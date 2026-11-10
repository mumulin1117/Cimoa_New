import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data, TEST_ACCOUNT_ID, TEST_USER_ID } from '../src/stores/seed.js'
import { ensure_account_defaults } from '../src/stores/accountDefaults.js'
import { validate_data } from '../src/stores/selectors.js'
import { AUTO_MATCH_GUIDE_REVISION } from '../src/stores/autoMatchGuide.js'
import { AUTO_MATCH_GUIDE_TARGETS, auto_match_guide_layout } from '../src/utils/autoMatchGuideLayout.js'
import { create_write_operation } from '../src/utils/writeOperation.js'

const epoch = Date.UTC(2026, 10, 2, 4)
const receipt_for = (data, owner = TEST_USER_ID) => data.settings.find(row => row.owner_user_id === owner)?.auto_match_guide
function first_use_seed() {
  const data = create_seed(epoch)
  // Most state-machine cases use an empty history. Installation eligibility is
  // also tested below against the untouched seed, including its prior matches.
  data.match_sessions = data.match_sessions.filter(row => row.owner_user_id !== TEST_USER_ID)
  data.users.find(row => row.user_id === TEST_USER_ID).onboarding_status = 'complete'
  return data
}
function fixture(saved = first_use_seed(), time = epoch) {
  const store = use_app_store(createPinia())
  let disk = clone_data(saved), now = time, writes = 0, fail_write = false
  configure_store_runtime(store, {
    clock: () => now,
    persistence: {
      read: () => clone_data(disk),
      write: (_key, data) => {
        if (fail_write) throw Error('Storage full')
        disk = clone_data(data); writes++
      },
    },
    services: {},
  })
  const hydration = store.hydrate()
  return {
    store, hydration,
    saved: () => clone_data(disk),
    writes: () => writes,
    fail_write: value => { fail_write = value },
    advance: ms => { now += ms; store.tick() },
  }
}
const succeed = result => assert.equal(result.success, true, result.message)
function begin(store) { const context = store.auth_context; succeed(store.begin_auto_match_guide(context)); return context }
function reach_end(store, context) { for (const step of [1, 2, 3]) succeed(store.move_auto_match_guide(step, context)) }
function without_guide_metadata(value) {
  const data = clone_data(value)
  delete data.revision; delete data.updated_at
  for (const settings of data.settings) delete settings.auto_match_guide
  return data
}

test('first eligible account begins once without writing storage or changing existing business data', () => {
  const f = fixture(), before = clone_data(f.store.data)
  succeed(f.hydration)
  assert.deepEqual(f.store.auto_match_guide, { eligible: true, receipt: null, step: 0, started: false })
  const context = begin(f.store)
  assert.equal(f.store.auto_match_guide.started, true)
  succeed(f.store.begin_auto_match_guide(context))
  assert.equal(f.store.auto_match_guide.step, 0)
  assert.equal(f.writes(), 0)
  assert.deepEqual(f.store.data, before)
  assert.deepEqual(f.saved(), first_use_seed(), 'hydration and opening a guide do not persist data')
})

test('all four steps and backward navigation remain transient without admitting, charging or editing preferences', () => {
  const f = fixture(), before = clone_data(f.store.data), context = begin(f.store)
  for (const step of [1, 2, 1, 0, 1, 2, 3, 2, 3]) {
    succeed(f.store.move_auto_match_guide(step, context))
    assert.equal(f.store.auto_match_guide.step, step)
    assert.deepEqual(f.store.data, before)
    assert.equal(f.writes(), 0)
  }
  assert.deepEqual(f.store.data.match_sessions, before.match_sessions)
  assert.deepEqual(f.store.data.match_quota, before.match_quota)
  assert.deepEqual(f.store.data.coin_transactions, before.coin_transactions)
  assert.deepEqual(f.store.data.match_preferences, before.match_preferences)
})

