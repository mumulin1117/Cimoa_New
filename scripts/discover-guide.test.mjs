import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data, TEST_ACCOUNT_ID, TEST_USER_ID } from '../src/stores/seed.js'
import { ensure_account_defaults } from '../src/stores/accountDefaults.js'
import { validate_data } from '../src/stores/selectors.js'
import { transact, connect_users } from '../src/stores/transactions.js'
import { DISCOVER_GUIDE_REVISION } from '../src/stores/discoverGuide.js'
import { create_write_operation } from '../src/utils/writeOperation.js'

const epoch = Date.UTC(2026, 10, 3, 4)
const receipt_for = (data, owner = TEST_USER_ID) => data.settings.find(row => row.owner_user_id === owner)?.discover_guide
const succeed = result => assert.equal(result.success, true, result.message)
function fixture(saved = create_seed(epoch), time = epoch) {
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
  return { store, hydration, saved: () => clone_data(disk), writes: () => writes, fail_write: value => { fail_write = value }, advance: ms => { now += ms; store.tick() } }
}
function begin(store) {
  const context = store.auth_context, target_user_id = store.discover_people[store.discover_card_index]?.user_id
  succeed(store.begin_discover_guide(target_user_id, context))
  return { context, target_user_id }
}
const reach_end = (store, context) => { for (const step of [1, 2, 3, 4, 5, 6]) succeed(store.move_discover_guide(step, context)) }
function without_guide_metadata(value) {
  const data = clone_data(value)
  delete data.revision; delete data.updated_at
  for (const settings of data.settings) delete settings.discover_guide
  return data
}

test('first eligible Discover card begins once with its exact ID and no writes or business mutations', () => {
  const f = fixture(), before = clone_data(f.store.data)
  succeed(f.hydration)
  assert.deepEqual(f.store.discover_guide, { eligible: true, receipt: null, started: false, step: 0, target_user_id: 'user_zane', target_available: true })
  const { context, target_user_id } = begin(f.store)
  assert.deepEqual(f.store.discover_guide_session, { auth_context: context, step: 0, target_user_id })
  succeed(f.store.begin_discover_guide(target_user_id, context))
  assert.equal(f.store.discover_guide.started, true)
  assert.deepEqual(f.store.data, before)
  assert.equal(f.store.discover_cursor, null)
  assert.equal(f.writes(), 0)
  assert.equal(receipt_for(f.saved()), undefined)
})

test('all seven steps are adjacent transient presentation state without requests, charges, permissions or form writes', () => {
  const f = fixture(), before = clone_data(f.store.data), { context, target_user_id } = begin(f.store)
  for (const step of [1, 2, 1, 0, 1, 2, 3, 4, 5, 6, 5, 6]) {
    succeed(f.store.move_discover_guide(step, context))
    assert.equal(f.store.discover_guide.step, step)
    assert.equal(f.store.discover_guide.target_user_id, target_user_id)
    assert.deepEqual(f.store.data, before)
    assert.deepEqual(f.store.introduction_forms, [])
    assert.equal(f.writes(), 0)
  }
  for (const table of ['requests', 'relationships', 'conversations', 'messages', 'coin_transactions', 'match_quota', 'match_preferences', 'drafts', 'media_files', 'settings']) assert.deepEqual(f.store.data[table], before[table], table)
})

test('the guide respects a retained current card rather than rotating to its own preferred person', () => {
  const f = fixture()
  assert.equal(f.store.remember_discover_card('user_anna'), true)
  const cursor = clone_data(f.store.discover_cursor)
  assert.equal(f.store.discover_guide.target_user_id, 'user_anna')
  assert.equal(f.store.begin_discover_guide('user_zane', f.store.auth_context).success, false)
  const { target_user_id } = begin(f.store)
  assert.equal(target_user_id, 'user_anna')
  assert.deepEqual(f.store.discover_cursor, cursor)
  assert.equal(f.writes(), 0)
})

