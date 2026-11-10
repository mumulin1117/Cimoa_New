import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { ensure_account_defaults, session_for } from '../src/stores/accountDefaults.js'

const now = Date.UTC(2026, 9, 19, 1), organizer = 'organizer_hkust'
function fixture(change = () => {}) {
  let disk = create_seed(now), writes = 0, fail = false
  disk.organizers.push({ organizer_id: 'organizer_other', name: 'Other Campus Society', avatar_url: '' })
  disk.events.push({ ...clone_data(disk.events[0]), event_id: 'event_other', organizer_id: 'organizer_other', feed_order: 2.5 })
  change(disk)
  const persistence = { read: key => key === STATE_KEY ? clone_data(disk) : null, write: (_, data) => { if (fail) throw Error('Storage full'); disk = clone_data(data); writes++ } }
  const attach = () => { const store = use_app_store(createPinia()); configure_store_runtime(store, { clock: () => now, persistence }); return store }
  const store = attach(); assert.equal(store.hydrate().success, true)
  return { store, attach, writes: () => writes, snapshot: () => clone_data(disk), fail: value => { fail = value } }
}
test('organizer blocking filters all recommendation tabs by institution ID, not personal accounts', () => {
  const { store } = fixture(), personal = clone_data(store.data.blocked_users), people = clone_data(store.visible_people)
  assert.equal(store.block_organizer(organizer).success, true)
  for (const tab of ['Today', 'This week']) {
    assert.equal(store.select_event_tab(tab).success, true)
    assert.ok(store.event_feed.length > 0); assert.ok(store.event_feed.every(e => e.organizer_id === 'organizer_other'))
  }
  assert.deepEqual(store.data.blocked_users, personal); assert.deepEqual(store.visible_people, people)
  assert.equal(store.event_detail('event_picnic').organizer_blocked, true)
  assert.equal(store.blocked_organizers[0].organizer_id, organizer)
  const view = store.blocked_organizers; view[0].name = 'Changed'; assert.equal(store.data.organizers.find(row => row.organizer_id === organizer).name, 'HKUST Student Union')
})
test('blocking retains joined events, participant counts, group membership/messages and unrelated data across fresh hydration', async () => {
  const f = fixture(), { store } = f
  assert.equal(store.join_event('event_picnic').success, true)
  assert.equal((await store.send_event_message('event_picnic', 'group_picnic', 'See you there', null, 'organizer_keep')).success, true)
  const before = clone_data(store.data), count = store.event_detail('event_picnic').participant_count
  assert.equal(store.block_organizer(organizer).success, true)
  for (const current of [store, f.attach()]) {
    if (current !== store) assert.equal(current.hydrate().success, true)
    assert.equal(current.event_feed.some(e => e.organizer_id === organizer), false)
    assert.equal(current.my_events[0].event_id, 'event_picnic'); assert.equal(current.my_event_groups.featured.event_id, 'event_picnic')
    assert.equal(current.event_detail('event_picnic').participant_count, count)
    assert.equal(current.event_group('event_picnic', 'group_picnic').messages.at(-1).body, 'See you there')
    for (const key of ['memberships', 'messages', 'conversations', 'relationships', 'coin_transactions', 'blocked_users', 'reports']) assert.deepEqual(current.data[key], before[key])
  }
})
test('unblock restores recommendation eligibility only; leave while blocked remains a separate explicit action', () => {
  const { store } = fixture(); store.join_event('event_picnic'); store.block_organizer(organizer)
  assert.equal(store.leave_event('event_picnic').success, true)
  const before = clone_data(store.data)
  assert.equal(store.unblock_organizer(organizer).success, true)
  assert.ok(store.event_feed.some(e => e.organizer_id === organizer)); assert.equal(store.my_events.length, 0)
  assert.equal(store.event_group('event_picnic', 'group_picnic'), null)
  for (const key of ['memberships', 'messages', 'conversations', 'relationships', 'coin_transactions', 'blocked_users', 'reports']) assert.deepEqual(store.data[key], before[key])
})
test('organizer block is account scoped; logout and another account do not leak hidden recommendations or lists', () => {
  const f = fixture(data => { data.accounts.push({ ...clone_data(data.accounts[0]), account_id: 'account_peer', user_id: 'user_noah', email: 'noah@campus.edu' }); ensure_account_defaults(data, 'user_noah') })
  f.store.block_organizer(organizer); f.store.logout(); assert.deepEqual(f.store.blocked_organizers, [])
  f.store.data.session = session_for(f.store.data.accounts.find(a => a.account_id === 'account_peer'), now)
  assert.deepEqual(f.store.blocked_organizers, []); assert.ok(f.store.event_feed.some(e => e.organizer_id === organizer))
  assert.equal(f.store.unblock_organizer(organizer).success, false)
  assert.equal(f.store.data.event_preferences.find(p => p.owner_user_id === 'user_cimoa').blocked_organizer_ids.length, 1)
})
test('missing/deleted session, missing organizer and duplicate actions cannot mutate preferences', () => {
  const f = fixture(), { store } = f
  for (const id of ['user_chloe', '', 'missing']) { const before = clone_data(store.data); assert.equal(store.block_organizer(id).success, false); assert.deepEqual(store.data, before) }
  store.block_organizer(organizer); const before = clone_data(store.data), writes = f.writes()
  assert.equal(store.block_organizer(organizer).success, false); assert.deepEqual(store.data, before); assert.equal(f.writes(), writes)
  store.unblock_organizer(organizer); assert.equal(store.unblock_organizer(organizer).success, false)
  store.logout(); const loggedOut = clone_data(store.data); assert.equal(store.block_organizer(organizer).success, false); assert.deepEqual(store.data, loggedOut)
})
test('persistence failures roll back block and unblock atomically', () => {
  const f = fixture(), before = clone_data(f.store.data); f.fail(true)
  assert.equal(f.store.block_organizer(organizer).success, false); assert.deepEqual(f.store.data, before); assert.deepEqual(f.snapshot(), before)
  f.fail(false); f.store.block_organizer(organizer); const blocked = clone_data(f.store.data); f.fail(true)
  assert.equal(f.store.unblock_organizer(organizer).success, false); assert.deepEqual(f.store.data, blocked); assert.deepEqual(f.snapshot(), blocked)
})
test('old saves default to an empty block set without writes or resetting existing filters and reminder preferences', () => {
  const f = fixture(data => { delete data.event_preferences[0].blocked_organizer_ids; data.event_preferences[0].filters.category = 'Music'; data.event_preferences[0].reminder_by_event = { event_picnic: true } })
  assert.deepEqual(f.store.data.event_preferences[0].blocked_organizer_ids, []); assert.equal(f.store.data.event_preferences[0].filters.category, 'Music')
  assert.equal(f.store.data.event_preferences[0].reminder_by_event.event_picnic, true); assert.equal(f.writes(), 0)
})
test('malformed explicit organizer IDs fail hydration without overwriting saved data', () => {
  for (const ids of [null, 'organizer_hkust', ['missing'], [organizer, organizer], [42]]) {
    const data = create_seed(now); data.event_preferences[0].blocked_organizer_ids = ids
    const store = use_app_store(createPinia()); configure_store_runtime(store, { clock: () => now, persistence: { read: () => data, write() { throw Error('Must not overwrite') } } })
    assert.equal(store.hydrate().success, false); assert.equal(store.hydration_status, 'error'); assert.deepEqual(store.blocked_organizers, [])
  }
})