test('logged out, expired and incomplete accounts cannot begin the guide', () => {
  for (const kind of ['guest', 'expired', 'not_started', 'in_progress']) {
    const data = first_use_seed()
    if (kind === 'guest') data.session = { account_id: null, current_user_id: null, expires_at: null }
    else if (kind === 'expired') data.session.expires_at = epoch - 1
    else data.users.find(row => row.user_id === TEST_USER_ID).onboarding_status = kind
    const f = fixture(data), before = clone_data(f.store.data)
    succeed(f.hydration)
    assert.equal(f.store.auto_match_guide.eligible, false, kind)
    assert.equal(f.store.begin_auto_match_guide(f.store.auth_context).success, false, kind)
    assert.equal(f.store.move_auto_match_guide(1, f.store.auth_context).success, false, kind)
    assert.equal(f.store.finish_auto_match_guide('skipped', f.store.auth_context).success, false, kind)
    assert.equal(f.writes(), 0, kind)
    assert.deepEqual(f.store.data, before, kind)
  }
})

test('local accounts need completed verification even when their profile is complete', () => {
  const data = first_use_seed(), account = data.accounts.find(row => row.account_id === TEST_ACCOUNT_ID)
  account.auth_provider = 'local'
  data.users.find(row => row.user_id === TEST_USER_ID).verification_status = 'pending'
  const unverified = fixture(data)
  assert.equal(unverified.store.auto_match_guide.eligible, false)
  assert.equal(unverified.store.begin_auto_match_guide(unverified.store.auth_context).success, false)
  account.local_verification = { method: 'fixed_code', status: 'verified', verified_at: epoch - 1000 }
  const verified = fixture(data)
  succeed(verified.hydration)
  assert.equal(verified.store.auto_match_guide.eligible, true)
  succeed(verified.store.begin_auto_match_guide(verified.store.auth_context))
  assert.equal(verified.store.current_user.verification_status, 'pending', 'the guide never grants student qualification')
})

test('hydration and account errors cannot expose an actionable first-use guide', () => {
  const f = fixture()
  for (const status of ['idle', 'loading', 'error']) {
    f.store.hydration_status = status
    assert.equal(f.store.auto_match_guide.eligible, false)
    assert.equal(f.store.begin_auto_match_guide(f.store.auth_context).success, false)
  }
  assert.equal(f.writes(), 0)
})

test('existing matching history does not replace the current installation completion preference', () => {
  for (const status of ['found', 'paused', 'passed', 'expired', 'left', 'no_match']) {
    const data = first_use_seed(), previous = create_seed(epoch).match_sessions[0]
    data.match_sessions.push({ ...previous, status })
    const f = fixture(data), before = clone_data(f.store.data)
    succeed(f.hydration)
    assert.equal(f.store.auto_match_guide.eligible, true, status)
    const context = begin(f.store)
    assert.deepEqual(f.store.auto_match_guide_session.matching_ids, [previous.match_id], status)
    reach_end(f.store, context)
    assert.equal(f.store.auto_match_guide.started, true, status)
    assert.deepEqual(f.store.auto_match_guide_session.matching_ids, [previous.match_id], 'moving steps preserves the original matching snapshot')
    assert.deepEqual(f.store.data, before, 'the guide never removes or rewrites historical business entities')
    assert.equal(f.writes(), 0)
  }
})

test('an untouched installation can log into the prepared account and guide without changing seed history or profile', async () => {
  const data = create_seed(epoch), historical = clone_data(data.match_sessions)
  data.session = { account_id: null, current_user_id: null, expires_at: null }
  const f = fixture(data)
  succeed(f.hydration)
  assert.equal(f.store.session.is_authenticated, false)
  assert.equal(f.store.current_user.user_id, undefined)
  assert.equal(f.store.current_user.user_name, '')
  assert.equal(f.store.auto_match_guide.eligible, false)
  succeed(await f.store.login('cimoa@connect.edu', '12341234'))
  assert.equal(f.store.current_user.onboarding_status, undefined, 'no fixture-only completed-profile override is needed')
  assert.equal(f.store.auto_match_guide.eligible, true)
  const before = clone_data(f.store.data), writes = f.writes(), context = begin(f.store)
  reach_end(f.store, context)
  assert.deepEqual(f.store.data, before)
  assert.deepEqual(f.store.data.match_sessions, historical)
  assert.equal(f.writes(), writes)
})

