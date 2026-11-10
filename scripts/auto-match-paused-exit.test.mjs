import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'

const epoch = Date.UTC(2026, 9, 26, 3)

function fixture(saved = create_seed(epoch), time = epoch) {
  setActivePinia(createPinia())
  const store = use_app_store()
  let disk = clone_data(saved), now = time, writes = 0, fail_write = false
  configure_store_runtime(store, {
    clock: () => now,
    persistence: {
      read: () => clone_data(disk),
      write: (_key, data) => {
        if (fail_write) throw new Error('Storage full')
        disk = clone_data(data)
        writes++
      },
    },
    // Exercise the shipped device engine, not the service-event adapter.
    services: {},
  })
  assert.equal(store.hydrate().success, true)
  return {
    store,
    saved: () => clone_data(disk),
    writes: () => writes,
    fail_write: value => { fail_write = value },
    advance: ms => { now += ms; store.tick() },
  }
}

function paused_with_preferences(f, has_candidate = true) {
  const started = f.store.start_match('paused-exit-admission')
  assert.equal(started.success, true, started.message)
  const id = started.data
  assert.equal(f.store.match_by_id(id).engine, 'device')
  f.advance(1500)
  assert.equal(f.store.transition_match(id, 'paused').success, true)
  const updated = f.store.update_match_preferences({
    interest_ids: [],
    // An unsupported preference value yields a legitimate no-candidate search.
    university: has_candidate ? 'All' : 'No matching university',
  })
  assert.equal(updated.success, true, updated.message)
  const paused = f.store.match_by_id(id)
  assert.equal(paused.status, 'paused')
  assert.equal(Boolean(paused.candidate_id), has_candidate)
  assert.equal(paused.expires_at, null)
  assert.equal(paused.search_remaining_ms, 7500)
  return id
}

const accounting = store => clone_data({ quota: store.data.match_quota, ledger: store.data.coin_transactions })

for (const has_candidate of [true, false]) {
  for (const paid of [false, true]) {
    test(`paused ${has_candidate ? 'candidate' : 'empty'} search exits after preference changes and hydration (${paid ? 'paid' : 'free'} admission)`, () => {
      const seed = create_seed(epoch)
      if (paid) seed.match_quota.push({ owner_user_id: 'user_cimoa', date_key: new Date(epoch).toISOString().slice(0, 10), used_count: 3 })
      const first = fixture(seed), id = paused_with_preferences(first, has_candidate)
      const charged = accounting(first.store)
      assert.equal(first.store.coin_balance, paid ? 250 : 260)
      assert.equal(first.store.free_matches_remaining, paid ? 0 : 2)

      const f = fixture(first.saved(), epoch + 200000)
      assert.equal(f.writes(), 0, 'hydration is read-only')
      assert.equal(f.store.match_by_id(id).status, 'paused', 'elapsed wall time cannot resume a pause')
      const result = f.store.transition_match(id, 'left')
      assert.equal(result.success, true, result.message)
      assert.equal(f.writes(), 1)
      const left = f.store.match_by_id(id)
      assert.equal(left.status, 'left')
      assert.equal(left.expires_at, null, 'ending a paused attempt does not invent an expiry')
      assert.equal(left.resolved_at, epoch + 200000)
      assert.equal(left.pool_closed_at, left.resolved_at)
      assert.equal(f.store.active_match, null)
      assert.equal(f.store.home_feed.match_card, null)
      assert.equal(f.store.matching_context(id).route, '/pages/auto-match/index')
      assert.deepEqual(accounting(f.store), charged, 'leaving must not charge or refund admission')

      const completed = clone_data(f.store.data)
      assert.equal(f.store.transition_match(id, 'left').success, false)
      assert.equal(f.store.transition_match(id, 'searching').success, false)
      assert.equal(f.store.retry_match(id, 'after-leave').success, false)
      assert.equal(f.writes(), 1, 'duplicate exits and stale resumes never persist')
      assert.deepEqual(f.store.data, completed)
      const replay = f.store.start_match('paused-exit-admission')
      assert.equal(replay.repeated, true)
      assert.equal(replay.data, id)
      assert.equal(f.writes(), 1)
      assert.equal(f.store.active_match, null, 'admission receipt replay does not revive the pool')

      const restored = fixture(f.saved(), epoch + 300000)
      assert.equal(restored.store.match_by_id(id).status, 'left')
      assert.equal(restored.store.active_match, null)
      assert.equal(restored.store.matching_context(id).history.find(row => row.match_id === id)?.status, 'left')
      assert.deepEqual(accounting(restored.store), charged)
      assert.equal(restored.writes(), 0)
    })
  }
}

