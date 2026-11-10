import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data, HOME_REQUEST_USER_ID } from '../src/stores/seed.js'
import { coin_source_route } from '../src/utils/coinReturnContext.js'
import { ACTIVE_COIN_PACKAGES } from '../src/stores/coinPackages.js'

const fixture = () => {
  let disk = create_seed()
  const store = use_app_store(createPinia())
  const persistence = { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }
  configure_store_runtime(store, { persistence }); store.hydrate()
  const pack = ACTIVE_COIN_PACKAGES.find(row => row.package_id === 'pkg_60')
  store.purchase_products = [{ package_id: pack.package_id, product_id: pack.product_id, display_price: '$0.99', currency_code: 'USD' }]
  const draft = store.prepare_introduction('user_zane', store.questions_for_user('user_zane')[0].question_id, 'text').data
  store.update_introduction_draft(draft, { text: 'Coffee and a campus walk after class?' })
  return { store, draft, persistence, reload: () => { const other = use_app_store(createPinia()); configure_store_runtime(other, { persistence }); other.hydrate(); return other } }
}
test('text confirmation is a no-debit snapshot; processing atomically charges 10 and creates one pending request', async () => {
  const { store, draft, reload } = fixture(), initial = store.coin_transactions.length
  const prepared = store.prepare_introduction_spend(draft, 'text'); assert.ok(prepared.success)
  assert.equal(store.coin_balance, 260); assert.equal(store.data.requests.filter(r => r.recipient_id === 'user_zane').length, 0)
  assert.equal(store.prepare_introduction_spend(draft, 'text').data, prepared.data)
  const sent = await store.complete_coin_spend(prepared.data); assert.ok(sent.success)
  const request = store.request_detail(sent.data.destination_id)
  assert.equal(request.kind, 'text'); assert.equal(request.status, 'pending'); assert.equal(request.text, 'Coffee and a campus walk after class?')
  assert.equal(store.coin_balance, 250); assert.equal(store.coin_transactions.length, initial + 1)
  const txn = store.coin_transactions.find(t => t.related_id === request.request_id)
  assert.equal(txn.amount, -10); assert.equal(store.coin_ledger_detail(txn.transaction_id).feature_label, 'Text Introduction')
  const recovered = reload(), before = clone_data(recovered.data)
  assert.equal((await recovered.complete_coin_spend(prepared.data)).repeated, true); assert.deepEqual(clone_data(recovered.data), before)
  assert.equal(recovered.introduction_context('user_zane').primary.label, 'Waiting for reply')
  assert.equal(recovered.introduction_context('user_zane').primary.disabled, true)
  assert.equal(recovered.introduction_context('user_zane', draft).completed_request_id, request.request_id)
  assert.equal(recovered.can_chat('user_zane'), false)
})
test('text failure rolls back request, ledger and draft, then retry succeeds once', async () => {
  const { store, draft, persistence } = fixture(), id = store.prepare_introduction_spend(draft, 'text').data, before = clone_data(store.data)
  configure_store_runtime(store, { persistence: { read: persistence.read, write() { throw Error('Storage full') } } })
  assert.equal((await store.complete_coin_spend(id)).success, false); assert.deepEqual(clone_data(store.data), before)
  configure_store_runtime(store, { persistence })
  assert.ok((await store.complete_coin_spend(id)).success); assert.equal(store.coin_balance, 250)
})
test('text insufficiency at prepare or processing never sends, and recharge returns to the same answer', async () => {
  const { store, draft } = fixture()
  assert.match(coin_source_route(store, draft), /icebreaker\/text\?user_id=user_zane&draft_id=/)
  assert.ok(store.begin_purchase(store.coin_packages[0].package_id, 'text-return', draft).success)
  const id = store.prepare_introduction_spend(draft, 'text').data
  store.data.coin_transactions = store.data.coin_transactions.filter(t => t.owner_user_id !== 'user_cimoa')
  const before = clone_data(store.data)
  assert.equal(store.prepare_introduction_spend(draft, 'text').success, false)
  assert.equal((await store.complete_coin_spend(id)).success, false); assert.deepEqual(clone_data(store.data), before)
})
test('editing an answer or switching mode invalidates its prior fee confirmation', async () => {
  for (const patch of [{ text: 'A different introduction.' }, { mode: 'voice' }]) {
    const { store, draft } = fixture(), id = store.prepare_introduction_spend(draft, 'text').data
    store.update_introduction_draft(draft, patch)
    const before = clone_data(store.data)
    assert.equal((await store.complete_coin_spend(id)).success, false); assert.deepEqual(clone_data(store.data), before)
  }
})
test('block, duplicate request, cancelled task and expired session invalidate pending spending atomically', async () => {
  for (const change of [s => s.block_user('user_zane'), async s => s.send_introduction({ user_id: 'user_zane', question_id: s.questions_for_user('user_zane')[0].question_id, text: 'Another entry', operation_id: 'other-entry' }), s => { s.data.session.expires_at = 1 }]) {
    const { store, draft } = fixture(), id = store.prepare_introduction_spend(draft, 'text').data
    await change(store); const before = clone_data(store.data)
    assert.equal((await store.complete_coin_spend(id)).success, false); assert.deepEqual(clone_data(store.data), before)
  }
  const { store, draft } = fixture(), id = store.prepare_introduction_spend(draft, 'text').data, before = clone_data(store.data)
  assert.equal((await store.complete_coin_spend(id, { is_current: () => false })).reason, 'cancelled'); assert.deepEqual(clone_data(store.data), before)
})
test('existing free requests remain free after hydration; received invitations and connected Chat stay enabled', () => {
  const { store, reload } = fixture(), before = store.coin_transactions.length
  store.data.requests.push({ request_id: 'historical_free', sender_id: 'user_cimoa', recipient_id: 'user_zane', question_id: 'user_zane_q_0', question_text: store.questions_for_user('user_zane')[0].text, kind: 'text', text: 'Previously sent', audio_id: null, status: 'pending', created_at: Date.now(), resolved_at: null })
  const snapshot = clone_data(store.data)
  configure_store_runtime(store, { persistence: { read: () => snapshot, write() {} } }); store.hydrate()
  assert.equal(store.coin_transactions.length, before); assert.equal(store.coin_balance, 260)
  assert.equal(store.introduction_context('user_zane').primary.disabled, true)
  assert.equal(store.introduction_context(HOME_REQUEST_USER_ID).primary.label, 'View request'); assert.ok(!store.introduction_context(HOME_REQUEST_USER_ID).primary.disabled)
  assert.equal(store.introduction_context('user_chloe').primary.label, 'Chat'); assert.ok(!store.introduction_context('user_chloe').primary.disabled)
  assert.ok(reload())
})
