import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'

const now = Date.UTC(2026, 9, 13, 1)
const make = (scenario = 'default', transform = () => {}) => {
  let time = now, disk = create_scenario(scenario, now), writes = 0
  transform(disk)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => time, persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data); writes++ } } })
  assert.equal(store.hydrate().success, true)
  return { store, writes: () => writes, advance: value => { time = value; store.tick() } }
}

test('full and ended events expose the same unavailable booking state across canonical card and detail reads', () => {
  for (const [transform, label, ended] of [
    [data => { data.events[0].capacity = 3 }, 'Event full', false],
    [data => { Object.assign(data.events[0], { starts_at: now - 7200000, ends_at: now }) }, 'Event ended', true],
  ]) {
    const { store, writes } = make('default', transform), before = clone_data(store.data)
    for (const event of [store.event_by_id('event_picnic'), store.event_detail('event_picnic')]) {
      assert.equal(event.joined, false)
      assert.equal(event.ended, ended)
      assert.equal(event.join_disabled, true)
      assert.equal(event.join_label, label)
    }
    if (!ended) assert.equal(store.event_feed.find(event => event.event_id === 'event_picnic').join_label, label)
    else assert.equal(store.event_feed.some(event => event.event_id === 'event_picnic'), false)
    assert.equal(store.join_event('event_picnic').success, false)
    assert.deepEqual(store.data, before)
    assert.equal(writes(), 0)
  }
})

test('joined full or ended events retain group access and attendance management until an actual leave', () => {
  for (const scenario of ['event_joined', 'event_past']) {
    const { store } = make(scenario, data => { data.events[0].capacity = 4 })
    const event = store.event_detail('event_picnic')
    assert.equal(event.available_count, 0)
    assert.equal(event.ended, scenario === 'event_past')
    assert.equal(event.joined, true)
    assert.equal(event.join_disabled, false)
    assert.equal(event.join_label, 'Joined')
    assert.equal(event.conversation_id, 'group_picnic')
    assert.ok(store.event_group('event_picnic', 'group_picnic'))
    assert.equal(store.my_events.some(row => row.event_id === event.event_id), true)
    assert.equal(store.leave_event(event.event_id).success, true)
    assert.equal(store.event_group(event.event_id, 'group_picnic'), null)
    const left = store.event_detail(event.event_id)
    assert.equal(left.available_count, 1)
    assert.equal(left.joined, false)
    assert.equal(left.join_disabled, scenario === 'event_past')
    assert.equal(left.join_label, scenario === 'event_past' ? 'Event ended' : 'Join event')
  }
})

test('a hidden participant keeps their occupied seat and cannot make a full event look joinable', () => {
  const { store } = make('default', data => { data.events[0].capacity = 3 })
  assert.equal(store.block_user('user_chloe').success, true)
  const event = store.event_detail('event_picnic')
  assert.equal(event.participant_count, 2)
  assert.equal(event.available_count, 0)
  assert.equal(event.join_label, 'Event full')
  assert.equal(event.join_disabled, true)
  assert.equal(store.event_people(event.event_id).some(user => user.user_id === 'user_chloe'), false)
  assert.match(store.event_join_blocker(event.event_id), /full/)
})

test('time crossing the event deadline updates presentation and still rejects a stale join intent without a write', () => {
  const { store, writes, advance } = make()
  const event = store.event_by_id('event_picnic'), before = clone_data(store.data)
  assert.equal(event.join_label, 'Join event')
  assert.equal(event.join_disabled, false)
  assert.equal(store.event_join_blocker(event.event_id), '')
  advance(event.ends_at)
  assert.equal(store.event_by_id(event.event_id).join_label, 'Event ended')
  assert.equal(store.event_detail(event.event_id).join_disabled, true)
  assert.match(store.event_join_blocker(event.event_id), /ended/)
  assert.equal(store.join_event(event.event_id).success, false)
  assert.deepEqual(store.data, before)
  assert.equal(writes(), 0)
})