test('failed paused exit preserves deadlines, preferences, quota, ledger and disk until a successful retry', () => {
  const f = fixture(), id = paused_with_preferences(f)
  const before = clone_data(f.store.data), disk_before = f.saved(), writes = f.writes()
  f.fail_write(true)
  const result = f.store.transition_match(id, 'left')
  assert.equal(result.success, false)
  assert.deepEqual(f.store.data, before)
  assert.deepEqual(f.saved(), disk_before)
  assert.equal(f.writes(), writes)
  assert.equal(f.store.active_match.match_id, id)
  assert.equal(f.store.match_by_id(id).status, 'paused')
  f.fail_write(false)
  assert.equal(f.store.transition_match(id, 'left').success, true)
  assert.equal(f.writes(), writes + 1)
  assert.equal(f.store.active_match, null)
  assert.deepEqual(accounting(f.store), { quota: before.match_quota, ledger: before.coin_transactions })
})

test('paused preference changes still resume the same remaining countdown with no extra charge', () => {
  const f = fixture(), id = paused_with_preferences(f), charged = accounting(f.store)
  f.advance(60000)
  assert.equal(f.store.transition_match(id, 'searching').success, true)
  const resumed = f.store.match_by_id(id)
  assert.equal(resumed.search_ready_at, f.store.clock_ms + 7500)
  assert.equal(resumed.expires_at, resumed.search_ready_at + 45000)
  assert.deepEqual(accounting(f.store), charged)
  f.advance(7500)
  assert.equal(f.store.match_by_id(id).status, 'found')
})

test('deadline validation accepts terminal null expiry but rejects malformed active countdowns', () => {
  const f = fixture(), id = paused_with_preferences(f), valid = clone_data(f.store.data)
  for (const status of ['paused', 'left', 'passed', 'expired', 'no_match']) {
    const data = clone_data(valid), row = data.match_sessions.find(row => row.match_id === id)
    row.status = status
    assert.doesNotThrow(() => validate_data(data), `${status} need not run a candidate countdown`)
  }
  for (const status of ['searching', 'found', 'waiting']) {
    for (const expiry of [null, NaN, Infinity, '123']) {
      const data = clone_data(valid), row = data.match_sessions.find(row => row.match_id === id)
      row.status = status
      row.expires_at = expiry
      assert.throws(() => validate_data(data), /Invalid device matching deadline/, `${status} rejects ${String(expiry)}`)
    }
  }
  for (const status of ['paused', 'left']) {
    for (const field of ['search_ready_at', 'expires_at']) {
      const data = clone_data(valid), row = data.match_sessions.find(row => row.match_id === id)
      row.status = status
      row[field] = NaN
      assert.throws(() => validate_data(data), /Invalid device matching deadline/, `${status} rejects a malformed ${field}`)
    }
  }
})

test('hydration fails closed for a candidate search with a missing active deadline', () => {
  const f = fixture(), id = paused_with_preferences(f), damaged = f.saved()
  damaged.match_sessions.find(row => row.match_id === id).status = 'searching'
  setActivePinia(createPinia())
  const store = use_app_store()
  let writes = 0
  configure_store_runtime(store, { clock: () => epoch, persistence: { read: () => clone_data(damaged), write: () => { writes++ } }, services: {} })
  assert.equal(store.hydrate().success, false)
  assert.equal(store.hydration_status, 'error')
  assert.equal(store.start_match('cannot-overwrite').success, false)
  assert.equal(writes, 0)
})