test('unstarted, out-of-order, invalid and cross-context steps fail without transient or persistent changes', () => {
  const f = fixture(), context = f.store.auth_context
  assert.equal(f.store.move_discover_guide(1, context).success, false)
  assert.equal(f.store.finish_discover_guide('completed', context).success, false)
  assert.equal(f.store.finish_discover_guide('skipped', context).success, false)
  assert.equal(f.store.begin_discover_guide('user_zane', 'old-context').success, false)
  begin(f.store)
  const before = clone_data(f.store.data), session = clone_data(f.store.discover_guide_session)
  for (const step of [-1, 2, 6, 7, '1', 1.5, null, NaN, Infinity]) assert.equal(f.store.move_discover_guide(step, context).success, false, String(step))
  assert.equal(f.store.move_discover_guide(1, 'old-context').success, false)
  assert.equal(f.store.finish_discover_guide('completed', context).success, false)
  assert.equal(f.store.finish_discover_guide('other', context).success, false)
  assert.equal(f.store.finish_discover_guide('skipped', 'old-context').success, false)
  assert.deepEqual(f.store.data, before)
  assert.deepEqual(f.store.discover_guide_session, session)
  assert.equal(f.writes(), 0)
})

test('logged out, expired, hydration errors, incomplete profiles and unconfirmed local accounts cannot begin', () => {
  for (const kind of ['guest', 'expired', 'not_started', 'in_progress', 'unconfirmed', 'idle', 'loading', 'error']) {
    const data = create_seed(epoch), user = data.users.find(row => row.user_id === TEST_USER_ID)
    if (kind === 'guest') data.session = { account_id: null, current_user_id: null, expires_at: null }
    if (kind === 'expired') data.session.expires_at = epoch - 1
    if (['not_started', 'in_progress'].includes(kind)) user.onboarding_status = kind
    if (kind === 'unconfirmed') { data.accounts[0].auth_provider = 'local'; user.onboarding_status = 'complete' }
    const f = fixture(data)
    if (['idle', 'loading', 'error'].includes(kind)) f.store.hydration_status = kind
    const before = clone_data(f.store.data)
    assert.equal(f.store.discover_guide.eligible, false, kind)
    assert.equal(f.store.discover_guide.target_available, false, kind)
    assert.equal(f.store.begin_discover_guide('user_zane', f.store.auth_context).success, false, kind)
    assert.deepEqual(f.store.data, before)
    assert.equal(f.writes(), 0)
  }
})

test('a completed local registration can guide without inventing student verification', () => {
  const data = create_seed(epoch), account = data.accounts[0], user = data.users.find(row => row.user_id === TEST_USER_ID)
  account.auth_provider = 'local'; account.local_verification = { method: 'fixed_code', status: 'verified', verified_at: epoch - 1000 }
  user.onboarding_status = 'complete'; user.verification_status = 'pending'
  const f = fixture(data), before = clone_data(f.store.data), { context } = begin(f.store)
  reach_end(f.store, context)
  assert.equal(f.store.current_user.verification_status, 'pending')
  assert.deepEqual(f.store.data, before)
  assert.equal(f.writes(), 0)
})

