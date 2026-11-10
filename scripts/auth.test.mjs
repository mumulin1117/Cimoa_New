import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { signup_error, age_from_date, is_source_supported_university_email } from '../src/utils/localAuth.js'
import { valid_local_code } from '../src/utils/localVerification.js'
const now = Date.UTC(2026, 9, 13)
function fixture(saved = null) {
  const disk = new Map(saved ? [[STATE_KEY, saved]] : []), store = use_app_store(createPinia())
  let writes = 0
  const persistence = { read: key => clone_data(disk.get(key) ?? null), write(key, value) { writes++; disk.set(key, clone_data(value)) } }
  configure_store_runtime(store, { persistence, clock: () => now })
  assert.equal(store.hydrate().success, true)
  return { store, disk, persistence, writes: () => writes }
}
const form = (email = 'student@campus.edu') => ({ email, password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2004-10-13', agreements: { terms: true, privacy: true, community: true } })
test('fresh install is a guest without writes; valid existing session and credentials are preserved', async () => {
  const guest = fixture()
  assert.equal(guest.store.session.is_authenticated, false); assert.equal(guest.writes(), 0)
  assert.equal(guest.store.home_connections.length, 0)
  assert.equal((await guest.store.login('cimoa@connect.edu', '12341234')).success, true)
  const restored = fixture(guest.disk.get(STATE_KEY))
  assert.equal(restored.store.session.is_authenticated, true); assert.equal(restored.writes(), 0)
  assert.deepEqual(restored.store.data.session, guest.store.data.session)
})
test('local registration checks valid dates, exact 18th birthday, password, agreements and email', () => {
  assert.equal(age_from_date('2008-10-13', now), 18); assert.equal(age_from_date('2008-10-14', now), 17)
  for (const invalid of ['2004-02-30', '2027-01-01', '2000-13-01', '2004-2-03']) assert.equal(age_from_date(invalid, now), null)
  assert.equal(signup_error(form(), now), '')
  for (const patch of [{ email: 'no-address' }, { password: 'short' }, { password: 'abcdefgh', confirmation: 'abcdefgh' }, { confirmation: 'different' }, { date_of_birth: '2008-10-14' }, { agreements: { terms: true, privacy: false, community: true } }]) assert.ok(signup_error({ ...form(), ...patch }, now))
})
test('source university-domain branch accepts the test university address and rejects personal email domains', () => {
  for (const email of ['cimoa@connect.edu', ' CIMOA@CONNECT.EDU ', 'student@campus.edu', 'student@connect.hkust.hk', 'student@college.ac.uk', 'STUDENT@CAMPUS.EDU']) assert.equal(is_source_supported_university_email(email), true)
  for (const email of ['cimoa@gmail.com', 'student@example.com', 'student@education.example', '', null]) assert.equal(is_source_supported_university_email(email), false)
})
test('registration saves salted credentials with no fake certification, session or coins and supports local login', async () => {
  const { store, disk } = fixture(), input = form(' Student@Campus.edu ')
  const result = await store.register_local_account(input)
  assert.equal(result.success, true); assert.equal(result.data.next_step, 'local_verification')
  assert.equal(store.session.is_authenticated, false)
  const account = store.data.accounts.find(row => row.account_id === result.data.account_id)
  assert.equal(account.email, 'student@campus.edu'); assert.equal(account.auth_provider, 'local')
  assert.equal(account.credential_salt.length, 32); assert.equal(account.credential_hash.length, 64)
  assert.equal(JSON.stringify(disk.get(STATE_KEY)).includes(input.password), false)
  const before = clone_data(store.data)
  assert.equal((await store.login(account.email, 'wrong')).success, false); assert.deepEqual(clone_data(store.data), before)
  assert.equal((await store.login(account.email, input.password)).success, true)
  assert.equal(store.current_user.verified, false); assert.equal(store.current_user.onboarding_status, 'not_started')
  assert.equal(store.home_connections.length, 0); assert.equal(store.coin_balance, 0)
  const restored = fixture(disk.get(STATE_KEY)).store
  assert.equal(restored.current_user.user_id, result.data.user_id)
  assert.equal((await restored.delete_account(input.password)).success, true)
  assert.equal((await restored.login(account.email, input.password)).success, false)
})
test('concurrent registration cannot duplicate an account; write failures leave no half-account', async () => {
  const { store } = fixture()
  const results = await Promise.all([store.register_local_account(form()), store.register_local_account(form())])
  assert.equal(results.filter(row => row.success).length, 1)
  assert.equal(store.data.accounts.filter(row => row.email === 'student@campus.edu').length, 1)
  const next = fixture(), before = clone_data(next.store.data)
  configure_store_runtime(next.store, { persistence: { ...next.persistence, write() { throw Error('Storage full') } } })
  assert.equal((await next.store.register_local_account(form())).success, false)
  assert.deepEqual(clone_data(next.store.data), before)
})
test('deleted emails remain reserved and missing-code verification fails', async () => {
  const data = create_seed(now); data.session = { account_id: null, current_user_id: null, expires_at: null }
  data.accounts[0].status = 'deleted'; data.users[0].deleted = true
  const { store } = fixture(data)
  assert.equal((await store.register_local_account(form('cimoa@connect.edu'))).reason, 'email_exists')
  assert.equal(store.apply_verification().success, false); assert.equal(store.begin_password_reset('cimoa@connect.edu').success, false)
})
test('fixed local code is exact, preserves leading zeroes, never promotes student identity, and is idempotent', async () => {
  const { store, disk, writes } = fixture()
  const account = (await store.register_local_account(form())).data.account_id
  const before = clone_data(store.data), count = writes()
  for (const code of [null, undefined, 9789, '9789', '000000', '123456', '0097890', ' 009789', '009789 ', '００９７８９', {}, ['009789']]) {
    assert.equal(store.apply_verification(code, account).success, false); assert.deepEqual(clone_data(store.data), before)
  }
  assert.equal(writes(), count)
  assert.equal('local_verification_code' in store, false)
  assert.equal(valid_local_code('009789'), true)
  assert.equal(store.apply_verification('009789', account).success, true)
  assert.equal(store.local_verification.verified, true); assert.equal(store.session.is_authenticated, false)
  assert.deepEqual(store.data.users, before.users); assert.deepEqual(store.data.relationships, before.relationships); assert.deepEqual(store.data.coin_transactions, before.coin_transactions)
  const saved = clone_data(store.data), after = writes()
  assert.equal(store.apply_verification('009789', account).repeated, true); assert.equal(writes(), after)
  assert.deepEqual(clone_data(store.data), saved)
  const restored = fixture(disk.get(STATE_KEY)).store
  assert.equal(restored.local_verification.verified, true)
  assert.equal((await restored.login('student@campus.edu', 'localpass123')).success, true)
  assert.equal(restored.requires_local_verification, false); assert.equal(restored.current_user.verified, false)
})
test('account verification cannot change another, deleted, expired or logged-out account', async () => {
  const { store } = fixture()
  const first = (await store.register_local_account(form('first@campus.edu'))).data.account_id
  const second = (await store.register_local_account(form('second@campus.edu'))).data.account_id
  const before = clone_data(store.data)
  assert.equal(store.apply_verification('009789', first).success, false); assert.deepEqual(clone_data(store.data), before)
  await store.login('first@campus.edu', 'localpass123')
  assert.equal(store.requires_local_verification, true)
  assert.equal(store.apply_verification('009789', second).success, false)
  store.logout(); assert.equal(store.local_verification, null); assert.equal(store.apply_verification('009789', first).success, false)
  await store.login('first@campus.edu', 'localpass123')
  const snapshot = clone_data(store.data); snapshot.session.expires_at = now - 1
  const expired = fixture(snapshot).store
  assert.equal(expired.local_verification, null); assert.equal(expired.apply_verification('009789', first).success, false)
  await store.delete_account('localpass123'); assert.equal(store.apply_verification('009789', first).success, false)
})
test('failed verification persistence rolls back completely; old snapshots have no invented account verification', async () => {
  const { store, persistence } = fixture(create_seed(now))
  assert.equal(store.local_verification.verified, false)
  const before = clone_data(store.data), id = store.local_verification.account_id
  configure_store_runtime(store, { persistence: { ...persistence, write() { throw Error('Storage full') } } })
  assert.equal(store.apply_verification('009789', id).success, false); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { persistence }); assert.equal(store.apply_verification('009789', id).success, true)
})
test('cancelled credential verification never commits a session', async () => {
  const { store, writes } = fixture(), before = clone_data(store.data)
  const result = await store.login('cimoa@connect.edu', '12341234', { is_current: () => false })
  assert.equal(result.reason, 'cancelled'); assert.deepEqual(clone_data(store.data), before); assert.equal(writes(), 0)
})
test('source login test states inspect real local data without writes or fabricated verification', async () => {
  const fixtureState = fixture(), fixtureBefore = clone_data(fixtureState.store.data)
  const wrong = await fixtureState.store.inspect_login_test_state('wrong_password')
  assert.equal(wrong.success, true); assert.equal(wrong.data.email, 'cimoa@connect.edu')
  assert.equal(wrong.data.message, 'Incorrect password. Try again or reset it.')
  assert.equal(fixtureState.writes(), 0); assert.deepEqual(clone_data(fixtureState.store.data), fixtureBefore)
  const missing = await fixtureState.store.inspect_login_test_state('unverified_account')
  assert.equal(missing.success, false); assert.match(missing.message, /No account awaiting confirmation/)
  assert.equal(fixtureState.writes(), 0); assert.deepEqual(clone_data(fixtureState.store.data), fixtureBefore)

  const local = fixture(), registration = await local.store.register_local_account(form('pending@campus.edu'))
  const writesBefore = local.writes(), localBefore = clone_data(local.store.data)
  const unverified = await local.store.inspect_login_test_state('unverified_account')
  assert.equal(unverified.success, true); assert.equal(unverified.data.email, 'pending@campus.edu')
  assert.equal(unverified.data.message, 'This account still needs university verification.')
  assert.equal(unverified.data.email, local.store.local_verification.email)
  assert.equal(local.writes(), writesBefore); assert.deepEqual(clone_data(local.store.data), localBefore)
  assert.equal(registration.success, true)
})
