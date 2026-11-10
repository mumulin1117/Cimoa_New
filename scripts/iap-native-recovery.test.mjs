import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { clone_data, TEST_USER_ID } from '../src/stores/seed.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { ACTIVE_COIN_PACKAGES, available_coin_packages, normalize_purchase_products } from '../src/stores/coinPackages.js'
import { create_purchase_bridge } from '../src/utils/iapBridge.js'
import { create_purchase_page_scope, create_purchase_recovery, load_purchase_products, verify_native_purchase, purchase_payload } from '../src/utils/nativePurchases.js'
import { create_write_operation } from '../src/utils/writeOperation.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { fake_clock } from './lib/fake-clock.mjs'

const now = Date.UTC(2026, 9, 24, 5), pack = ACTIVE_COIN_PACKAGES[0]
const product = { package_id: pack.package_id, product_id: pack.product_id, display_price: '0,99 €', currency_code: 'EUR' }
const proof = result => ({ ...result, verified: true, receipt_id: result.receipt_id || result.transaction_id, transaction_id: result.receipt_id || result.transaction_id })
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { resolve, promise } }
function fixture({ services = {}, write } = {}) {
  const clock = fake_clock(now), disk = new Map([[STATE_KEY, create_scenario('default', now)]]), store = use_app_store(createPinia())
  let writes = 0
  const persistence = { read: key => clone_data(disk.get(key) ?? null), write: (key, value) => { writes++; if (write) write(key, value); disk.set(key, clone_data(value)) } }
  configure_store_runtime(store, { persistence, clock: clock.now, services: { purchase_products: async () => ({ products: [product] }), verify_purchase: async result => proof(result), ...services } })
  assert.equal(store.hydrate().success, true)
  store.purchase_products = [product]
  return { store, clock, disk, persistence, writes: () => writes }
}
const result_for = (request, receipt_id = 'apple-transaction-1') => ({ ...purchase_payload(request, pack), status: 'success', receipt_id, transaction_id: receipt_id, display_price: product.display_price, purchased_at: now })
const open = subject => { const result = subject.store.begin_purchase(pack.package_id, `purchase-${subject.writes()}`); assert.equal(result.success, true); return subject.store.purchase_by_id(result.data) }
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }

test('all eight owner-confirmed USD card prices remain separate from real sale prices and availability', () => {
  assert.deepEqual(ACTIVE_COIN_PACKAGES.map(row => [row.coins, row.reference_usd, row.product_id]), [[60, '0.99', 'rblzerghvsqyxkgp'], [120, '1.99', 'mznhzilrvvtggvdi'], [300, '3.99', 'vjsbdvylaviugals'], [380, '4.99', 'vbadxyfeihvigwiu'], [800, '9.99', 'ypznugdetqagwzja'], [1600, '19.99', 'dcbyodummketgliq'], [3200, '49.99', 'cuxjyntanjgosesh'], [6800, '99.99', 'gmuduvxnpwzfitwu']])
  assert.ok(available_coin_packages().every(row => row.price === 'Unavailable' && !row.available))
  const displayed = ['$0.99', '$1.99', '$3.99', '$4.99', '$9.99', '$19.99', '$49.99', '$99.99']
  assert.deepEqual(available_coin_packages().map(row => row.display_price_usd), displayed)
  assert.deepEqual(available_coin_packages([product]).map(row => row.display_price_usd), displayed)
  const catalog = available_coin_packages([product]); assert.equal(catalog[0].price, '0,99 €'); assert.equal(catalog.filter(row => row.available).length, 1)
})

