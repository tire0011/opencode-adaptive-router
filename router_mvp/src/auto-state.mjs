export const AUTO_PROVIDER = 'adaptive-router'
export const AUTO_MODEL = 'auto'

export function isAutoModel(model) {
  return model?.providerID === AUTO_PROVIDER && (model?.id ?? model?.modelID) === AUTO_MODEL
}

/** Decide whether a user-selected model change should stop automatic routing. */
export function autoMode(current, saved) {
  if (isAutoModel(current)) return 'start'
  if (!current && saved?.enabled) return 'continue'
  if (saved?.enabled && !saved.lastSelected) return 'continue'
  if (saved?.enabled && saved.lastSelected && sameModel(current, saved.lastSelected)) return 'continue'
  if (saved?.enabled && current) return 'stop'
  return 'off'
}

function sameModel(a, b) {
  return a?.providerID === b?.providerID && (a?.id ?? a?.modelID) === (b?.id ?? b?.modelID)
}
