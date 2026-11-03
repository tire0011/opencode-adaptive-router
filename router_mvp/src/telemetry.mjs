/** Bounded local transport telemetry. A 2xx status is NOT a task success. */
export function recordTransport(stats, model, status, latencyMs) {
  if (!model?.providerID || !model?.id || !Number.isInteger(status)) return stats ?? {}
  if (status < 100 || status > 599) return stats ?? {}
  const key = `${model.providerID}/${model.id}`
  const old = stats?.[key] ?? {responses:0, httpErrors:0, latencySumMs:0}
  if (old.responses >= 100000) return stats
  return {...stats, [key]: {
    responses: old.responses + 1,
    httpErrors: old.httpErrors + Number(status >= 400),
    latencySumMs: old.latencySumMs + Math.min(600000, Math.max(0, Number.isFinite(latencyMs) ? latencyMs : 0)),
  }}
}
