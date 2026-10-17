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
  const previous_until=row.priority_until
  row.priority_until = now + 900000
  if (row.engine !== 'device') return
  if (row.status === 'paused') {
    const remaining=previous_until<=now&&row.standard_search_remaining_ms!=null?row.standard_search_remaining_ms:row.search_remaining_ms??Math.max(0,row.search_ready_at-row.paused_at)
    row.standard_search_remaining_ms=remaining;row.search_remaining_ms=Math.min(remaining,5000)
  }
  else {
    row.standard_search_ready_at=row.search_ready_at
    row.search_ready_at = now + Math.min(Math.max(0, row.search_ready_at - now), 5000)
    row.expires_at = row.candidate_id ? row.search_ready_at + 45000 : null
  }
}
