import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import './fake-provider.mjs'

const cli = new URL('../node_modules/.bin/opencode', import.meta.url).pathname
const cwd = new URL('.', import.meta.url).pathname
const env = { ...process.env, OPENCODE_CONFIG: new URL('./opencode.jsonc', import.meta.url).pathname, MOCK_API_KEY:'test' }

async function run(args, alternateConfig) {
  const proc = spawn(cli, ['run', '--standalone', ...args, 'say fake ok'], {cwd, env:alternateConfig ? {...env, OPENCODE_CONFIG: new URL('./opencode-no-eligible.jsonc', import.meta.url).pathname} : env, stdio:['ignore','pipe','pipe']})
  let stdout = '', stderr = ''
  proc.stdout.on('data', chunk => stdout += chunk)
  proc.stderr.on('data', chunk => stderr += chunk)
  const code = await Promise.race([
    new Promise(resolve => proc.once('exit', resolve)),
    delay(25000).then(() => {proc.kill(); return 'timeout'}),
  ])
  console.log('[cli]', args.join(' '), 'exit=', code, 'stdout=', stdout.trim(), 'stderr=', stderr.slice(-350))
  return {code, stdout, stderr}
}

async function models() {
  return (await (await fetch('http://127.0.0.1:18083/requests')).json()).models
}

async function verify(label, args, expected) {
  const before = (await models()).length
  const response = await run(args)
  const selected = (await models()).slice(before)
  assert.equal(response.code, 0, `${label}: CLI failed`)
  assert.match(response.stdout, /fake ok/, `${label}: missing response`)
  assert(selected.length > 0, `${label}: no provider request`)
  assert(selected.every(model => model === expected), `${label}: expected ${expected}, observed ${selected}`)
  console.log(`[PASS] ${label}: ${selected.join(', ')}`)
}

try {
  await verify('Auto picks cheapest tool-capable model', ['--model','adaptive-router/auto'], 'ultra')
  await verify('Default without Auto stays unchanged', [], 'pricey')
  await verify('Explicit manual selection wins', ['--model','mock/cheap'], 'cheap')
  const session = `ses_e2erouter${Date.now().toString(36)}000`
  await verify('Session Auto initially chooses cheapest', ['--session',session,'--model','adaptive-router/auto'], 'ultra')
  await verify('Manual switch in same session', ['--session',session,'--model','mock/pricey'], 'pricey')
  await verify('Manual switch remains active next prompt', ['--session',session], 'pricey')

  const before = (await models()).length
  const failClosed = await run(['--model','adaptive-router/auto'], true)
  const after = (await models()).length
  assert.equal(after, before, 'No-eligible Auto request must not reach fake provider')
  assert(!failClosed.stdout.includes('fake ok'), 'No-eligible Auto request unexpectedly succeeded')
  console.log('[PASS] Auto with no tool-capable model fails closed')
  console.log('[e2e] PASS')
} catch (error) {
  console.error('[e2e] FAIL', error)
  process.exitCode = 1
} finally {
  process.exit()
}
