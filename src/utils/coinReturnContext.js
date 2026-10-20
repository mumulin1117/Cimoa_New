export function coin_source_route(store, context_id) {
  const match=store.current_drafts.find(row=>row.draft_id===context_id&&row.kind==='match_return')
  if(match){if(match.payload.kind==='match_entry')return '/pages/auto-match/index';return store.matching_context(match.payload.match_id).route||'/pages/auto-match/index'}
  const draft = store.current_drafts.find(row => row.draft_id === context_id && row.kind === 'introduction')
  if (!draft) return '/pages/profile/index'
  const context = store.introduction_context(draft.target_id, draft.draft_id)
  if (context.error || context.blocker || draft.payload.completed_request_id) return '/pages/profile/index'
  if (draft.payload.mode === 'text' && draft.payload.text?.trim()) return `/pages/discover/icebreaker/text?user_id=${encodeURIComponent(draft.target_id)}&draft_id=${encodeURIComponent(draft.draft_id)}`
  if (draft.payload.mode !== 'voice' || !context.audio) return '/pages/profile/index'
  return `/pages/discover/icebreaker/preview?user_id=${encodeURIComponent(draft.target_id)}&draft_id=${encodeURIComponent(draft.draft_id)}&media_id=${encodeURIComponent(context.audio.media_id)}`
}
export function coin_center_route(store, context_id) {
  return coin_source_route(store, context_id) === '/pages/profile/index' ? '/pages/coins/index' : `/pages/coins/index?return_context_id=${encodeURIComponent(context_id)}`
}
export function coin_child_route(store, route, context_id) {
  if (!route.startsWith('/pages/coins/') || coin_source_route(store, context_id) === '/pages/profile/index') return route
  const [path, query = ''] = route.split('?'), params = new URLSearchParams(query)
  params.set('return_context_id', context_id)
  return `${path}?${params.toString()}`
}
