import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { home_destination, require_home_destination_ready } from '../src/utils/homeNavigation.js'
const make = (scenario = 'default') => {
  setActivePinia(createPinia()); const store = use_app_store(); const now = Date.now(), data = create_scenario(scenario, now)
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => data, write() { throw new Error('Navigation must not write') } } }); store.hydrate(); return store
}
test('Home destinations use canonical entity IDs, have no write or balance effects', () => {
  const store = make(), before = JSON.stringify(store.data)
  assert.equal(home_destination(store, 'profile'), '/pages/profile/index')
  assert.equal(home_destination(store, 'match'), '/pages/auto-match/index')
  assert.equal(home_destination(store, 'discover'), '/pages/discover/index')
  assert.equal(home_destination(store, 'card', 'user_chloe'), '/pages/messages/chat?conversation_id=conversation_chloe')
  assert.equal(home_destination(store, 'card', 'user_liam'), '/pages/auto-match/found?match_id=match_liam')
  assert.equal(home_destination(store, 'card', 'user_lina'), '/pages/connections/received?request_id=request_lina')
  assert.equal(JSON.stringify(store.data), before)
})
test('deferred dependencies cannot navigate into wrong legacy screens or appear successful', () => {
  const store = make()
  for (const [kind, id] of [['profile'], ['match'], ['card', 'user_chloe'], ['card', 'user_liam'], ['card', 'user_lina']]) assert.throws(() => require_home_destination_ready(home_destination(store, kind, id)), /not been restored/)
  assert.equal(require_home_destination_ready(home_destination(store, 'discover')), '/pages/discover/index')
})
test('Home rejects blocked, expired, declined, one-way and logged-out navigation', () => {
  for (const [scenario, id] of [['blocked','user_chloe'], ['match_expired','user_liam'], ['request_declined','user_lina'], ['one_way','user_chloe']]) assert.throws(() => home_destination(make(scenario), 'card', id), /no longer/)
  assert.throws(() => home_destination(make('session_expired'), 'profile'), /session/)
})
test('Home status cards derive current candidate, exact route and deadlines without mutations', () => {
  for (const status of ['searching', 'paused', 'found', 'waiting']) {
    const store = make(`match_${status}`), before = JSON.stringify(store.data)
    assert.equal(store.home_match_card.status, status)
    assert.equal(home_destination(store, 'status'), `/pages/auto-match/${status}?match_id=match_liam`)
    if (status === 'waiting') assert.equal(store.home_match_card.title, 'Waiting for Liam Park')
    assert.equal(JSON.stringify(store.data), before)
  }
  for (const status of ['expired','left','no_match','connected']) assert.equal(make(`match_${status}`).home_match_card, null)
})
test('queue updates require verified events and valid values, persist once and feed Home', async () => {
  const store = make('match_searching'), event = { event_id: 'queue_1', match_id: 'match_liam', type: 'queue', queue_position: 4, estimated_wait_seconds: 120 }
  assert.equal((await store.apply_match_event(event)).success, false)
  let writes = 0
  configure_store_runtime(store, { services: { verify_match_event: async () => true }, persistence: { write: () => { writes++ } } })
  assert.equal((await store.apply_match_event({ ...event, queue_position: -1 })).success, false)
  assert.equal(writes, 0)
  assert.equal((await store.apply_match_event(event)).success, true)
  assert.equal(store.home_match_card.subtitle, 'Queue position 4 · about 2 min')
  await store.apply_match_event(event); assert.equal(writes, 1)
})
