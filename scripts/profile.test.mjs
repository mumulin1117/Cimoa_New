import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { profile_destination, require_profile_destination_ready, PROFILE_DEFERRED_ROUTES } from '../src/utils/profileNavigation.js'
import { home_destination, require_home_destination_ready } from '../src/utils/homeNavigation.js'
import { discover_destination, require_discover_destination_ready } from '../src/utils/discoverNavigation.js'
import { events_destination, require_events_destination_ready } from '../src/utils/eventsNavigation.js'

const make = (scenario = 'default', transform) => {
  const now = Date.now(); let disk = create_scenario(scenario, now), writes = 0; transform?.(disk)
  const store = use_app_store(createPinia())
  const persistence = { read: () => clone_data(disk), write: (_, value) => { disk = clone_data(value); writes++ } }
  configure_store_runtime(store, { clock: () => now, persistence }); store.hydrate()
  return { store, persistence, writes: () => writes }
}
test('Profile displays canonical current person, ordered interest entities and ledger balance without writes', () => {
  const f = make(), before = JSON.stringify(f.store.data)
  assert.deepEqual([f.store.current_user.user_name, f.store.current_user.age, f.store.current_user.major, f.store.current_user.verified], ['Ethan', 22, 'Interaction Design', true])
  assert.deepEqual(f.store.current_interests.map(i => [i.item_id, i.emoji, i.label]), [['photography', '📷', 'Photography'], ['coffee', '☕', 'Coffee'], ['music', '🎵', 'Live Music']])
  f.store.current_interests[0].label = 'Not a store mutation'
  assert.equal(f.store.coin_balance, 260); assert.equal(JSON.stringify(f.store.data), before); assert.equal(f.writes(), 0)
  assert.deepEqual(make('default', d => { d.users[0].interest_ids = ['music', 'coffee'] }).store.current_interests.map(i => i.item_id), ['music', 'coffee'])
})
test('empty, expired, deleted and unreadable profiles never leak seed interests or a false verified badge', () => {
  assert.deepEqual(make('default', d => { d.users[0].interest_ids = [] }).store.current_interests, [])
  assert.equal(make('discover_unverified').store.current_user.verified, false)
  assert.equal(make('zero_coins').store.coin_balance, 0)
  for (const scenario of ['session_expired', 'account_deleted']) {
    const { store } = make(scenario); assert.deepEqual(store.current_interests, []); assert.equal(store.current_user.user_id, undefined)
    assert.throws(() => profile_destination(store, 'edit'), /session/)
  }
  const { store } = make(); store.hydration_status = 'error'; assert.deepEqual(store.current_interests, [])
  assert.throws(() => profile_destination(store, 'settings'), /unavailable/)
})
test('profile edits flow through the Store and survive rehydration without page copies; failures are atomic', () => {
  const f = make()
  assert.equal(f.store.update_profile({ user_name: 'Saved Ethan', bio: 'Saved introduction', interest_ids: ['music'] }).success, true)
  assert.equal(f.writes(), 1); f.store.hydration_status = 'idle'; f.store.hydrate()
  assert.equal(f.store.current_user.user_name, 'Saved Ethan'); assert.equal(f.store.current_user.bio, 'Saved introduction')
  assert.deepEqual(f.store.current_interests.map(i => i.item_id), ['music'])
  const before = JSON.stringify(f.store.data)
  configure_store_runtime(f.store, { persistence: { ...f.persistence, write() { throw Error('Storage full') } } })
  assert.equal(f.store.update_profile({ user_name: 'Should not save' }).success, false)
  assert.equal(JSON.stringify(f.store.data), before)
})
test('switching accounts derives only that account interests and balance', () => {
  const f = make('default', d => {
    d.accounts.push({ ...d.accounts[0], account_id: 'second', user_id: 'user_liam', email: 'fixture@example.test' })
    d.session.account_id = 'second'; d.session.current_user_id = 'user_liam'
  })
  assert.equal(f.store.current_user.user_name, 'Liam Park')
  assert.deepEqual(f.store.current_interests.map(i => i.item_id), ['photography', 'hiking', 'films'])
  assert.equal(f.store.coin_balance, 0); assert.equal(f.writes(), 0)
})
test('all three restored Tab entries reach Profile; child readiness stays explicit and read-only', () => {
  const f = make(), before = JSON.stringify(f.store.data)
  for (const [destination, require_ready] of [[home_destination, require_home_destination_ready], [discover_destination, require_discover_destination_ready], [events_destination, require_events_destination_ready]]) assert.equal(require_ready(destination(f.store, 'profile')), '/pages/profile/index')
  for (const [kind, target] of [['settings','/pages/settings/index'], ['edit','/pages/profile/edit'], ['coins','/pages/coins/index'], ['preview','/pages/profile/preview']]) {
    assert.equal(profile_destination(f.store, kind), target)
    if (PROFILE_DEFERRED_ROUTES.includes(target)) assert.throws(() => require_profile_destination_ready(target), /not been restored/)
    else assert.equal(require_profile_destination_ready(target), target)
  }
  assert.throws(() => profile_destination(f.store, 'invalid'), /unavailable/)
  assert.equal(JSON.stringify(f.store.data), before); assert.equal(f.writes(), 0)
})
