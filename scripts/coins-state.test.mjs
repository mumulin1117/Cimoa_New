import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { create_purchase_bridge } from '../src/utils/iapBridge.js'
import { fake_clock } from './lib/fake-clock.mjs'
const payload = { request_id: 'purchase_test', owner_user_id: 'user_cimoa', package_id: 'pkg_60', product_id: 'test.cimoa.60' }
test('initial dispatch before navigation creates no orphan page timer and caches an early callback', async () => {
  const clock = fake_clock(), sent = [], b = create_purchase_bridge({ timers: clock, clock: clock.now, send: p => sent.push(p) })
  assert.equal(b.dispatch(payload, { deadline_at: 8000 }), true); assert.equal(clock.pending(), 0); b.dispatch(payload); assert.equal(sent.length, 1)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'failure' }), true); assert.equal((await b.request(payload, { dispatch: false })).status, 'failure'); assert.equal(clock.pending(), 0)
})
test('one complete 8000ms window without a handler; duplicate observers do not restart or dispatch twice', async () => {
  const clock = fake_clock(), sent = [], b = create_purchase_bridge({ timers: clock, clock: clock.now, send: p => sent.push(p) })
  let done = false; const p = b.request(payload); p.then(() => { done = true }); assert.equal(b.request(payload), p)
  await clock.advance(7999); assert.equal(done, false); await clock.advance(1); assert.equal((await p).status, 'timeout'); assert.equal(sent.length, 1); assert.equal(clock.pending(), 0)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'success' }), false)
})
test('hide detaches every timer; an exact native callback is cached and delivered on resume without another charge message', async () => {
  const clock = fake_clock(), sent = [], b = create_purchase_bridge({ timers: clock, clock: clock.now, send: p => sent.push(p) })
  const p = b.request(payload); await clock.advance(1000); b.suspend(payload.request_id); assert.equal((await p).status, 'interrupted'); assert.equal(clock.pending(), 0)
  await clock.advance(1000); assert.equal(b.resolve(payload.request_id, { ...payload, owner_user_id: 'other', status: 'failure' }), false)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'failure' }), true)
  const result = await b.request(payload, { dispatch: false }); assert.equal(result.status, 'failure'); assert.equal(result.received_at, 2000); assert.equal(sent.length, 1); assert.equal(clock.pending(), 0); b.forget(payload.request_id)
})
test('new-document recovery waits only the remainder of the same persisted deadline and never dispatches payment', async () => {
  const clock = fake_clock(4000), b = create_purchase_bridge({ timers: clock, clock: clock.now, send() { throw Error('Must not send') } })
  let done = false; const p = b.request(payload, { deadline_at: 8000, dispatch: false }); p.then(() => { done = true })
  await clock.advance(3999); assert.equal(done, false); await clock.advance(1); assert.equal((await p).status, 'timeout'); assert.equal(clock.pending(), 0)
})
test('conflicting identities and a callback arriving after the detached deadline cannot succeed', async () => {
  const clock = fake_clock(), b = create_purchase_bridge({ timers: clock, clock: clock.now, send() {} })
  const p = b.request(payload); assert.equal((await b.request({ ...payload, owner_user_id: 'other' })).status, 'failure')
  b.suspend(payload.request_id); await p; await clock.advance(8001)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'success' }), false)
  assert.equal((await b.request(payload, { dispatch: false })).status, 'timeout'); assert.equal(clock.pending(), 0)
})
function fixture() {
  const clock = fake_clock(Date.UTC(2026, 9, 17)), store = use_app_store(createPinia()); let disk = create_seed(clock.now())
  disk.coin_packages.find(p => p.package_id === payload.package_id).product_id = payload.product_id
  configure_store_runtime(store, { clock: clock.now, persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, services: { verify_purchase: async () => true } }); store.hydrate()
  const id = store.begin_purchase(payload.package_id, 'coin_unit').data
  return { store, clock, id, receipt: { ...payload, request_id: id, status: 'success', receipt_id: 'verified_test_receipt' } }
}
test('a verified callback received in time is not made late by mandatory Loading; replay cannot credit twice', async () => {
  const { store, clock, id, receipt } = fixture(); await clock.advance(7990); const received_at = clock.now(); await clock.advance(500)
  assert.equal((await store.settle_purchase(id, receipt, { received_at })).success, true); assert.equal(store.coin_balance, 320)
  assert.equal((await store.settle_purchase(id, receipt, { received_at })).success, false); assert.equal(store.coin_balance, 320)
})
test('receipt verification cannot publish into a replacement session and malformed delivery timestamps never add coins', async () => {
  const { store, clock, id, receipt } = fixture(); let release
  configure_store_runtime(store, { services: { verify_purchase: () => new Promise(resolve => { release = resolve }) } })
  const pending = store.settle_purchase(id, receipt); store.logout(); await store.login('cimoa@gmail.com', '12341234'); const before = clone_data(store.data); release(true)
  assert.equal((await pending).success, false); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { services: { verify_purchase: async () => true } })
  assert.equal((await store.settle_purchase(id, receipt, { received_at: clock.now() + 1 })).success, false); assert.equal(store.coin_balance, 260)
})