test('another user’s matching history does not suppress the current account guide', () => {
  const data = first_use_seed(), previous = create_seed(epoch).match_sessions[0]
  data.match_sessions.push({ ...previous, owner_user_id: 'user_lina', candidate_id: 'user_liam' })
  const f = fixture(data)
  succeed(f.hydration)
  assert.equal(f.store.auto_match_guide.eligible, true)
  begin(f.store)
  assert.equal(f.writes(), 0)
})

test('unstarted, invalid, skipped and cross-context step changes fail without partial progress', () => {
  const f = fixture(), context = f.store.auth_context
  assert.equal(f.store.move_auto_match_guide(1, context).success, false)
  assert.equal(f.store.finish_auto_match_guide('completed', context).success, false)
  assert.equal(f.store.finish_auto_match_guide('skipped', context).success, false)
  assert.equal(f.store.begin_auto_match_guide('wrong-context').success, false)
  begin(f.store)
  const before = clone_data(f.store.data), session = clone_data(f.store.auto_match_guide_session)
  for (const step of [-1, 2, 3, 4, 1.5, '1', null, NaN, Infinity]) assert.equal(f.store.move_auto_match_guide(step, context).success, false, String(step))
  assert.equal(f.store.move_auto_match_guide(1, 'wrong-context').success, false)
  assert.equal(f.store.finish_auto_match_guide('completed', context).success, false)
  assert.equal(f.store.finish_auto_match_guide('anything', context).success, false)
  assert.equal(f.store.finish_auto_match_guide('skipped', 'wrong-context').success, false)
  assert.deepEqual(f.store.auto_match_guide_session, session)
  assert.deepEqual(f.store.data, before)
  assert.equal(f.writes(), 0)
})

for (const outcome of ['completed', 'skipped']) {
  test(`${outcome} persists exactly one account preference and survives fresh hydration`, () => {
    const f = fixture(), before = clone_data(f.store.data), context = begin(f.store)
    if (outcome === 'completed') reach_end(f.store, context)
    succeed(f.store.finish_auto_match_guide(outcome, context))
    const expected = { revision: AUTO_MATCH_GUIDE_REVISION, outcome, completed_at: epoch }
    assert.deepEqual(receipt_for(f.store.data), expected)
    assert.deepEqual(receipt_for(f.saved()), expected)
    assert.deepEqual(without_guide_metadata(f.store.data), without_guide_metadata(before))
    assert.equal(f.store.auto_match_guide_session, null)
    assert.equal(f.store.auto_match_guide.eligible, false)
    assert.equal(f.writes(), 1)
    const committed = clone_data(f.store.data)
    for (const replay_outcome of [outcome, outcome === 'completed' ? 'skipped' : 'completed']) {
      const replay = f.store.finish_auto_match_guide(replay_outcome, context)
      succeed(replay); assert.equal(replay.repeated, true)
    }
    assert.deepEqual(f.store.data, committed)
    assert.equal(f.writes(), 1, 'repeated callbacks never rewrite the completion outcome')
    const restored = fixture(f.saved(), epoch + 1000)
    succeed(restored.hydration)
    assert.deepEqual(restored.store.auto_match_guide.receipt, expected)
    assert.equal(restored.store.auto_match_guide.eligible, false)
    assert.equal(restored.store.auto_match_guide.started, false)
    assert.equal(restored.store.begin_auto_match_guide(restored.store.auth_context).success, false)
    assert.equal(restored.writes(), 0)
  })

  test(`${outcome} remains suppressed through same-install logout, login and fresh hydration`, async () => {
    const f = fixture(), context = begin(f.store)
    if (outcome === 'completed') reach_end(f.store, context)
    succeed(f.store.finish_auto_match_guide(outcome, context))
    const completed = clone_data(receipt_for(f.store.data)), history = clone_data(f.store.data.match_sessions)
    succeed(f.store.logout(TEST_ACCOUNT_ID))
    assert.equal(f.store.auto_match_guide.eligible, false)
    succeed(await f.store.login('cimoa@connect.edu', '12341234'))
    assert.equal(f.store.auto_match_guide.eligible, false)
    assert.equal(f.store.begin_auto_match_guide(f.store.auth_context).success, false)
    assert.deepEqual(receipt_for(f.store.data), completed)
    assert.deepEqual(f.store.data.match_sessions, history)
    const restored = fixture(f.saved(), epoch + 1000)
    succeed(restored.hydration)
    assert.equal(restored.store.auto_match_guide.eligible, false)
    assert.deepEqual(receipt_for(restored.store.data), completed)
    assert.equal(restored.writes(), 0)
  })

  test(`${outcome} from a previous installation does not suppress a clean reinstall login`, async () => {
    const previous = fixture(), previous_context = begin(previous.store)
    if (outcome === 'completed') reach_end(previous.store, previous_context)
    succeed(previous.store.finish_auto_match_guide(outcome, previous_context))
    const previous_disk = previous.saved()
    const clean_install = create_seed(epoch + 1000)
    clean_install.session = { account_id: null, current_user_id: null, expires_at: null }
    const reinstalled = fixture(clean_install, epoch + 1000)
    succeed(reinstalled.hydration)
    assert.equal(reinstalled.store.auto_match_guide.eligible, false)
    succeed(await reinstalled.store.login('cimoa@connect.edu', '12341234'))
    assert.equal(reinstalled.store.auto_match_guide.eligible, true)
    assert.equal(reinstalled.store.auto_match_guide.started, false)
    assert.equal(receipt_for(reinstalled.store.data), undefined)
    const before = clone_data(reinstalled.store.data), writes = reinstalled.writes(), context = begin(reinstalled.store)
    reach_end(reinstalled.store, context)
    assert.deepEqual(reinstalled.store.data, before, 'reinstall teaching preserves all entities supplied by the new installation')
    assert.equal(reinstalled.writes(), writes)
    assert.deepEqual(previous.saved(), previous_disk, 'isolated reinstall does not edit the previous installation')
  })

  test(`${outcome} storage failure preserves data, disk and active step for a retry`, () => {
    const f = fixture(), context = begin(f.store)
    if (outcome === 'completed') reach_end(f.store, context)
    const before = clone_data(f.store.data), disk = f.saved(), progress = clone_data(f.store.auto_match_guide_session)
    f.fail_write(true)
    const failure = f.store.finish_auto_match_guide(outcome, context)
    assert.equal(failure.success, false)
    assert.equal(failure.reason, 'guide_update_failed')
    assert.deepEqual(f.store.data, before)
    assert.deepEqual(f.saved(), disk)
    assert.deepEqual(f.store.auto_match_guide_session, progress)
    assert.equal(f.writes(), 0)
    f.fail_write(false)
    succeed(f.store.finish_auto_match_guide(outcome, context))
    assert.equal(f.writes(), 1)
  })
}

