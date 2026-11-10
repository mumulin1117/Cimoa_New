import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data, TEST_ACCOUNT_ID, TEST_EMAIL, TEST_USER_ID } from '../src/stores/seed.js'
import { upgrade_additive_data } from '../src/stores/migration.js'
import { validate_data } from '../src/stores/selectors.js'
import { auth_context_key, ensure_account_defaults } from '../src/stores/accountDefaults.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { is_source_supported_university_email, signup_error } from '../src/utils/localAuth.js'
import { valid_local_code } from '../src/utils/localVerification.js'
import { LOCAL_VERIFICATION_CODE } from '../src/config/local-auth.js'

const now = Date.UTC(2026, 9, 24, 8)
const legacy_email = 'cimoa@gmail.com'
const account_for = data => data.accounts.find(row => row.account_id === TEST_ACCOUNT_ID)
const guest_session = () => ({ account_id: null, current_user_id: null, expires_at: null })
const form = email => ({ email, password: '12341234', confirmation: '12341234', date_of_birth: '2002-01-01', agreements: { terms: true, privacy: true, community: true } })
function old_snapshot() {
  // Start with the current additive baseline so unrelated historical upgrades
  // cannot disguise an identity migration as an entity mutation.
  const data = upgrade_additive_data(create_seed(now))
  account_for(data).email = legacy_email
  return data
}
function fixture(saved = null) {
  const disk = new Map(saved ? [[STATE_KEY, clone_data(saved)]] : [])
  const store = use_app_store(createPinia())
  let writes = 0, media_accesses = 0
  const persistence = { read: key => clone_data(disk.get(key) ?? null), write(key, value) { writes++; disk.set(key, clone_data(value)) } }
  const media = Object.fromEntries(['get', 'put', 'delete'].map(method => [method, async () => { media_accesses++; throw Error(`Unexpected media ${method}`) }]))
  configure_store_runtime(store, { persistence, media, clock: () => now })
  const hydration = store.hydrate()
  return { store, disk, persistence, hydration, writes: () => writes, media_accesses: () => media_accesses }
}

test('the approved identity and code keep the existing password, supported university domain and guest first install', async () => {
  assert.equal(TEST_EMAIL, 'cimoa@connect.edu')
  assert.equal(TEST_ACCOUNT_ID, 'account_cimoa')
  assert.equal(TEST_USER_ID, 'user_cimoa')
  assert.equal(LOCAL_VERIFICATION_CODE, '009789')
  assert.equal(is_source_supported_university_email(TEST_EMAIL), true)
  assert.equal(signup_error(form(TEST_EMAIL), now), '')
  const fresh = fixture()
  assert.equal(fresh.hydration.success, true)
  assert.equal(fresh.store.session.is_authenticated, false)
  assert.equal(fresh.store.data.session.account_id, null)
  assert.equal(fresh.writes(), 0)
  assert.equal(fresh.disk.size, 0)
  assert.equal((await fresh.store.login(TEST_EMAIL, '12341234')).success, true)
  assert.equal(fresh.store.current_user.user_id, TEST_USER_ID)
  assert.equal(fresh.store.current_user.email, TEST_EMAIL)
})

test('v2 identity upgrade changes only its email and owned auth contexts, preserving every entity and input bytes', () => {
  const old = old_snapshot()
  old.users.find(row => row.user_id === TEST_USER_ID).bio = `Contact text ${legacy_email} must remain literal.`
  old.auth_flow.email = legacy_email
  old.auth_flow.password_reset = { reset_id: 'reset_existing', account_id: TEST_ACCOUNT_ID, email: legacy_email, created_at: now - 2000, verified_at: now - 1000 }
  old.media_files.push({ media_id: 'retained_audio', owner_user_id: TEST_USER_ID, kind: 'audio', media_url: 'indexeddb://retained_audio', mime: 'audio/webm', byte_size: 8, duration_ms: 1000 })
  old.drafts.push({ draft_id: 'retained_draft', owner_user_id: TEST_USER_ID, kind: 'message', target_id: 'conv_chloe', payload: { text: legacy_email }, updated_at: now })
  validate_data(old)
  const original = clone_data(old), original_context = auth_context_key(old), upgraded = upgrade_additive_data(old)
  const expected = clone_data(original)
  account_for(expected).email = TEST_EMAIL
  expected.auth_flow.email = TEST_EMAIL
  expected.auth_flow.password_reset.email = TEST_EMAIL
  assert.deepEqual(upgraded, expected)
  assert.deepEqual(old, original)
  assert.equal(auth_context_key(upgraded), original_context)
  assert.deepEqual(upgrade_additive_data(upgraded), upgraded)
  validate_data(upgraded)
})

