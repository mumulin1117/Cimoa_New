import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, TEST_USER_ID, clone_data } from '../src/stores/seed.js'
import { validate_data, home_cards, utc_date_key } from '../src/stores/selectors.js'
import { SCENARIOS, create_scenario, create_source_scenario } from '../src/stores/scenarios.js'
import { STATE_KEY, LEGACY_KEY } from '../src/utils/statePersistence.js'
import { create_media_cache } from '../src/utils/mediaRepository.js'
import { create_recorder, read_permissions } from '../src/utils/mediaCapabilities.js'
import { create_write_operation } from '../src/utils/writeOperation.js'
import { create_waiting_call } from '../src/utils/waitingCall.js'
import { create_purchase_bridge } from '../src/utils/iapBridge.js'
import { fake_clock } from './lib/fake-clock.mjs'

const now = Date.UTC(2026, 9, 13, 23, 59, 50)
function fixture(name = 'default', overrides = {}) {
  const clock = fake_clock(now), disk = new Map([[STATE_KEY, create_scenario(name, now)]]), blobs = new Map()
  const persistence = { read: (key) => clone_data(disk.get(key) ?? null), write: (key, value) => { disk.set(key, clone_data(value)) } }
  const media = { put: async (id, blob) => { blobs.set(id, blob) }, get: async (id) => blobs.get(id), delete: async (id) => { blobs.delete(id) } }
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence, media, clock: clock.now, inspect_media: async (_, kind) => ({ duration_ms: kind === 'audio' ? 1500 : 0 }), services: {}, ...overrides })
  assert.equal(store.hydrate().success, true)
  return { store, clock, disk, blobs, persistence, media }
}
test('source fixtures and independent UI scenarios have valid references and canonical people', () => {
  for (const name of SCENARIOS) assert.equal(validate_data(create_scenario(name, now)), true, name)
  const inventory = JSON.parse(fs.readFileSync('docs/cimoa-page-inventory.json'))
  for (const page of inventory) assert.equal(validate_data(create_source_scenario(page.source_query, now).data), true, page.source_query)
  const { store } = fixture()
  assert.deepEqual(store.home_connections.map((row) => [row.user.user_name, row.user.university, row.kind]), [['Chloe Lin', 'HKUST', 'connected'], ['Liam Park', 'Stanford', 'auto_match'], ['Lina', 'HKU', 'invite']])
  assert.equal(store.coin_balance, 260); assert.equal(store.free_matches_remaining, 3)
  assert.equal(store.can_chat('user_lina'), false); assert.equal(store.can_chat('user_liam'), false)
  const multi = fixture('three_chats').store
  assert.equal(multi.current_conversations.length, 3)
  assert.ok(multi.current_conversations.every((row) => row.messages.length >= 3 && row.messages.length <= 6))
})
test('fixture login validates identity; logout/deletion and expired sessions hide private data', async () => {
  const { store } = fixture()
  assert.equal(store.logout().success, true); assert.equal(store.current_conversations.length, 0)
  assert.equal((await store.login('cimoa@gmail.com', 'wrong')).success, false)
  assert.equal((await store.login(' Cimoa@gmail.com ', '12341234')).success, true)
  assert.equal(store.create_account({ email: 'cimoa@gmail.com' }).reason, 'email_exists')
  assert.equal((await store.delete_account('wrong')).success, false)
  assert.equal((await store.delete_account('12341234')).success, true)
  assert.equal((await store.login('cimoa@gmail.com', '12341234')).success, false)
  assert.equal(fixture('session_expired').store.home_connections.length, 0)
})
test('free text at zero coins changes no ledger; retries and duplicate pending requests are safe', async () => {
  const { store } = fixture('zero_coins')
  const args = { user_id: 'user_liam', question_id: 'user_liam_q_0', text: 'A long walk and good coffee.', operation_id: 'intro-1' }
  assert.equal((await store.send_introduction({ ...args, text: ' ' })).success, false)
  const result = await store.send_introduction(args)
  assert.equal(result.success, true); assert.equal(store.coin_balance, 0); assert.equal(store.coin_transactions.length, 0)
  assert.equal((await store.send_introduction(args)).data, result.data)
  assert.equal((await store.send_introduction({ ...args, operation_id: 'intro-2' })).success, false)
  assert.equal(store.data.requests.filter((row) => row.sender_id === TEST_USER_ID).length, 1)
})
test('request acceptance is directional, atomic and synchronizes Home and chat', () => {
  const { store } = fixture()
  assert.equal(store.cancel_request('request_lina').success, false)
  const result = store.accept_request('request_lina'); assert.equal(result.success, true)
  assert.equal(store.can_chat('user_lina'), true)
  assert.equal(store.home_connections.find((row) => row.user_id === 'user_lina').conversation_id, result.data)
  assert.equal(store.accept_request('request_lina').success, false)
  assert.equal(fixture().store.decline_request('request_lina').success, true)
})
test('write failures roll back profiles, ledger, requests, reports, quota and membership together', async () => {
  const { store } = fixture('quota_used', { services: { matching_available: true } })
  const before = clone_data(store.data)
  configure_store_runtime(store, { persistence: { read: () => null, write() { throw new Error('Storage full. Please free space and retry.') } } })
  for (const action of [() => store.update_profile({ user_name: 'New name' }), () => store.start_match('failed'), () => store.accept_request('request_lina'), () => store.join_event('event_picnic'), () => store.submit_report({ target_type: 'user', target_id: 'user_liam', reason: 'Spam', also_block: true })]) { assert.equal(action().success, false); assert.deepEqual(clone_data(store.data), before) }
  assert.equal((await store.send_introduction({ user_id: 'user_liam', question_id: 'user_liam_q_0', text: 'Hi there', operation_id: 'failed-text' })).success, false)
  assert.deepEqual(clone_data(store.data), before)
})
test('UTC midnight resets quota without changing stored history or using device timezone', async () => {
  const { store, clock, disk } = fixture('quota_used', { services: { matching_available: true } })
  const paid = store.start_match('paid'); assert.equal(paid.success, true); assert.equal(store.coin_balance, 250)
  assert.equal(store.start_match('paid').repeated, true); assert.equal(store.coin_balance, 250)
  assert.equal(store.transition_match(paid.data, 'left').success, true)
  await clock.advance(10000); store.tick(); assert.equal(store.free_matches_remaining, 3)
  assert.equal(utc_date_key(clock.now()), '2026-10-14')
  assert.equal(store.start_match('new-day').success, true); assert.equal(store.coin_balance, 250)
  assert.deepEqual(store.data.match_quota.map((row) => row.used_count), [3, 1])
  const restored = use_app_store(createPinia()); configure_store_runtime(restored, { persistence: { read: (key) => disk.get(key) ?? null }, clock: clock.now }); assert.equal(restored.hydrate().success, true); assert.equal(restored.free_matches_remaining, 2)
  const exhausted = fixture('zero_coins', { services: { matching_available: true } }).store
  exhausted.data.match_quota = [{ owner_user_id: TEST_USER_ID, date_key: utc_date_key(now), used_count: 3 }]
  assert.equal(exhausted.start_match('no-coins').success, false); assert.equal(exhausted.coin_balance, 0)
})
test('matching state machine requires trusted peer events and retains exact deadlines', async () => {
  const { store, clock } = fixture('home_empty', { services: { matching_available: true, verify_match_event: async () => true } })
  const id = store.start_match('match-1').data
  assert.equal(store.boost_match(id, 'boost-1').success, true); const deadline = store.active_match.priority_until
  assert.equal(store.boost_match(id, 'boost-1').repeated, true); assert.equal(store.coin_balance, 240)
  assert.equal(store.boost_match(id, 'boost-2').success, false)
  assert.equal(store.transition_match(id, 'paused').success, true); assert.equal(store.transition_match(id, 'searching').success, true)
  assert.equal((await store.apply_match_event({ event_id: 'found-1', type: 'found', match_id: id, user_id: 'user_liam' })).success, true)
  assert.equal(store.transition_match(id, 'connected').success, false)
  assert.equal(store.transition_match(id, 'waiting').success, true)
  assert.equal((await store.apply_match_event({ event_id: 'accepted-1', type: 'accepted', match_id: id, user_id: 'user_liam' })).success, true)
  assert.equal(store.can_chat('user_liam'), true); assert.equal(store.match_by_id(id).priority_until, deadline)
  const expires = fixture('match_found'); await expires.clock.advance(45001); expires.store.tick(); assert.equal(expires.store.match_by_id('match_liam').status, 'expired'); assert.equal(expires.store.transition_match('match_liam', 'waiting').success, false)
})
test('events enforce capacity, unique memberships, ended dates and group access', async () => {
  const { store } = fixture()
  assert.equal(store.join_event('event_badminton').success, false)
  assert.equal((await store.send_message('group_picnic', 'Not joined')).success, false)
  assert.equal(store.join_event('event_picnic').success, true); assert.equal(store.join_event('event_picnic').success, false)
  assert.equal(store.event_participants('event_picnic').length, 4)
  assert.equal((await store.send_message('group_picnic', 'See you soon', 'group-send')).success, true)
  assert.equal(store.leave_event('event_picnic').success, true); assert.equal(store.messages_for_conversation('group_picnic').length, 0)
  assert.equal(fixture('event_past').store.join_event('event_picnic').success, false)
})
test('blocking filters Home, people, participants and direct/group messages; unblocking adds no relationships', () => {
  const { store } = fixture('event_joined')
  assert.equal(store.block_user('user_chloe').success, true)
  assert.ok(!store.home_connections.some((row) => row.user_id === 'user_chloe'))
  assert.equal(store.current_conversations.length, 0)
  assert.ok(store.messages_for_conversation('group_picnic').every((row) => row.sender_id !== 'user_chloe'))
  assert.ok(store.event_participants('event_picnic').every((row) => row.user_id !== 'user_chloe'))
  const edges = store.data.relationships.length; assert.equal(store.unblock_user('user_chloe').success, true); assert.equal(store.data.relationships.length, edges)
  assert.equal(store.submit_report({ target_type: 'user', target_id: TEST_USER_ID, reason: 'Spam' }).success, false)
  assert.equal(store.submit_report({ target_type: 'event', target_id: 'event_picnic', reason: 'Incorrect information' }).success, true); assert.equal(store.current_reports[0].status, 'local_saved')
})
test('purchase callbacks enforce package, owner, receipt, full timeout, retry and refund idempotence', async () => {
  const { store } = fixture('default', { services: { verify_purchase: async () => true, verify_refund: async () => true } })
  store.data.coin_packages[0].product_id = 'test.cimoa.60'
  const id = store.begin_purchase('pkg_60', 'purchase-1').data
  const receipt = { status: 'success', product_id: 'test.cimoa.60', owner_user_id: TEST_USER_ID, package_id: 'pkg_60', receipt_id: 'test-receipt' }
  assert.equal((await store.settle_purchase(id, { ...receipt, owner_user_id: 'wrong' })).success, false); assert.equal(store.coin_balance, 260)
  assert.equal((await store.settle_purchase(id, receipt)).success, true); assert.equal(store.coin_balance, 320)
  assert.equal((await store.settle_purchase(id, receipt)).success, false); assert.equal(store.coin_balance, 320)
  for (const status of ['failure', 'cancelled', 'timeout']) { const request = store.begin_purchase('pkg_60', `purchase-${status}`).data; assert.equal((await store.settle_purchase(request, { status })).success, true); assert.equal((await store.settle_purchase(request, receipt)).success, false); assert.equal(store.coin_balance, 320) }
  assert.equal((await store.apply_refund('txn_seed_1', { event_id: 'refund-1' })).success, true); assert.equal(store.coin_balance, 340)
  assert.equal((await store.apply_refund('txn_seed_1', { event_id: 'refund-1' })).repeated, true); assert.equal((await store.apply_refund('txn_seed_1', { event_id: 'refund-2' })).success, false)
  const clock = fake_clock(), bridge = create_purchase_bridge({ timers: clock, send() {} }), payload = { request_id: 'host-1', package_id: 'pkg_60', owner_user_id: TEST_USER_ID, product_id: 'test.cimoa.60' }
  let settled = false; const promise = bridge.request(payload).then((result) => { settled = true; return result })
  assert.equal(bridge.resolve('host-1', { ...receipt, product_id: 'wrong' }), false)
  await clock.advance(7999); assert.equal(settled, false); await clock.advance(1); assert.equal((await promise).status, 'timeout'); assert.equal(bridge.resolve('host-1', receipt), false); assert.equal(clock.pending(), 0)
})
test('missing services and audio fail honestly without business changes', async () => {
  const { store } = fixture(); const before = clone_data(store.data)
  for (const result of [store.create_account({ email: 'new@example.com' }), store.reset_password(), store.apply_verification(), store.submit_support(), store.start_match('unavailable')]) assert.equal(result.success, false)
  assert.equal((await store.send_introduction({ user_id: 'user_liam', question_id: 'user_liam_q_0', kind: 'voice', audio_id: 'missing', operation_id: 'voice' })).success, false)
  assert.deepEqual(clone_data(store.data), before)
})
test('media persistence, refresh, voice payment and metadata failure compensation', async () => {
  const f = fixture(), audio = new Blob(['audio-fixture'], { type: 'audio/webm' })
  const saved = await f.store.save_media(audio, 'audio'); assert.equal(saved.success, true)
  const args = { user_id: 'user_liam', question_id: 'user_liam_q_0', kind: 'voice', audio_id: saved.data.media_id, operation_id: 'voice-1' }
  assert.equal((await f.store.send_introduction(args)).success, true); assert.equal(f.store.coin_balance, 250)
  assert.equal((await f.store.send_introduction(args)).repeated, true); assert.equal(f.store.coin_balance, 250)
  const restore = use_app_store(createPinia()); configure_store_runtime(restore, { persistence: f.persistence, media: f.media, clock: f.clock.now }); assert.equal(restore.hydrate().success, true); assert.equal(restore.data.media_files[0].media_url, saved.data.media_url)
  const before = f.blobs.size; configure_store_runtime(f.store, { persistence: { ...f.persistence, write() { throw new Error('Full') } } }); assert.equal((await f.store.save_media(audio, 'audio')).success, false); assert.equal(f.blobs.size, before)
  const broken = fixture('default', { inspect_media: async () => { throw new Error('Decode failed') } }); assert.equal((await broken.store.save_media(audio, 'audio')).success, false); assert.equal(broken.blobs.size, 0)
})
test('object URLs are reference counted, idle-expired and never revoke active readers', async () => {
  const clock = fake_clock(), revoked = [], cache = create_media_cache({ get: async () => new Blob(['image']) }, { createObjectURL: () => 'blob:fixture', revokeObjectURL: (url) => revoked.push(url) }, clock.now, clock)
  const a = await cache.acquire('indexeddb://test'), b = await cache.acquire('indexeddb://test'); a.release(); await clock.advance(120000); assert.equal(revoked.length, 0); b.release(); await clock.advance(119999); assert.equal(revoked.length, 0); await clock.advance(1); assert.deepEqual(revoked, ['blob:fixture']); assert.equal(clock.pending(), 0)
})
test('microphone denial/no-device/unavailable and permission queries report real failures', async () => {
  for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError']) await assert.rejects(create_recorder({ Recorder: class {}, devices: { getUserMedia: async () => { throw { name } } } }), /denied|found|opened/)
  await assert.rejects(create_recorder({ devices: {}, Recorder: null }), /unavailable/)
  assert.equal((await read_permissions({ permissions: { query: async () => { throw new Error() } } })).microphone, 'unavailable')
})
test('write loading is before mutation, rejects repeats and resolves cancellation without leaked timers', async () => {
  const clock = fake_clock(), states = [], operation = create_write_operation({ timers: clock, set_loading: (state) => states.push(state) }); let writes = 0
  const promise = operation.run(() => { writes++; return { success: true } }); assert.equal(states[0], true)
  assert.equal((await operation.run(() => {})).reason, 'busy'); await clock.advance(499); assert.equal(writes, 0); await clock.advance(1); assert.equal((await promise).success, true); assert.equal(writes, 1)
  const cancelled = operation.run(() => { writes++ }); operation.cancel(); assert.equal((await cancelled).reason, 'cancelled'); await clock.advance(1000); assert.equal(writes, 1); assert.equal(clock.pending(), 0)
})
test('waiting call honors 450ms dots, 8/12s limits, one end and unmount cleanup', async () => {
  for (const random of [0, 1]) {
    const clock = fake_clock(), dots = [], ended = [], call = create_waiting_call({ random: () => random, timers: clock, on_dots: (v) => dots.push(v), on_end: (r) => ended.push(r) })
    await clock.advance(450); assert.equal(dots.length, 1); await clock.advance(7550 + random * 4000); assert.deepEqual(ended, ['timeout']); assert.equal(call.end(), false); assert.equal(clock.pending(), 0)
  }
  const clock = fake_clock(), ended = []; const call = create_waiting_call({ timers: clock, on_dots() {}, on_end: (r) => ended.push(r) }); call.dispose(); await clock.advance(13000); assert.equal(ended.length, 0); assert.equal(clock.pending(), 0)
})
test('hydration is read-only, preserves legacy custom content and rejects corrupt saves', () => {
  const legacy = { current_user: { user_id: 'user_hottix', user_name: 'My edited name', coin_balance: 270, bio: 'My saved bio' }, posts: [{ body: 'My original post' }], unknown_custom_field: [1, 2] }
  let writes = 0; const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence: { read: (key) => key === LEGACY_KEY ? legacy : null, write() { writes++ } } })
  assert.equal(store.hydrate().success, true); assert.equal(writes, 0); assert.equal(store.current_user.user_name, 'My edited name'); assert.deepEqual(store.legacy_recovery, legacy); assert.equal(store.user_by_id('user_chloe').university, 'HKUST')
  assert.equal(store.hydrate().success, true); assert.equal(writes, 0)
  assert.equal(store.update_profile({ bio: 'Updated bio' }).success, true); assert.equal(writes, 1)
  const corrupt = use_app_store(createPinia()); configure_store_runtime(corrupt, { persistence: { read: () => ({ schema_version: 999 }), write() { throw new Error('Must not write') } } }); assert.equal(corrupt.hydrate().success, false); assert.equal(corrupt.home_connections.length, 0)
})

test('all seeded local media resolve offline; defaults never reference invented image files', () => {
  const data = create_seed(now)
  const paths = JSON.stringify(data).match(/\/static\/assets\/[^"\s]+\.(?:png|jpg|woff2)/g) || []
  assert.ok(paths.length > 30)
  for (const path of paths) assert.ok(fs.existsSync(path.slice(1)), path)
})

test('switching accounts isolates drafts, coins, reports, blocked users and conversations', async () => {
  const { store } = fixture()
  assert.equal(store.save_draft('support', null, { body: 'Private draft' }).success, true)
  store.data.accounts.push({ ...store.data.accounts[0], account_id: 'account_alex', user_id: 'user_alex', email: 'alex@example.test' })
  assert.equal((await store.login('alex@example.test', '12341234')).success, true)
  assert.equal(store.current_user.user_id, 'user_alex'); assert.equal(store.coin_balance, 0); assert.equal(store.current_drafts.length, 0); assert.equal(store.current_reports.length, 0); assert.equal(store.blocked_accounts.length, 0); assert.equal(store.current_conversations.length, 0); assert.equal(store.legacy_recovery, null)
  assert.equal(store.update_profile({ user_id: TEST_USER_ID }).success, false)
})