test('catalog validates product/package/price/duplicates and is only transient presentation state', async () => {
  for (const item of [{ products: null }, { products: [{ ...product, package_id: 'pkg_wrong' }] }, { products: [{ ...product, display_price: '' }] }, { products: [{ ...product, product_id: 'invented' }] }, { products: [product, product] }]) assert.throws(() => normalize_purchase_products(item), /package|App Store/)
  const subject = fixture(), before = subject.writes()
  assert.equal((await subject.store.load_purchase_catalog()).success, true)
  assert.equal(subject.writes(), before); assert.equal(subject.store.coin_packages[0].price, product.display_price)
  assert.deepEqual(await load_purchase_products(async () => ({ products: [] })), [])
  assert.deepEqual(await load_purchase_products(async () => [product]), normalize_purchase_products({ products: [product] }))
  subject.store.purchase_products = []
  assert.equal(subject.store.begin_purchase(pack.package_id, 'unavailable').success, false)
  assert.equal(subject.store.coin_balance, 260); assert.equal(subject.store.current_purchase_requests.length, 0)
})

test('a browser without a native host quietly skips application recovery', async () => {
  const subject = fixture(), errors = []
  let loading = 0
  const controller = create_purchase_recovery({ store: subject.store, run_with_loading: async () => { loading++ }, on_error: message => errors.push(message) })
  assert.equal((await controller.start()).reason, 'host_unavailable')
  assert.equal((await controller.refresh()).reason, 'host_unavailable')
  assert.equal(loading, 0); assert.deepEqual(errors, []); controller.stop()
})

test('hiding or replacing a coin page during catalog loading prevents a later purchase or native dispatch', async () => {
  for (const interruption of ['hide', 'reopen', 'account']) {
    const catalogue = deferred(); let account = 'original', writes = 0, dispatched = 0
    const scope = create_purchase_page_scope(() => account === 'original'), token = scope.capture()
    const pending = catalogue.promise.then(() => scope.guard(token, () => { writes++; return { success: true } })).then(result => { if (result.success) scope.guard(token, () => { dispatched++ }); return result })
    if (interruption === 'account') account = 'replacement'
    else { scope.hide(); if (interruption === 'reopen') scope.show() }
    catalogue.resolve({ products: [product] })
    assert.equal((await pending).reason, 'cancelled'); assert.equal(writes, 0); assert.equal(dispatched, 0)
  }
})

test('a page that leaves after request persistence still cannot dispatch a new Apple payment', async () => {
  const scope = create_purchase_page_scope(), token = scope.capture()
  let writes = 0, dispatched = 0
  const saved = scope.guard(token, () => { writes++; return { success: true } })
  scope.hide(); scope.show()
  assert.equal(scope.guard(token, () => { dispatched++; return saved }).reason, 'cancelled')
  assert.equal(writes, 1); assert.equal(dispatched, 0)
  const current = scope.capture(); assert.equal(scope.guard(current, () => ({ success: true })).success, true)
})

test('purchase begin snapshots the actual product, coin amount and localized offer without credit', () => {
  const subject = fixture(), request = open(subject)
  assert.equal(request.product_id, pack.product_id); assert.equal(request.coins, 60); assert.equal(request.display_price, product.display_price)
  assert.equal(request.phase, 'awaiting_host'); assert.equal(request.accepted_at, null); assert.equal(subject.store.coin_balance, 260)
  assert.equal(subject.store.begin_purchase(pack.package_id, 'duplicate-pending').success, false)
})

test('the bridge waits the full eight-second acknowledgement window when no host responds', async () => {
  const clock = fake_clock(), bridge = create_purchase_bridge({ timers: clock, clock: clock.now, send() {} }), payload = { request_id: 'no-host', package_id: pack.package_id, owner_user_id: TEST_USER_ID, product_id: pack.product_id }
  let done = false; const pending = bridge.request(payload).then(result => { done = true; return result })
  await clock.advance(7999); assert.equal(done, false)
  await clock.advance(1); assert.equal((await pending).status, 'timeout'); assert.equal(clock.pending(), 0)
})