test('an unavailable current card is never replaced just to force an introduction tutorial', () => {
  for (const kind of ['incoming', 'outgoing', 'connected', 'no_questions', 'not_qualified']) {
    const data = create_seed(epoch), owner = TEST_USER_ID, target = 'user_zane'
    if (['incoming', 'outgoing'].includes(kind)) data.requests.push({ ...clone_data(data.requests[0]), request_id: `guide_${kind}`, sender_id: kind === 'incoming' ? target : owner, recipient_id: kind === 'incoming' ? owner : target, question_id: data.users.find(row => row.user_id === (kind === 'incoming' ? owner : target)).icebreaker_ids[0], status: 'pending' })
    if (kind === 'connected') connect_users(data, target, epoch)
    if (kind === 'no_questions') data.users.find(row => row.user_id === target).icebreaker_ids = []
    if (kind === 'not_qualified') data.users.find(row => row.user_id === target).verification_status = 'pending'
    const f = fixture(data)
    succeed(f.hydration)
    const before = clone_data(f.store.data)
    assert.equal(f.store.discover_people[f.store.discover_card_index].user_id, target)
    assert.equal(f.store.discover_guide.eligible, true, kind)
    assert.equal(f.store.discover_guide.target_available, false, kind)
    assert.equal(f.store.begin_discover_guide(target, f.store.auth_context).success, false, kind)
    assert.equal(f.store.begin_discover_guide('user_linden', f.store.auth_context).success, false, kind)
    assert.equal(f.store.discover_cursor, null)
    assert.deepEqual(f.store.data, before)
    assert.equal(f.writes(), 0)
  }
})

test('a fixed target cannot be swapped once the presentation session starts', () => {
  const f = fixture(), { context, target_user_id } = begin(f.store)
  assert.equal(f.store.remember_discover_card('user_linden'), true)
  const session = clone_data(f.store.discover_guide_session)
  assert.equal(f.store.begin_discover_guide('user_linden', context).success, false)
  assert.deepEqual(f.store.discover_guide_session, session)
  assert.equal(f.store.discover_guide.target_user_id, target_user_id)
  assert.equal(f.writes(), 0)
})

for (const outcome of ['completed', 'skipped']) {
  test(`${outcome} writes only one validated account receipt, never tutorial progress or target identity`, () => {
    const f = fixture(), before = clone_data(f.store.data), { context } = begin(f.store)
    if (outcome === 'completed') reach_end(f.store, context)
    succeed(f.store.finish_discover_guide(outcome, context))
    const expected = { revision: DISCOVER_GUIDE_REVISION, outcome, completed_at: epoch }
    assert.deepEqual(receipt_for(f.store.data), expected)
    assert.deepEqual(receipt_for(f.saved()), expected)
    assert.deepEqual(without_guide_metadata(f.store.data), without_guide_metadata(before))
    assert.equal(f.store.discover_guide_session, null)
    assert.equal(f.store.discover_guide.eligible, false)
    assert.equal(f.writes(), 1)
    const committed = clone_data(f.store.data)
    for (const callback of [outcome, outcome === 'completed' ? 'skipped' : 'completed']) {
      const result = f.store.finish_discover_guide(callback, context)
      succeed(result); assert.equal(result.repeated, true)
    }
    assert.deepEqual(f.store.data, committed)
    assert.equal(f.writes(), 1)
    const restored = fixture(f.saved(), epoch + 1000)
    succeed(restored.hydration)
    assert.equal(restored.store.discover_guide.eligible, false)
    assert.equal(restored.store.discover_guide.started, false)
    assert.deepEqual(restored.store.discover_guide.receipt, expected)
    assert.equal(restored.writes(), 0)
  })

  test(`${outcome} remains suppressed on same-install relogin and returns after clean reinstall login`, async () => {
    const f = fixture(), { context } = begin(f.store)
    if (outcome === 'completed') reach_end(f.store, context)
    succeed(f.store.finish_discover_guide(outcome, context))
    const receipt = clone_data(receipt_for(f.store.data))
    succeed(f.store.logout(TEST_ACCOUNT_ID))
    assert.equal(f.store.discover_guide_session, null)
    succeed(await f.store.login('cimoa@connect.edu', '12341234'))
    assert.equal(f.store.discover_guide.eligible, false)
    assert.deepEqual(receipt_for(f.store.data), receipt)
    const clean = create_seed(epoch + 1000)
    clean.session = { account_id: null, current_user_id: null, expires_at: null }
    const reinstalled = fixture(clean, epoch + 1000)
    assert.equal(reinstalled.store.discover_guide.eligible, false)
    succeed(await reinstalled.store.login('cimoa@connect.edu', '12341234'))
    assert.equal(reinstalled.store.discover_guide.eligible, true)
    assert.equal(reinstalled.store.discover_guide.started, false)
    assert.equal(receipt_for(reinstalled.store.data), undefined)
    const before = clone_data(reinstalled.store.data), writes = reinstalled.writes(), next = begin(reinstalled.store)
    reach_end(reinstalled.store, next.context)
    assert.deepEqual(reinstalled.store.data, before)
    assert.equal(reinstalled.writes(), writes)
  })

  test(`${outcome} storage failure is atomic and keeps presentation progress for a real retry`, () => {
    const f = fixture(), { context } = begin(f.store)
    if (outcome === 'completed') reach_end(f.store, context)
    const before = clone_data(f.store.data), disk = f.saved(), session = clone_data(f.store.discover_guide_session)
    f.fail_write(true)
    const result = f.store.finish_discover_guide(outcome, context)
    assert.equal(result.success, false)
    assert.equal(result.reason, 'guide_update_failed')
    assert.deepEqual(f.store.data, before)
    assert.deepEqual(f.saved(), disk)
    assert.deepEqual(f.store.discover_guide_session, session)
    assert.equal(f.writes(), 0)
    f.fail_write(false)
    succeed(f.store.finish_discover_guide(outcome, context))
    assert.equal(f.writes(), 1)
  })
}

