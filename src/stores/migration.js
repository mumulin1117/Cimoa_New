import { create_seed, clone_data, TEST_USER_ID, DISCOVER_PROFILE_IDS } from './seed.js'
import { ensure, validate_data } from './selectors.js'
import { AVATAR_PROFILE_IDS } from './peopleCatalog.js'
import { ensure_account_defaults, registration_profile } from './accountDefaults.js'
import { generated_match_distances } from './matchingCatalog.js'
export function upgrade_additive_data(value) {
  const data = clone_data(value)
  if (data.app_consent === undefined) data.app_consent = { revision: null, accepted_at: null }
  if (data.call_sessions === undefined) data.call_sessions = []
  for (const row of data.event_preferences || []) if (row.blocked_organizer_ids === undefined) row.blocked_organizer_ids = []
  if(data.match_distances===undefined)data.match_distances=generated_match_distances()
  for (const row of data.settings || []) if (row.privacy && row.privacy.auto_match_visible === undefined) row.privacy.auto_match_visible = true
  for (const row of data.match_preferences || []) if (row.interest_mode === undefined) row.interest_mode = 'Similar interests'
  if (data.auth_flow && data.auth_flow.password_reset === undefined) data.auth_flow.password_reset = null
  for (const row of data.requests || []) if (row.question_text === undefined) row.question_text = data.icebreakers.find(question => question.question_id === row.question_id)?.text || ''
  const catalog = create_seed(Number.isFinite(data.updated_at) ? data.updated_at : Date.now())
  const discover_ids = new Set([...DISCOVER_PROFILE_IDS, ...AVATAR_PROFILE_IDS])
  const added_user_ids = new Set()
  for (const baseline of catalog.users.filter((row) => discover_ids.has(row.user_id))) {
    const current = data.users.find((row) => row.user_id === baseline.user_id)
    if (!current) { data.users.push(clone_data(baseline)); added_user_ids.add(baseline.user_id) }
    else if (!current.deleted) for (const key of ['discoverable', 'discover_order', 'voice_intro']) if (current[key] === undefined && baseline[key] !== undefined) current[key] = clone_data(baseline[key])
  }
  for (const baseline of catalog.profile_photos.filter((row) => discover_ids.has(row.user_id))) if (data.users.some(user => user.user_id === baseline.user_id && user.photo_ids.includes(baseline.photo_id)) && !data.profile_photos.some(row => row.photo_id === baseline.photo_id)) data.profile_photos.push(clone_data(baseline))
  for (const baseline of catalog.icebreakers.filter((row) => discover_ids.has(row.user_id))) if ((data.users.some(user => user.user_id === baseline.user_id && user.icebreaker_ids.includes(baseline.question_id)) || data.requests.some(request => request.question_id === baseline.question_id)) && !data.icebreakers.some(row => row.question_id === baseline.question_id)) data.icebreakers.push(clone_data(baseline))
  for (const baseline of catalog.memberships.filter(row => added_user_ids.has(row.user_id))) if (!data.memberships.some(row => row.event_id === baseline.event_id && row.user_id === baseline.user_id) && data.events.some(row => row.event_id === baseline.event_id && row.capacity > data.memberships.filter(member => member.event_id === row.event_id && member.status === 'joined').length)) data.memberships.push(clone_data(baseline))
  for (const account of data.accounts || []) {
    if (account.status !== 'active') continue
    ensure_account_defaults(data, account.user_id)
    const user = data.users.find(row => row.user_id === account.user_id)
    if (!user) continue
    if (account.auth_provider === 'local') for (const [key, value] of Object.entries(registration_profile(user.user_id, user.age))) if (user[key] === undefined) user[key] = clone_data(value)
    if (user.country === '') user.country = []
    if (user.onboarding_status === 'complete' && !Number.isInteger(user.discover_order)) user.discover_order = Math.max(-1, ...data.users.map(row => row.discover_order).filter(Number.isInteger)) + 1
  }
  return data
}
export function migrate_legacy(legacy, now) {
  const data = create_seed(now)
  if (legacy == null) {
    // A seeded test identity is not an authenticated first-install session.
    data.session = { account_id: null, current_user_id: null, expires_at: null }
    return data
  }
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
