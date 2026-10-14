export function events_destination(store, kind, id) {
  if (store.hydration_status !== 'ready') throw new Error('Saved data is unavailable. Please retry loading it.')
  if (!store.session.is_authenticated) throw new Error('Your session has expired. Please sign in again.')
  if (kind === 'profile') return '/pages/profile/index'
  if (kind === 'upcoming') return '/pages/events/upcoming'
  const event = store.event_by_id(id)
  if (!event) throw new Error('This event is no longer available.')
  if (!['detail', 'participants', 'group', 'join-success'].includes(kind)) throw new Error('This page is unavailable.')
  if (['group', 'join-success'].includes(kind) && !event.joined) throw new Error('Join this event before opening this page.')
  if (kind === 'group' && !event.conversation_id) throw new Error('The event group is unavailable.')
  return `/pages/events/${kind}?event_id=${encodeURIComponent(id)}` + (kind === 'group' ? `&conversation_id=${encodeURIComponent(event.conversation_id)}` : '')
}
// Per-target gates are removed only when their own Stage 5 restoration is complete.
export const EVENTS_DEFERRED_ROUTES = Object.freeze(['group'].map(key => `/pages/events/${key}`))
export function require_events_destination_ready(url) {
  if (EVENTS_DEFERRED_ROUTES.includes(url.split('?')[0])) throw new Error('This destination has not been restored yet.')
  return url
}
export function previous_event_is_detail(id, pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []) {
  const previous = pages.at(-2)
  return previous?.route === 'pages/events/detail' && (previous.options || previous.$page?.options)?.event_id === id
}