test('accepted/deferred payments have no eight-second final deadline and cannot be locally cancelled', async () => {
  const clock = fake_clock(), sent = [], received = [], bridge = create_purchase_bridge({ timers: clock, clock: clock.now, send: payload => { sent.push(payload); return Promise.resolve({ ...payload, status: 'accepted' }) } })
  const payload = { request_id: 'accepted', package_id: pack.package_id, owner_user_id: TEST_USER_ID, product_id: pack.product_id }
  bridge.subscribe(value => received.push(value))
  let finished = false; const pending = bridge.request(payload).then(value => { finished = true; return value })
  await flush(); assert.equal(clock.pending(), 0); assert.equal(bridge.cancel(payload.request_id), false)
  await clock.advance(86400000); assert.equal(finished, false)
  assert.equal(bridge.resolve(payload.request_id, { ...payload, status: 'pending', recovery_state: 'awaiting_approval' }), true)
  assert.equal(bridge.resolve(payload.request_id, { ...payload, status: 'success', receipt_id: 'tx' }), true)
  assert.equal((await pending).receipt_id, 'tx'); assert.equal(sent.length, 1); assert.equal(received[0].status, 'accepted')
})

test('page suspension preserves the payment and late success after UI timeout still reaches recovery', async () => {
  const clock = fake_clock(), sent = [], bridge = create_purchase_bridge({ timers: clock, clock: clock.now, send: payload => sent.push(payload) })
  const payload = { request_id: 'suspended', package_id: pack.package_id, owner_user_id: TEST_USER_ID, product_id: pack.product_id }
  const first = bridge.request(payload); bridge.resolve(payload.request_id, { ...payload, status: 'accepted' }); bridge.suspend(payload.request_id)
  assert.equal((await first).status, 'interrupted')
  const resumed = bridge.request(payload, { dispatch: true, accepted: true }); assert.equal(sent.length, 1)
  bridge.resolve(payload.request_id, { ...payload, status: 'success', receipt_id: 'resumed-tx' }); assert.equal((await resumed).status, 'success')
  const later = { ...payload, request_id: 'late' }, late = bridge.request(later)
  await clock.advance(8000); assert.equal((await late).status, 'timeout')
  const events = []; bridge.subscribe(value => events.push(value))
  assert.equal(bridge.resolve('late', { ...later, status: 'success', receipt_id: 'late-tx' }), true)
  assert.equal(events.at(-1).receipt_id, 'late-tx'); assert.equal(clock.pending(), 0)
})

test('native verification rejects mismatched identities or a truthy success without a verified delivery', async () => {
  const subject = fixture(), request = open(subject), result = result_for(request)
  await assert.rejects(verify_native_purchase(result, async () => ({ ...proof(result), product_id: 'different' })), /awaiting confirmation/)
  await assert.rejects(verify_native_purchase(result, async () => ({ verified: true })), /awaiting confirmation/)
  assert.equal((await verify_native_purchase(result, async (method, payload) => { assert.equal(method, 'verifyPurchase'); assert.equal(payload.transaction_id, result.receipt_id); return proof(result) })).verified, true)
  configure_store_runtime(subject.store, { services: { verify_purchase: async () => true } })
  assert.equal((await subject.store.settle_purchase(request.request_id, result)).reason, 'verification_pending'); assert.equal(subject.store.coin_balance, 260)
})

test('accepted purchases survive long waits and verified transaction IDs credit once without duplicate writes', async () => {
  const subject = fixture(), request = open(subject), result = result_for(request)
  assert.equal(subject.store.note_purchase_state(request.request_id, { ...purchase_payload(request), status: 'accepted' }).success, true)
  await subject.clock.advance(3600000); subject.store.expire_purchases()
  assert.equal(subject.store.purchase_by_id(request.request_id).status, 'pending')
  assert.equal((await subject.store.settle_purchase(request.request_id, result)).success, true)
  assert.equal(subject.store.coin_balance, 320)
  const writes = subject.writes(), duplicate = await subject.store.settle_purchase(request.request_id, result)
  assert.equal(duplicate.repeated, true); assert.equal(subject.writes(), writes); assert.equal(subject.store.coin_balance, 320)
  const detail = subject.store.coin_ledger_detail(subject.store.coin_transactions.find(row => row.receipt_id === result.receipt_id).transaction_id)
  assert.equal(detail.verified_purchase, true); assert.equal(detail.pack.price, product.display_price)
})

