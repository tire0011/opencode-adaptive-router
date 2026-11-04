import { chooseByFeedback, explore, mergeEvidence } from './feedback.mjs'
import { chooseByProfile } from './performance-profiles.mjs'

export function selectModel(models, options = {}) {
  const {
    currentProvider,
    crossProvider = false,
    allowedProviders = [],
    allowedModels = [],
    requiredContext = 0,
    requiresImage = false,
    taskTier = 'simple',
    feedbackStats,
    verificationStats,
    transportStats,
    fallbackModel,
    modelProfiles,
    exploration = 0.1,
    random = Math.random,
  } = options;
  // Manual ratings and verified test/build outcomes both count as evidence.
  const evidence = mergeEvidence(feedbackStats, verificationStats);
  const exploreOr = (pool, baseline) =>
    explore(pool, taskTier, evidence, baseline, {rate: exploration, random}) ?? baseline;
  const allowed = new Set(allowedProviders);
  const modelAllowlist = new Set(allowedModels);
  const eligible = models.filter((model) => {
    if (!model || !model.providerID || !model.id) return false;
    if (model.providerID === 'adaptive-router') return false;
    if (modelAllowlist.size > 0 && !modelAllowlist.has(`${model.providerID}/${model.id}`)) return false;
    if (model.enabled === false || model.status === 'deprecated') return false;
    // Tool execution is mandatory: fail closed on explicit denial or unknown
    // capabilities. Some provider configs expose the alias `toolcall`.
    if (model.capabilities?.tools === false || model.capabilities?.toolcall === false ||
        (model.capabilities?.tools !== true && model.capabilities?.toolcall !== true)) return false;
    const health = transportStats?.[`${model.providerID}/${model.id}`];
    // Only exclude repeatedly failing transport, not models with one transient error.
    if (health?.responses >= 3 && health.httpErrors / health.responses >= 0.5 &&
        typeof health.lastErrorAt === 'number' && Date.now() - health.lastErrorAt < 300000) return false;
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
  if (!eligible.some((m) => Number.isFinite(cost(m)))) {
    const profiled = chooseByProfile(eligible, taskTier, evidence, modelProfiles);
    if (profiled) return exploreOr(eligible, profiled);
    // The trusted configured default is permitted only after all safety filters.
    return eligible.find(m => m.providerID === fallbackModel?.providerID && m.id === (fallbackModel?.id ?? fallbackModel?.modelID));
  }
  const ranked = eligible.toSorted((a, b) =>
    cost(a) - cost(b) ||
    (b.limit?.context ?? 0) - (a.limit?.context ?? 0) ||
    `${a.providerID}/${a.id}`.localeCompare(`${b.providerID}/${b.id}`)
  );
  // Price is only a provisional capacity proxy, not proof of model quality.
  // Unknown-price candidates remain excluded from automatic escalation.
  const priced = ranked.filter(m => Number.isFinite(cost(m)));
  const evaluated = chooseByFeedback(priced, taskTier, evidence);
  if (evaluated) return evaluated;
  // The upper tier is bounded by the mandatory allowedModels list in the plugin;
  // the selector never reaches beyond what was explicitly approved.
  const baseline = taskTier === 'complex' ? priced.at(-1)
    : taskTier === 'medium' ? priced[Math.floor((priced.length - 1) / 2)]
    : priced[0];
  return exploreOr(priced, baseline);
}