test('refreshing unfinished transient progress restarts at zero without pretending completion', () => {
  const f = fixture(), context = begin(f.store)
  succeed(f.store.move_auto_match_guide(1, context))
  succeed(f.store.move_auto_match_guide(2, context))
  const restored = fixture(f.saved())
  assert.deepEqual(restored.store.auto_match_guide, { eligible: true, receipt: null, step: 0, started: false })
  assert.equal(restored.writes(), 0)
})

test('completion and runtime progress remain isolated when logging out and changing accounts', async () => {
  const data = first_use_seed(), template = data.accounts[0]
  data.accounts.push({ ...template, account_id: 'account_lina', user_id: 'user_lina', email: 'lina@connect.edu' })
  data.users.find(row => row.user_id === 'user_lina').onboarding_status = 'complete'
  ensure_account_defaults(data, 'user_lina')
  const f = fixture(data), first_context = begin(f.store)
  succeed(f.store.move_auto_match_guide(1, first_context))
  succeed(f.store.logout(TEST_ACCOUNT_ID))
  assert.equal(f.store.auto_match_guide_session, null)
  assert.equal(f.store.auto_match_guide.eligible, false)
  succeed(await f.store.login('lina@connect.edu', '12341234'))
  assert.equal(f.store.session.account_id, 'account_lina')
  assert.equal(f.store.auto_match_guide.eligible, true)
  assert.equal(f.store.auto_match_guide.started, false)
  const lina_context = begin(f.store)
  assert.equal(f.store.move_auto_match_guide(1, first_context).success, false)
  assert.equal(f.store.finish_auto_match_guide('skipped', first_context).success, false)
  succeed(f.store.finish_auto_match_guide('skipped', lina_context))
  assert.equal(receipt_for(f.store.data, 'user_lina').outcome, 'skipped')
  assert.equal(receipt_for(f.store.data), undefined)
  succeed(f.store.logout('account_lina'))
  succeed(await f.store.login('cimoa@connect.edu', '12341234'))
  assert.equal(f.store.auto_match_guide.eligible, true)
  assert.equal(f.store.auto_match_guide.started, false)
  assert.equal(f.store.auto_match_guide.step, 0)
  assert.equal(f.store.finish_auto_match_guide('skipped', lina_context).success, false)
  assert.equal(receipt_for(f.store.data), undefined)
})

