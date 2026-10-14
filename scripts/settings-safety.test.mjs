import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data, TEST_USER_ID } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'

const now = Date.UTC(2026, 9, 14, 8)
const fixture = ({ guest = false, fail_write = false } = {}) => {
  let disk = create_seed(now)
  if (guest) disk.session = { account_id: null, current_user_id: null, expires_at: null }
  const blobs = new Map([['owned_media', new Blob(['photo'], { type: 'image/png' })]])
  const store = use_app_store(createPinia())
  const persistence = { read: key => key === STATE_KEY ? clone_data(disk) : null, write: (_, value) => { if (fail_write) throw Error('Storage full'); disk = clone_data(value) } }
  configure_store_runtime(store, { clock: () => now, persistence, media: { get: async id => blobs.get(id), put: async (id, blob) => blobs.set(id, blob), delete: async id => blobs.delete(id) }, inspect_media: async (_, kind) => ({ duration_ms: kind === 'audio' ? 1500 : 0 }) })
  assert.equal(store.hydrate().success, true)
  return { store, blobs, snapshot: () => clone_data(disk) }
}

test('privacy choices persist through the Store and gate Discover, Auto Match, fields and events', () => {
  const { store } = fixture()
  assert.equal(store.privacy_visibility, 'discover')
  assert.equal(store.set_privacy_visibility('auto_match').success, true)
  assert.equal(store.privacy_visibility, 'auto_match')
  assert.equal(store.current_settings.privacy.discover_visible, false)
  assert.equal(store.current_settings.privacy.auto_match_visible, true)
  assert.equal(store.set_privacy_visibility('hidden').success, true)
  assert.equal(store.current_settings.privacy.auto_match_visible, false)
  assert.equal(store.update_settings('privacy', { show_year: false, show_field: false, event_visible: false }).success, true)
  const other = fixture().store
  Object.assign(other.data.settings[0], { owner_user_id: 'user_chloe' })
  other.data.settings[0].privacy.show_year = false; other.data.settings[0].privacy.show_field = false; other.data.settings[0].privacy.event_visible = false
  assert.equal(other.user_by_id('user_chloe').year, '')
  assert.equal(other.user_by_id('user_chloe').major, '')
  assert.equal(other.event_participants('event_picnic').some(row => row.user_id === 'user_chloe'), false)
})

test('blocking is account-scoped, atomic, clears private linkage, and unblocking does not restore it', () => {
  const { store } = fixture()
  assert.equal(store.can_chat('user_chloe'), true)
  assert.equal(store.block_user('user_chloe').success, true)
  assert.deepEqual([...store.blocked_user_ids].sort(), ['user_chloe', 'user_jordan'])
  assert.equal(store.can_chat('user_chloe'), false)
  assert.equal(store.current_conversations.some(row => row.participant_id === 'user_chloe'), false)
  assert.equal(store.data.requests.some(row => row.status === 'pending' && [row.sender_id, row.recipient_id].includes('user_chloe') && [row.sender_id, row.recipient_id].includes(TEST_USER_ID)), false)
  assert.equal(store.unblock_user('user_chloe').success, true)
  assert.equal(store.can_chat('user_chloe'), false)
})

test('direct notification mute is Store-backed, account-scoped and validated', () => {
  const { store, snapshot } = fixture()
  assert.equal(store.is_direct_muted('user_chloe'), false)
  assert.equal(store.set_direct_muted('user_chloe', true).success, true)
  assert.equal(store.is_direct_muted('user_chloe'), true)
  assert.deepEqual(snapshot().settings[0].muted_direct_user_ids, ['user_chloe'])
  assert.equal(store.set_direct_muted('user_chloe', true).success, true)
  assert.deepEqual(store.current_settings.muted_direct_user_ids, ['user_chloe'])
  assert.equal(store.set_direct_muted('user_chloe', false).success, true)
  assert.equal(store.is_direct_muted('user_chloe'), false)
  assert.equal(store.set_direct_muted('missing_user', true).success, false)
})

test('direct text messages persist once and require a live mutual conversation', async () => {
  const { store } = fixture()
  const before = store.direct_conversation('conversation_chloe').messages.length
  const sent = await store.send_direct_message('conversation_chloe', 'A local message', null, 'direct_message_test')
  assert.equal(sent.success, true)
  assert.equal(store.direct_conversation('conversation_chloe').messages.length, before + 1)
  const repeated = await store.send_direct_message('conversation_chloe', 'A local message', null, 'direct_message_test')
  assert.equal(repeated.success, true)
  assert.equal(repeated.repeated, true)
  assert.equal(store.direct_conversation('conversation_chloe').messages.length, before + 1)
  assert.equal(store.block_user('user_chloe').success, true)
  assert.equal((await store.send_direct_message('conversation_chloe', 'Should fail')).success, false)
})

