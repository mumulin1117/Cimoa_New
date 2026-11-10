// Presentation only: progress never reads or mutates business data.
export const REFRESH_ORBIT_PATH = 'M38 23C31 13 24 10 17 14C7 20 9 32 19 33C27 34 33 27 38 23C43 19 49 12 57 13C67 14 69 26 59 32C52 36 45 33 38 23'
export const REFRESH_ORBIT_REVERSE = 'M38 23C45 33 52 36 59 32C69 26 67 14 57 13C49 12 43 19 38 23C33 27 27 34 19 33C9 32 7 20 17 14C24 10 31 13 38 23'
export function refresh_orbit_presentation(progress, refreshing = false) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const eased = value * value * (3 - 2 * value)
  const bend = Math.sin(value * Math.PI) * 4
  const state = refreshing ? 'refreshing' : value >= 1 ? 'ready' : value > 0 ? 'pulling' : 'idle'
  return {
    progress: value, state,
    label: refreshing ? 'Refreshing your connections…' : state === 'ready' ? 'Release to refresh' : 'Pull to refresh',
    cyan: { x: 12 + 23 * eased, y: 23 + bend },
    pink: { x: 64 - 23 * eased, y: 23 - bend },
    track_opacity: refreshing ? 1 : eased,
    dash_offset: 100 * (1 - eased),
  }
}
