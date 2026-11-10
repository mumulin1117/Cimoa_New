import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { HOME_REQUEST_USER_ID } from '../src/stores/seed.js'
import { discover_destination, require_discover_destination_ready, DISCOVER_DEFERRED_ROUTES } from '../src/utils/discoverNavigation.js'

const make = (name = 'default', transform) => {
  setActivePinia(createPinia())
  const store = use_app_store(), now = Date.now(), data = create_scenario(name, now)
  transform?.(data)
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => data, write() { throw new Error('Read/navigation must not write') } } })
  store.hydrate(); assert.equal(store.hydration_status, 'ready'); return store
}
test('Discover derives canonical visible person and their ordered photo without page fixtures', () => {
  const store = make(), before = JSON.stringify(store.data), person = store.discover_person
  assert.deepEqual([person.user_id, person.user_name, person.age, person.university, person.major, person.mbti], ['user_zane', 'Zane', 22, 'HKUST', 'Engineering', 'ESTP'])
  assert.equal(person.photo.media_url, '/static/assets/discover/zane/photo-1.jpg')
  assert.equal(person.photo.user_id, person.user_id)
  person.photo.media_url = 'not-a-mutation'; assert.equal(JSON.stringify(store.data), before)
  const reordered = make('default', data => { data.profile_photos.find(p => p.photo_id === 'user_zane_photo_1').position = -1 })
  assert.equal(reordered.discover_person.photo.photo_id, 'user_zane_photo_1')
})
test('Discover excludes hidden, blocked, deleted and other-account entities; no photo uses empty state', () => {
  assert.equal(make('blocked').discover_person.user_id, 'user_zane')
  assert.equal(make('discover_empty').discover_person, null)
  assert.equal(make('default', data => { data.users.find(row => row.user_id === 'user_zane').photo_ids = [] }).discover_person.photo, null)
  assert.equal(make('default', data => { data.settings.push({ owner_user_id: 'user_zane', privacy: { show_field: false } }) }).discover_person.major, '')
  for (const name of ['session_expired', 'account_deleted']) assert.equal(make(name).discover_person, null)
  for (const transform of [d => { d.users.find(row => row.user_id === 'user_zane').deleted = true }, d => { d.settings.push({ owner_user_id: 'user_zane', privacy: { discover_visible: false } }) }, d => { d.blocked_users.push({ block_id: 'reverse_block', owner_user_id: 'user_zane', user_id: d.users[0].user_id }) }]) assert.equal(make('default', transform).discover_person.user_id, 'user_linden')
  assert.throws(() => make('default', d => { d.users[1].photo_ids = d.users[2].photo_ids }), /ready/)
})
test('Discover builds source destinations with same user ID, no spending and explicit dependency guards', () => {
  const store = make('discover_unconnected'), before = JSON.stringify(store.data)
  assert.equal(store.coin_balance, 0)
  assert.equal(discover_destination(store, 'profile'), '/pages/profile/index')
  assert.equal(discover_destination(store, 'preferences'), '/pages/auto-match/preferences')
  assert.equal(discover_destination(store, 'detail', 'user_zane'), '/pages/discover/profile?user_id=user_zane')
  assert.equal(discover_destination(store, 'icebreaker', 'user_chloe'), '/pages/discover/icebreaker/select?user_id=user_chloe')
  for (const route of DISCOVER_DEFERRED_ROUTES) assert.throws(() => require_discover_destination_ready(route + '?user_id=user_chloe'), /not been restored/)
  assert.equal(JSON.stringify(store.data), before)
})
test('connected profile resolves its existing direct conversation without creating or changing data', () => {
  const store = make(), before = JSON.stringify(store.data)
  assert.equal(discover_destination(store, 'chat', 'user_chloe'), '/pages/messages/chat?conversation_id=conversation_chloe')
  assert.throws(() => discover_destination(store, 'chat', 'user_liam'), /conversation is no longer available/)
  assert.equal(JSON.stringify(store.data), before)
})
test('entry and submit share verification, relationship and pending-request eligibility', async () => {
  for (const [scenario, pattern] of [['default', /already connected/], ['discover_unverified', /verification/], ['session_expired', /session/]]) {
    const store = make(scenario), before = JSON.stringify(store.data)
    assert.throws(() => discover_destination(store, 'icebreaker', 'user_chloe'), pattern)
    const result = await store.send_introduction({ user_id: 'user_chloe', question_id: store.data.users[1].icebreaker_ids[0], text: 'Hello', operation_id: 'reject' })
    assert.equal(result.success, false); assert.match(result.message, pattern); assert.equal(JSON.stringify(store.data), before)
  }
  const pending = make('default', data => { data.users[1].discoverable = false; data.users[2].discoverable = false })
  assert.throws(() => discover_destination(pending, 'icebreaker', HOME_REQUEST_USER_ID), /already pending/)
  assert.throws(() => discover_destination(make('blocked'), 'detail', 'user_chloe'), /no longer/)
})
test('a visible profile opened from another real entry can start its own eligible icebreaker', () => {
  const store = make('default', data => { data.requests.find(row => row.request_id === 'request_lina').status = 'declined' })
  assert.equal(store.discover_person.user_id, 'user_zane')
  assert.equal(discover_destination(store, 'icebreaker', HOME_REQUEST_USER_ID), `/pages/discover/icebreaker/select?user_id=${HOME_REQUEST_USER_ID}`)
})
test('Store changes and rehydration preserve the same canonical profile and photo', () => {
  const store = make(), persisted = structuredClone(JSON.parse(JSON.stringify(store.data)))
  persisted.users.find(row => row.user_id === 'user_zane').user_name = 'Updated Zane'
  store.data = persisted
  assert.equal(store.discover_person.user_name, 'Updated Zane')
  configure_store_runtime(store, { persistence: { read: () => persisted } })
  store.hydration_status = 'idle'; store.hydrate()
  assert.equal(store.discover_person.user_name, 'Updated Zane')
  assert.equal(store.discover_person.photo.user_id, 'user_zane')
})