test('hydration is zero-write and zero-media, keeps the session and lazily persists the email with the next ordinary action', () => {
  const old = old_snapshot(), original = clone_data(old), f = fixture(old)
  assert.equal(f.hydration.success, true)
  assert.equal(f.store.session.is_authenticated, true)
  assert.equal(f.store.current_user.email, TEST_EMAIL)
  assert.deepEqual(clone_data(f.store.data.session), original.session)
  assert.equal(f.writes(), 0)
  assert.equal(f.media_accesses(), 0)
  assert.deepEqual(f.disk.get(STATE_KEY), original)
  assert.equal(f.store.update_profile({ bio: 'A new campus chapter.' }).success, true)
  assert.equal(f.writes(), 1)
  const persisted = f.disk.get(STATE_KEY)
  assert.equal(account_for(persisted).email, TEST_EMAIL)
  for (const table of ['relationships', 'requests', 'conversations', 'messages', 'memberships', 'match_sessions', 'match_quota', 'coin_transactions', 'media_files']) assert.deepEqual(persisted[table], original[table], table)
  const refreshed = fixture(persisted)
  assert.equal(refreshed.hydration.success, true)
  assert.equal(refreshed.store.current_user.email, TEST_EMAIL)
  assert.deepEqual(clone_data(refreshed.store.data), persisted)
  assert.equal(refreshed.writes(), 0)
})

test('the migrated login accepts only the new email and does not regenerate the account, relations, messages or coins', async () => {
  const old = old_snapshot()
  old.session = guest_session()
  const f = fixture(old), protected_data = clone_data(f.store.data)
  assert.equal((await f.store.login(legacy_email, '12341234')).success, false)
  assert.equal((await f.store.login(TEST_EMAIL, 'wrong-password')).success, false)
  assert.equal(f.writes(), 0)
  assert.deepEqual(clone_data(f.store.data), protected_data)
  assert.equal((await f.store.login(' CIMOA@CONNECT.EDU ', '12341234')).success, true)
  assert.equal(f.writes(), 1)
  assert.equal(f.store.session.account_id, TEST_ACCOUNT_ID)
  for (const table of ['accounts', 'users', 'profile_photos', 'icebreakers', 'relationships', 'requests', 'conversations', 'messages', 'coin_transactions', 'media_files']) assert.deepEqual(clone_data(f.store.data[table]), protected_data[table], table)
})

test('failed first persistence cannot partially commit the migration or the attempted business mutation', async () => {
  const old = old_snapshot(), f = fixture(old), memory = clone_data(f.store.data), disk = clone_data(f.disk.get(STATE_KEY))
  configure_store_runtime(f.store, { persistence: { ...f.persistence, write() { throw Error('Disk full') } } })
  assert.equal(f.store.update_profile({ bio: 'Must not be published.' }).success, false)
  assert.deepEqual(clone_data(f.store.data), memory)
  assert.deepEqual(f.disk.get(STATE_KEY), disk)
  assert.equal(f.writes(), 0)
  assert.equal(f.media_accesses(), 0)
  old.session = guest_session()
  const signed_out = fixture(old), before = clone_data(signed_out.store.data)
  configure_store_runtime(signed_out.store, { persistence: { ...signed_out.persistence, write() { throw Error('Disk full') } } })
  assert.equal((await signed_out.store.login(TEST_EMAIL, '12341234')).success, false)
  assert.equal(signed_out.store.session.is_authenticated, false)
  assert.deepEqual(clone_data(signed_out.store.data), before)
  assert.deepEqual(signed_out.disk.get(STATE_KEY), old)
})

test('an email collision fails closed without merging identities, overwriting storage or exposing a session', () => {
  for (const email of [TEST_EMAIL, TEST_EMAIL.toUpperCase()]) {
    const old = old_snapshot()
    old.accounts.push({ ...clone_data(account_for(old)), account_id: 'account_other', user_id: 'user_chloe', email })
    const before = clone_data(old)
    assert.throws(() => upgrade_additive_data(old), /recovery|overwritten/)
    assert.deepEqual(old, before)
    const f = fixture(old)
    assert.equal(f.hydration.success, false)
    assert.equal(f.store.hydration_status, 'error')
    assert.equal(f.store.session.is_authenticated, false)
    assert.equal(f.writes(), 0)
    assert.deepEqual(f.disk.get(STATE_KEY), before)
  }
})

test('the migration requires both stable identity IDs and the exact legacy email', () => {
  for (const patch of [{ account_id: 'different_account' }, { user_id: 'user_chloe' }, { email: 'personal@campus.edu' }, { email: 'Cimoa@gmail.com' }]) {
    const old = old_snapshot(), target = account_for(old)
    Object.assign(target, patch)
    if (patch.account_id) old.session.account_id = patch.account_id
    if (patch.user_id) { old.session.current_user_id = patch.user_id; ensure_account_defaults(old, patch.user_id) }
    const before = clone_data(old)
    assert.deepEqual(upgrade_additive_data(old), before)
    assert.deepEqual(old, before)
  }
  const other = old_snapshot()
  other.accounts[0].email = 'different@campus.edu'
  other.accounts.push({ ...clone_data(other.accounts[0]), account_id: 'another_account', user_id: 'user_chloe', email: legacy_email })
  const expected = clone_data(other)
  // Normalize only the unrelated existing additive account defaults.
  const once = upgrade_additive_data(other)
  assert.equal(once.accounts.find(row => row.account_id === 'another_account').email, legacy_email)
  assert.deepEqual(once.accounts, expected.accounts)
  assert.deepEqual(other, expected)
})

