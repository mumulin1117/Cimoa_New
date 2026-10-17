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
test('scoped logout is atomic, clears entry drafts only and relogin restores edited entities', async () => {
  const f = fixture(), { store, id } = f
  assert.equal(store.save_profile_section('basic', { user_name: 'Returning Morgan', pronouns: 'they / them', year: 'Year 3', major: 'Design' }, id).success, true)
  assert.equal(store.save_profile_section('ice', { questions: ['Your favourite class?', 'Your ideal club?', 'Your campus tradition?'] }, id).success, true)
  const before = clone_data(store.data)
  assert.equal(store.logout('another-account').success, false); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { persistence: { ...f.persistence, write() { throw Error('Storage full') } } })
  assert.equal(store.logout(id).success, false); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { persistence: f.persistence }); assert.equal(store.logout(id).success, true)
  assert.equal(store.session.is_authenticated, false); assert.equal(store.auth_draft.email, ''); assert.deepEqual(store.auth_draft.profile_draft, {})
  for (const key of ['users','accounts','profile_photos','media_files','icebreakers','relationships','coin_transactions','settings']) assert.deepEqual(clone_data(store.data[key]), before[key])
  store.hydration_status = 'idle'; store.hydrate(); assert.equal(store.session.is_authenticated, false)
  const logged_out = clone_data(store.data); assert.equal((await store.login('cimoa@gmail.com','wrong')).success, false); assert.deepEqual(clone_data(store.data), logged_out)
  assert.equal((await store.login('cimoa@gmail.com','12341234')).success, true); assert.equal(store.current_user.user_name,'Returning Morgan'); assert.equal(store.profile_editor.questions[2],'Your campus tradition?')
  assert.equal(store.profile_editor.account_id,id); assert.equal(store.coin_balance,260)
})
test('preflight rejects invalid photo drafts without writes, including foreign replacement IDs', async () => {
  const f = fixture(), { store, id } = f, blob = new Blob(['image'], { type:'image/png' }), before = clone_data(store.data)
  assert.match(store.profile_edit_validation_error({}, [], id),/Keep/)
  const foreign = store.data.profile_photos.find(row=>row.user_id!==store.current_user.user_id)
  assert.match(store.profile_edit_validation_error({}, [{ photo_id:foreign.photo_id,blob }], id),/no longer belongs/)
  assert.equal((await store.save_profile_edit({}, [{ photo_id:foreign.photo_id,blob }], id)).success,false)
  assert.equal(f.writes(),0); assert.equal(f.blobs.size,0); assert.deepEqual(clone_data(store.data),before)
})
test('profile voice bio shares canonical media, restores, rejects invalid audio and rolls back metadata failure', async () => {
  const f = fixture(), { store, id, blobs } = f, blob = new Blob(['decoded voice'], { type: 'audio/wav' })
  configure_store_runtime(store, { inspect_media: async () => ({ duration_ms: 2100 }) })
  assert.equal((await store.save_profile_edit({ bio: 'A warm introduction' }, null, id, { audio: { blob } })).success, true)
  const audio = store.profile_editor.audio; assert.equal(audio.duration_ms, 2100); assert.ok(blobs.has(audio.media_id))
  assert.equal(store.user_by_id(store.current_user.user_id).voice_intro.audio_url, audio.media_url)
  store.hydration_status = 'idle'; store.hydrate(); assert.equal(store.profile_editor.audio.media_id, audio.media_id)
  const before = clone_data(store.data), count = blobs.size
  configure_store_runtime(store, { inspect_media: async () => ({ duration_ms: 31000 }) })
  assert.equal((await store.save_profile_edit({}, null, id, { audio: { blob } })).success, false); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { inspect_media: async () => ({ duration_ms: 2100 }), persistence: { ...f.persistence, write() { throw Error('Storage full') } } })
  assert.equal((await store.save_profile_edit({}, null, id, { audio: { blob } })).success, false); assert.equal(blobs.size, count); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { persistence: f.persistence })
  assert.equal((await store.save_profile_edit({}, null, id, { audio: null })).success, true); assert.equal(store.profile_editor.audio, null)
  assert.ok(blobs.has(audio.media_id), 'Historical owned media is not deleted behind other consumers')
})
test('async photo decoding cannot publish across same-account reauthentication; duplicate saves are rejected', async () => {
  const { store, id, blobs } = fixture(), blob = new Blob(['image'], { type: 'image/png' })
  let release; configure_store_runtime(store, { inspect_media: () => new Promise(resolve => { release = resolve }) })
  const pending = store.save_profile_edit({ bio: 'Must not be published' }, [{ blob }], id)
  assert.equal((await store.save_profile_edit({ bio: 'Duplicate' }, null, id)).reason, 'busy')
  store.logout(); await store.login('cimoa@gmail.com', '12341234'); const before = clone_data(store.data)
  release({ duration_ms: 0 }); assert.equal((await pending).success, false); assert.deepEqual(clone_data(store.data), before); assert.equal(blobs.size, 0)
})
test('verification read model masks private email and never invents a verification timestamp', () => {
  const { store } = fixture(), v = store.profile_verification
  assert.equal(v.masked_email, 'ci•••@gmail.com'); assert.equal(v.verified_at, null); assert.equal(v.verified, true)
  store.data.users[0].verification_status = 'pending'; assert.equal(store.profile_verification.verified, false)
  assert.equal('credential_hash' in store.profile_verification, false); store.logout(); assert.equal(store.profile_verification, null)
})
test('twelve source preference groups map to shared Auto Match fields without page copies or implicit resets', () => {
  const { store } = fixture(), draft = store.match_preferences, before = clone_data(store.data)
  const groups = store.profile_preference_groups(draft); assert.equal(groups.length, 12)
  assert.deepEqual(groups.find(g => g.title === 'Age range').options.map(o => o.label), ['18 – 21', '18 – 24', '21 – 27'])
  assert.equal(groups[0].options.length, 15)
  for (const [title, label] of [['Age range', '21 – 27'], ['Distance', 'Within 5 km'], ['Height range', '180 cm +'], ['Connection goal', 'Travel buddies']]) Object.assign(draft, groups.find(g => g.title === title).options.find(o => o.label === label).patch)
  assert.deepEqual(clone_data(store.data), before); const { owner_user_id, ...patch } = draft
  assert.equal(store.update_match_preferences(patch).success, true)
  assert.deepEqual([store.match_preferences.age_min, store.match_preferences.age_max, store.match_preferences.distance_max, store.match_preferences.height_min, store.match_preferences.goal_id], [21,27,5,180,'travel'])
  store.hydration_status = 'idle'; store.hydrate(); assert.equal(store.match_preferences.goal_id, 'travel')
})
