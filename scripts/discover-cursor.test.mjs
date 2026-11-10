import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { discover_cursor_index } from '../src/stores/discoverCursor.js'

function fixture() {
  let disk = create_seed(), writes = 0, fail = false
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { if (fail) throw Error('Storage full'); writes++; disk = clone_data(data) } } })
  store.hydrate()
  return { store, disk: () => disk, writes: () => writes, fail: value => { fail = value } }
}
const current = store => store.discover_people[store.discover_card_index]?.user_id || null

test('settled browsing survives page reconciliation with no data revision, disk write or skip/request record', () => {
  const f = fixture(), before = clone_data(f.store.data), ids = f.store.discover_people.map(person => person.user_id)
  f.store.reconcile_discover_cursor()
  for (const id of ids) {
    assert.equal(f.store.remember_discover_card(id), true)
    for (let i = 0; i < 3; i++) { f.store.tick(); f.store.reconcile_discover_cursor(); assert.equal(current(f.store), id) }
  }
  assert.deepEqual(clone_data(f.store.data), before); assert.equal(f.writes(), 0)
  assert.equal(f.store.remember_discover_card('missing-user'), false); assert.equal(current(f.store), ids.at(-1))
})
test('a stable ID survives ordering changes, previous-card removal and current profile edits', () => {
  const { store } = fixture(), ids = store.discover_people.map(person => person.user_id), target = ids[3]
  store.remember_discover_card(target)
  store.data.users.find(person => person.user_id === target).discover_order = -1
  store.data.users.find(person => person.user_id === ids[0]).discoverable = false
  store.data.users.find(person => person.user_id === target).user_name = 'Updated student'
  store.reconcile_discover_cursor()
  assert.equal(current(store), target); assert.equal(store.discover_card_index, 0)
  assert.equal(store.discover_people[store.discover_card_index].user_name, 'Updated student')
})
test('blocking the active person advances to a valid fallback; unblocking does not revive the old cursor', () => {
  const { store } = fixture(), ids = store.discover_people.map(person => person.user_id)
  store.remember_discover_card(ids[2]); assert.ok(store.block_user(ids[2]).success)
  store.reconcile_discover_cursor(); assert.equal(current(store), ids[3])
  assert.ok(store.unblock_user(ids[2]).success); store.reconcile_discover_cursor()
  assert.equal(current(store), ids[3])
})
test('an empty pool clears the cursor safely; a refilled or singleton pool resolves without invalid indices', () => {
  const { store } = fixture(), target = store.discover_people[4].user_id
  store.remember_discover_card(target)
  for (const person of store.data.users) person.discoverable = false
  store.reconcile_discover_cursor(); assert.equal(current(store), null); assert.equal(store.discover_cursor, null)
  store.data.users.find(person => person.user_id === target).discoverable = true
  store.reconcile_discover_cursor(); assert.equal(current(store), target); assert.equal(store.discover_card_index, 0)
  assert.equal(discover_cursor_index({ auth_context: 'a', user_id: 'gone', index: -1 }, 'a', ['one']), 0)
})
test('unrelated settings and pending request updates preserve the cursor while current canonical state stays live', async () => {
  const { store } = fixture(), target = store.discover_people[2].user_id
  store.remember_discover_card(target); assert.ok(store.update_settings('notifications', { master: false }).success)
  assert.equal(current(store), target)
  const question = store.questions_for_user(target)[0].question_id
  const form = store.stage_introduction_form(target, question).data
  store.edit_introduction_form(form, { text: 'Would you like to meet after class?' }); store.persist_introduction_form(form)
  const request = await store.complete_coin_spend(store.prepare_introduction_spend(form, 'text').data)
  assert.ok(request.success); assert.equal(current(store), target)
  assert.equal(store.introduction_context(target).primary.label, 'Waiting for reply')
  assert.equal(store.introduction_context(target).primary.disabled, true)
})
test('failed logout keeps the cursor; successful logout and same-account relogin clear it', async () => {
  const f = fixture(), target = f.store.discover_people[3].user_id
  f.store.remember_discover_card(target); f.fail(true)
  assert.equal(f.store.logout().success, false); assert.equal(current(f.store), target)
  f.fail(false); assert.ok(f.store.logout().success); assert.equal(f.store.discover_cursor, null)
  assert.ok((await f.store.login('cimoa@connect.edu', '12341234')).success)
  assert.equal(current(f.store), 'user_zane')
})
test('another auth context, expired session and a fresh app instance cannot expose the previous cursor', () => {
  const { store } = fixture(); store.remember_discover_card(store.discover_people[3].user_id)
  store.data.auth_flow.flow_id = 'another-login'; assert.equal(current(store), 'user_zane')
  store.reconcile_discover_cursor(); store.data.session.expires_at = 1
  assert.equal(current(store), null); assert.equal(store.remember_discover_card('user_zane'), false)
  const next = fixture(); assert.equal(next.store.discover_cursor, null); assert.equal(current(next.store), 'user_zane')
})
