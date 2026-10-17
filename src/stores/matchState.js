// Read-only deadlines: navigation, refresh and ticking never write a business event.
export function effective_match_status(row, now) {
  if (!row) return 'idle'
  const status = row.engine === 'device' && row.status === 'searching' && now >= row.search_ready_at ? row.candidate_id ? 'found' : 'no_match' : row.status
  return status === 'found' && Number.isFinite(row.expires_at) && now >= row.expires_at ? 'expired' : status
}
export function match_route(row) {
  if (!row) return '/pages/auto-match/index'
  const page = row.status === 'no_match' ? 'no-match' : row.status === 'left' ? 'index' : row.status
  return `/pages/auto-match/${page}${page === 'index' ? '' : `?match_id=${encodeURIComponent(row.match_id)}`}`
}
export function apply_priority(row, now) {
  row.priority_until = now + 900000
  if (row.engine !== 'device') return
  if (row.status === 'paused') row.search_remaining_ms = Math.min(row.search_remaining_ms ?? Math.max(0,row.search_ready_at-row.paused_at), 5000)
  else {
    row.search_ready_at = now + Math.min(Math.max(0, row.search_ready_at - now), 5000)
    row.expires_at = row.candidate_id ? row.search_ready_at + 45000 : null
  }
}
