import { appendFile } from 'node:fs/promises'

/** Opt-in local JSONL diagnostics. Only explicit metadata passed by callers. */
export async function debugLog(event, fields = {}, path = process.env.ADAPTIVE_ROUTER_DEBUG_LOG) {
  if (!path) return
  try {
    await appendFile(path, JSON.stringify({at: new Date().toISOString(), event, ...fields}) + '\n', 'utf8')
  } catch {
    console.warn('[adaptive-router] cannot write debug log')
  }
}