test('direct media publishes its Blob and metadata atomically and compensates failed storage', async () => {
  const fixture_ok = fixture(), image = new Blob(['decoded image'], { type: 'image/png' })
  const sent = await fixture_ok.store.send_direct_message('conversation_chloe', '', { kind: 'image', blob: image }, 'direct_photo_test')
  assert.equal(sent.success, true)
  const message = fixture_ok.store.direct_conversation('conversation_chloe').messages.at(-1)
  assert.equal(message.kind, 'image'); assert.equal(message.media.media_url, `indexeddb://${message.media.media_id}`)
  assert.equal(fixture_ok.blobs.has(message.media.media_id), true)
  const restored = use_app_store(createPinia())
  configure_store_runtime(restored, { clock: () => now, persistence: { read: key => key === STATE_KEY ? fixture_ok.snapshot() : null, write() {} }, media: { get: id => fixture_ok.blobs.get(id), put: async () => {}, delete: async () => {} }, inspect_media: async () => ({ duration_ms: 0 }) })
  assert.equal(restored.hydrate().success, true)
  assert.equal(restored.direct_conversation('conversation_chloe').messages.at(-1).media.media_id, message.media.media_id)

  const failed = fixture({ fail_write: true }), before = clone_data(failed.store.data), before_blobs = [...failed.blobs.keys()]
  const result = await failed.store.send_direct_message('conversation_chloe', '', { kind: 'audio', blob: new Blob(['decoded audio'], { type: 'audio/webm' }), duration_ms: 1500 }, 'direct_voice_failure')
  assert.equal(result.success, false); assert.deepEqual(failed.store.data, before); assert.deepEqual([...failed.blobs.keys()], before_blobs)
})

test('reports are local records with the correct target and optional blocking is one atomic write', () => {
  const { store } = fixture()
  const result = store.submit_report({ target_type: 'user', target_id: 'user_chloe', reason: 'Harassment', description: 'Repeated contact.', context_id: 'conversation_chloe', also_block: true })
  assert.equal(result.success, true)
  const report = store.report_by_id(result.data)
  assert.deepEqual([report.target_type, report.target_id, report.status], ['user', 'user_chloe', 'local_saved'])
  assert.equal(store.blocked_user_ids.includes('user_chloe'), true)
  const failed = fixture({ fail_write: true }), before = clone_data(failed.store.data)
  assert.equal(failed.store.submit_report({ target_type: 'event', target_id: 'event_picnic', reason: 'Incorrect information' }).success, false)
  assert.deepEqual(failed.store.data, before)
})

test('fixed-code password reset migrates only the selected credential and preserves account readiness', async () => {
  const { store } = fixture({ guest: true })
  const before_users = clone_data(store.data.users), before_coins = clone_data(store.data.coin_transactions)
  const started = store.begin_password_reset(' Cimoa@gmail.com ')
  assert.equal(started.success, true)
  const id = started.data.reset_id, snapshot = clone_data(store.data)
  for (const code of ['9789', '000000', 9789, ' 009789']) assert.equal(store.verify_password_reset_code(code, id).success, false)
  assert.deepEqual(store.data, snapshot)
  assert.equal(store.verify_password_reset_code('009789', id).success, true)
  assert.equal((await store.finish_password_reset('short', 'short', id)).success, false)
  assert.equal((await store.finish_password_reset('newlocal123', 'newlocal123', id)).success, true)
  assert.deepEqual(store.data.users, before_users); assert.deepEqual(store.data.coin_transactions, before_coins)
  const migrated = store.data.accounts.find(row => row.email === 'cimoa@gmail.com')
  assert.equal(migrated.auth_provider, 'local'); assert.equal(migrated.local_verification.status, 'verified'); assert.equal(Number.isFinite(migrated.onboarding.completed_at), true)
  assert.equal((await store.login('cimoa@gmail.com', '12341234')).success, false)
  assert.equal((await store.login('cimoa@gmail.com', 'newlocal123')).success, true)
  assert.equal(store.onboarding.completed, true)
})

test('account deletion verifies the password, removes private local entities, and deletes owned blobs', async () => {
  const { store, blobs } = fixture()
  store.data.media_files.push({ media_id: 'owned_media', owner_user_id: TEST_USER_ID, kind: 'image', media_url: 'indexeddb://owned_media', mime: 'image/png', duration_ms: 0, byte_size: 5 })
  const owner = store.data.users.find(row => row.user_id === TEST_USER_ID)
  const photo = { photo_id: 'owned_photo', user_id: TEST_USER_ID, media_url: 'indexeddb://owned_media', position: owner.photo_ids.length }
  store.data.profile_photos.push(photo); owner.photo_ids.push(photo.photo_id)
  assert.equal((await store.delete_account('wrong', 'Privacy concerns')).success, false)
  const result = await store.delete_account('12341234', 'Privacy concerns')
  assert.equal(result.success, true); assert.equal(result.data.cleanup_warning, '')
  assert.equal(blobs.has('owned_media'), false); assert.equal(store.session.is_authenticated, false)
  assert.deepEqual([store.last_deleted_account.account_id, store.last_deleted_account.deletion_reason], ['account_cimoa', 'Privacy concerns'])
  assert.equal(store.data.accounts[0].status, 'deleted'); assert.equal(store.data.users[0].deleted, true)
  assert.equal(store.data.relationships.some(row => [row.from_user_id, row.to_user_id].includes(TEST_USER_ID)), false)
  assert.equal(store.data.coin_transactions.some(row => row.owner_user_id === TEST_USER_ID), false)
  assert.equal((await store.login('cimoa@gmail.com', '12341234')).success, false)
})
