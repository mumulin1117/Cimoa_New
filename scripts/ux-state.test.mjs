import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'

const epoch = Date.UTC(2026, 9, 23, 1)
const expected = {
  searching: ['Your search is still in progress', 'Return to your search, or adjust your preferences to explore more people.', 'Return to search'],
  paused: ['Your search is paused', 'Your search is paused. Return when you’re ready to resume, or adjust your preferences.', 'View paused search'],
  no_match: ['No compatible matches are available right now', 'You can stay in the pool, adjust your preferences, or try again later.', 'Stay in Pool'],
}

function fixture({ paid = false, device = false } = {}) {
  let now = epoch, disk = create_seed(now), writes = 0
  if (paid) disk.match_quota.push({ owner_user_id: 'user_cimoa', date_key: '2026-10-23', used_count: 3 })
  const store = use_app_store(createPinia())
  configure_store_runtime(store, {
    persistence: { read: () => clone_data(disk), write: (_, data) => { writes++; disk = clone_data(data) } },
    clock: () => now,
    services: device ? {} : { matching_available: true, verify_match_event: async () => true },
  })
  assert.equal(store.hydrate().success, true)
  return { store, writes: () => writes, saved: () => clone_data(disk), advance: duration => { now += duration; store.tick() } }
}

for (const status of Object.keys(expected)) {
  test(`search options reflect ${status} without another admission or persistence write`, async t => {
    for (const paid of [false, true]) await t.test(paid ? 'paid admission' : 'free admission', async () => {
      const f = fixture({ paid }), { store } = f
      const start = store.start_match(`options-${status}-${paid}`)
      assert.equal(start.success, true)
      const id = start.data
      if (status === 'paused') assert.equal(store.transition_match(id, 'paused').success, true)
      if (status === 'no_match') assert.equal((await store.apply_match_event({ event_id: 'no-result', match_id: id, type: 'no_match' })).success, true)
      const before = clone_data(store.data), saved = f.saved(), writes = f.writes()
      assert.equal(store.coin_balance, paid ? 250 : 260)
      assert.equal(store.free_matches_remaining, paid ? 0 : 2)
      for (let read = 0; read < 3; read++) {
        const view = store.match_presentation(id)
        assert.equal(view.error, '')
        assert.equal(view.match.match_id, id)
        assert.equal(view.match.status, status)
        assert.deepEqual([view.search_options_title, view.search_options_copy, view.search_options_return], expected[status])
        if (status !== 'no_match') assert.doesNotMatch(`${view.search_options_title} ${view.search_options_copy}`, /no compatible|no matches|nothing available/i)
        assert.equal(view.route, `/pages/auto-match/${status === 'no_match' ? 'no-match' : status}?match_id=${encodeURIComponent(id)}`)
      }
      assert.equal(f.writes(), writes)
      assert.deepEqual(clone_data(store.data), before)
      assert.deepEqual(f.saved(), saved)
      assert.deepEqual(store.data.match_quota, before.match_quota)
      assert.deepEqual(store.data.coin_transactions, before.coin_transactions)
      assert.deepEqual(store.data.operation_receipts, before.operation_receipts)
    })
  })
}

test('device deadline derives real no-result copy without writing a terminal status or replaying the quota', () => {
  const f = fixture({ device: true }), { store } = f
  assert.equal(store.update_match_preferences({ age_min: 99, age_max: 100 }).success, true)
  const start = store.start_match('device-no-result')
  assert.equal(start.success, true)
  const id = start.data, before = clone_data(store.data), writes = f.writes()
  assert.equal(store.match_by_id(id).status, 'searching')
  assert.equal(store.match_presentation(id).search_options_title, expected.searching[0])
  f.advance(9000)
  const view = store.match_presentation(id)
  assert.equal(view.match.status, 'no_match')
  assert.deepEqual([view.search_options_title, view.search_options_copy, view.search_options_return], expected.no_match)
  assert.equal(store.data.match_sessions.find(match => match.match_id === id).status, 'searching')
  assert.equal(f.writes(), writes)
  assert.deepEqual(clone_data(store.data), before)
  assert.deepEqual(f.saved(), before)
  assert.equal(store.free_matches_remaining, 2)
  assert.equal(store.coin_balance, 260)
})
