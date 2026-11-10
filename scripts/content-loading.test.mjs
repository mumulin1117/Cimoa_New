import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { create_content_loading_registry } from '../src/utils/mainTabSkeleton.js'
import { create_content_refresh } from '../src/utils/contentRefresh.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { MOTION } from '../src/config/navigation.js'

test('cold/auth rounds grant three independent one-shot tabs, not warm navigation or refresh', () => {
  const cache = create_content_loading_registry()
  assert.equal(cache.consume('/pages/home/index'), false)
  cache.prepare('account:1'); cache.synchronize('account:1')
  for (const tab of ['home', 'discover', 'events']) {
    assert.equal(cache.consume(`/pages/${tab}/index`), true)
    assert.equal(cache.consume(`/pages/${tab}/index`), false)
  }
  cache.synchronize('account:1'); assert.equal(cache.consume('/pages/home/index'), false)
  cache.prepare('account:1'); assert.equal(cache.consume('/pages/home/index'), true)
  cache.synchronize(null); assert.equal(cache.consume('/pages/discover/index'), false)
  cache.synchronize('account:2'); assert.equal(cache.consume('/pages/events/index'), true)
  assert.ok(MOTION.skeleton >= 500 && MOTION.skeleton <= 700)
})
test('entity cache isolates kind, ID and auth generation; expired completions cannot mark a new round', () => {
  const cache = create_content_loading_registry(); cache.prepare('a')
  const ticket = cache.ticket()
  assert.equal(cache.complete('profile', '1', ticket), true)
  assert.equal(cache.cached('profile', '1'), true)
  assert.equal(cache.cached('profile', '2'), false)
  assert.equal(cache.cached('event', '1'), false)
  cache.prepare('b')
  assert.equal(cache.cached('profile', '1'), false)
  assert.equal(cache.complete('profile', '2', ticket), false)
  assert.equal(cache.cached('profile', '2'), false)
  assert.equal(cache.complete('profile', '', cache.ticket()), false)
})
test('Home projection refresh preserves every canonical entity, storage bytes and the Discover cursor', () => {
  const now = Date.now(), data = create_scenario('default', now), store = use_app_store(createPinia())
  let writes = 0, clock = now
  configure_store_runtime(store, { clock: () => clock, persistence: { read: () => clone_data(data), write: () => { writes++ } } })
  assert.equal(store.hydrate().success, true)
  store.remember_discover_card(store.discover_people[3].user_id)
  const before = JSON.stringify(store.data), cursor = JSON.stringify(store.discover_cursor)
  clock += 500
  const result = store.refresh_home_feed(store.auth_context)
  assert.equal(result.success, true); assert.deepEqual(result.data, store.home_feed)
  assert.equal(JSON.stringify(store.data), before); assert.equal(JSON.stringify(store.discover_cursor), cursor); assert.equal(writes, 0)
  assert.equal(store.refresh_home_feed('stale-account').success, false)
  configure_store_runtime(store, { clock: () => { throw Error('read failed') } })
  assert.equal(store.refresh_home_feed(store.auth_context).reason, 'refresh_failed')
  assert.equal(JSON.stringify(store.data), before); assert.equal(writes, 0)
})
test('refresh delay coalesces duplicates and cancellation settles promises without reading', async () => {
  let callback, cancelled = false, reads = 0
  const refresh = create_content_refresh({ read: () => { reads++; return { success: true } }, delay: 600, schedule: fn => { callback = fn; return 1 }, clear: () => { cancelled = true } })
  const first = refresh.start(); assert.strictEqual(refresh.start(), first); assert.equal(reads, 0)
  refresh.cancel(); assert.equal((await first).reason, 'cancelled'); assert.equal(cancelled, true)
  await callback(); assert.equal(reads, 0)
  const second = refresh.start(); await callback(); assert.equal((await second).success, true)
})