test('session expiration hides unfinished progress and denies a delayed completion without a write', () => {
  const f = fixture(), context = begin(f.store)
  reach_end(f.store, context)
  const before = clone_data(f.store.data)
  f.advance(31 * 86400000)
  assert.equal(f.store.auto_match_guide.eligible, false)
  assert.equal(f.store.auto_match_guide.started, false)
  assert.equal(f.store.finish_auto_match_guide('completed', context).success, false)
  assert.deepEqual(f.store.data, before)
  assert.equal(f.writes(), 0)
})

test('a newly active real matching session invalidates an unfinished guide without adding a preference', () => {
  const f = fixture(), context = begin(f.store)
  reach_end(f.store, context)
  succeed(f.store.start_match('guide-manual-start'))
  const admitted = clone_data(f.store.data), disk = f.saved(), writes = f.writes()
  assert.equal(f.store.auto_match_guide.eligible, false)
  assert.equal(f.store.auto_match_guide.started, false)
  assert.equal(f.store.finish_auto_match_guide('completed', context).success, false)
  assert.deepEqual(f.store.data, admitted)
  assert.deepEqual(f.saved(), disk)
  assert.equal(f.writes(), writes)
  assert.equal(receipt_for(f.store.data), undefined)
})

test('old matching status changes and other accounts’ new sessions do not cancel the current teaching snapshot', () => {
  const data = create_seed(epoch)
  data.users.find(row => row.user_id === TEST_USER_ID).onboarding_status = 'complete'
  const f = fixture(data), context = begin(f.store), captured = clone_data(f.store.auto_match_guide_session.matching_ids)
  const old = f.store.data.match_sessions.find(row => row.owner_user_id === TEST_USER_ID)
  old.status = old.status === 'paused' ? 'left' : 'paused'
  f.store.data.match_sessions.push({ ...clone_data(old), match_id: 'guide_other_account_new_match', owner_user_id: 'user_lina' })
  assert.equal(f.store.auto_match_guide.eligible, true)
  succeed(f.store.move_auto_match_guide(1, context))
  assert.deepEqual(f.store.auto_match_guide_session.matching_ids, captured)
  assert.equal(f.store.auto_match_guide.started, true)
  assert.equal(f.writes(), 0)
})

test('malformed completion preferences are rejected by validation and fail hydration closed', () => {
  const invalid = [
    null, false, {},
    { revision: 2, outcome: 'completed', completed_at: epoch },
    { revision: 1, outcome: 'pending', completed_at: epoch },
    { revision: 1, outcome: 'skipped', completed_at: 0 },
    { revision: 1, outcome: 'completed', completed_at: -1 },
    { revision: 1, outcome: 'completed', completed_at: String(epoch) },
    { revision: 1, outcome: 'completed', completed_at: null },
  ]
  for (const receipt of invalid) {
    const data = first_use_seed()
    data.settings.find(row => row.owner_user_id === TEST_USER_ID).auto_match_guide = receipt
    assert.throws(() => validate_data(data), /Invalid first-use guide preference/)
    const f = fixture(data)
    assert.equal(f.hydration.success, false, JSON.stringify(receipt))
    assert.equal(f.store.hydration_status, 'error')
    assert.equal(f.store.auto_match_guide.eligible, false)
    assert.equal(f.writes(), 0)
    assert.deepEqual(f.saved(), data)
  }
  for (const completed_at of [NaN, Infinity, -Infinity]) {
    const data = first_use_seed()
    data.settings[0].auto_match_guide = { revision: 1, outcome: 'completed', completed_at }
    assert.throws(() => validate_data(data), /Invalid first-use guide preference/)
  }
})

