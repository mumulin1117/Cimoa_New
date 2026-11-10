import { authenticated, owner_id } from './selectors.js'
import { clone_data } from './seed.js'
export function coin_ledger_detail(data, id, now) {
  if (!authenticated(data, now)) return null
  const owner = owner_id(data), transaction = data.coin_transactions.find(t => t.transaction_id === id && t.owner_user_id === owner)
  if (!transaction) return null
  const request = data.purchase_requests.find(r => r.request_id === transaction.related_id && r.owner_user_id === owner)
  const stored_pack = request && data.coin_packages.find(p => p.package_id === request.package_id)
  const pack = stored_pack && { ...stored_pack, product_id: request.product_id || stored_pack.product_id, coins: request.coins || stored_pack.coins, price: transaction.display_price || request.display_price || 'Amount unavailable' }
  const verified_purchase = !transaction.fixture && transaction.kind === 'purchase' && transaction.status === 'completed' && request?.status === 'success' && !!request.receipt_id && !!pack?.product_id && transaction.amount === pack.coins
  const mode = transaction.kind === 'refund' && transaction.amount > 0 ? 'refund' : transaction.amount > 0 ? transaction.fixture ? 'credit' : 'purchase' : 'spend'
  const original = mode === 'refund' ? data.coin_transactions.find(t => t.transaction_id === transaction.related_id && t.owner_user_id === owner) : transaction
  const key = original?.fixture ? '' : original?.business_key || ''
  const feature_label = key.startsWith('text:') ? 'Text Introduction' : key.startsWith('voice:') ? 'Voice Introduction' : key.startsWith('priority:') ? 'Priority Match' : key.startsWith('match:') ? 'Auto Match' : 'Unavailable'
  return clone_data({ transaction, request: request || null, pack: pack || null, verified_purchase, mode, feature_label, original_transaction_id: mode === 'refund' ? original?.transaction_id || null : null })
}