test('a verified late payment can repair an acknowledgement timeout, but never duplicate another request receipt', async () => {
  const subject = fixture(), request = open(subject), payload = purchase_payload(request)
  await subject.clock.advance(8000)
  assert.equal((await subject.store.settle_purchase(request.request_id, { ...payload, status: 'timeout' })).success, true)
  assert.equal((await subject.store.settle_purchase(request.request_id, result_for(request))).success, true); assert.equal(subject.store.coin_balance, 320)
  const next = open(subject)
  assert.equal((await subject.store.settle_purchase(next.request_id, result_for(next))).success, false); assert.equal(subject.store.coin_balance, 320)
})

test('late host acceptance reopens only an acknowledgement timeout and blocks a separate purchase', async () => {
  const subject = fixture(), request = open(subject), payload = purchase_payload(request)
  await subject.clock.advance(8000)
  assert.equal((await subject.store.settle_purchase(request.request_id, { ...payload, status: 'timeout' })).success, true)
  assert.equal(subject.store.note_purchase_state(request.request_id, { ...payload, status: 'accepted' }).success, true)
  assert.equal(subject.store.purchase_by_id(request.request_id).status, 'pending')
  assert.equal(subject.store.begin_purchase(pack.package_id, 'separate-while-accepted').success, false)
  await subject.clock.advance(60000); subject.store.expire_purchases()
  assert.equal(subject.store.purchase_by_id(request.request_id).status, 'pending'); assert.equal(subject.store.coin_balance, 260)
})

test('restoration can recreate only native-verified requests and cannot credit another account', async () => {
  const subject = fixture(), delivery = result_for({ request_id: 'restored-native-request', package_id: pack.package_id, product_id: pack.product_id, owner_user_id: TEST_USER_ID })
  assert.equal((await subject.store.settle_purchase(delivery.request_id, delivery, { allow_recovery: true })).success, true)
  assert.equal(subject.store.coin_balance, 320); assert.equal(subject.store.purchase_by_id(delivery.request_id).receipt_id, delivery.receipt_id)
  const before = clone_data(subject.store.data)
  assert.equal((await subject.store.settle_purchase('wrong-owner', { ...delivery, request_id: 'wrong-owner', owner_user_id: 'another-user', receipt_id: 'other-tx' }, { allow_recovery: true })).success, false)
  assert.deepEqual(clone_data(subject.store.data), before)
})

test('recovery shows write loading, commits atomically, then acknowledges StoreKit; replay only acknowledges', async () => {
  const subject = fixture(), request = open(subject), delivery = result_for(request), states = [], calls = []
  const operation = create_write_operation({ timers: subject.clock, set_loading: value => states.push(value) })
  const host = async (method, payload) => {
    calls.push(method)
    if (method === 'getPendingPurchases') return { purchases: [] }
    if (method === 'getPurchaseStatus') return { ...purchase_payload(request), status: 'unknown' }
    if (method === 'acknowledgePurchase') { assert.equal(subject.store.coin_balance, 320); assert.equal(subject.disk.get(STATE_KEY).purchase_requests.find(row => row.request_id === request.request_id).status, 'success'); return { acknowledged: true } }
    throw new Error('Unexpected request')
  }
  const controller = create_purchase_recovery({ store: subject.store, run_with_loading: operation.run, host, subscribe: () => () => {}, clock: subject.clock.now })
  await controller.start()
  const pending = controller.process(delivery); assert.equal(states.at(-1), true)
  await subject.clock.advance(499); assert.equal(subject.store.coin_balance, 260); assert.equal(calls.includes('acknowledgePurchase'), false)
  await subject.clock.advance(1); await flush(); assert.equal((await pending).success, true); assert.equal(subject.store.coin_balance, 320)
  const writes = subject.writes(), again = controller.process(delivery)
  await subject.clock.advance(500); await flush(); assert.equal((await again).repeated, true); assert.equal(subject.writes(), writes)
  assert.equal(calls.filter(method => method === 'acknowledgePurchase').length, 2)
  controller.stop(); operation.cancel(); assert.equal(subject.clock.pending(), 0)
})

