import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { profile_destination } from '../src/utils/profileNavigation.js'
import { discover_destination } from '../src/utils/discoverNavigation.js'
import { events_destination } from '../src/utils/eventsNavigation.js'
import { create_write_operation } from '../src/utils/writeOperation.js'
import { create_host_bridge } from '../src/utils/hostBridge.js'

const now = Date.UTC(2026, 9, 24, 2)
const forbidden = /\b(?:saved|saving|local|locally|demo|fixture|injected|TypeError|ReferenceError|SyntaxError|DOMException|indexedDB|localStorage)\b|\/Users\/|node_modules/i
function fixture(overrides = {}) {
  let disk = create_scenario('default', now), writes = 0
  const persistence = { read: key => key === STATE_KEY ? clone_data(disk) : null, write: (_, data) => { disk = clone_data(data); writes++ } }
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence, ...overrides })
  assert.equal(store.hydrate().success, true)
  return { store, persistence, disk: () => clone_data(disk), writes: () => writes }
}
const formal_failure = result => {
  assert.equal(result.success, false)
  assert.equal(typeof result.message, 'string')
  assert.ok(result.message.length > 0)
  assert.doesNotMatch(result.message, forbidden)
}

test('unreadable information keeps failure state and original stored content', () => {
  const original = 'unreadable-state', store = use_app_store(createPinia())
  let writes = 0
  configure_store_runtime(store, { persistence: { read: () => original, write() { writes++ } } })
  const result = store.hydrate()
  formal_failure(result)
  assert.equal(store.hydration_status, 'error')
  assert.match(store.hydration_error, /information.*loaded/i)
  assert.equal(writes, 0)
  assert.deepEqual(store.home_connections, [])
})

test('unavailable read and navigation errors describe the affected information', () => {
  const { store } = fixture()
  store.hydration_status = 'error'
  for (const read of [() => profile_destination(store, 'edit'), () => discover_destination(store, 'profile', 'user_chloe'), () => events_destination(store, 'detail', 'event_picnic')]) {
    assert.throws(read, error => { assert.doesNotMatch(error.message, forbidden); return /information.*unavailable/i.test(error.message) })
  }
  for (const message of [store.introduction_blocker('user_liam'), store.event_join_blocker('event_picnic'), store.matching_context('').error]) assert.doesNotMatch(message, forbidden)
})

test('quota failure retains an actionable space message and leaves all business entities unchanged', () => {
  const f = fixture(), before = clone_data(f.store.data), persisted = f.disk()
  configure_store_runtime(f.store, { persistence: { ...f.persistence, write() { throw Error('Storage full') } } })
  const result = f.store.update_profile({ user_name: 'Changed name' })
  formal_failure(result)
  assert.equal(result.reason, 'operation_failed')
  assert.match(result.message, /space.*try again/i)
  assert.deepEqual(f.store.data, before)
  assert.deepEqual(f.disk(), persisted)
})

test('unexpected persistence failures cannot expose stack or storage implementation details', () => {
  const f = fixture(), before = clone_data(f.store.data)
  configure_store_runtime(f.store, { persistence: { ...f.persistence, write() { throw new TypeError('Injected localStorage failure at /Users/developer/node_modules/storage.js') } } })
  for (const action of [() => f.store.join_event('event_picnic'), () => f.store.accept_request('request_lina'), () => f.store.submit_report({ target_type: 'user', target_id: 'user_liam', reason: 'Spam', also_block: true })]) {
    const result = action()
    formal_failure(result)
    assert.equal(result.reason, 'operation_failed')
    assert.deepEqual(f.store.data, before)
  }
})

test('invalid data errors never reveal internal collection or profile field names', () => {
  for (const corrupt of [data => { data.users[0].user_id = '' }, data => { data.users[0].goal_ids = ['missing'] }]) {
    const data = create_scenario('default', now)
    corrupt(data)
    assert.throws(() => validate_data(data), error => {
      assert.doesNotMatch(error.message, /users|identifiers|goal_ids|interest_ids|photo_ids|icebreaker_ids/)
      return /couldn’t be read.*try again/.test(error.message)
    })
  }
})

test('sending feedback retains its owner guard, failure result and unpublished message', async () => {
  let reject_media
  const media = new Promise((_, reject) => { reject_media = reject })
  const { store } = fixture({ inspect_media: () => media })
  const before = clone_data(store.data)
  const payload = { kind: 'image', blob: new Blob(['image'], { type: 'image/png' }), duration_ms: 0 }
  const pending = store.send_direct_message('conversation_chloe', '', payload, 'copy-send')
  const busy = await store.send_direct_message('conversation_chloe', 'Repeat', null, 'copy-repeat')
  formal_failure(busy)
  assert.equal(busy.reason, 'busy')
  assert.match(busy.message, /already being sent/i)
  reject_media(new TypeError('Injected indexedDB failure'))
  const result = await pending
  formal_failure(result)
  assert.equal(result.reason, 'message_failed')
  assert.match(result.message, /message.*sent/i)
  assert.deepEqual(store.data, before)
})

test('profile feedback retains its in-flight guard and failed update remains atomic', async () => {
  let reject_media
  const media = new Promise((_, reject) => { reject_media = reject })
  const { store } = fixture({ inspect_media: () => media })
  const before = clone_data(store.data), account_id = store.session.account_id
  const pending = store.save_profile_edit({}, [{ blob: new Blob(['image'], { type: 'image/png' }) }], account_id)
  const busy = await store.save_profile_edit({}, null, account_id)
  formal_failure(busy)
  assert.equal(busy.reason, 'busy')
  assert.match(busy.message, /already being updated/i)
  reject_media(new TypeError('Injected indexedDB failure'))
  const result = await pending
  formal_failure(result)
  assert.equal(result.reason, 'profile_save_failed')
  assert.deepEqual(store.data, before)
})

test('formal feedback preserves unavailable support and unverified purchase boundaries', () => {
  const { store } = fixture(), before = clone_data(store.data)
  const support = store.submit_support(), purchase = store.complete_purchase()
  formal_failure(support); formal_failure(purchase)
  assert.equal(support.reason, 'service_unavailable')
  assert.match(support.message, /Support delivery.*unavailable/)
  assert.equal(purchase.reason, 'unverified_purchase')
  assert.match(purchase.message, /confirmed before coins can be added/)
  assert.deepEqual(store.data, before)
})

test('write error copy changes neither the 500ms delay nor cancellation settlement', async () => {
  let callback, delay, writes = 0
  const loading = [], operation = create_write_operation({ set_loading: value => loading.push(value), timers: { setTimeout(fn, ms) { callback = fn; delay = ms; return 1 }, clearTimeout() {} } })
  const pending = operation.run(() => { writes++; throw new TypeError('Injected localStorage failure') })
  assert.equal(delay, 500)
  assert.equal(writes, 0)
  await callback()
  const result = await pending
  formal_failure(result)
  assert.equal(result.reason, 'operation_failed')
  assert.equal(writes, 1)
  assert.deepEqual(loading, [true, false])
  const cancelled = operation.run(() => { writes++ })
  operation.cancel()
  assert.deepEqual(await cancelled, { success: false, reason: 'cancelled' })
  assert.equal(writes, 1)
})

test('system adapter errors keep failure while removing technical exception text', async () => {
  const bridge = create_host_bridge({ send: () => Promise.reject(new TypeError('Injected bridge failure at /Users/developer/host.js')) })
  await assert.rejects(bridge.request('getEnvironment'), error => { assert.doesNotMatch(error.message, forbidden); return /system request.*completed/i.test(error.message) })
})
