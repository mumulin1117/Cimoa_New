import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { install_connection_visuals, take_connection_visuals, clear_connection_visuals } from '../src/utils/connectionVisuals.js'
import { match_ignition, begin_match_ignition, land_match_ignition, clear_match_ignition } from '../src/utils/matchIgnition.js'
import { MOTION } from '../src/config/navigation.js'

const now = Date.UTC(2026, 9, 26, 4)
const fixture = () => {
  const store = use_app_store(createPinia())
  let disk = create_seed(now), fail = false
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(disk), write: (_key, data) => { if (fail) throw Error('Storage full'); disk = clone_data(data) } } })
  assert.equal(store.hydrate().success, true)
  clear_connection_visuals()
  return { store, fail: () => { fail = true }, stop: install_connection_visuals(store) }
}
test('only a successful persisted new request acceptance creates one connection glow receipt', () => {
  const f = fixture(), context = f.store.auth_context
  try {
    assert.deepEqual(take_connection_visuals(context, f.store.home_feed.cards), [], 'seed relationships are not new connections')
    const request = f.store.data.requests.find(row => row.recipient_id === f.store.current_user.user_id && row.status === 'pending')
    const financial = clone_data(f.store.data.coin_transactions)
    assert.equal(f.store.accept_request(request.request_id, 'visual-accept').success, true)
    assert.deepEqual(take_connection_visuals(context, f.store.home_feed.cards), [request.sender_id])
    assert.deepEqual(take_connection_visuals(context, f.store.home_feed.cards), [], 'return and refresh cannot replay a consumed receipt')
    f.store.accept_request(request.request_id, 'visual-accept')
    assert.deepEqual(take_connection_visuals(context, f.store.home_feed.cards), [])
    assert.deepEqual(f.store.data.coin_transactions, financial)
    assert.equal(f.store.hydrate().success, true)
    assert.deepEqual(take_connection_visuals(context, f.store.home_feed.cards), [])
  } finally { f.stop(); clear_connection_visuals() }
})
test('failed writes and declined requests cannot emit a connection success effect', () => {
  for (const fail of [true, false]) {
    const f = fixture()
    try {
      const request = f.store.data.requests.find(row => row.recipient_id === f.store.current_user.user_id && row.status === 'pending')
      if (fail) f.fail()
      const result = f.store.resolve_request(request.request_id, fail ? 'accepted' : 'declined', 'not-a-connection')
      assert.equal(result.success, !fail)
      assert.deepEqual(take_connection_visuals(f.store.auth_context, f.store.home_feed.cards), [])
    } finally { f.stop(); clear_connection_visuals() }
  }
})
test('connection glow receipts cannot leak into another account context or survive explicit cancellation', () => {
  const f = fixture()
  try {
    const request = f.store.data.requests.find(row => row.recipient_id === f.store.current_user.user_id && row.status === 'pending')
    assert.equal(f.store.accept_request(request.request_id, 'owner-only').success, true)
    assert.deepEqual(take_connection_visuals('another-session', f.store.home_feed.cards), [])
    clear_connection_visuals()
    assert.deepEqual(take_connection_visuals(f.store.auth_context, f.store.home_feed.cards), [])
  } finally { f.stop(); clear_connection_visuals() }
})
test('matching requires a verified acceptance result before its new Connection can light up', async () => {
  const f = fixture()
  try {
    assert.equal(f.store.transition_match('match_liam', 'waiting').success, true)
    const event = { event_id: 'visual-matching-accepted', type: 'accepted', match_id: 'match_liam', user_id: 'user_liam' }
    assert.equal((await f.store.apply_match_event(event)).success, false)
    assert.deepEqual(take_connection_visuals(f.store.auth_context, f.store.home_feed.cards), [])
    configure_store_runtime(f.store, { services: { verify_match_event: async () => true } })
    assert.equal((await f.store.apply_match_event(event)).success, true)
    assert.deepEqual(take_connection_visuals(f.store.auth_context, f.store.home_feed.cards), ['user_liam'])
    assert.deepEqual(take_connection_visuals(f.store.auth_context, f.store.home_feed.cards), [])
  } finally { f.stop(); clear_connection_visuals() }
})
test('a verified matching result arriving after visual cancellation still commits but cannot resurrect the glow', async () => {
  const f = fixture()
  try {
    assert.equal(f.store.transition_match('match_liam', 'waiting').success, true)
    let verify
    configure_store_runtime(f.store, { services: { verify_match_event: () => new Promise(resolve => { verify = resolve }) } })
    const result = f.store.apply_match_event({ event_id: 'visual-late-matching-accepted', type: 'accepted', match_id: 'match_liam', user_id: 'user_liam' })
    clear_connection_visuals()
    verify(true)
    assert.equal((await result).success, true, 'visual cancellation must not falsify or roll back real consent')
    assert.ok(f.store.connection_by_user('user_liam'))
    assert.deepEqual(take_connection_visuals(f.store.auth_context, f.store.home_feed.cards), [], 'cancelled visual generation cannot be revived by the late callback')
  } finally { f.stop(); clear_connection_visuals() }
})
test('Auto Match click acknowledgement hands off within 240ms and cannot change business state', () => {
  const callbacks = [], element = { getBoundingClientRect: () => ({ left: 280, top: 60, width: 44, height: 44 }) }
  assert.equal(begin_match_ignition(element, 'account', { now, schedule: callback => callbacks.push(callback) }), true)
  assert.equal(match_ignition.value.stage, 'source')
  assert.equal(land_match_ignition(element, 'wrong-account', now + 10), false)
  assert.equal(land_match_ignition(element, 'account', now + 40), true)
  assert.equal(match_ignition.value.stage, 'arrival')
  assert.equal(match_ignition.value.duration, MOTION.match_ignite - 40)
  assert.equal(land_match_ignition(element, 'account', now + MOTION.match_ignite), false)
  clear_match_ignition()
  callbacks[0]()
  assert.equal(match_ignition.value, null)
  assert.equal(begin_match_ignition(null, 'account'), false)
  assert.equal(begin_match_ignition(element, ''), false)
})
test('card press reuses touch cancellation and source layout, with theme-only bounded feedback', () => {
  const home = fs.readFileSync('src/pages/home/index.vue', 'utf8'), policy = fs.readFileSync('src/utils/touchPolicy.js', 'utf8')
  assert.match(home, /data-press-glow/)
  assert.match(home, /scale\(\.985\)/)
  assert.match(home, /prefers-reduced-motion/)
  assert.match(home, /var\(--cimoa-gradient-press-glow\)/)
  assert.match(policy, /hasAttribute\?\.\('data-press-glow'\)/)
  assert.doesNotMatch(home, /:hover|setPointerCapture|localStorage|\.setItem\(/)
  assert.doesNotMatch(fs.readFileSync('src/utils/matchIgnition.js', 'utf8'), /start_match|add_transaction|\.write\(/)
})