test('unchanged deferred-payment status reads do not add writes or another loading animation', async () => {
  const subject = fixture(), request = open(subject), snapshot = { ...purchase_payload(request), status: 'pending', recovery_state: 'awaiting_approval', can_abandon_interrupted: false }
  subject.store.note_purchase_state(request.request_id, snapshot)
  const writes = subject.writes(); let loading = 0
  const controller = create_purchase_recovery({ store: subject.store, run_with_loading: async action => { loading++; return action({ is_current: () => true }) }, host: async method => method === 'getPurchaseStatus' ? snapshot : { purchases: [] }, subscribe: () => () => {} })
  assert.equal((await controller.start()).success, true); assert.equal((await controller.refresh()).success, true)
  assert.equal(loading, 0); assert.equal(subject.writes(), writes); controller.stop()
})

test('unfinished scanning rechecks a checking request and exposes its interrupted result in the same round', async () => {
  const subject = fixture(), request = open(subject), payload = purchase_payload(request), operation = create_write_operation({ timers: subject.clock })
  let scanned = false, reads = 0
  const controller = create_purchase_recovery({ store: subject.store, run_with_loading: operation.run, host: async method => {
    if (method === 'getPendingPurchases') { scanned = true; return { purchases: [] } }
    if (method === 'getPurchaseStatus') { reads++; return { ...payload, status: 'pending', recovery_state: scanned ? 'interrupted' : 'checking', can_abandon_interrupted: scanned } }
    throw new Error('Unexpected request')
  }, subscribe: () => () => {}, clock: subject.clock.now })
  const started = controller.start(); await flush(); await subject.clock.advance(500); await flush()
  assert.equal(subject.store.purchase_by_id(request.request_id).recovery_state, 'checking')
  await subject.clock.advance(500); await flush(); assert.equal((await started).success, true)
  assert.equal(reads, 2); assert.equal(subject.store.purchase_by_id(request.request_id).phase, 'interrupted'); assert.equal(subject.store.purchase_by_id(request.request_id).can_abandon_interrupted, true)
  controller.stop(); operation.cancel()
})

test('persistence failure never finishes a paid StoreKit delivery or changes the coin balance', async () => {
  let fail = false, acknowledgements = 0
  const subject = fixture({ write: () => { if (fail) throw new Error('Disk full') } }), request = open(subject), operation = create_write_operation({ timers: subject.clock })
  const controller = create_purchase_recovery({ store: subject.store, run_with_loading: operation.run, host: async method => method === 'getPendingPurchases' ? { purchases: [] } : method === 'getPurchaseStatus' ? { ...purchase_payload(request), status: 'unknown' } : (acknowledgements++, { acknowledged: true }), subscribe: () => () => {}, clock: subject.clock.now })
  await controller.start(); fail = true
  const pending = controller.process(result_for(request)); await subject.clock.advance(500); await flush()
  assert.equal((await pending).success, false); assert.equal(subject.store.coin_balance, 260); assert.equal(acknowledgements, 0)
  controller.stop(); operation.cancel()
})

test('background cancellation and account changes suppress late verification and allow a later foreground recovery', async () => {
  const verification = deferred(), subject = fixture({ services: { verify_purchase: () => verification.promise } }), request = open(subject), operation = create_write_operation({ timers: subject.clock }), delivery = result_for(request)
  let acknowledgements = 0
  const host = async method => method === 'getPendingPurchases' ? { purchases: [] } : method === 'getPurchaseStatus' ? { ...purchase_payload(request), status: 'unknown' } : (acknowledgements++, { acknowledged: true })
  const controller = create_purchase_recovery({ store: subject.store, run_with_loading: operation.run, host, subscribe: () => () => {}, clock: subject.clock.now })
  await controller.start(); const pending = controller.process(delivery)
  await subject.clock.advance(500); controller.stop(); operation.cancel(); verification.resolve(proof(delivery)); await flush()
  assert.equal((await pending).success, false); assert.equal(subject.store.coin_balance, 260); assert.equal(acknowledgements, 0)
  configure_store_runtime(subject.store, { services: { verify_purchase: async result => proof(result) } })
  await controller.start(); const resumed = controller.process(delivery)
  await subject.clock.advance(500); await flush(); assert.equal((await resumed).success, true); assert.equal(subject.store.coin_balance, 320)
  controller.stop(); operation.cancel()
})