test('auth email migration is account-scoped and leaves another registration or reset context untouched', () => {
  const scenarios = [
    { pending_registration_account_id: TEST_ACCOUNT_ID, password_reset: null, migrate_flow: true },
    { pending_registration_account_id: 'account_other', password_reset: null, migrate_flow: false },
    { pending_registration_account_id: null, password_reset: { reset_id: 'r', account_id: 'account_other', email: legacy_email, created_at: now, verified_at: null }, migrate_flow: false },
    { pending_registration_account_id: null, password_reset: { reset_id: 'r', account_id: TEST_ACCOUNT_ID, email: legacy_email, created_at: now, verified_at: null }, migrate_flow: true },
    { pending_registration_account_id: null, password_reset: null, migrate_flow: true },
  ]
  for (const scenario of scenarios) {
    const old = old_snapshot()
    old.accounts.push({ ...clone_data(account_for(old)), account_id: 'account_other', user_id: 'user_chloe', email: 'another@campus.edu' })
    old.session = guest_session()
    Object.assign(old.auth_flow, { email: legacy_email, pending_registration_account_id: scenario.pending_registration_account_id, password_reset: scenario.password_reset })
    const result = upgrade_additive_data(old)
    assert.equal(result.auth_flow.email, scenario.migrate_flow ? TEST_EMAIL : legacy_email)
    if (scenario.password_reset) assert.equal(result.auth_flow.password_reset.email, scenario.password_reset.account_id === TEST_ACCOUNT_ID ? TEST_EMAIL : legacy_email)
    assert.deepEqual(result.auth_flow.profile_draft, old.auth_flow.profile_draft)
    assert.equal(auth_context_key(result), auth_context_key(old))
  }
  const other_session = old_snapshot()
  other_session.accounts.push({ ...clone_data(account_for(other_session)), account_id: 'account_other', user_id: 'user_chloe', email: 'another@campus.edu' })
  other_session.session = { account_id: 'account_other', current_user_id: 'user_chloe', expires_at: now + 10000 }
  other_session.auth_flow.email = legacy_email
  assert.equal(upgrade_additive_data(other_session).auth_flow.email, legacy_email)
})

test('a previously reset local credential is preserved, never silently restored to the default password', async () => {
  const original = fixture()
  const reset = original.store.begin_password_reset(TEST_EMAIL)
  assert.equal(reset.success, true)
  assert.equal(original.store.verify_password_reset_code('009789', reset.data.reset_id).success, true)
  assert.equal((await original.store.finish_password_reset('ChangedPass123', 'ChangedPass123', reset.data.reset_id)).success, true)
  const old = clone_data(original.store.data)
  account_for(old).email = legacy_email
  old.auth_flow.email = legacy_email
  const f = fixture(old), credential = clone_data(account_for(old))
  assert.equal(f.hydration.success, true)
  assert.deepEqual(clone_data(account_for(f.store.data)), { ...credential, email: TEST_EMAIL })
  assert.equal(f.writes(), 0)
  assert.equal((await f.store.login(TEST_EMAIL, '12341234')).success, false)
  assert.equal((await f.store.login(legacy_email, 'ChangedPass123')).success, false)
  assert.equal((await f.store.login(TEST_EMAIL, 'ChangedPass123')).success, true)
  assert.deepEqual(clone_data(f.store.data.coin_transactions), old.coin_transactions)
})

test('deleted identities remain deleted, reserved and unable to log in after email migration', async () => {
  const original = fixture(upgrade_additive_data(create_seed(now)))
  assert.equal((await original.store.delete_account('12341234')).success, true)
  const old = clone_data(original.store.data)
  account_for(old).email = legacy_email
  const expected = clone_data(old)
  account_for(expected).email = TEST_EMAIL
  const f = fixture(old)
  assert.equal(f.hydration.success, true)
  assert.deepEqual(clone_data(f.store.data), expected)
  assert.equal(f.store.session.is_authenticated, false)
  assert.equal(account_for(f.store.data).status, 'deleted')
  assert.equal(account_for(f.store.data).credential_hash, 'deleted')
  assert.equal((await f.store.login(TEST_EMAIL, '12341234')).success, false)
  assert.equal((await f.store.register_local_account(form(TEST_EMAIL))).reason, 'email_exists')
  assert.equal(f.store.begin_password_reset(TEST_EMAIL).success, false)
  assert.equal(f.writes(), 0)
  assert.deepEqual(f.disk.get(STATE_KEY), old)
})

test('verification remains an internal exact code and is absent from registration and reset UI', () => {
  assert.equal(valid_local_code('009789'), true)
  for (const code of [9789, '9789', '009789 ', ' 009789', '000000', '12341234']) assert.equal(valid_local_code(code), false)
  for (const path of ['src/pages/auth/verification/code.vue', 'src/pages/auth/reset/code.vue']) {
    const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /009789|LOCAL_VERIFICATION_CODE|local_verification_code|Show code again/i, path)
    assert.match(source, /<input\b/, path)
  }
})
