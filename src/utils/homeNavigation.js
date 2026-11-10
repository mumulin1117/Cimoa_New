// Entity validation lives next to the Store, never in a card-local business copy.
export function home_destination(store, kind, id) {
  const feed = store.home_feed
  if (['loading', 'error'].includes(feed.status)) throw new Error('Your connections are unavailable. Please try again.')
  if (feed.status === 'session_expired') throw new Error('Your session has expired. Please sign in again.')
  if (['profile', 'match', 'discover'].includes(kind)) return feed.destinations[kind]
  if (kind === 'card') {
    const card = feed.cards.find(row => row.user_id === id)
    if (!card) throw new Error('This connection is no longer available.')
    if (card.destination) return card.destination
    throw new Error(card.unavailable_reason || 'This invitation or match is no longer available. Please check your latest connections.')
  }
  if (kind === 'status') {
    if (!feed.match_card) throw new Error('This match is no longer active.')
    return feed.match_card.destination
  }
  throw new Error('This page is unavailable.')
}

// Stage 5.2: no fake target screen or old mega-page can satisfy a deferred dependency.
export const HOME_DEFERRED_ROUTES = Object.freeze([
])
export function require_home_destination_ready(url) {
  if (HOME_DEFERRED_ROUTES.includes(url.split('?')[0])) throw new Error('This page is currently unavailable. Your connections and coins have not changed.')
  return url
}
