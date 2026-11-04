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

const valid = n => Number.isFinite(n) && n >= 0
const id = model => `${model.providerID}/${model.id}`

/** Combine manual ratings with verified test/build outcomes (verification/v1). */
export function mergeEvidence(feedbackStats, verificationStats) {
  const merged = {}
  for (const [key, value] of Object.entries(feedbackStats ?? {})) {
    if (valid(value?.positive) && valid(value?.negative)) merged[key] = {positive:value.positive, negative:value.negative}
  }
  for (const [key, value] of Object.entries(verificationStats ?? {})) {
    const base = key.replace(/:(?:test|build)$/, '')
    if (base === key || !valid(value?.passed) || !valid(value?.failed)) continue
    const old = merged[base] ?? {positive:0, negative:0}
    merged[base] = {positive:old.positive + value.passed, negative:old.negative + value.failed}
  }
  return merged
}

export function ratingCount(stats, tier, model) {
  const entry = stats?.[`${tier}:${id(model)}`]
  return entry && valid(entry.positive) && valid(entry.negative) ? entry.positive + entry.negative : 0
}

/** Beta(1,1) smoothing: avoid 100% certainty from a tiny sample. */
export function betaScore(stats, tier, model) {
  const entry = stats?.[`${tier}:${id(model)}`]
  return ((entry?.positive ?? 0) + 1) / (ratingCount(stats, tier, model) + 2)
}

export function chooseByFeedback(models, tier, stats, minimumRatings=3) {
  // Never let one rated model replace an otherwise unmeasured alternative.
  if (models.length < 2 || models.some(m => ratingCount(stats, tier, m) < minimumRatings)) return undefined
  return models.toSorted((a,b) =>
    betaScore(stats, tier, b) - betaScore(stats, tier, a) ||
    ratingCount(stats, tier, b) - ratingCount(stats, tier, a) ||
    id(a).localeCompare(id(b)))[0]
}

/**
 * Bounded ε-greedy exploration. Without it the baseline model is the only one
 * that ever gets rated and feedback could never take effect. Exploration starts
 * only after the baseline itself has enough evidence and stops once every
 * candidate has it, so unrated sessions stay deterministic.
 */
export function explore(models, tier, stats, baseline, {rate=0.1, random=Math.random, minimumRatings=3} = {}) {
  if (!baseline || models.length < 2 || !(rate > 0)) return undefined
  if (ratingCount(stats, tier, baseline) < minimumRatings) return undefined
  const underRated = models.filter(m => ratingCount(stats, tier, m) < minimumRatings)
  if (!underRated.length || random() >= rate) return undefined
  return underRated.toSorted((a,b) => ratingCount(stats, tier, a) - ratingCount(stats, tier, b))[0]
}
