import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { validate_data } from '../src/stores/selectors.js'

const epoch = Date.UTC(2026, 9, 17, 10)
test('waiting calls persist one absolute deadline, isolate login/connection ownership and never imply an answer', () => {
  const f = fixture(), { store } = f
  const call = store.start_waiting_call('conversation_chloe', 'call-once')
  assert.equal(call.success, true)
  assert.equal(store.start_waiting_call('conversation_chloe', 'call-once').repeated, true)
  assert.equal(store.start_waiting_call('conversation_chloe', 'another-click').data, call.data)
  assert.equal(store.data.call_sessions.length, 1)
  const row = store.waiting_call(call.data)
  assert.ok(row.expires_at - row.started_at >= 8000 && row.expires_at - row.started_at <= 12000)
  assert.equal(row.status, 'waiting')
  f.advance(4500)
  assert.equal(store.waiting_call(call.data).expires_at, row.expires_at)
  const reloaded = fixture(f.disk.get(STATE_KEY)).store
  assert.equal(reloaded.waiting_call(call.data).expires_at, row.expires_at)
  f.advance(8000); assert.equal(store.waiting_call(call.data).status, 'timeout')
  assert.equal(store.data.call_sessions[0].ended_at, null)
  const next = store.start_waiting_call('conversation_chloe', 'next-call')
  f.fail(true); const before = clone_data(store.data)
  assert.equal(store.end_waiting_call(next.data).success, false); assert.deepEqual(clone_data(store.data), before)
  f.fail(false); assert.equal(store.end_waiting_call(next.data).success, true); assert.equal(store.waiting_call(next.data).status, 'ended')
  store.data.session.expires_at += 1; assert.equal(store.waiting_call(call.data), null)
  store.block_user('user_chloe'); assert.equal(store.data.call_sessions.length, 0)
  assert.equal(store.start_waiting_call('conversation_chloe', 'call-once').success, false)
})
test('call creation failure, privacy, expiry, corrupt deadlines and old saves remain safe', () => {
  const f = fixture(), { store } = f, before = clone_data(store.data)
  f.fail(true); assert.equal(store.start_waiting_call('conversation_chloe').success, false); assert.deepEqual(clone_data(store.data), before)
  f.fail(false); store.data.settings[0].privacy.allow_video = false
  assert.equal(store.start_waiting_call('conversation_chloe').success, false)
  store.data.settings[0].privacy.allow_video = true
  const call = store.start_waiting_call('conversation_chloe'); const bad = clone_data(store.data); bad.call_sessions[0].expires_at += 13000
  assert.throws(() => validate_data(bad), /waiting call/)
  f.advance(31 * 86400000); assert.equal(store.waiting_call(call.data), null)
  assert.equal(store.end_waiting_call(call.data).success, false)
  const old = create_seed(epoch); delete old.call_sessions
  const migrated = fixture(old); assert.deepEqual(migrated.store.data.call_sessions, []); assert.equal(migrated.writes(), 0)
})
function fixture(saved = create_seed(epoch)) {
  let fail = false, writes = 0, now = epoch
  const disk = new Map([[STATE_KEY, saved]]), store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence: { read: key => clone_data(disk.get(key) ?? null), write: (key, data) => { if (fail) throw Error('Storage full'); writes++; disk.set(key, clone_data(data)) } } })
  assert.equal(store.hydrate().success, true)
  return { store, disk, fail: value => { fail = value }, writes: () => writes, advance: ms => { now += ms; store.tick() } }
}
function text_invite(store, id = 'incoming') {
  store.data.requests = store.data.requests.filter(row => row.request_id !== 'request_lina')
  store.data.requests.push({ request_id: id, sender_id: 'user_lina', recipient_id: 'user_cimoa', question_id: 'user_cimoa_q_0', question_text: 'How would you spend your ideal weekend?', kind: 'text', text: 'A long walk and coffee by the sea.', audio_id: null, status: 'pending', created_at: epoch - 1000, resolved_at: null })
  return id
}
test('ConnectionRequest → Connection → unique Conversation commits atomically and retry is idempotent with the same operation', () => {
  const f = fixture(), { store } = f, id = text_invite(store)
  assert.equal(store.connection_request(id).can_accept, true); assert.equal(store.connection_by_user('user_lina'), null)
  const before = clone_data(store.data); f.fail(true)
  assert.equal(store.accept_request(id, 'accept-once').success, false); assert.deepEqual(clone_data(store.data), before)
  f.fail(false); const first = store.accept_request(id, 'accept-once'), repeated = store.accept_request(id, 'accept-once')
  assert.equal(first.success, true); assert.equal(repeated.repeated, true); assert.equal(first.data, repeated.data)
  assert.equal(store.connection_request(id).conversation_id, first.data)
  const connection = store.connection_by_user('user_lina'), conversation = store.direct_conversation(first.data)
  assert.equal(connection.source_request_id, id); assert.equal(connection.conversation_id, first.data); assert.equal(conversation.connection_id, connection.connection_id)
  assert.equal(conversation.messages.length, 1); assert.equal(conversation.messages[0].sender_id, 'user_lina'); assert.equal(conversation.unread_count, 1)
  assert.equal(conversation.preview, 'A long walk and coffee by the sea.')
  assert.equal(store.data.conversations.filter(row => row.participant_ids.includes('user_lina')).length, 1)
  assert.equal(store.decline_request(id, 'opposite-decision').success, false)
  assert.equal(store.connection_by_id(connection.connection_id).user_id, 'user_lina')
  connection.shared_interests.length = 0; assert.ok(store.connection_by_user('user_lina').shared_interests.length)
  assert.equal(fixture(f.disk.get(STATE_KEY)).store.direct_conversation(first.data).preview, conversation.preview)
})
test('declining, cancellation, wrong actor and duplicate pending do not establish either consent or chat', async () => {
  const { store } = fixture(), id = text_invite(store)
  assert.equal(store.cancel_request(id, 'wrong-actor').success, false)
  assert.equal((await store.send_introduction({ user_id: 'user_lina', question_id: 'user_lina_q_0', text: 'Crossed request', operation_id: 'crossed' })).success, false)
  assert.equal(store.decline_request(id, 'decline-once').success, true); assert.equal(store.decline_request(id, 'decline-once').repeated, true)
  assert.equal(store.can_chat('user_lina'), false); assert.equal(store.connection_by_user('user_lina'), null)
  const sent = await store.send_introduction({ user_id: 'user_lina', question_id: 'user_lina_q_0', text: 'A new introduction.', operation_id: 'new' })
  assert.equal(sent.success, true); assert.equal(store.connection_request(sent.data).can_cancel, true)
  assert.equal(store.accept_request(sent.data).success, false); assert.equal(store.cancel_request(sent.data, 'cancel-once').success, true)
  assert.equal(store.connection_request(sent.data).status, 'cancelled'); assert.equal(store.can_chat('user_lina'), false)
})
test('request keeps the question as sent, including after profile editing and additive legacy migration', async () => {
  const data = create_seed(epoch); delete data.requests[0].question_text
  const f = fixture(data), { store } = f
  assert.equal(f.writes(), 0); assert.equal(store.request_detail('request_lina').question, 'How would you spend your ideal weekend?')
  const sent = await store.send_introduction({ user_id: 'user_noah', question_id: 'user_noah_q_0', text: 'Coffee after class?', operation_id: 'snapshot' })
  const original = store.request_detail(sent.data).question
  store.data.icebreakers.find(row => row.question_id === 'user_noah_q_0').text = 'A changed profile question.'
  assert.equal(store.request_detail(sent.data).question, original)
})
test('block invalidates the connection generation, accepted result and operation replay; unblock never restores consent', () => {
  const { store } = fixture(), id = text_invite(store), accepted = store.accept_request(id, 'accept-original')
  const original = store.connection_by_user('user_lina').connection_id
  assert.equal(store.block_user('user_lina').success, true); assert.equal(store.connection_by_id(original), null)
  assert.equal(store.direct_conversation(accepted.data), null); assert.equal(store.request_detail(id), null)
  store.unblock_user('user_lina')
  assert.equal(store.connection_by_user('user_lina'), null); assert.equal(store.request_detail(id).conversation_id, null)
  assert.equal(store.accept_request(id, 'accept-original').success, false)
  text_invite(store, 'new-generation'); assert.equal(store.accept_request('new-generation', 'accept-new').success, true)
  assert.notEqual(store.connection_by_user('user_lina').connection_id, original)
  assert.equal(store.request_detail(id).conversation_id, null)
})
test('message ownership, private read receipts and media types cannot cross conversations', () => {
  for (const mutate of [data => { data.messages[0].sender_id = 'user_lina' }, data => { data.messages[0].read_by.push('user_lina') }, data => { data.messages[0].read_by.push(data.messages[0].read_by[0]) }, data => { data.messages[0].sent_at = null }]) {
    const data = create_seed(epoch); mutate(data); assert.throws(() => validate_data(data), /private message/)
  }
  const { store } = fixture(); assert.equal(store.mark_read('conversation_chloe').success, true)
  assert.equal(store.direct_conversation('conversation_chloe').unread_count, 0)
  assert.equal(store.direct_conversation('group_picnic'), null)
})
test('session expiry hides all three core entities and preserves saved state on rejected writes', () => {
  const f = fixture(), { store } = f
  text_invite(store); const result = store.accept_request('incoming', 'expire-case')
  f.advance(31 * 86400000)
  assert.equal(store.connection_request('incoming'), null); assert.deepEqual(store.connections, []); assert.equal(store.direct_conversation(result.data), null)
  const before = clone_data(store.data); assert.equal(store.accept_request('incoming', 'expire-case').success, false); assert.deepEqual(clone_data(store.data), before)
})
test('expired profiles cannot acquire new consent, but declining remains available and existing conversations survive', async () => {
  const { store } = fixture(), id = text_invite(store)
  store.data.users.find(row => row.user_id === 'user_lina').verification_status = 'expired'
  const before = clone_data(store.data)
  assert.equal(store.accept_request(id, 'expired-accept').success, false); assert.deepEqual(clone_data(store.data), before)
  assert.equal((await store.send_introduction({ user_id: 'user_lina', question_id: 'user_lina_q_0', text: 'New request', operation_id: 'expired-intro' })).success, false)
  assert.equal(store.decline_request(id, 'expired-decline').success, true)
  store.data.users.find(row => row.user_id === 'user_chloe').verification_status = 'expired'
  assert.ok(store.direct_conversation('conversation_chloe'))
  store.data.match_sessions.push({ ...clone_data(store.data.match_sessions[0]), match_id: 'expired-peer', owner_user_id: 'user_noah', candidate_id: 'user_cimoa', status: 'waiting', self_accepted: true, peer_accepted: false })
  store.data.users.find(row => row.user_id === 'user_noah').verification_status = 'expired'
  assert.equal(store.respond_to_match('expired-peer', 'accepted').success, false)
  assert.equal(store.respond_to_match('expired-peer', 'declined').success, true)
})
test('consent provenance cannot point at a request or match belonging to another pair', () => {
  const data = create_seed(epoch); data.relationships[0].source_request_id = 'request_lina'
  assert.throws(() => validate_data(data), /connection request consent/)
  delete data.relationships[0].source_request_id; data.relationships[0].source_match_id = data.match_sessions[0].match_id
  assert.throws(() => validate_data(data), /matching consent/)
})
test('a legacy one-way consent is renewed by the explicit request and acceptance, not mistaken for an old generation', () => {
  const { store } = fixture(), id = text_invite(store)
  store.data.relationships.push({ relationship_id: 'legacy_one_way', from_user_id: 'user_lina', to_user_id: 'user_cimoa', created_at: epoch - 5000 })
  assert.equal(store.connection_by_user('user_lina'), null)
  const accepted = store.accept_request(id, 'complete-two-directions')
  assert.equal(accepted.success, true); assert.equal(store.connection_by_user('user_lina').source_request_id, id); assert.equal(store.request_detail(id).conversation_id, accepted.data)
})
test('leaving during an asynchronous voice read cannot send a request or deduct coins', async () => {
  const { store } = fixture(), blob = new Blob(['voice'], { type: 'audio/wav' })
  store.data.media_files.push({ media_id: 'cancelled_voice', owner_user_id: 'user_cimoa', kind: 'audio', mime: blob.type, media_url: 'indexeddb://cancelled_voice', byte_size: blob.size, duration_ms: 1000 })
  let release, active = true
  configure_store_runtime(store, { media: { get: () => new Promise(resolve => { release = resolve }) } })
  const before = clone_data(store.data), pending = store.send_introduction({ user_id: 'user_noah', question_id: 'user_noah_q_0', kind: 'voice', audio_id: 'cancelled_voice', operation_id: 'cancel-mid-read' }, { is_current: () => active })
  active = false; release(blob)
  assert.equal((await pending).reason, 'cancelled'); assert.deepEqual(clone_data(store.data), before)
})
test('cancelled media publication compensates a Blob already written without publishing its metadata', async () => {
  const { store } = fixture(), blobs = new Map(), blob = new Blob(['voice'], { type: 'audio/wav' })
  let active = true
  configure_store_runtime(store, { inspect_media: async () => ({ duration_ms: 1000 }), media: { put: async (id,value) => { blobs.set(id,value); active = false }, delete: async id => blobs.delete(id) } })
  const before = clone_data(store.data)
  assert.equal((await store.save_media(blob, 'audio', 1000, { is_current: () => active })).reason, 'cancelled')
  assert.equal(blobs.size, 0); assert.deepEqual(clone_data(store.data), before)
})
test('either participant can disable call access without deleting their valid conversation', () => {
  const { store } = fixture()
  assert.equal(store.direct_conversation('conversation_chloe').can_call, true)
  store.data.settings[0].privacy.allow_video = false
  assert.equal(store.direct_conversation('conversation_chloe').can_call, false)
  store.data.settings[0].privacy.allow_video = true
  store.data.settings.push({ owner_user_id: 'user_chloe', privacy: { allow_video: false } })
  assert.match(store.direct_conversation('conversation_chloe').call_blocker, /turned off/)
  assert.equal(store.can_chat('user_chloe'), true)
})
