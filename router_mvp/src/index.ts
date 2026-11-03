import { Plugin } from '@opencode/plugin'
import { selectModel } from './selector.mjs'

/** OpenCode v2 proof of concept. The native plugin API requires a live smoke test. */
export default Plugin.define({
  id: 'adaptive-router',
  async setup(ctx) {
    // Cross-provider routing is intentionally disabled by default because merely
    // connecting a provider does not authorize sending every project's code to it.
    const allowedProviders = Array.isArray(ctx.options.allowedProviders)
      ? ctx.options.allowedProviders.filter((value): value is string => typeof value === 'string')
      : []
    const crossProvider = ctx.options.crossProvider === true && allowedProviders.length > 0

    await ctx.command.transform((editor) => {
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
          console.info('[adaptive-router] disabled for session', sessionID)
        },
      })
    })

    await ctx.session.hook('prompt', async (event) => {
      if (await ctx.storage.get(`auto/${event.sessionID}`) !== true) return

      // Model.Info is produced by OpenCode's active-model registry, not by
      // a manually maintained provider/model mapping.
      const listed = await ctx.model.list()
      const models = Array.isArray(listed) ? listed : listed.data
      const session = await ctx.session.get({ sessionID: event.sessionID })
      const current = (session as unknown as { model?: { providerID?: string } }).model
      const providerID = current?.providerID ?? (await ctx.model.default())?.data?.providerID
      const selected = selectModel(models, {
        currentProvider: providerID,
        crossProvider,
        allowedProviders,
      })

      // Fail safe: leave the currently selected model untouched.
      if (!selected) {
        console.warn('[adaptive-router] no eligible models; keeping current selection')
        return
      }
      await ctx.session.switchModel({
        sessionID: event.sessionID,
        model: { providerID: selected.providerID, id: selected.id },
      })
      console.info(`[adaptive-router] selected ${selected.providerID}/${selected.id}`)
    })
  },
})
