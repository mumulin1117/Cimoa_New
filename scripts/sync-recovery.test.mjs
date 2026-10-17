import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { session_for } from '../src/stores/accountDefaults.js'

const epoch = Date.UTC(2026, 9, 17, 23, 59, 50)
function fixture(change = () => {}) {
  let now = epoch, disk = create_seed(now), writes = 0, fail = false
  disk.session = session_for(disk.accounts[0], now); change(disk)
  const blobs = new Map(), media = { get: async id => blobs.get(id), put: async (id, blob) => blobs.set(id, blob), delete: async id => blobs.delete(id) }
  const persistence = { read: key => key === STATE_KEY ? clone_data(disk) : null, write: (_, value) => { if (fail) throw Error('Storage full'); writes++; disk = clone_data(value) } }
  const attach = () => { const store = use_app_store(createPinia()); configure_store_runtime(store, { clock: () => now, persistence, media, inspect_media: async (_, kind) => ({ duration_ms: kind === 'audio' ? 1500 : 0 }) }); assert.equal(store.hydrate().success, true); return store }
  const store = attach()
  return { store, attach, media, blobs, persistence, snapshot: () => clone_data(disk), writes: () => writes, fail: value => { fail = value }, advance: ms => { now += ms; store.tick() } }
}
test('event cards, detail, group headers and participants use one privacy/block count without freeing hidden occupied seats', () => {
  const { store } = fixture(data => { data.settings.push({ owner_user_id: 'user_chloe', privacy: { event_visible: false } }) })
  const id = 'event_picnic', card = store.event_by_id(id), people = store.event_people(id)
  assert.equal(card.participants.some(p => p.user_id === 'user_chloe'), false)
  assert.equal(card.participant_count, people.length); assert.equal(store.event_detail(id).participant_count, people.length)
  assert.equal(card.available_count, card.capacity - store.data.memberships.filter(m => m.event_id === id && m.status === 'joined').length)
  const before = clone_data(store.data); store.event_feed; store.my_event_groups; store.event_participants(id); assert.deepEqual(store.data, before)
})
test('same-account reauthentication with identical expiry cannot publish a delayed direct-media message', async () => {
  const f = fixture(), { store } = f, session = clone_data(store.data.session); let release
  configure_store_runtime(store, { inspect_media: () => new Promise(resolve => { release = resolve }) })
  const pending = store.send_direct_message('conversation_chloe', '', { kind: 'image', blob: new Blob(['image'], { type: 'image/png' }) }, 'old_direct')
  store.logout(); assert.equal((await store.login('cimoa@gmail.com', '12341234')).success, true); assert.deepEqual(store.data.session, session)
  const before = clone_data(store.data), count = f.writes(); release({ duration_ms: 0 })
  assert.equal((await pending).success, false); assert.deepEqual(store.data, before); assert.equal(f.writes(), count); assert.equal(f.blobs.size, 0)
})
for (const kind of ['save_media', 'save_profile_photos', 'send_introduction', 'complete_coin_spend', 'discard_media']) test('async ' + kind + ' cannot cross a same-account login generation', async () => {
  const f = fixture(data => { data.match_sessions = []; data.media_files.push(...['audio', 'image'].map(kind => ({ media_id: 'owned_' + kind, owner_user_id: 'user_cimoa', kind, media_url: 'indexeddb://owned_' + kind, mime: kind + '/' + (kind === 'audio' ? 'wav' : 'png'), byte_size: 5, duration_ms: kind === 'audio' ? 1500 : 0 }))) })
  const { store } = f, audio = new Blob(['audio'], { type: 'audio/wav' }), image = new Blob(['image'], { type: 'image/png' }); f.blobs.set('owned_audio', audio); f.blobs.set('owned_image', image)
  if (kind === 'complete_coin_spend') {
    const intro = store.save_draft('introduction', 'user_liam', { question_id: 'user_liam_q_0', mode: 'voice', audio_id: 'owned_audio' })
    assert.equal(intro.success, true); assert.equal(store.prepare_voice_introduction_spend(intro.data).success, true)
  }
  let release
  if (kind === 'save_media') configure_store_runtime(store, { inspect_media: () => new Promise(resolve => { release = resolve }) })
  else configure_store_runtime(store, { media: { ...f.media, get: id => new Promise(resolve => { release = () => resolve(f.blobs.get(id)) }) } })
  const actions = {
    save_media: () => store.save_media(image, 'image'), save_profile_photos: () => store.save_profile_photos(['owned_image']),
    send_introduction: () => store.send_introduction({ user_id: 'user_liam', question_id: 'user_liam_q_0', kind: 'voice', audio_id: 'owned_audio', operation_id: 'old_intro' }),
    complete_coin_spend: () => store.complete_coin_spend(store.current_drafts.find(d => d.kind === 'coin_spend').draft_id), discard_media: () => store.discard_media('owned_audio'),
  }
  const pending = actions[kind](); assert.equal(typeof release, 'function'); store.logout(); assert.equal((await store.login('cimoa@gmail.com', '12341234')).success, true)
  const before = clone_data(store.data), count = f.writes(), ids = [...f.blobs.keys()]; release({ duration_ms: 0 })
  assert.equal((await pending).success, false); assert.deepEqual(store.data, before); assert.equal(f.writes(), count); assert.deepEqual([...f.blobs.keys()], ids)
})
test('block filters every shared entry after fresh hydration; unblock never resurrects direct consent, messages, requests or calls', () => {
  const f = fixture(), { store } = f; assert.equal(store.join_event('event_picnic').success, true)
  const call = store.start_waiting_call('conversation_chloe'); assert.equal(call.success, true)
  assert.equal(store.block_user('user_chloe').success, true)
  for (const current of [store, f.attach()]) {
    assert.equal(current.home_feed.cards.some(c => c.user_id === 'user_chloe'), false); assert.equal(current.visible_people.some(p => p.user_id === 'user_chloe'), false)
    assert.equal(current.user_by_id('user_chloe'), null); assert.equal(current.can_chat('user_chloe'), false); assert.equal(current.direct_conversation('conversation_chloe'), null)
    assert.equal(current.event_people('event_picnic').some(p => p.user_id === 'user_chloe'), false); assert.equal(current.event_group('event_picnic', 'group_picnic').messages.some(m => m.sender_id === 'user_chloe'), false)
    assert.equal(current.waiting_call(call.data), null)
  }
  assert.equal(store.unblock_user('user_chloe').success, true)
  const restored = f.attach(); assert.equal(restored.can_chat('user_chloe'), false); assert.equal(restored.direct_conversation('conversation_chloe'), null); assert.equal(restored.waiting_call(call.data), null)
})
test('profile, event membership, UTC quota and absolute match deadlines restore without read writes or restart', () => {
  const f = fixture(), { store } = f
  assert.equal(store.save_profile_section('basic', { user_name: 'Robin', major: 'Design', pronouns: 'they / them', year: 'Year 3' }, store.session.account_id).success, true)
  assert.equal(store.join_event('event_picnic').success, true); const started = store.start_match('sync_match'); assert.equal(started.success, true)
  const match = store.match_by_id(started.data), writes = f.writes(); f.advance(2000)
  const restored = f.attach(); assert.equal(restored.current_user.user_name, 'Robin'); assert.equal(restored.current_user.major, 'Design'); assert.equal(restored.event_by_id('event_picnic').joined, true)
  assert.equal(restored.match_by_id(started.data).search_ready_at, match.search_ready_at); assert.equal(restored.free_matches_remaining, 2); assert.equal(f.writes(), writes)
  f.advance(10000); assert.equal(store.free_matches_remaining, 3); assert.equal(f.writes(), writes)
})
test('refresh never reseeds removed catalog photos/questions into edited or deleted people', () => {
  const f = fixture(data => {
    const user = data.users.find(u => u.user_id === 'user_noah'); user.photo_ids = []; user.icebreaker_ids = []; user.deleted = true; user.discoverable = false
    data.profile_photos = data.profile_photos.filter(p => p.user_id !== user.user_id); data.icebreakers = data.icebreakers.filter(q => q.user_id !== user.user_id)
  })
  for (const store of [f.store, f.attach()]) { assert.equal(store.data.profile_photos.some(p => p.user_id === 'user_noah'), false); assert.equal(store.data.icebreakers.some(q => q.user_id === 'user_noah'), false) }
})
test('a late discard compensation cannot restore media belonging to a deleted account', async () => {
  const f = fixture(data => data.media_files.push({ media_id: 'discard_during_delete', owner_user_id: 'user_cimoa', kind: 'audio', media_url: 'indexeddb://discard_during_delete', mime: 'audio/wav', byte_size: 5, duration_ms: 1500 }))
  f.blobs.set('discard_during_delete', new Blob(['audio'], { type: 'audio/wav' }))
  let release, first = true
  configure_store_runtime(f.store, { media: { ...f.media, delete: async id => {
    if (first) { first = false; await new Promise(resolve => { release = resolve }) }
    f.blobs.delete(id)
  } } })
  const discard = f.store.discard_media('discard_during_delete')
  await Promise.resolve(); assert.equal(typeof release, 'function')
  assert.equal((await f.store.delete_account('12341234')).success, true)
  release(); assert.equal((await discard).success, false)
  assert.equal(f.blobs.size, 0); assert.equal(f.store.data.media_files.some(m => m.media_id === 'discard_during_delete'), false)
  assert.equal(f.attach().data.media_files.some(m => m.media_id === 'discard_during_delete'), false)
})