test('only an explicitly releasable interrupted request can be abandoned; a late original payment still credits', async () => {
  const subject = fixture(), request = open(subject), operation = create_write_operation({ timers: subject.clock })
  let abandon_calls = 0
  const payload = purchase_payload(request), interrupted = { ...payload, status: 'pending', recovery_state: 'interrupted', can_abandon_interrupted: true }
  assert.equal(subject.store.note_purchase_state(request.request_id, interrupted).success, true)
  const controller = create_purchase_recovery({ store: subject.store, run_with_loading: operation.run, host: async method => method === 'getPendingPurchases' ? { purchases: [] } : method === 'getPurchaseStatus' ? interrupted : method === 'abandonInterruptedPurchase' ? (abandon_calls++, { ...payload, status: 'pending', recovery_state: 'abandoned', can_abandon_interrupted: false }) : { acknowledged: true }, subscribe: () => () => {}, clock: subject.clock.now })
  const starting = controller.start(); await flush(); await subject.clock.advance(500); await starting
  const abandoned = controller.abandon(subject.store.purchase_by_id(request.request_id)); await flush(); assert.equal(abandon_calls, 0)
  await subject.clock.advance(499); assert.equal(abandon_calls, 0)
  await subject.clock.advance(1); await flush(); assert.equal(abandon_calls, 1)
  assert.equal((await abandoned).success, true); assert.equal(subject.store.purchase_by_id(request.request_id).phase, 'abandoned'); assert.equal(subject.store.purchase_by_id(request.request_id).status, 'cancelled')
  assert.equal(subject.store.begin_purchase(pack.package_id, 'new-separate-purchase').success, true)
  const late = controller.process(result_for(request)); await subject.clock.advance(500); await flush()
  assert.equal((await late).success, true); assert.equal(subject.store.coin_balance, 320)
  controller.stop(); operation.cancel()
})

test('a paid callback queued before release takes precedence and never calls native abandon', async () => {
  const subject = fixture(), request = open(subject), payload = purchase_payload(request), operation = create_write_operation({ timers: subject.clock })
  const interrupted = { ...payload, status: 'pending', recovery_state: 'interrupted', can_abandon_interrupted: true }
  subject.store.note_purchase_state(request.request_id, interrupted)
  let abandoned = 0
  const controller = create_purchase_recovery({ store: subject.store, run_with_loading: operation.run, host: async method => method === 'getPurchaseStatus' ? interrupted : method === 'getPendingPurchases' ? { purchases: [] } : method === 'abandonInterruptedPurchase' ? (abandoned++, { ...payload, status: 'unknown', recovery_state: 'abandoned' }) : { acknowledged: true }, subscribe: () => () => {}, clock: subject.clock.now })
  await controller.start()
  const release = controller.abandon(subject.store.purchase_by_id(request.request_id)), delivery = controller.process(result_for(request))
  await subject.clock.advance(500); await flush()
  assert.equal((await release).reason, 'purchase_still_pending'); assert.equal(abandoned, 0)
  await subject.clock.advance(500); await flush(); assert.equal((await delivery).success, true); assert.equal(subject.store.coin_balance, 320)
  controller.stop(); operation.cancel()
})