test('cancelled finish scopes never write a completed or skipped guide preference', () => {
  for (const outcome of ['completed', 'skipped']) {
    const f = fixture(), context = begin(f.store)
    if (outcome === 'completed') reach_end(f.store, context)
    const before = clone_data(f.store.data), progress = clone_data(f.store.auto_match_guide_session)
    assert.equal(f.store.finish_auto_match_guide(outcome, context, { is_current: () => false }).success, false)
    assert.deepEqual(f.store.data, before)
    assert.deepEqual(f.store.auto_match_guide_session, progress)
    assert.equal(f.writes(), 0)
  }
})

test('the shared guide write controller waits its existing 500ms before committing a single preference', async () => {
  const f = fixture(), context = begin(f.store)
  reach_end(f.store, context)
  let scheduled, loading = false
  const operation = create_write_operation({
    set_loading: value => { loading = value },
    timers: { setTimeout: (callback, duration) => { scheduled = { callback, duration }; return 1 }, clearTimeout: () => {} },
  })
  const promise = operation.run(scope => f.store.finish_auto_match_guide('completed', context, scope))
  assert.equal(loading, true)
  assert.equal(scheduled.duration, 500)
  assert.equal(f.writes(), 0)
  assert.equal(receipt_for(f.store.data), undefined)
  assert.equal((await operation.run(() => { throw Error('Second write must not execute') })).reason, 'busy')
  await scheduled.callback()
  succeed(await promise)
  assert.equal(loading, false)
  assert.equal(f.writes(), 1)
  assert.equal(receipt_for(f.store.data).outcome, 'completed')
})

test('background-style cancellation settles the guide write Promise and rejects an already-queued callback', async () => {
  const f = fixture(), context = begin(f.store)
  let scheduled, loading = false
  const operation = create_write_operation({
    set_loading: value => { loading = value },
    timers: { setTimeout: callback => { scheduled = callback; return 1 }, clearTimeout: () => {} },
  })
  const before = clone_data(f.store.data)
  const promise = operation.run(scope => f.store.finish_auto_match_guide('skipped', context, scope))
  operation.cancel()
  assert.equal((await promise).reason, 'cancelled')
  assert.equal(loading, false)
  await scheduled()
  assert.equal(f.writes(), 0)
  assert.deepEqual(f.store.data, before)
  assert.equal(f.store.auto_match_guide.started, true, 'cancelling an interaction does not pretend the guide was completed')
})

const close_to = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.000001, `${message}: ${actual} ≠ ${expected}`)
function safe_geometry(layout, input) {
  const { card, spot, mask } = layout
  for (const rect of [card, ...mask, ...(spot ? [spot] : [])]) {
    for (const key of ['left', 'top', 'width', 'height']) assert.ok(Number.isFinite(rect[key]), `${key} is finite`)
    assert.ok(rect.left >= 0 && rect.top >= 0 && rect.width >= 0 && rect.height >= 0)
    assert.ok(rect.left + rect.width <= input.width + 0.000001, 'rectangle remains horizontally in the viewport')
    assert.ok(rect.top + rect.height <= input.height + 0.000001, 'rectangle remains vertically in the viewport')
  }
  assert.ok(card.top >= input.safe_top, 'card clears the physical top safe area')
  assert.ok(card.top + card.height <= input.height - input.safe_bottom, 'card clears the bottom safe area')
  assert.ok(layout.body_height > 0)
  assert.ok(card.height >= input.chrome_height + 1, 'non-scrollable controls fit before explanation shrinks')
  close_to(layout.rpx_scale * input.width, 750, 'measured logical geometry uses the current responsive rpx scale')
  if (spot) {
    const vertical_gap = layout.placement === 'above' ? spot.top - (card.top + card.height) : card.top - spot.bottom
    assert.ok(vertical_gap >= 16 * input.width / 393 - 0.000001, 'teaching card does not cover the highlighted target')
    const area = mask.reduce((sum, rect) => sum + rect.width * rect.height, 0)
    close_to(area + spot.width * spot.height, input.width * input.height, 'four masks cover everything except the real spotlight')
  } else assert.deepEqual(mask, [{ left: 0, top: 0, width: input.width, height: input.height }])
}

