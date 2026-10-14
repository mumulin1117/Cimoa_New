import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { clone_data } from '../src/stores/seed.js'
import { authenticated_destination, startup_destination } from '../src/utils/authNavigation.js'
function fixture(saved = null) {
  const store = use_app_store(createPinia()), disk = new Map(saved ? [['cimoa_app_state_v2', saved]] : [])
  const persistence = { read: key => clone_data(disk.get(key) ?? null), write: (key, data) => disk.set(key, clone_data(data)) }
  configure_store_runtime(store, { persistence, clock: () => Date.UTC(2026, 9, 14) }); store.hydrate()
  return { store, disk, persistence }
}
test('age/agreements reject underage and invalid dates without writes and restore adult draft', () => {
  const { store, disk, persistence } = fixture(), initial = clone_data(store.data)
  for (const dob of ['', '2008-10-15', '2004-02-30', '2099-01-01']) assert.equal(store.save_registration_age(dob).success, false)
  assert.deepEqual(clone_data(store.data), initial); assert.equal(disk.size, 0)
  assert.equal(store.save_registration_agreements({ terms: true, privacy: true, community: true }).success, false)
  assert.equal(store.save_registration_age('2008-10-14').success, true)
  assert.equal(fixture(disk.get('cimoa_app_state_v2')).store.auth_draft.profile_draft.date_of_birth, '2008-10-14')
  assert.equal(store.save_registration_agreements({ terms: true }).success, false)
  const before = clone_data(store.data)
  configure_store_runtime(store, { persistence: { ...persistence, write() { throw Error('Full') } } })
  assert.equal(store.save_registration_agreements({ terms: true, privacy: true, community: true }).success, false)
  assert.deepEqual(clone_data(store.data), before)
})
test('cancelled registration hashing cannot create an account', async () => {
  const { store } = fixture(), before = clone_data(store.data)
  const result = await store.register_local_account({ email: 'new@campus.edu', password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } }, { is_current: () => false })
  assert.equal(result.reason, 'cancelled'); assert.deepEqual(clone_data(store.data), before)
})
test('email corrections are scoped, unique and forbidden after local verification', async () => {
  const { store } = fixture()
  const { data } = await store.register_local_account({ email: 'new@campus.edu', password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
  const before = clone_data(store.data)
  for (const [email, id] of [['bad', data.account_id], ['cimoa@gmail.com', data.account_id], ['other@campus.edu', 'wrong']]) assert.equal(store.change_registration_email(email, id).success, false)
  assert.deepEqual(clone_data(store.data), before)
  assert.equal(store.change_registration_email(' CORRECT@Campus.edu ', data.account_id).success, true)
  assert.equal(store.local_verification.email, 'correct@campus.edu')
  store.apply_verification('009789', data.account_id)
  assert.equal(store.change_registration_email('next@campus.edu', data.account_id).success, false)
})
test('onboarding is scoped to a verified local account and cannot skip steps; saved progress resumes', async () => {
  const { store, disk } = fixture()
  const { data } = await store.register_local_account({ email: 'setup@campus.edu', password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
  assert.equal(store.begin_onboarding(data.account_id).success, false)
  store.apply_verification('009789', data.account_id)
  assert.equal(startup_destination(store), '/pages/auth/verification/success')
  assert.equal(store.begin_onboarding(data.account_id).success, true)
  assert.equal(authenticated_destination(store), '/pages/onboarding/basic')
  const before = clone_data(store.data)
  assert.equal((await store.save_onboarding_step('complete', {}, data.account_id)).success, false)
  assert.equal((await store.save_onboarding_step('basic', { user_name: '', date_of_birth: '2000-01-01', gender: 'Man', pronouns: '' }, data.account_id)).success, false)
  assert.deepEqual(clone_data(store.data), before)
  assert.equal((await store.save_onboarding_step('basic', { user_name: 'Morgan', date_of_birth: '2000-01-01', gender: 'Non-binary', pronouns: 'they / them' }, data.account_id)).success, true)
  const restored = fixture(disk.get('cimoa_app_state_v2')).store
  assert.equal(restored.current_user.user_name, 'Morgan'); assert.equal(restored.onboarding.step, 'uni')
  assert.equal(authenticated_destination(restored), '/pages/onboarding/uni')
  assert.equal(restored.current_user.verification_status, 'pending'); assert.equal(restored.coin_balance, 0); assert.deepEqual(restored.home_connections, [])
  restored.logout(); assert.equal(restored.onboarding, null)
  assert.equal((await restored.save_onboarding_step('basic', {}, data.account_id)).success, false)
})
