// Geometry only; reading position is transient UI state, never business storage.
export function chat_near_bottom(metrics, threshold) {
  if (!metrics || !['scrollTop', 'scrollHeight', 'height'].every(key => Number.isFinite(metrics[key])) || metrics.height <= 0) return null
  return metrics.scrollHeight - Math.max(0, metrics.scrollTop) - metrics.height <= threshold
}
