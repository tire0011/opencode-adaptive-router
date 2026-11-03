/** Manual evaluation only: successful HTTP responses are not proof of correctness. */
export function recordFeedback(stats, decision, positive) {
  if (!decision?.model?.providerID || !decision?.model?.id || !['simple','medium','complex'].includes(decision.tier)) return stats ?? {}
  const key = `${decision.tier}:${decision.model.providerID}/${decision.model.id}`
  const old = stats?.[key] ?? {positive:0, negative:0}
  const next = {
    positive: Math.min(100000, Math.max(0, old.positive) + Number(Boolean(positive))),
    negative: Math.min(100000, Math.max(0, old.negative) + Number(!positive)),
  }
  return {...stats, [key]: next}
}

export function chooseByFeedback(models, tier, stats, minimumRatings=3) {
  const candidates = models.map(model => {
    const entry = stats?.[`${tier}:${model.providerID}/${model.id}`]
    if (!entry) return undefined
    const count = entry.positive + entry.negative
    if (count < minimumRatings) return undefined
    // Beta(1,1) smoothing: avoid 100% certainty from a tiny sample.
    return {model, count, score:(entry.positive + 1) / (count + 2)}
  }).filter(Boolean)
  // Never let one rated model replace an otherwise unmeasured alternative.
  if (candidates.length !== models.length || candidates.length < 2) return undefined
  return candidates.toSorted((a,b) => b.score - a.score || b.count - a.count || `${a.model.providerID}/${a.model.id}`.localeCompare(`${b.model.providerID}/${b.model.id}`))[0]?.model
}
