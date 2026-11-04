const supported = /^(?:dotnet\s+(?:test|build)\b|npm\s+(?:test|run\s+(?:test|build)\b)|pnpm\s+(?:test|build)\b|yarn\s+(?:test|build)\b|pytest\b|python(?:3)?\s+-m\s+pytest\b|cargo\s+(?:test|build)\b|go\s+test\b|mvn\s+test\b|gradle\s+(?:test|build)\b)/i

/** Only recognize explicit build/test commands with a structured exit code. */
export function classifyVerification(tool, input, result) {
  if (!['bash','shell','powershell','exec_command'].includes(tool)) return undefined
  const command = typeof input?.command === 'string' ? input.command : typeof input?.cmd === 'string' ? input.cmd : ''
  // Do not infer success from arbitrary output text or chained commands.
  const trimmed = command.trim()
  if (/[;&|\n`]/.test(trimmed) || !supported.test(trimmed)) return undefined
  const meta = result?.metadata
  const code = meta?.exitCode ?? meta?.exit_code ?? result?.output?.exitCode
  if (!Number.isInteger(code) || code < 0) return undefined
  return {kind:/\b(?:build)\b/i.test(trimmed) ? 'build' : 'test', passed:code===0}
}

export function recordVerification(stats, decision, outcome) {
  if (!decision?.model?.providerID || !decision?.model?.id || !['simple','medium','complex'].includes(decision.tier)) return stats ?? {}
  if (!['test','build'].includes(outcome?.kind) || typeof outcome.passed !== 'boolean') return stats ?? {}
  const key = `${decision.tier}:${decision.model.providerID}/${decision.model.id}:${outcome.kind}`
  const old = stats?.[key] ?? {passed:0, failed:0}
  return {...stats,[key]:{
    passed:Math.min(100000,old.passed + Number(outcome.passed)),
    failed:Math.min(100000,old.failed + Number(!outcome.passed)),
  }}
}
