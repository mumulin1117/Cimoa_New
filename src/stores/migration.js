import { create_seed, clone_data, TEST_USER_ID } from './seed.js'
import { ensure, validate_data } from './selectors.js'
export function migrate_legacy(legacy, now) {
  const data = create_seed(now)
  if (legacy == null) return data
  ensure(legacy && typeof legacy === 'object' && legacy.current_user?.user_id, 'Legacy data needs recovery. It has not been overwritten.')
  data.legacy_archive = { owner_user_id: TEST_USER_ID, snapshot: clone_data(legacy), captured_at: now }
  const defaults = { user_name: 'Hottix', major: 'Product Design', university: 'Cimoa University', bio: 'Making room for good conversations, small adventures, and better campus days.', avatar_url: '/static/assets/head/me.png' }
  const me = data.users.find((row) => row.user_id === TEST_USER_ID)
  for (const [field, original] of Object.entries(defaults)) {
    const value = legacy.current_user[field]
    if (typeof value === 'string' && value && value !== original) me[field] = value
  }
  const old_rows = legacy.coin_transactions || []
  const extra = old_rows.filter((row) => !['coin_001', 'coin_002', 'coin_003'].includes(row.transaction_id))
  if (extra.length) {
    const original_total = old_rows.filter((row) => row.status === 'success').reduce((sum, row) => sum + row.amount, 0)
    ensure(Number.isInteger(legacy.current_user.coin_balance) && original_total === legacy.current_user.coin_balance, 'Legacy coin history needs recovery. No balance was changed.')
    for (const row of extra) {
      ensure(Number.isInteger(row.amount) && row.amount !== 0 && typeof row.transaction_id === 'string', 'Legacy transaction is invalid. No data was changed.')
      data.coin_transactions.push({ transaction_id: `legacy_${row.transaction_id}`, owner_user_id: TEST_USER_ID, business_key: `legacy_${row.transaction_id}`, amount: row.amount, kind: 'migration', status: row.status === 'success' ? 'completed' : 'failed', created_at: now, related_id: row.transaction_id, fixture: true })
    }
  }
  validate_data(data)
  return data
}
