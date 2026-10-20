import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'

function fixture() {
  let disk = create_seed(), writes = 0, fail = false
  const persistence = { read: () => clone_data(disk), write: (_, value) => { if (fail) throw Error('Storage full'); writes++; disk = clone_data(value) } }
  const store = use_app_store(createPinia()); configure_store_runtime(store, { persistence }); store.hydrate()
  return { store, disk: () => disk, writes: () => writes, fail: value => { fail = value }, reload: () => { const next = use_app_store(createPinia()); configure_store_runtime(next, { persistence }); next.hydrate(); return next } }
}
const open = store => store.stage_introduction_form('user_zane', store.questions_for_user('user_zane')[0].question_id, 'text').data
test('question selection, typing, mode switch and Back use transient forms without disk writes or a data revision', () => {
  const f = fixture(), before = clone_data(f.store.data), id = open(f.store)
  for (const patch of [{ text: 'Coffee after class?' }, { mode: 'voice' }, { mode: 'text' }]) assert.ok(f.store.edit_introduction_form(id, patch).success)
  assert.equal(f.store.introduction_context('user_zane', id).draft.payload.text, 'Coffee after class?')
  assert.equal(f.store.introduction_context('user_zane').question.question_id, 'user_zane_q_0')
  assert.deepEqual(clone_data(f.store.data), before); assert.equal(f.writes(), 0); assert.equal(f.store.current_drafts.length, 0)
  assert.doesNotMatch(fs.readFileSync('src/pages/discover/icebreaker/text.vue', 'utf8'), /setTimeout|save_timer|update_introduction_draft/)
  assert.doesNotMatch(fs.readFileSync('src/pages/discover/icebreaker/select.vue', 'utf8'), /run_with_loading|Saving your question/)
})
test('unrelated writes cannot autosave UI-only introduction fields', () => {
  const f = fixture(), id = open(f.store)
  f.store.edit_introduction_form(id, { text: 'Unsubmitted private answer' })
  assert.ok(f.store.update_settings('notifications', { master: false }).success)
  assert.equal(f.disk().drafts.length, 0); assert.ok(!JSON.stringify(f.disk()).includes('Unsubmitted private answer'))
})
test('reload discards unpublished text, but explicit publish and fee confirmation remain recoverable and atomic', async () => {
  const f = fixture(), id = open(f.store)
  f.store.edit_introduction_form(id, { text: 'Only save when sending.' })
  assert.ok(f.reload().introduction_context('user_zane', id).error)
  f.fail(true); const before = clone_data(f.store.data)
  assert.equal(f.store.persist_introduction_form(id).success, false); assert.deepEqual(clone_data(f.store.data), before)
  assert.equal(f.store.introduction_context('user_zane', id).draft.payload.text, 'Only save when sending.')
  f.fail(false); assert.ok(f.store.persist_introduction_form(id).success)
  const recovered = f.reload(); assert.equal(recovered.introduction_context('user_zane', id).draft.payload.text, 'Only save when sending.')
  const spend = recovered.prepare_introduction_spend(id, 'text'); assert.ok(spend.success)
  const sent = await recovered.complete_coin_spend(spend.data); assert.ok(sent.success)
  assert.equal(recovered.coin_balance, 250); assert.equal((await recovered.complete_coin_spend(spend.data)).repeated, true)
})
test('logout/relogin clears transient text and cannot revive a previous form under the same account', async () => {
  const f = fixture(), id = open(f.store)
  f.store.edit_introduction_form(id, { text: 'Do not reveal after logout' })
  f.store.logout(); assert.equal(f.store.introduction_forms.length, 0)
  await f.store.login('cimoa@gmail.com', '12341234')
  assert.ok(f.store.introduction_context('user_zane', id).error)
  assert.equal(f.store.edit_introduction_form(id, { text: 'Should fail' }).success, false)
})
test('invalid question, blocked target, expired session and completed request cannot create or publish a form', async () => {
  const f = fixture(), id = open(f.store)
  assert.equal(f.store.stage_introduction_form('user_zane', 'user_lina_q_0').success, false)
  f.store.block_user('user_zane'); const before = clone_data(f.store.data)
  assert.equal(f.store.persist_introduction_form(id).success, false); assert.deepEqual(clone_data(f.store.data), before)
  assert.equal(f.store.stage_introduction_form('user_zane', 'user_zane_q_0').success, false)
  const other = fixture(); other.store.data.session.expires_at = 1
  assert.equal(other.store.stage_introduction_form('user_zane', 'user_zane_q_0').success, false)
})
test('actual recipient acceptance changes the sender deck/profile primary from grey waiting to canonical Chat', async () => {
  const f = fixture(), id = open(f.store)
  f.store.edit_introduction_form(id, { text: 'Would you like a campus walk?' }); f.store.persist_introduction_form(id)
  const sent = await f.store.complete_coin_spend(f.store.prepare_introduction_spend(id, 'text').data), request_id = sent.data.destination_id
  assert.equal(f.store.introduction_context('user_zane').primary.label, 'Waiting for reply'); assert.equal(f.store.introduction_context('user_zane').primary.disabled, true)
  // Test-only recipient credentials; no production catalog account is added.
  f.store.data.accounts.push({ ...clone_data(f.store.data.accounts[0]), account_id: 'account_zane_test', user_id: 'user_zane', email: 'zane@campus.test' })
  f.store.logout(); assert.ok((await f.store.login('zane@campus.test', '12341234')).success)
  const accepted = f.store.accept_request(request_id, 'zane-explicit-accept'); assert.ok(accepted.success)
  f.store.logout(); await f.store.login('cimoa@gmail.com', '12341234')
  const primary = f.store.introduction_context('user_zane').primary
  assert.equal(primary.label, 'Chat'); assert.ok(!primary.disabled); assert.equal(primary.destination, `/pages/messages/chat?conversation_id=${accepted.data}`)
  assert.equal(f.store.coin_balance, 250); assert.equal(f.reload().introduction_context('user_zane').primary.destination, primary.destination)
})
