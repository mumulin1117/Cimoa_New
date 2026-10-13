import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { signup_error, age_from_date } from '../src/utils/localAuth.js'
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
  assert.equal((await guest.store.login('cimoa@gmail.com', '12341234')).success, true)
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
test('registration saves salted credentials with no fake certification, session or coins and supports local login', async () => {
  const { store, disk } = fixture(), input = form(' Student@Campus.edu ')
  const result = await store.register_local_account(input)
  assert.equal(result.success, true); assert.equal(result.data.next_step, 'verification_undecided')
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
test('deleted emails remain reserved; verification and reset remain unavailable', async () => {
  const data = create_seed(now); data.session = { account_id: null, current_user_id: null, expires_at: null }
  data.accounts[0].status = 'deleted'; data.users[0].deleted = true
  const { store } = fixture(data)
  assert.equal((await store.register_local_account(form('cimoa@gmail.com'))).reason, 'email_exists')
  assert.equal(store.apply_verification().success, false); assert.equal(store.reset_password().success, false)
})
