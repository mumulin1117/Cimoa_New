// Entity validation lives next to the Store, never in a card-local business copy.
export function home_destination(store, kind, id) {
  if (store.hydration_status !== 'ready') throw new Error('Saved data is unavailable. Please retry loading your connections.')
  if (!store.session.is_authenticated) throw new Error('Your session has expired. Please sign in again.')
  if (kind === 'profile') return '/pages/profile/index'
  if (kind === 'match') return '/pages/auto-match/index'
  if (kind === 'discover') return '/pages/discover/index'
  const card = store.home_connections.find((row) => row.user_id === id)
  if (kind === 'card') {
    if (!card) throw new Error('This connection is no longer available.')
    if (card.kind === 'connected' && store.can_chat(id) && store.current_conversations.some((row) => row.conversation_id === card.conversation_id)) return `/pages/messages/chat?conversation_id=${encodeURIComponent(card.conversation_id)}`
    if (card.kind === 'invite' && store.request_by_id(card.request_id)?.status === 'pending') return `/pages/connections/received?request_id=${encodeURIComponent(card.request_id)}`
    if (card.kind === 'auto_match' && store.match_by_id(card.match_id)?.status === 'found') return `/pages/auto-match/found?match_id=${encodeURIComponent(card.match_id)}`
    throw new Error('This invitation or match is no longer available. Please check your latest connections.')
  }
  if (kind === 'status') {
    const match = store.active_match
    if (!match || !['searching', 'paused', 'found', 'waiting'].includes(match.status)) throw new Error('This match is no longer active.')
    return `/pages/auto-match/${match.status}?match_id=${encodeURIComponent(match.match_id)}`
  }
  throw new Error('This page is unavailable.')
}

// Stage 5.2: no fake target screen or old mega-page can satisfy a deferred dependency.
export const HOME_DEFERRED_ROUTES = Object.freeze([
  '/pages/profile/index', '/pages/messages/chat', '/pages/connections/received',
  '/pages/auto-match/index', '/pages/auto-match/searching', '/pages/auto-match/paused', '/pages/auto-match/found', '/pages/auto-match/waiting',
])
export function require_home_destination_ready(url) {
  if (HOME_DEFERRED_ROUTES.includes(url.split('?')[0])) throw new Error('This destination has not been restored yet. Your connections and coins have not changed.')
  return url
}
