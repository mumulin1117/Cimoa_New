export function discover_destination(store, kind, id) {
  if (store.hydration_status !== 'ready') throw new Error('Saved data is unavailable. Please retry loading it.')
  if (!store.session.is_authenticated) throw new Error('Your session has expired. Please sign in again.')
  if (kind === 'profile') return '/pages/profile/index'
  if (kind === 'preferences') return '/pages/auto-match/preferences'
  if (!id || store.discover_person?.user_id !== id) throw new Error('This profile is no longer available.')
  if (kind === 'detail') return `/pages/discover/profile?user_id=${encodeURIComponent(id)}`
  if (kind === 'icebreaker') {
    const blocker = store.introduction_blocker(id)
    if (blocker) throw new Error(blocker)
    return `/pages/discover/icebreaker/select?user_id=${encodeURIComponent(id)}`
  }
  throw new Error('This page is unavailable.')
}

// Remove individual guards only after the corresponding Stage 5 page is restored.
export const DISCOVER_DEFERRED_ROUTES = Object.freeze([
  '/pages/auto-match/preferences',
  '/pages/discover/icebreaker/select',
])
export function require_discover_destination_ready(url) {
  if (DISCOVER_DEFERRED_ROUTES.includes(url.split('?')[0])) throw new Error('This destination has not been restored yet. Your requests and coins have not changed.')
  return url
}
