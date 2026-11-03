import { chooseByFeedback } from './feedback.mjs'

export function selectModel(models, options = {}) {
  const {
    currentProvider,
    crossProvider = false,
    allowedProviders = [],
    requiredContext = 0,
    requiresImage = false,
    taskTier = 'simple',
    feedbackStats,
  } = options;
  const allowed = new Set(allowedProviders);
  const eligible = models.filter((model) => {
    if (!model || !model.providerID || !model.id) return false;
    if (model.providerID === 'adaptive-router') return false;
    if (model.enabled === false || model.status === 'deprecated') return false;
    if (model.capabilities?.tools === false) return false;
    if (requiresImage && !model.capabilities?.input?.includes('image')) return false;
    if (requiredContext > 0 && (model.limit?.context ?? 0) < requiredContext) return false;
    if (crossProvider) {
      // Cross-provider routing is only possible for an explicit, non-empty set.
      if (!allowed.size || !allowed.has(model.providerID)) return false;
    } else if (currentProvider && model.providerID !== currentProvider) return false;
    return true;
  });
  if (!eligible.length) return undefined;
  const cost = (m) => {
    const tiers = Array.isArray(m.cost) ? m.cost : [];
    const first = tiers[0];
    return typeof first?.input === 'number' && typeof first?.output === 'number'
      ? first.input + 2 * first.output : Number.POSITIVE_INFINITY;
  };
  // Unknown-cost candidates do not outrank priced candidates. If all prices
  // are unknown, the caller should preserve its selected model instead.
  if (!eligible.some((m) => Number.isFinite(cost(m)))) return undefined;
  const ranked = eligible.toSorted((a, b) =>
    cost(a) - cost(b) ||
    (b.limit?.context ?? 0) - (a.limit?.context ?? 0) ||
    `${a.providerID}/${a.id}`.localeCompare(`${b.providerID}/${b.id}`)
  );
  // Price is only a provisional capacity proxy, not proof of model quality.
  // Unknown-price candidates remain excluded from automatic escalation.
  const priced = ranked.filter(m => Number.isFinite(cost(m)));
  const evaluated = chooseByFeedback(priced, taskTier, feedbackStats);
  if (evaluated) return evaluated;
  if (taskTier === 'complex') return priced.at(-1);
  if (taskTier === 'medium') return priced[Math.floor((priced.length - 1) / 2)];
  return priced[0];
}
