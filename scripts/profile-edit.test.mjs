import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
function fixture() {
  let disk = create_scenario('default', Date.now()), writes = 0
  const blobs = new Map(), store = use_app_store(createPinia())
  const persistence = { read: () => clone_data(disk), write: (_, value) => { disk = clone_data(value); writes++ } }
  configure_store_runtime(store, { persistence, media: { put: async (id, blob) => blobs.set(id, blob), get: async id => blobs.get(id), delete: async id => blobs.delete(id) }, inspect_media: async () => ({}) }); store.hydrate()
  return { store, blobs, persistence, writes: () => writes, id: store.session.account_id }
}
test('profile editor is a detached current-account view and shares onboarding catalog', () => {
  const { store } = fixture(); const view = store.profile_editor; view.user.user_name = 'Leak'; view.questions[0] = 'Changed'
  assert.equal(store.current_user.user_name, 'Ethan'); assert.notEqual(store.data.icebreakers.find(row => row.question_id === store.current_user.icebreaker_ids[0]).text, 'Changed')
  assert.equal(store.profile_catalog.songs.length, 10); store.logout(); assert.equal(store.profile_editor, null)
})
test('profile section validation, unchanged verification/coins, hydration and account isolation', () => {
  const f = fixture(), { store, id } = f, before = clone_data(store.data)
  for (const [section, patch] of [['basic', { user_name: '' }], ['all', { university: 'Other' }], ['all', { song_id: 'birds' }], ['all', { country: ['Invalid'] }], ['interests', { interest_ids: ['music'] }], ['goals', { goal_ids: [] }], ['ice', { questions: ['q','q','q'] }]]) assert.equal(store.save_profile_section(section, patch, id).success, false)
  assert.deepEqual(clone_data(store.data), before)
  assert.equal(store.save_profile_section('basic', { user_name: 'Morgan', pronouns: 'they / them', year: 'Year 2', major: 'Design' }, id).success, true)
  assert.equal(store.save_profile_section('goals', { goal_ids: ['career'] }, id).success, true)
  assert.equal(store.goals_for_user(store.current_user.user_id)[0].label, 'Career Networking')
  assert.equal(store.save_profile_section('interests', { interest_ids: ['films', 'books', 'art'] }, 'wrong').success, false)
  store.hydration_status = 'idle'; store.hydrate(); assert.equal(store.current_user.user_name, 'Morgan'); assert.equal(store.coin_balance, 260); assert.equal(store.current_user.verification_status, 'verified')
  assert.equal(store.data.users.find(row => row.user_id === 'user_chloe').user_name, 'Chloe Lin')
})
test('photo replacements and text commit once; failed metadata/cancellation clean new blobs atomically', async () => {
  const f = fixture(), { store, blobs, id } = f, image = new Blob(['decoded test image'], { type: 'image/png' }), old = store.current_photos[0]
  assert.equal((await store.save_profile_edit({ bio: 'New bio' }, [{ photo_id: old.photo_id, blob: image }], id)).success, true)
  assert.equal(f.writes(), 1); assert.equal(blobs.size, 1); assert.equal(store.current_user.avatar_url, store.current_photos[0].media_url)
  const before = clone_data(store.data), count = blobs.size
  configure_store_runtime(store, { persistence: { ...f.persistence, write() { throw Error('Storage full') } } })
  assert.equal((await store.save_profile_edit({ bio: 'Not saved' }, [{ blob: image }], id)).success, false)
  assert.deepEqual(clone_data(store.data), before); assert.equal(blobs.size, count)
  assert.equal((await store.save_profile_edit({}, [{ blob: image }], id, { is_current: () => false })).success, false)
  assert.deepEqual(clone_data(store.data), before); assert.equal(blobs.size, count)
})
test('photo ordering keeps IDs and avatar; removing every photo fails; historical questions survive', async () => {
  const { store, id } = fixture(), blob = new Blob(['image'], { type: 'image/png' })
  assert.equal((await store.save_profile_edit({}, [...store.current_photos, { blob }], id)).success, true)
  const photos = store.current_photos, question = store.profile_editor.questions[0], old_ids = [...store.current_user.icebreaker_ids]
  assert.equal((await store.save_profile_edit({}, [...photos].reverse(), id)).success, true)
  assert.equal(store.current_user.avatar_url, photos[1].media_url); assert.equal(store.current_photos[0].photo_id, photos[1].photo_id)
  assert.equal((await store.save_profile_edit({}, [], id)).success, false)
  assert.equal(store.save_profile_section('ice', { questions: [question, 'Your favourite campus cafe?', 'A place you want to visit?'] }, id).success, true)
  assert.ok(old_ids.every(q => store.data.icebreakers.some(row => row.question_id === q)))
  store.hydration_status = 'idle'; store.hydrate(); assert.equal(store.profile_editor.questions[2], 'A place you want to visit?')
})
