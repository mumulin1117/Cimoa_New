import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { clone_data } from '../src/stores/seed.js'
import { authenticated_destination, startup_destination } from '../src/utils/authNavigation.js'
import { onboarding_error } from '../src/utils/onboardingFlow.js'
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
  configure_store_runtime(store, { persistence: { ...persistence, write() { throw Error('Full') } } })
  assert.equal(store.save_registration_age('2008-10-14').success, false)
  assert.deepEqual(clone_data(store.data), initial); assert.equal(disk.size, 0)
  configure_store_runtime(store, { persistence })
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
test('email corrections are scoped, unique and forbidden after account verification', async () => {
  const { store } = fixture()
  const { data } = await store.register_local_account({ email: 'new@campus.edu', password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
  const before = clone_data(store.data)
  for (const [email, id] of [['bad', data.account_id], ['cimoa@connect.edu', data.account_id], ['other@campus.edu', 'wrong']]) assert.equal(store.change_registration_email(email, id).success, false)
  assert.deepEqual(clone_data(store.data), before)
  assert.equal(store.change_registration_email(' CORRECT@Campus.edu ', data.account_id).success, true)
  assert.equal(store.local_verification.email, 'correct@campus.edu')
  store.apply_verification('009789', data.account_id)
  assert.equal(store.change_registration_email('next@campus.edu', data.account_id).success, false)
})
test('onboarding is scoped to a verified account and cannot skip steps; saved progress resumes', async () => {
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
async function photo_fixture() {
  const fixture_data = fixture(), { store } = fixture_data, blobs = new Map()
  configure_store_runtime(store, { media: { put: async (id, blob) => blobs.set(id, blob), get: async id => blobs.get(id), delete: async id => blobs.delete(id) }, inspect_media: async () => ({}) })
  const id = (await store.register_local_account({ email: 'photos@campus.edu', password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })).data.account_id
  store.apply_verification('009789', id); store.begin_onboarding(id)
  for (const [step, patch] of [['basic', { user_name: 'Morgan', date_of_birth: '2000-01-01', gender: 'Man', pronouns: '' }], ['uni', { university: 'HKUST', year: 'Year 3', major: '', graduation_year: '' }], ['major', { major: 'Engineering' }]]) assert.equal((await store.save_onboarding_step(step, patch, id)).success, true)
  return { ...fixture_data, id, blobs }
}
test('photo collection enforces 2–3 real owned media, synchronizes primary/order/remove and fails on missing blobs', async () => {
  const { store, id, blobs } = await photo_fixture(), image = new Blob(['unit decoded fixture'], { type: 'image/png' })
  assert.equal((await store.add_onboarding_photos([new Blob(['bad'])], null, id)).success, false)
  assert.equal((await store.add_onboarding_photos([image, image], null, id)).success, true)
  const ids = store.current_photos.map(row => row.photo_id), primary = store.current_photos[1].media_url
  assert.equal(store.edit_onboarding_photo(ids[1], 'primary', id).success, true); assert.equal(store.current_user.avatar_url, primary)
  assert.equal(store.edit_onboarding_photo(ids[1], 'later', id).success, true); assert.equal(store.current_photos[1].photo_id, ids[1])
  assert.equal(store.edit_onboarding_photo(ids[1], 'remove', id).success, true)
  assert.equal((await store.save_onboarding_step('photos', {}, id)).success, false)
  assert.equal((await store.add_onboarding_photos([image, image], null, id)).success, true)
  assert.equal((await store.add_onboarding_photos([image], null, id)).success, false)
  assert.equal((await store.add_onboarding_photos([image], ids[0], id)).success, true)
  assert.equal((await store.save_onboarding_step('photos', {}, id)).success, true)
  blobs.delete(store.current_photos[0].media_url.slice(12))
  assert.equal((await store.save_onboarding_step('photos', {}, id)).success, false)
})
test('failed photo metadata save or cancelled decode leaves neither half-photo nor new Blob', async () => {
  const { store, id, blobs, persistence } = await photo_fixture(), before = clone_data(store.data), image = new Blob(['unit image'], { type: 'image/png' })
  assert.equal((await store.add_onboarding_photos([image], null, id, { is_current: () => false })).success, false)
  assert.equal(blobs.size, 0); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { persistence: { ...persistence, write() { throw Error('Storage full') } } })
  assert.equal((await store.add_onboarding_photos([image], null, id)).success, false)
  assert.equal(blobs.size, 0); assert.deepEqual(clone_data(store.data), before)
})
test('missing catalog rows and unreadable storage do not expose a partial onboarding context', () => {
  const { store } = fixture()
  store.data.interests = []
  assert.deepEqual(store.onboarding_catalog.interests, [])
  store.hydration_status = 'error'
  assert.equal(store.onboarding, null)
})
test('icebreaker validation requires exactly three unique safe bounded questions', () => {
  const valid = ['Your ideal Sunday?', 'A campus spot?', 'Your favourite meal?']
  assert.equal(onboarding_error('ice', { questions: valid }), '')
  for (const questions of [[], valid.slice(0, 2), [...valid, 'Fourth?'], ['Same?', ' Same? ', 'Third?'], ['password?', ...valid.slice(1)], ['X'.repeat(161), ...valid.slice(1)], [null, ...valid.slice(1)]]) assert.ok(onboarding_error('ice', { questions }))
})
test('completion validates real media and every step, commits atomically, resumes Home and keeps new-user identity isolated', async () => {
  const { store, id, disk, persistence, blobs } = await photo_fixture()
  const image = new Blob(['unit decoded image'], { type: 'image/png' })
  await store.add_onboarding_photos([image, image], null, id)
  for (const [step, patch] of [['photos', {}], ['about', { bio: '' }], ['interests', { interest_ids: ['coffee', 'music', 'photography'] }], ['goal', { goal_ids: ['campus', 'conversations'] }], ['ice', { questions: ['Ideal Sunday?', 'Favourite meal?', 'A campus spot?'] }], ['notif', { notification_permission: 'skipped' }]]) assert.equal((await store.save_onboarding_step(step, patch, id)).success, true)
  assert.deepEqual(store.data.goals.find(row => row.item_id === 'campus'), { item_id: 'campus', emoji: '🎉', label: 'Campus Events' })
  assert.deepEqual(store.data.goals.find(row => row.item_id === 'conversations'), { item_id: 'conversations', emoji: '💬', label: 'Meaningful Conversations' })
  const before = clone_data(store.data), media_id = store.current_photos[0].media_url.slice(12), photo = blobs.get(media_id)
  blobs.delete(media_id); assert.equal((await store.save_onboarding_step('complete', {}, id)).success, false); blobs.set(media_id, photo)
  assert.equal((await store.save_onboarding_step('complete', {}, id, { is_current: () => false })).reason, 'cancelled')
  configure_store_runtime(store, { persistence: { ...persistence, write() { throw Error('Storage full') } } })
  assert.equal((await store.save_onboarding_step('complete', {}, id)).success, false); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { persistence })
  assert.equal((await store.save_onboarding_step('complete', {}, id)).data, 'home')
  const restored = fixture(disk.get('cimoa_app_state_v2')).store
  assert.equal(restored.onboarding.completed, true); assert.equal(startup_destination(restored), '/pages/home/index')
  assert.equal(restored.current_user.verification_status, 'pending'); assert.equal(restored.coin_balance, 0); assert.deepEqual(restored.home_connections, [])
  restored.logout(); assert.equal((await restored.login('photos@campus.edu', 'localpass123')).success, true)
  assert.equal(authenticated_destination(restored), '/pages/home/index'); assert.equal(restored.current_user.user_name, 'Morgan')
  assert.equal((await restored.save_onboarding_step('complete', {}, id)).success, false)
})
test('invalid persisted onboarding step fails hydration instead of silently skipping setup', async () => {
  const { store, disk, id } = await photo_fixture()
  const value = clone_data(disk.get('cimoa_app_state_v2'))
  value.accounts.find(a => a.account_id === id).onboarding.step = 'invented-step'
  const restored = fixture(value).store
  assert.equal(restored.hydration_status, 'error'); assert.equal(restored.onboarding, null)
  assert.equal(store.onboarding.step, 'photos')
})