test('unfinished refresh and explicit cancellation restart at zero without writing fake completion', () => {
  const f = fixture(), { context } = begin(f.store)
  succeed(f.store.move_discover_guide(1, context))
  succeed(f.store.move_discover_guide(2, context))
  const restored = fixture(f.saved())
  assert.equal(restored.store.discover_guide.started, false)
  assert.equal(restored.store.discover_guide.step, 0)
  assert.equal(restored.store.discover_guide.eligible, true)
  assert.equal(f.store.cancel_discover_guide('old-context'), false)
  assert.equal(f.store.discover_guide.started, true)
  assert.equal(f.store.cancel_discover_guide(context), true)
  assert.equal(f.store.discover_guide_session, null)
  assert.equal(f.store.discover_guide.eligible, true)
  assert.equal(receipt_for(f.store.data), undefined)
  assert.equal(f.writes(), 0)
  begin(f.store)
  f.store.hydration_status = 'idle'
  succeed(f.store.hydrate())
  assert.equal(f.store.discover_guide_session, null)
  assert.equal(f.writes(), 0)
})

test('receipts and unfinished sessions are isolated across logout and different accounts', async () => {
  const data = create_seed(epoch), template = data.accounts[0]
  data.accounts.push({ ...template, account_id: 'account_lina', user_id: 'user_lina', email: 'lina@connect.edu' })
  data.users.find(row => row.user_id === 'user_lina').onboarding_status = 'complete'
  ensure_account_defaults(data, 'user_lina')
  const f = fixture(data), first = begin(f.store)
  succeed(f.store.move_discover_guide(1, first.context))
  succeed(f.store.logout(TEST_ACCOUNT_ID))
  assert.equal(f.store.discover_guide_session, null)
  succeed(await f.store.login('lina@connect.edu', '12341234'))
  assert.equal(f.store.discover_guide.eligible, true)
  assert.equal(f.store.discover_guide.started, false)
  const second = begin(f.store)
  assert.equal(f.store.move_discover_guide(1, first.context).success, false)
  assert.equal(f.store.finish_discover_guide('skipped', first.context).success, false)
  assert.equal(f.store.cancel_discover_guide(first.context), false)
  succeed(f.store.finish_discover_guide('skipped', second.context))
  assert.equal(receipt_for(f.store.data, 'user_lina').outcome, 'skipped')
  assert.equal(receipt_for(f.store.data), undefined)
  succeed(f.store.logout('account_lina'))
  succeed(await f.store.login('cimoa@connect.edu', '12341234'))
  assert.equal(f.store.discover_guide.eligible, true)
  assert.equal(f.store.discover_guide.started, false)
  assert.equal(f.store.finish_discover_guide('completed', second.context).success, false)
  assert.equal(receipt_for(f.store.data), undefined)
})

