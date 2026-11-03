// Initial, low-confidence routing hypotheses, NOT comparable benchmark scores.
// Siemens deployments may differ from the upstream models and their published evals.
// Source model cards are documented in README.md.
export const MODEL_PROFILES = Object.freeze({
  'siemens/ministral-3-14b-instruct-2512': {tier: 'simple', tools: true},
  'siemens/qwen-3.8-27b': {tier: 'medium', tools: true},
  'siemens/deepseek-v4.1-flash': {tier: 'complex', tools: true},
});

export function chooseByProfile(models, tier, stats) {
  if (!['simple', 'medium', 'complex'].includes(tier)) return undefined;
  const matches = models.filter(m => MODEL_PROFILES[`${m.providerID}/${m.id}`]);
  // Never apply incomplete public assumptions to a mixed/unknown inventory.
  if (matches.length !== models.length || matches.length < 2) return undefined;
  const feedback = matches.map(m => {
    const value = stats?.[`${tier}:${m.providerID}/${m.id}`];
    return value && Number.isFinite(value.positive) && Number.isFinite(value.negative)
      && value.positive >= 0 && value.negative >= 0 && value.positive + value.negative >= 3;
  });
  // Only replace the starting profile after every alternative was evaluated.
  if (feedback.every(Boolean)) {
    return matches.toSorted((a,b) => {
      const value = m => stats[`${tier}:${m.providerID}/${m.id}`];
      const score = m => (value(m).positive + 1) / (value(m).positive + value(m).negative + 2);
      return score(b) - score(a) || `${a.providerID}/${a.id}`.localeCompare(`${b.providerID}/${b.id}`);
    })[0];
  }
  const target = {simple:0, medium:1, complex:2}[tier];
  const order = {simple:0, medium:1, complex:2};
  return matches.toSorted((a,b) => {
    const distance = m => Math.abs(order[MODEL_PROFILES[`${m.providerID}/${m.id}`].tier] - target);
    return distance(a) - distance(b) || `${a.providerID}/${a.id}`.localeCompare(`${b.providerID}/${b.id}`);
  })[0];
}
