import { Model, Plugin, Provider } from '@opencode/plugin'
import { selectModel } from './selector.mjs'
import { AUTO_MODEL, AUTO_PROVIDER, autoMode, isAutoModel } from './auto-state.mjs'
import { classifyTask } from './classifier.mjs'
import { recordFeedback } from './feedback.mjs'
import { recordTransport } from './telemetry.mjs'
import { classifyVerification, recordVerification } from './outcomes.mjs'

/** OpenCode v2 proof of concept. The native plugin API requires a live smoke test. */
export default Plugin.define({
  id: 'adaptive-router',
  async setup(ctx) {
    // A virtual provider is shown by /models. It must NEVER receive a request:
    // the prompt hook replaces it with a real, eligible model or rejects admission.
    const virtualProviderID = Provider.ID.make(AUTO_PROVIDER)
    await ctx.provider.transform((editor) => {
      editor.add({
        info: {
          ...Provider.Info.empty(virtualProviderID),
          name: 'Adaptive Router',
          activation: 'enabled',
          package: '@opencode/ai/providers/openai-compatible',
          settings: { baseURL: 'http://127.0.0.1:9/v1' },
        },
        models: [{
          ...Model.Info.default(virtualProviderID, Model.ID.make(AUTO_MODEL)),
          name: 'Auto (Adaptive Router)',
        }],
      })
    })
    // Cross-provider routing is intentionally disabled by default because merely
    // connecting a provider does not authorize sending every project's code to it.
    const allowedProviders = Array.isArray(ctx.options.allowedProviders)
      ? ctx.options.allowedProviders.filter((value): value is string => typeof value === 'string')
      : []
    const crossProvider = ctx.options.crossProvider === true && allowedProviders.length > 0
    let verificationWrite = Promise.resolve()
    await ctx.tool.hook('execute.after', async (event) => {
      if (event.status !== 'completed') return
      const outcome = classifyVerification(event.tool, event.input, event.result)
      if (!outcome) return
      const decision = await ctx.storage.get(`decision/${event.sessionID}`)
      if (!decision || typeof decision !== 'object') return
      verificationWrite = verificationWrite.then(async () => {
        const stats = await ctx.storage.get('verification/v1')
        await ctx.storage.set('verification/v1', recordVerification(stats, decision, outcome))
      }).catch(error => console.warn('[adaptive-router] verification stats unavailable', error))
      await verificationWrite
    })
    // Request timings are ephemeral; persist only aggregated status/latency counts.
    const started = new WeakMap<Request, number>()
    let telemetryWrite = Promise.resolve()
    await ctx.session.hook('http.request', (event) => {
      if (event.kind === 'primary') started.set(event.request, Date.now())
    })
    await ctx.session.hook('http.response', async (event) => {
      if (event.kind !== 'primary') return
      const start = started.get(event.request)
      started.delete(event.request)
      // Capture only Auto-selected requests; do not instrument manual traffic.
      const decision = await ctx.storage.get(`decision/${event.sessionID}`)
      if (!decision || typeof decision !== 'object') return
      const model = event.model as {providerID:string; id:string}
      const selected = (decision as {model?:{providerID:string;id:string}}).model
      if (!selected || selected.providerID !== model.providerID || selected.id !== model.id) return
      telemetryWrite = telemetryWrite.then(async () => {
        const stats = await ctx.storage.get('transport/v1')
        await ctx.storage.set('transport/v1', recordTransport(stats, model, event.response.status, start === undefined ? NaN : Date.now() - start))
      }).catch(error => console.warn('[adaptive-router] transport stats unavailable', error))
      await telemetryWrite
    })

    await ctx.command.transform((editor) => {
      for (const [name, positive] of [['adaptive-rate-good', true], ['adaptive-rate-bad', false]] as const) {
        editor.add({
          name,
          description: positive ? 'Mark last Auto answer useful (local feedback)' : 'Mark last Auto answer unhelpful (local feedback)',
          execute: async ({sessionID}) => {
            const key = `decision/${sessionID}`
            const decision = await ctx.storage.get(key)
            if (!decision || typeof decision !== 'object') return
            const stats = await ctx.storage.get('stats/v1')
            await ctx.storage.set('stats/v1', recordFeedback(stats, decision, positive))
            await ctx.storage.remove(key) // Consume once; never count repeated votes.
            console.info(`[adaptive-router] feedback ${positive ? 'good' : 'bad'} stored locally`)
          },
        })
      }
      editor.add({
        name: 'adaptive-auto-on',
        description: 'Enable local adaptive selection for this session',
        execute: async ({ sessionID }) => {
          await ctx.storage.set(`auto/${sessionID}`, true)
          console.info('[adaptive-router] enabled for session', sessionID)
        },
      })
      editor.add({
        name: 'adaptive-auto-off',
        description: 'Disable local adaptive selection for this session',
        execute: async ({ sessionID }) => {
          await ctx.storage.remove(`auto/${sessionID}`)
          await ctx.storage.remove(`decision/${sessionID}`)
          console.info('[adaptive-router] disabled for session', sessionID)
        },
      })
    })

    await ctx.session.hook('prompt', async (event) => {
      const session = await ctx.session.get({ sessionID: event.sessionID })
      const current = (session as unknown as { model?: { providerID?: string; id?: string } }).model
      const saved = await ctx.storage.get(`auto/${event.sessionID}`)
      const state = typeof saved === 'object' && saved !== null
        ? saved as { enabled?: boolean; lastSelected?: { providerID: string; id: string } }
        : saved === true ? { enabled: true } : undefined
      const mode = autoMode(current, state)
      if (mode === 'stop') {
        await ctx.storage.remove(`auto/${event.sessionID}`)
        await ctx.storage.remove(`decision/${event.sessionID}`)
        return
      }
      if (mode === 'off') return

      // Model.Info is produced by OpenCode's active-model registry, not by
      // a manually maintained provider/model mapping.
      const listed = await ctx.model.list()
      const models = Array.isArray(listed) ? listed : listed.data
      const defaultProvider = (await ctx.model.default())?.data?.providerID
      const providerID = current?.providerID && !isAutoModel(current)
        ? current.providerID
        : state?.lastSelected?.providerID ?? (defaultProvider !== AUTO_PROVIDER ? defaultProvider : undefined)
      if (!providerID && !crossProvider) {
        throw new Error('[adaptive-router] No trusted base provider for Auto; select a real model first or configure allowedProviders')
      }
      const classified = classifyTask(event.prompt.text)
      const stats = await ctx.storage.get('stats/v1')
      const transportStats = await ctx.storage.get('transport/v1')
      const attachments = event.prompt.files ?? []
      const requiresImage = attachments.some(attachment => /\.(?:png|jpe?g|webp|gif|bmp)$/i.test(attachment.name ?? attachment.uri))
      const selected = selectModel(models, {
        currentProvider: providerID,
        crossProvider,
        allowedProviders,
        taskTier: classified.tier,
        feedbackStats: stats,
        transportStats,
        requiresImage,
      })

      // Fail safe: leave the currently selected model untouched.
      if (!selected) {
        if (isAutoModel(current)) throw new Error('[adaptive-router] Auto has no eligible real model; request blocked')
        console.warn('[adaptive-router] no eligible models; keeping current selection')
        return
      }
      await ctx.session.switchModel({
        sessionID: event.sessionID,
        model: { providerID: selected.providerID, id: selected.id },
      })
      await ctx.storage.set(`auto/${event.sessionID}`, {
        enabled: true,
        lastSelected: { providerID: selected.providerID, id: selected.id },
      })
      // Store only tier and model ID. Never retain user prompt or source code.
      await ctx.storage.set(`decision/${event.sessionID}`, {
        tier: classified.tier,
        model: {providerID:selected.providerID, id:selected.id},
      })
      console.info(`[adaptive-router] selected ${selected.providerID}/${selected.id}`)
    })
  },
})