test('real request submission ends teaching without marking completion or altering its existing charge', async () => {
  const f = fixture(), { context, target_user_id } = begin(f.store)
  reach_end(f.store, context)
  const balance = f.store.coin_balance, requests = f.store.data.requests.length
  succeed(await f.store.send_introduction({ user_id: target_user_id, question_id: f.store.questions_for_user(target_user_id)[0].question_id, text: 'Would you like to explore campus together?', operation_id: 'guide-manual-introduction' }))
  const sent = clone_data(f.store.data), disk = f.saved(), writes = f.writes()
  assert.equal(f.store.data.requests.length, requests + 1)
  assert.equal(f.store.coin_balance, balance - 10)
  assert.equal(f.store.discover_guide_session, null)
  assert.equal(f.store.discover_guide.started, false)
  assert.equal(f.store.discover_guide.target_available, false)
  assert.equal(f.store.finish_discover_guide('completed', context).success, false)
  assert.equal(receipt_for(f.store.data), undefined)
  assert.deepEqual(f.store.data, sent)
  assert.deepEqual(f.saved(), disk)
  assert.equal(f.writes(), writes)
})

for (const kind of ['connection', 'incoming', 'block', 'reverse_block', 'privacy', 'no_questions', 'access']) {
  test(`real ${kind} change invalidates the fixed target without a guide receipt or extra write`, () => {
    const f = fixture(), { context, target_user_id } = begin(f.store)
    reach_end(f.store, context)
    const writes = f.writes()
    succeed(transact(f.store, null, (data, now) => {
      if (kind === 'connection') connect_users(data, target_user_id, now)
      if (kind === 'incoming') data.requests.push({ ...clone_data(data.requests[0]), request_id: 'guide_incoming_real', sender_id: target_user_id, recipient_id: TEST_USER_ID, question_id: data.users.find(row => row.user_id === TEST_USER_ID).icebreaker_ids[0], status: 'pending' })
      if (kind === 'block' || kind === 'reverse_block') data.blocked_users.push({ block_id: `guide_${kind}`, owner_user_id: kind === 'block' ? TEST_USER_ID : target_user_id, user_id: kind === 'block' ? target_user_id : TEST_USER_ID, created_at: now })
      if (kind === 'privacy') { ensure_account_defaults(data, target_user_id); data.settings.find(row => row.owner_user_id === target_user_id).privacy.discover_visible = false }
      if (kind === 'no_questions') data.users.find(row => row.user_id === target_user_id).icebreaker_ids = []
      if (kind === 'access') data.users.find(row => row.user_id === TEST_USER_ID).verification_status = 'expired'
    }))
    assert.equal(f.writes(), writes + 1, 'only the real business action writes')
    assert.equal(f.store.discover_guide_session, null)
    assert.equal(f.store.discover_guide.started, false)
    assert.equal(f.store.finish_discover_guide('completed', context).success, false)
    assert.equal(receipt_for(f.store.data), undefined)
    assert.equal(f.writes(), writes + 1)
  })
}

test('session expiry clears volatile teaching and denies delayed completion without a write', () => {
  const f = fixture(), { context } = begin(f.store)
  reach_end(f.store, context)
  const before = clone_data(f.store.data)
  f.advance(31 * 86400000)
  assert.equal(f.store.discover_guide.eligible, false)
  assert.equal(f.store.discover_guide_session, null)
  assert.equal(f.store.finish_discover_guide('completed', context).success, false)
  assert.deepEqual(f.store.data, before)
  assert.equal(f.writes(), 0)
})