test('guide target registry follows Home lightning, preferences, real Join control and an unanchored final explanation', () => {
  assert.deepEqual(AUTO_MATCH_GUIDE_TARGETS, ['.home-match', '.am-1505-49', '.am-1504-45', ''])
  assert.equal(Object.isFrozen(AUTO_MATCH_GUIDE_TARGETS), true)
})

test('phone-size spotlight geometry keeps the Home lightning unobscured below the safe area', () => {
  for (const [width, height, safe_top, safe_bottom] of [[320, 568, 20, 0], [375, 667, 20, 0], [393, 852, 59, 34], [402, 874, 62, 34], [440, 956, 62, 34]]) {
    const scale = width / 393
    const input = { width, height, safe_top, safe_bottom, anchor: { left: width - 74 * scale, top: safe_top + 6 * scale, width: 54 * scale, height: 54 * scale }, card_height: 390 * scale, chrome_height: 195 * scale }
    const layout = auto_match_guide_layout(input)
    assert.ok(layout.spot)
    assert.equal(layout.placement, 'below')
    safe_geometry(layout, input)
  }
})

test('short phones place footer-control explanations above their anchors without hiding action controls', () => {
  for (const [width, height, safe_top, safe_bottom] of [[320, 568, 20, 0], [375, 667, 20, 0], [393, 852, 59, 34]]) {
    const scale = width / 393
    for (const offset of [0, 65]) {
      const input = { width, height, safe_top, safe_bottom, anchor: { left: 20 * scale, top: height - safe_bottom - (74 + offset) * scale, width: width - 40 * scale, height: 54 * scale }, card_height: 390 * scale, chrome_height: 190 * scale }
      const layout = auto_match_guide_layout(input)
      assert.ok(layout.spot)
      assert.equal(layout.placement, 'above')
      safe_geometry(layout, input)
    }
  }
})

test('oversized explanation shrinks only its scroll body while preserving a visible usable target', () => {
  const input = { width: 320, height: 568, safe_top: 20, safe_bottom: 0, anchor: { left: 250, top: 32, width: 54, height: 54 }, card_height: 1200, chrome_height: 190 }
  const layout = auto_match_guide_layout(input)
  assert.ok(layout.spot)
  assert.ok(layout.card.height < input.card_height)
  assert.ok(layout.body_height >= 58 * input.width / 393, 'the explanation retains a genuine scroll region')
  close_to(layout.body_height, layout.card.height - input.chrome_height, 'only text area absorbs the height reduction')
  safe_geometry(layout, input)
})

test('missing, unreadable and entirely offscreen targets safely center the guide', () => {
  const base = { width: 393, height: 852, safe_top: 59, safe_bottom: 34, card_height: 390, chrome_height: 190 }
  const anchors = [null, {}, { left: 1, top: 1, width: 0, height: 30 }, { left: 10, top: 10, width: 30, height: NaN }, { left: -999, top: 300, width: 54, height: 54 }, { left: 999, top: 300, width: 54, height: 54 }, { left: 20, top: -999, width: 54, height: 54 }, { left: 20, top: 999, width: 54, height: 54 }]
  for (const anchor of anchors) {
    const input = { ...base, anchor }, layout = auto_match_guide_layout(input)
    assert.equal(layout.spot, null)
    assert.equal(layout.placement, 'center')
    safe_geometry(layout, input)
  }
})

test('partially clipped anchors remain bounded and impossible side clearance falls back to a centered card', () => {
  const base = { width: 393, height: 852, safe_top: 59, safe_bottom: 34, card_height: 380, chrome_height: 190 }
  for (const anchor of [{ left: -10, top: 80, width: 54, height: 54 }, { left: 380, top: 80, width: 54, height: 54 }, { left: 100, top: 40, width: 54, height: 54 }]) {
    const input = { ...base, anchor }, layout = auto_match_guide_layout(input)
    assert.ok(layout.spot)
    safe_geometry(layout, input)
  }
  const input = { ...base, anchor: { left: 20, top: 280, width: 353, height: 290 }, card_height: 500, chrome_height: 250 }
  const layout = auto_match_guide_layout(input)
  assert.equal(layout.spot, null)
  assert.equal(layout.placement, 'center')
  safe_geometry(layout, input)
})
