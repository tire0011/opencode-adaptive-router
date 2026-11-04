import { chooseByFeedback } from './feedback.mjs'

const order = {simple:0, medium:1, complex:2}

/**
 * Optional, user-configured starting hypotheses for unpriced models:
 * `{ "provider/model": "simple" | "medium" | "complex" }`. Nothing is built in;
 * the plugin never ships a fixed task → model mapping.
 */
export function chooseByProfile(models, tier, stats, profiles = {}) {
  if (!(tier in order)) return undefined
  const profileOf = m => profiles?.[`${m.providerID}/${m.id}`]
  const matches = models.filter(m => profileOf(m) in order)
  // Never apply incomplete assumptions to a mixed/unknown inventory.
  if (matches.length !== models.length || matches.length === 0) return undefined
  // Only replace the starting profile after every alternative was evaluated.
  const evaluated = chooseByFeedback(matches, tier, stats)
  if (evaluated) return evaluated
  return matches.toSorted((a,b) => {
    const distance = m => Math.abs(order[profileOf(m)] - order[tier])
    return distance(a) - distance(b) || `${a.providerID}/${a.id}`.localeCompare(`${b.providerID}/${b.id}`)
  })[0]
}
