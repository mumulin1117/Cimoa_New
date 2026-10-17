export function discover_destination(store, kind, id) {
  if (store.hydration_status !== 'ready') throw new Error('Saved data is unavailable. Please retry loading it.')
  if (!store.session.is_authenticated) throw new Error('Your session has expired. Please sign in again.')
  if (kind === 'profile') return '/pages/profile/index'
  if (kind === 'preferences') return '/pages/auto-match/preferences'
  if (kind === 'primary') {
    const context = store.introduction_context(id)
    if (context.error || context.primary?.error || !context.primary?.destination) throw new Error(context.error || context.primary?.error || 'This profile is no longer available.')
    return context.primary.destination
  }
  if (kind === 'chat') {
    if (!id || !store.user_by_id(id)) throw new Error('This profile is no longer available.')
    const conversation = store.current_conversations.find((row) => row.participant_id === id)
    if (!conversation || !store.can_chat(id)) throw new Error('This conversation is no longer available.')
    return `/pages/messages/chat?conversation_id=${encodeURIComponent(conversation.conversation_id)}`
  }
  if (kind === 'icebreaker') {
    if (!id || !store.user_by_id(id)) throw new Error('This profile is no longer available.')
    const blocker = store.introduction_blocker(id)
    if (blocker) throw new Error(blocker)
    return `/pages/discover/icebreaker/select?user_id=${encodeURIComponent(id)}`
  }
  if (!id || !store.discover_people.some((person) => person.user_id === id)) throw new Error('This profile is no longer available.')
  if (kind === 'detail') return `/pages/discover/profile?user_id=${encodeURIComponent(id)}`
  throw new Error('This page is unavailable.')
}

// Remove individual guards only after the corresponding Stage 5 page is restored.
export const DISCOVER_DEFERRED_ROUTES = Object.freeze([
])
export function require_discover_destination_ready(url) {
  if (DISCOVER_DEFERRED_ROUTES.includes(url.split('?')[0])) throw new Error('This destination has not been restored yet. Your requests and coins have not changed.')
  return url
}
