import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { validate_data } from '../src/stores/selectors.js'

const epoch = Date.UTC(2026, 9, 17, 10)
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