test('an abandoned native request recovers after H5 persistence fails and a new controller restarts', async () => {
  let fail = false
  const subject = fixture({ write: () => { if (fail) throw new Error('Disk full') } }), request = open(subject), payload = purchase_payload(request)
  subject.store.note_purchase_state(request.request_id, { ...payload, status: 'pending', recovery_state: 'interrupted', can_abandon_interrupted: true })
  const operation = create_write_operation({ timers: subject.clock }), snapshot = { ...payload, status: 'unknown', recovery_state: 'abandoned', can_abandon_interrupted: false }
  const options = { store: subject.store, run_with_loading: operation.run, host: async method => method === 'getPurchaseStatus' ? snapshot : { purchases: [] }, subscribe: () => () => {}, clock: subject.clock.now }
  const interrupted = create_purchase_recovery(options); fail = true
  const first = interrupted.start(); await flush(); await subject.clock.advance(500); await flush(); await first
  assert.equal(subject.store.purchase_by_id(request.request_id).status, 'pending')
  interrupted.stop(); operation.cancel(); fail = false
  const restarted = create_purchase_recovery(options), restored = restarted.start()
  await flush(); await subject.clock.advance(500); await flush(); await restored
  assert.equal(subject.store.purchase_by_id(request.request_id).status, 'cancelled'); assert.equal(subject.store.purchase_by_id(request.request_id).phase, 'abandoned')
  assert.equal(subject.store.begin_purchase(pack.package_id, 'purchase-after-restored-release').success, true)
  restarted.stop(); operation.cancel(); assert.equal(subject.clock.pending(), 0)
})

test('only old product-less unaccepted requests expire through a 500ms write, never starting a payment', async () => {
  for (const package_id of ['pkg_60', 'pkg_680']) {
    const subject = fixture(), row = { request_id: `legacy-${package_id}`, package_id, owner_user_id: TEST_USER_ID, status: 'pending', product_id: null, created_at: now - 9000, receipt_id: null }
    let historical = subject.store.data.coin_packages.find(item => item.package_id === package_id)
    if (!historical) { historical = { package_id, product_id: null, coins: 680, price: '$6.99' }; subject.store.data.coin_packages.push(historical) }
    historical.product_id = null; subject.store.data.purchase_requests.push(row)
    const operation = create_write_operation({ timers: subject.clock }), methods = []
    const controller = create_purchase_recovery({ store: subject.store, run_with_loading: operation.run, host: async method => { methods.push(method); assert.equal(method, 'getPendingPurchases'); return { purchases: [] } }, subscribe: () => () => {}, clock: subject.clock.now })
    const started = controller.start(); await flush(); await subject.clock.advance(499)
    assert.equal(subject.store.purchase_by_id(row.request_id).status, 'pending')
    await subject.clock.advance(1); await flush(); assert.equal((await started).success, true)
    const restored = subject.store.purchase_by_id(row.request_id)
    assert.equal(restored.status, 'timeout'); assert.equal(restored.product_id, null); assert.equal(subject.store.coin_balance, 260)
    assert.deepEqual(methods, ['getPendingPurchases']); controller.stop(); operation.cancel()
  }
})

test('legacy compatibility never expires an actual product, acceptance, phase or an incomplete eight-second window', () => {
  for (const change of ['row-product', 'catalog-product', 'accepted', 'phase', 'recent']) {
    const subject = fixture(), row = { request_id: 'strict-legacy', package_id: pack.package_id, owner_user_id: TEST_USER_ID, status: 'pending', product_id: null, accepted_at: null, created_at: now - 9000, receipt_id: null }
    subject.store.data.coin_packages.find(item => item.package_id === pack.package_id).product_id = null
    if (change === 'row-product') row.product_id = pack.product_id
    if (change === 'catalog-product') subject.store.data.coin_packages.find(item => item.package_id === pack.package_id).product_id = pack.product_id
    if (change === 'accepted') row.accepted_at = now - 9000
    if (change === 'phase') row.phase = 'accepted'
    if (change === 'recent') row.created_at = now - 7999
    subject.store.data.purchase_requests.push(row)
    const before = clone_data(subject.store.data)
    assert.equal(subject.store.expire_unconfigured_purchase(row.request_id).success, false)
    assert.deepEqual(clone_data(subject.store.data), before); assert.equal(subject.store.coin_balance, 260)
  }
})
