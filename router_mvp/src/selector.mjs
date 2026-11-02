export function selectModel(models, options = {}) {
  const { currentProvider, crossProvider = false } = options;
  const eligible = models.filter((model) => {
    if (!model || !model.providerID || !model.id) return false;
    if (model.enabled === false || model.status === 'deprecated') return false;
    if (model.capabilities?.tools === false) return false;
    if (!crossProvider && currentProvider && model.providerID !== currentProvider) return false;
    return true;
  });
  if (!eligible.length) return undefined;
  const cost = (m) => {
    const tiers = Array.isArray(m.cost) ? m.cost : [];
    const first = tiers[0];
    return typeof first?.input === 'number' && typeof first?.output === 'number'
      ? first.input + 2 * first.output : Number.POSITIVE_INFINITY;
  };
  return eligible.toSorted((a, b) =>
    cost(a) - cost(b) ||
    (b.limit?.context ?? 0) - (a.limit?.context ?? 0) ||
    `${a.providerID}/${a.id}`.localeCompare(`${b.providerID}/${b.id}`)
  )[0];
}
