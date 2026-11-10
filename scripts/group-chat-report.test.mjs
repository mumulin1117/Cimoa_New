import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data, TEST_USER_ID } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'

const now = Date.UTC(2026, 9, 24, 1)
const group_report = { target_type: 'group', target_id: 'group_picnic', context_id: 'event_picnic', reason: 'Harassment or discrimination', description: 'Repeated unwanted messages in this group.' }

function fixture(change = () => {}) {
  let disk = create_seed(now), writes = 0, fail = false
  change(disk)
  const persistence = {
    read: key => key === STATE_KEY ? clone_data(disk) : null,
    write: (_, data) => { if (fail) throw Error('Storage full'); disk = clone_data(data); writes++ },
  }
  const attach = () => {
    const store = use_app_store(createPinia())
    configure_store_runtime(store, { clock: () => now, persistence })
    return store
  }
  const store = attach()
  assert.equal(store.hydrate().success, true)
  return { store, attach, writes: () => writes, snapshot: () => clone_data(disk), fail: value => { fail = value } }
}

const join = store => assert.equal(store.join_event('event_picnic').success, true)
const unchanged = (f, payload, success) => {
  const before = clone_data(f.store.data), disk = f.snapshot(), writes = f.writes()
  assert.equal(f.store.submit_report(payload).success, success)
  assert.deepEqual(f.store.data, before)
  assert.deepEqual(f.snapshot(), disk)
  assert.equal(f.writes(), writes)
}

test('group reporting validates the exact conversation and event without creating report history', () => {
  const f = fixture(), { store } = f
  join(store)
  const joined = clone_data(store.data)
  unchanged(f, group_report, true)
  unchanged(f, group_report, true)
  assert.deepEqual(store.data, joined)
  assert.equal(store.current_reports.length, 0)
  assert.equal(store.event_detail('event_picnic').joined, true)
  assert.ok(store.event_group('event_picnic', 'group_picnic'))
})

test('group reasons are canonical and repeated valid submissions remain write-free', () => {
  const f = fixture(), { store } = f
  join(store)
  const reasons = ['Harassment or discrimination', 'Inappropriate content', 'Spam or scam', 'Underage safety concern', 'Other']
  assert.deepEqual(store.group_report_reasons, reasons)
  assert.equal(Object.isFrozen(store.group_report_reasons), true)
  for (const reason of ['Misleading event information', 'Unsafe activity', 'Other ', 'Harassment', '', '  ', null, 42]) unchanged(f, { ...group_report, reason }, false)
  for (const reason of reasons) unchanged(f, { ...group_report, reason }, true)
  assert.equal(store.current_reports.length, 0)
})

test('group reporting rejects mismatched, missing, direct and unjoined targets', () => {
  const f = fixture(), { store } = f
  join(store)
  assert.equal(store.join_event('event_mic').success, true)
  const other_group = store.event_detail('event_mic').conversation_id
  for (const patch of [
    { target_id: other_group }, { context_id: 'event_mic' }, { target_id: 'conversation_chloe' },
    { target_id: 'event_picnic' }, { target_id: 'missing_group' }, { context_id: 'missing_event' },
    { target_id: '' }, { context_id: '' }, { context_id: null }, { context_id: undefined },
  ]) unchanged(f, { ...group_report, ...patch }, false)
  unchanged(f, { ...group_report, target_id: other_group, context_id: 'event_mic' }, true)

  const unjoined = fixture()
  unchanged(unjoined, group_report, false)
  join(unjoined.store)
  assert.equal(unjoined.store.leave_event('event_picnic').success, true)
  unchanged(unjoined, group_report, false)
})

test('group reporting needs a ready authenticated session and never supports blocking', () => {
  for (const change of [
    data => { data.session = { account_id: null, current_user_id: null, expires_at: null } },
    data => { data.session.expires_at = now },
    data => { data.accounts[0].status = 'deleted' },
  ]) unchanged(fixture(change), group_report, false)
  const f = fixture()
  join(f.store)
  unchanged(f, { ...group_report, also_block: true }, false)
  f.store.hydration_status = 'error'
  unchanged(f, group_report, false)
})

test('ordinary group and event reports do not touch persistence even when persistence would fail', () => {
  const f = fixture()
  join(f.store)
  f.fail(true)
  unchanged(f, group_report, true)
  unchanged(f, { target_type: 'event', target_id: 'event_picnic', reason: 'Incorrect information' }, true)
})

test('legacy report records remain readable but new reports never add to them', () => {
  const legacy = { ...group_report, report_id: 'report_legacy_group', owner_user_id: TEST_USER_ID, status: 'local_saved', created_at: now - 1 }
  const f = fixture(data => data.reports.push(legacy))
  join(f.store)
  assert.deepEqual(f.store.report_by_id(legacy.report_id), legacy)
  unchanged(f, group_report, true)
  const restored = f.attach()
  assert.equal(restored.hydrate().success, true)
  assert.deepEqual(restored.current_reports, [legacy])
})

test('user report with block persists only the block transaction while ordinary reports are repeatable', () => {
  const f = fixture(), { store } = f
  const payload = { target_type: 'user', target_id: 'user_chloe', reason: 'Harassment', context_id: 'conversation_chloe' }
  unchanged(f, payload, true)
  unchanged(f, payload, true)
  const before_reports = clone_data(store.data.reports), writes = f.writes()
  const blocked = store.submit_report({ ...payload, also_block: true })
  assert.equal(blocked.success, true)
  assert.equal(f.writes(), writes + 1)
  assert.deepEqual(store.data.reports, before_reports)
  assert.equal(store.blocked_user_ids.includes('user_chloe'), true)
  assert.equal(store.current_conversations.some(row => row.participant_ids.includes('user_chloe')), false)
})

test('malformed persisted legacy group targets still fail hydration without overwriting disk', () => {
  for (const patch of [
    { target_id: 'conversation_chloe' }, { target_id: 'missing_group' },
    { context_id: 'event_mic' }, { context_id: 'missing_event' }, { context_id: null },
  ]) {
    const disk = create_seed(now)
    disk.reports.push({ ...group_report, ...patch, report_id: 'report_invalid_group', owner_user_id: TEST_USER_ID, status: 'local_saved', created_at: now })
    const store = use_app_store(createPinia())
    configure_store_runtime(store, { clock: () => now, persistence: { read: key => key === STATE_KEY ? clone_data(disk) : null, write() { assert.fail('Invalid saved data must not be overwritten') } } })
    assert.equal(store.hydrate().success, false)
    assert.equal(store.hydration_status, 'error')
    assert.deepEqual(store.current_reports, [])
  }
})