test('Discover and Auto Match guide preferences and progress do not suppress or rewrite one another', () => {
  const f = fixture(), auto_context = f.store.auth_context
  succeed(f.store.begin_auto_match_guide(auto_context))
  succeed(f.store.move_auto_match_guide(1, auto_context))
  const auto = clone_data(f.store.auto_match_guide_session), { context } = begin(f.store)
  reach_end(f.store, context)
  succeed(f.store.finish_discover_guide('completed', context))
  assert.deepEqual(f.store.auto_match_guide_session, auto)
  assert.equal(f.store.auto_match_guide.eligible, true)
  assert.equal(f.store.auto_match_guide.step, 1)
  assert.equal(f.store.data.settings.find(row => row.owner_user_id === TEST_USER_ID).auto_match_guide, undefined)
})

test('malformed Discover receipts fail validation and hydration closed without editing storage', () => {
  for (const receipt of [null, false, {}, { revision: 2, outcome: 'completed', completed_at: epoch }, { revision: 1, outcome: 'pending', completed_at: epoch }, ...[0, -1, null, String(epoch)].map(completed_at => ({ revision: 1, outcome: 'skipped', completed_at }))]) {
    const data = create_seed(epoch)
    data.settings.find(row => row.owner_user_id === TEST_USER_ID).discover_guide = receipt
    assert.throws(() => validate_data(data), /Invalid Discover guide preference/)
    const f = fixture(data)
    assert.equal(f.hydration.success, false)
    assert.equal(f.store.hydration_status, 'error')
    assert.equal(f.store.discover_guide.eligible, false)
    assert.equal(f.writes(), 0)
    assert.deepEqual(f.saved(), data)
  }
  for (const completed_at of [NaN, Infinity, -Infinity]) {
    const data = create_seed(epoch)
    data.settings[0].discover_guide = { revision: 1, outcome: 'completed', completed_at }
    assert.throws(() => validate_data(data), /Invalid Discover guide preference/)
  }
})

test('completion still waits the existing 500ms write controller, and cancellation settles without writing', async () => {
  for (const cancel of [false, true]) {
    const f = fixture(), { context } = begin(f.store)
    reach_end(f.store, context)
    let scheduled, loading = false
    const operation = create_write_operation({ set_loading: value => { loading = value }, timers: { setTimeout: (callback, duration) => { scheduled = { callback, duration }; return 1 }, clearTimeout() {} } })
    const pending = operation.run(scope => f.store.finish_discover_guide('completed', context, scope))
    assert.equal(loading, true)
    assert.equal(scheduled.duration, 500)
    assert.equal(f.writes(), 0)
    assert.equal((await operation.run(() => { throw Error('No second finish') })).reason, 'busy')
    if (cancel) operation.cancel()
    await scheduled.callback()
    const result = await pending
    assert.equal(result.success, !cancel)
    assert.equal(loading, false)
    assert.equal(f.writes(), cancel ? 0 : 1)
    if (cancel) {
      assert.equal(result.reason, 'cancelled')
      assert.equal(f.store.discover_guide.started, true)
      assert.equal(receipt_for(f.store.data), undefined)
    }
  }
})

test('stale completion scopes and real transaction failure never fake tutorial completion', () => {
  const f = fixture(), { context } = begin(f.store)
  reach_end(f.store, context)
  const before = clone_data(f.store.data), session = clone_data(f.store.discover_guide_session)
  assert.equal(f.store.finish_discover_guide('completed', context, { is_current: () => false }).success, false)
  assert.deepEqual(f.store.data, before)
  assert.deepEqual(f.store.discover_guide_session, session)
  f.fail_write(true)
  assert.equal(f.store.block_user('user_zane').success, false)
  assert.equal(f.store.discover_guide.started, true)
  assert.deepEqual(f.store.discover_guide_session, session)
  assert.deepEqual(f.store.data, before)
  assert.equal(f.writes(), 0)
})
