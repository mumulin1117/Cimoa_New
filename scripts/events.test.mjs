import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data, TEST_USER_ID } from '../src/stores/seed.js'
import { events_destination, require_events_destination_ready, EVENTS_DEFERRED_ROUTES } from '../src/utils/eventsNavigation.js'

const now = Date.UTC(2026, 9, 13, 1) // Tuesday 09:00 Hong Kong, deliberately not device-local time.
const make = transform => {
  let disk = create_seed(now), writes = 0; transform?.(disk)
  const store = use_app_store(createPinia())
  const persistence = { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data); writes++ } }
  configure_store_runtime(store, { clock: () => now, persistence }); assert.equal(store.hydrate().success, true)
  return { store, persistence, writes: () => writes, disk: () => disk }
}
test('Events real date/campus filters, source featured ordering and no read-side writes', () => {
  const f = make(), before = JSON.stringify(f.store.data)
  assert.deepEqual(f.store.event_feed.slice(0, 3).map(e => e.event_id), ['event_picnic', 'event_mic', 'event_yoga'])
  assert.equal(f.store.event_feed[0].date_label, 'Today · 5:30 PM')
  assert.equal(f.store.event_feed[0].participant_count, 3); assert.equal(f.store.event_feed[0].available_count, 17)
  assert.equal(JSON.stringify(f.store.data), before); assert.equal(f.writes(), 0)
  assert.equal(f.store.select_event_tab('This week').success, true); assert.equal(f.store.event_feed[0].event_id, 'event_film')
  assert.ok(!f.store.event_feed.some(e => e.event_id === 'event_study'))
  assert.equal(f.store.select_event_tab('My campus').success, true); assert.equal(f.store.event_feed[0].event_id, 'event_market')
  f.store.data.users[0].university = 'Stanford'; assert.deepEqual(f.store.event_feed, [])
})
test('Today and Monday-week boundaries use event timezone, with UTC fallback for old saves', () => {
  const f = make(data => { Object.assign(data.events[0], { starts_at: Date.UTC(2026, 9, 12, 17), ends_at: now + 3600000 }) })
  const contains = () => f.store.event_feed.some(e => e.event_id === 'event_picnic')
  assert.equal(contains(), true) // UTC Monday = HK Tuesday.
  delete f.store.data.events[0].time_zone; assert.equal(contains(), false)
  f.store.select_event_tab('This week'); assert.equal(contains(), true)
  f.store.data.events[0].starts_at = Date.UTC(2026, 9, 11, 23); assert.equal(contains(), false)
  f.store.data.events[0].starts_at = Date.UTC(2026, 9, 19, 0); assert.equal(contains(), false)
})
test('tab preference persists without overwriting old filters/media; errors are atomic and account scoped', () => {
  const f = make(), old = clone_data(f.store.data.event_preferences[0]); assert.equal(f.store.select_event_tab('My campus').success, true)
  assert.deepEqual(f.store.data.event_preferences[0], { ...old, active_tab: 'My campus' })
  f.store.hydration_status = 'idle'; f.store.hydrate(); assert.equal(f.store.active_event_tab, 'My campus')
  const before = JSON.stringify(f.store.data)
  assert.equal(f.store.select_event_tab('invalid').success, false); assert.equal(JSON.stringify(f.store.data), before)
  configure_store_runtime(f.store, { persistence: { ...f.persistence, write() { throw Error('Storage full') } } })
  assert.equal(f.store.select_event_tab('Today').success, false); assert.equal(JSON.stringify(f.store.data), before)
  const legacy = make(d => { delete d.events[0].time_zone; d.events[0].image_url = ''; d.events[0].title = 'My saved event' })
  assert.equal(legacy.store.event_by_id('event_picnic').image_url, ''); assert.equal(legacy.store.event_by_id('event_picnic').title, 'My saved event'); assert.equal(legacy.writes(), 0)
  const no_row = make(d => { d.event_preferences = [] }); assert.equal(no_row.store.select_event_tab('This week').success, true); assert.equal(no_row.store.data.event_preferences[0].owner_user_id, TEST_USER_ID)
})
test('joining and cancelling atomically synchronize cards, My Events, counts and group permissions', () => {
  const f = make(), id = 'event_picnic', coins = f.store.coin_balance
  assert.equal(f.store.join_event(id).success, true); assert.equal(f.store.join_event(id).success, false); assert.equal(f.writes(), 1)
  const event = f.store.event_feed.find(e => e.event_id === id)
  assert.equal(event.participant_count, 4); assert.equal(event.available_count, 16); assert.equal(event.joined, true)
  assert.equal(f.store.my_events.length, 1); assert.equal(event.conversation_id, 'group_picnic'); assert.equal(f.store.coin_balance, coins)
  assert.equal(f.store.leave_event(id).success, true); assert.equal(f.store.event_by_id(id).available_count, 17)
  assert.equal(f.store.event_by_id(id).conversation_id, null); assert.equal(f.store.my_events.length, 0)
  assert.equal(f.store.messages_for_conversation('group_picnic').length, 0)
  assert.equal(f.store.join_event(id).success, true); assert.equal(f.store.data.memberships.filter(m => m.event_id === id && m.user_id === TEST_USER_ID).length, 1)
})
test('eligibility is shared by entry and commit; capacity/expiry/paid/unverified/stale IDs fail without writes', () => {
  for (const [transform, id, pattern] of [[null, 'event_badminton', /full/], [d => { Object.assign(d.events[0], { starts_at: now - 7200000, ends_at: now }) }, 'event_picnic', /ended/], [d => { d.events[0].price = 10 }, 'event_picnic', /Paid/], [d => { d.users[0].verification_status = 'pending' }, 'event_picnic', /verification/], [null, 'missing', /no longer/], [d => { d.session.expires_at = now }, 'event_picnic', /session/]]) {
    const f = make(transform), before = JSON.stringify(f.store.data)
    assert.match(f.store.event_join_blocker(id), pattern); assert.equal(f.store.join_event(id).success, false)
    assert.equal(JSON.stringify(f.store.data), before); assert.equal(f.writes(), 0)
  }
  const f = make(); configure_store_runtime(f.store, { persistence: { ...f.persistence, write() { throw Error('Full disk') } } })
  assert.equal(f.store.join_event('event_picnic').success, false); assert.equal(f.store.my_events.length, 0)
})
test('blocked users do not appear in previews but keep their seat; getters return isolated copies', () => {
  const f = make(); f.store.block_user('user_chloe')
  const event = f.store.event_by_id('event_picnic'); assert.equal(event.participant_count, 2); assert.equal(event.available_count, 17)
  assert.ok(event.participants.every(p => p.user_id !== 'user_chloe'))
  event.participants[0].user_name = 'Changed'; assert.notEqual(f.store.event_by_id('event_picnic').participants[0].user_name, 'Changed')
})
test('source navigation carries exact event and group IDs, never autojoins or enters unrestored targets', () => {
  const f = make(), before = JSON.stringify(f.store.data)
  assert.equal(events_destination(f.store, 'upcoming'), '/pages/events/upcoming')
  assert.equal(events_destination(f.store, 'detail', 'event_mic'), '/pages/events/detail?event_id=event_mic')
  assert.equal(events_destination(f.store, 'participants', 'event_picnic'), '/pages/events/participants?event_id=event_picnic')
  assert.throws(() => events_destination(f.store, 'group', 'event_picnic'), /Join/)
  for (const route of EVENTS_DEFERRED_ROUTES) assert.throws(() => require_events_destination_ready(route), /not been restored/)
  assert.equal(JSON.stringify(f.store.data), before)
  f.store.join_event('event_picnic'); assert.equal(events_destination(f.store, 'group', 'event_picnic'), '/pages/events/group?event_id=event_picnic&conversation_id=group_picnic')
})
test('malformed event metadata is a recoverable read error; failed cancellation retains membership', () => {
  for (const transform of [d => { d.events[0].time_zone = 'Invalid/Timezone' }, d => { d.event_preferences[0].active_tab = 'unknown' }]) {
    const saved = create_seed(now); transform(saved)
    const store = use_app_store(createPinia())
    configure_store_runtime(store, { clock: () => now, persistence: { read: () => saved, write() { throw Error('Must not overwrite') } } })
    assert.equal(store.hydrate().success, false); assert.equal(store.hydration_status, 'error'); assert.deepEqual(store.event_feed, [])
  }
  const f = make(); f.store.join_event('event_picnic'); const before = JSON.stringify(f.store.data)
  configure_store_runtime(f.store, { persistence: { ...f.persistence, write() { throw Error('Full disk') } } })
  assert.equal(f.store.leave_event('event_picnic').success, false); assert.equal(JSON.stringify(f.store.data), before)
  assert.equal(f.store.event_by_id('event_picnic').conversation_id, 'group_picnic')
})
