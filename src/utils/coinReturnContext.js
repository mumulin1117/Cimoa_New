export function coin_source_route(store, context_id) {
  const draft = store.current_drafts.find(row => row.draft_id === context_id && row.kind === 'introduction')
  if (!draft) return '/pages/profile/index'
  const context = store.introduction_context(draft.target_id, draft.draft_id)
  if (context.error || !context.audio) return '/pages/profile/index'
  return `/pages/discover/icebreaker/preview?user_id=${encodeURIComponent(draft.target_id)}&draft_id=${encodeURIComponent(draft.draft_id)}&media_id=${encodeURIComponent(context.audio.media_id)}`
}
export function coin_center_route(store, context_id) {
  return coin_source_route(store, context_id) === '/pages/profile/index' ? '/pages/coins/index' : `/pages/coins/index?return_context_id=${encodeURIComponent(context_id)}`
}
