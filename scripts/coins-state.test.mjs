import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { create_purchase_bridge } from '../src/utils/iapBridge.js'
import { fake_clock } from './lib/fake-clock.mjs'
import { coin_child_route, coin_center_route } from '../src/utils/coinReturnContext.js'
import { build_coin_history } from '../src/utils/coinHistory.js'
import { legal_document_route, legal_return_route } from '../src/utils/legalNavigation.js'
import { ACTIVE_COIN_PACKAGES } from '../src/stores/coinPackages.js'
const product = ACTIVE_COIN_PACKAGES.find(pack => pack.package_id === 'pkg_60')
const catalogue = [{ package_id: product.package_id, product_id: product.product_id, display_price: '$0.99', currency_code: 'USD' }]
const verify_purchase = async result => ({ ...result, verified: true, transaction_id: result.receipt_id })
const payload = { request_id: 'purchase_test', owner_user_id: 'user_cimoa', package_id: product.package_id, product_id: product.product_id }
const delivery = { ...payload, status: 'success', receipt_id: 'verified_test_receipt', transaction_id: 'verified_test_receipt' }
test('initial dispatch before navigation creates no orphan page timer and caches an early callback', async () => {
  const clock = fake_clock(), sent = [], b = create_purchase_bridge({ timers: clock, clock: clock.now, send: p => sent.push(p) })
  assert.equal(b.dispatch(payload, { deadline_at: 8000 }), true); assert.equal(clock.pending(), 0); b.dispatch(payload); assert.equal(sent.length, 1)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'failure' }), true); assert.equal((await b.request(payload, { dispatch: false })).status, 'failure'); assert.equal(clock.pending(), 0)
})
test('one complete 8000ms window without a handler; duplicate observers do not restart or dispatch twice', async () => {
  const clock = fake_clock(), sent = [], b = create_purchase_bridge({ timers: clock, clock: clock.now, send: p => sent.push(p) })
  let done = false; const p = b.request(payload); p.then(() => { done = true }); assert.equal(b.request(payload), p)
  await clock.advance(7999); assert.equal(done, false); await clock.advance(1); assert.equal((await p).status, 'timeout'); assert.equal(sent.length, 1); assert.equal(clock.pending(), 0)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'failure' }), false)
})
test('hide detaches the page observer while the application keeps its acknowledgement timer and exact result', async () => {
  const clock = fake_clock(), sent = [], b = create_purchase_bridge({ timers: clock, clock: clock.now, send: p => sent.push(p) })
  const p = b.request(payload); await clock.advance(1000); b.suspend(payload.request_id); assert.equal((await p).status, 'interrupted'); assert.equal(clock.pending(), 1)
  await clock.advance(1000); assert.equal(b.resolve(payload.request_id, { ...payload, owner_user_id: 'other', status: 'failure' }), false)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'failure' }), true)
  const result = await b.request(payload, { dispatch: false }); assert.equal(result.status, 'failure'); assert.equal(result.received_at, 2000); assert.equal(sent.length, 1); assert.equal(clock.pending(), 0); b.forget(payload.request_id)
})
test('new-document recovery waits only the remainder of the same persisted deadline and never dispatches payment', async () => {
  const clock = fake_clock(4000), b = create_purchase_bridge({ timers: clock, clock: clock.now, send() { throw Error('Must not send') } })
  let done = false; const p = b.request(payload, { deadline_at: 8000, dispatch: false }); p.then(() => { done = true })
  await clock.advance(3999); assert.equal(done, false); await clock.advance(1); assert.equal((await p).status, 'timeout'); assert.equal(clock.pending(), 0)
})
test('conflicting identities always fail, while a late transaction reaches verification without redispatch', async () => {
  const clock = fake_clock(), b = create_purchase_bridge({ timers: clock, clock: clock.now, send() {} })
  const p = b.request(payload); assert.equal((await b.request({ ...payload, owner_user_id: 'other' })).status, 'failure')
  b.suspend(payload.request_id); await p; await clock.advance(8001)
  assert.equal(b.resolve(payload.request_id, { ...delivery, owner_user_id: 'other' }), false)
  assert.equal((await b.request(payload, { dispatch: false })).status, 'timeout')
  assert.equal(b.resolve(payload.request_id, delivery), true)
  assert.equal((await b.request(payload, { dispatch: false })).receipt_id, delivery.receipt_id); assert.equal(clock.pending(), 0)
})
test('accepted or deferred Apple payments do not expire after eight seconds or permit a local cancellation', async () => {
  const clock = fake_clock(), sent = [], observed = [], b = create_purchase_bridge({ timers: clock, clock: clock.now, send: value => sent.push(value) })
  b.subscribe(result => observed.push(result.status))
  const pending = b.request(payload)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'accepted' }), true)
  assert.equal(b.resolve(payload.request_id, { ...payload, status: 'pending' }), true)
  assert.equal(clock.pending(), 0)
  await clock.advance(60000)
  assert.equal(b.cancel(payload.request_id), false)
  assert.deepEqual(observed, ['accepted', 'pending'])
  assert.equal(b.resolve(payload.request_id, delivery), true)
  assert.equal((await pending).status, 'success'); assert.equal(sent.length, 1)
  assert.equal(clock.pending(), 0)
})
function fixture() {
  const clock = fake_clock(Date.UTC(2026, 9, 17)), store = use_app_store(createPinia()); let disk = create_seed(clock.now())
  configure_store_runtime(store, { clock: clock.now, persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, services: { verify_purchase } }); store.hydrate()
  store.purchase_products = catalogue.map(row => ({ ...row }))
  const begun = store.begin_purchase(payload.package_id, 'coin_unit'); assert.ok(begun.success)
  return { store, clock, id: begun.data, receipt: { ...delivery, request_id: begun.data } }
}
test('a verified callback received in time is not made late by mandatory Loading; replay cannot credit twice', async () => {
  const { store, clock, id, receipt } = fixture(); await clock.advance(7990); const received_at = clock.now(); await clock.advance(500)
  assert.equal((await store.settle_purchase(id, receipt, { received_at })).success, true); assert.equal(store.coin_balance, 320)
  const repeated = await store.settle_purchase(id, receipt, { received_at })
  assert.equal(repeated.success, true); assert.equal(repeated.repeated, true); assert.equal(store.coin_balance, 320)
})
test('receipt verification cannot publish into a replacement session and malformed delivery timestamps never add coins', async () => {
  const { store, clock, id, receipt } = fixture(); let release
  configure_store_runtime(store, { services: { verify_purchase: () => new Promise(resolve => { release = resolve }) } })
  const pending = store.settle_purchase(id, receipt); store.logout(); await store.login('cimoa@connect.edu', '12341234'); const before = clone_data(store.data); release(await verify_purchase(receipt))
  assert.equal((await pending).success, false); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { services: { verify_purchase } })
  assert.equal((await store.settle_purchase(id, receipt, { received_at: clock.now() + 1 })).success, false); assert.equal(store.coin_balance, 260)
})
test('history keeps only validated owned return context and a refund never claims a new purchase', () => {
  const { store } = fixture(), id = store.save_draft('match_return', 'entry', { kind: 'match_entry', match_id: null }).data
  assert.equal(coin_center_route(store, id), '/pages/coins/index?return_context_id=' + id)
  assert.equal(coin_child_route(store, '/pages/coins/history?filter=all', id), '/pages/coins/history?filter=all&return_context_id=' + id)
  assert.equal(coin_child_route(store, '/pages/coins/history', 'forged'), '/pages/coins/history')
  const [refund] = build_coin_history([{ transaction_id: 'refund', kind: 'refund', amount: 10, status: 'completed', created_at: 1 }], [], [])
  assert.equal(refund.title, 'Coin refund'); assert.equal(refund.subtitle, 'Returned coins'); assert.equal(refund.filter, 'used')
  store.logout(); assert.equal(coin_child_route(store, '/pages/coins/history', id), '/pages/coins/history')
})
test('ledger detail projects provenance, exact verified amount and real feature references without exposing mutable Store entities', async () => {
  const { store, id, receipt } = fixture(), credit = store.coin_ledger_detail('txn_seed_0')
  assert.equal(credit.mode, 'credit'); assert.equal(credit.verified_purchase, false); credit.transaction.amount = 9999; assert.equal(store.coin_balance, 260)
  assert.equal((await store.settle_purchase(id, receipt)).success, true)
  const transaction = store.coin_transactions.find(t => t.related_id === id), detail = store.coin_ledger_detail(transaction.transaction_id)
  assert.equal(detail.verified_purchase, true); assert.equal(detail.mode, 'purchase')
  store.data.coin_transactions.find(t => t.transaction_id === transaction.transaction_id).amount++
  assert.equal(store.coin_ledger_detail(transaction.transaction_id).verified_purchase, false)
  assert.equal(store.coin_ledger_detail('missing'), null)
})
test('public legal navigation keeps only a named app origin and owned coin draft, never an arbitrary redirect', () => {
  const { store } = fixture(), id = store.save_draft('match_return', 'entry', { kind: 'match_entry', match_id: null }).data
  assert.equal(legal_document_route(store, 'terms', 'coins', id), '/pages/legal/terms?origin=coins&return_context_id=' + id)
  assert.equal(legal_return_route(store, 'coins', id), '/pages/coins/help?return_context_id=' + id)
  assert.equal(legal_document_route(store, 'privacy', 'coins', 'foreign'), '/pages/legal/privacy?origin=coins')
  assert.equal(legal_return_route(store, 'https://example.com', id), '/pages/settings/legal')
  store.logout()
  assert.equal(legal_return_route(store, 'coins', id), '/pages/auth/welcome')
  assert.equal(legal_return_route(store, 'signup', id), '/pages/auth/signup')
})
