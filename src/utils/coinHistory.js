const date_formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export const format_coin_date = value => Number.isFinite(value) ? date_formatter.format(new Date(value)) : 'Date unavailable'

export function build_coin_history(transactions, requests, packages) {
  const package_by_id = new Map(packages.map(item => [item.package_id, item]))
  const completed_request_ids = new Set(transactions.filter(item => item.kind === 'purchase' && item.related_id).map(item => item.related_id))
  const ledger_rows = transactions.map(item => ({
    record_id: item.transaction_id,
    entity_type: 'transaction',
    filter: item.kind === 'purchase' ? 'purchases' : 'used',
    title: item.kind === 'refund' ? 'Coin refund' : item.amount > 0 ? 'Coin purchase' : 'Coins used',
    subtitle: item.fixture ? 'Local demo ledger entry' : item.kind === 'refund' ? 'Returned coins' : item.kind === 'purchase' && item.amount > 0 ? 'Verified App Store purchase' : 'Completed coin activity',
    when: format_coin_date(item.created_at),
    created_at: item.created_at,
    status: item.status === 'completed' ? 'Completed' : item.status,
    amount: `${item.amount > 0 ? '+' : '−'}${Math.abs(item.amount).toLocaleString('en-US')}`,
    positive: item.amount > 0,
    route: item.kind === 'purchase' ? `/pages/coins/purchase-detail?transaction_id=${encodeURIComponent(item.transaction_id)}` : `/pages/coins/spend-detail?transaction_id=${encodeURIComponent(item.transaction_id)}`,
  }))
  const request_rows = requests.filter(item => !completed_request_ids.has(item.request_id)).map(item => {
    const pack = package_by_id.get(item.package_id), label = item.status === 'cancelled' ? 'Purchase cancelled' : item.status === 'timeout' ? 'Purchase timed out' : item.status === 'failure' ? 'Purchase failed' : 'Purchase pending'
    const route = item.status === 'cancelled' ? `/pages/coins/cancelled?purchase_request_id=${encodeURIComponent(item.request_id)}` : item.status === 'pending' ? `/pages/coins/purchasing?purchase_request_id=${encodeURIComponent(item.request_id)}` : `/pages/coins/failed?purchase_request_id=${encodeURIComponent(item.request_id)}`
    return { record_id: item.request_id, entity_type: 'purchase_request', filter: 'purchases', title: label, subtitle: `${pack?.coins?.toLocaleString('en-US') || 'Unknown'} Coins · ${pack?.price || 'Price unavailable'}`, when: format_coin_date(item.created_at), created_at: item.created_at, status: item.status, amount: 'No coins', positive: false, route }
  })
  return [...ledger_rows, ...request_rows].sort((a, b) => b.created_at - a.created_at)
}
