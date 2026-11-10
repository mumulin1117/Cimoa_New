import test from 'node:test'
import assert from 'node:assert/strict'
import { create_media_permission_flow } from '../src/utils/mediaPermissionFlow.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const setup = (overrides = {}) => {
  const state = { status: 'checking', error: '', requesting: false, navigating: false }
  const calls = { request: 0, navigate: 0, settings: 0 }
  let owner = 'account-a'
  const flow = create_media_permission_flow({
    state, kind: () => 'microphone', context: () => owner,
    read: async () => ({ microphone: 'not_requested' }),
    request: async () => { calls.request++; return 'granted' },
    navigate: async () => { calls.navigate++ },
    open_settings: async () => { calls.settings++ },
    ...overrides,
  })
  return { state, calls, flow, owner: value => { owner = value } }
}

test('grant ends requesting before a single real return; repeated taps never double-pop', async () => {
  const permission = deferred(), navigation = deferred()
  const subject = setup({ request: async () => { subject.calls.request++; return permission.promise }, navigate: async () => {
    subject.calls.navigate++
    assert.equal(subject.state.requesting, false)
    assert.equal(subject.state.navigating, true)
    return navigation.promise
  } })
  await subject.flow.show()
  const first = subject.flow.allow()
  assert.equal(subject.state.requesting, true)
  assert.equal(await subject.flow.back(), false)
  assert.equal(await subject.flow.allow(), false)
  permission.resolve('granted')
  await Promise.resolve(); await Promise.resolve()
  assert.equal(subject.calls.navigate, 1)
  assert.equal(await subject.flow.back(), false)
  navigation.resolve()
  assert.equal(await first, true)
  assert.equal(await subject.flow.back(), false)
  assert.equal(await subject.flow.allow(), false)
  assert.equal(subject.calls.navigate, 1)
  assert.equal(subject.state.requesting, false)
  assert.equal(subject.state.navigating, false)
})

test('failed navigation retains the real granted status and restores usable Back', async () => {
  let attempts = 0
  const subject = setup({ navigate: async () => { if (++attempts === 1) throw new Error('Couldn’t return. Please try again.') } })
  await subject.flow.show()
  assert.equal(await subject.flow.allow(), false)
  assert.equal(subject.state.status, 'granted')
  assert.match(subject.state.error, /return/)
  assert.equal(subject.state.requesting, false)
  assert.equal(subject.state.navigating, false)
  assert.equal(await subject.flow.back(), true)
  assert.equal(attempts, 2)
})

test('denied, unavailable and invalid permission responses never pretend to grant or navigate', async () => {
  for (const status of ['denied', 'not_requested', 'unavailable', 'pretend']) {
    const subject = setup({ request: async () => status })
    await subject.flow.show()
    assert.equal(await subject.flow.allow(), false)
    assert.equal(subject.calls.navigate, 0)
    assert.notEqual(subject.state.status, 'granted')
    assert.ok(subject.state.error)
    assert.equal(subject.state.requesting, false)
  }
})

test('permission rejection preserves denial and allows a retry', async () => {
  let attempts = 0
  const subject = setup({ request: async () => { if (!attempts++) throw new Error('Microphone permission was denied.'); return 'granted' } })
  await subject.flow.show()
  await subject.flow.allow()
  assert.equal(subject.state.status, 'denied')
  assert.equal(subject.calls.navigate, 0)
  assert.equal(await subject.flow.allow(), true)
  assert.equal(subject.calls.navigate, 1)
})

test('hiding or unmounting before a delayed grant suppresses all stale UI and navigation', async () => {
  const permission = deferred(), subject = setup({ request: () => permission.promise })
  await subject.flow.show()
  const pending = subject.flow.allow()
  subject.flow.hide()
  const snapshot = structuredClone(subject.state)
  permission.resolve('granted')
  assert.equal(await pending, false)
  assert.deepEqual(subject.state, snapshot)
  assert.equal(subject.calls.navigate, 0)
  assert.equal(await subject.flow.back(), false)
})

test('hide/show invalidates old errors without unlocking a newer permission request', async () => {
  const older = deferred(), newer = deferred()
  let requests = 0
  const subject = setup({ request: () => (++requests === 1 ? older : newer).promise })
  await subject.flow.show()
  const first = subject.flow.allow()
  subject.flow.hide()
  await subject.flow.show()
  const second = subject.flow.allow()
  older.reject(new Error('Microphone permission was denied.'))
  assert.equal(await first, false)
  assert.equal(subject.state.requesting, true)
  assert.equal(subject.state.error, '')
  newer.resolve('granted')
  assert.equal(await second, true)
  assert.equal(subject.calls.navigate, 1)
})

test('account change invalidates a permission result even before the reactive watcher runs', async () => {
  const permission = deferred(), subject = setup({ request: () => permission.promise })
  await subject.flow.show()
  const pending = subject.flow.allow()
  subject.owner('account-b')
  const snapshot = structuredClone(subject.state)
  permission.resolve('granted')
  assert.equal(await pending, false)
  assert.deepEqual(subject.state, snapshot)
  assert.equal(subject.calls.navigate, 0)
  await subject.flow.context_changed()
  assert.equal(subject.state.requesting, false)
  assert.equal(subject.state.status, 'not_requested')
})

test('a late initial status read cannot overwrite the newer grant result', async () => {
  const read = deferred(), navigation = deferred()
  const subject = setup({ read: () => read.promise, navigate: () => navigation.promise })
  const shown = subject.flow.show()
  const pending = subject.flow.allow()
  await Promise.resolve(); await Promise.resolve()
  assert.equal(subject.state.status, 'granted')
  read.resolve({ microphone: 'denied' })
  await shown
  assert.equal(subject.state.status, 'granted')
  navigation.resolve()
  assert.equal(await pending, true)
})

test('account change and hidden-page refresh suppress older status and settings errors', async () => {
  const read = deferred(), settings = deferred()
  let reads = 0
  const subject = setup({ read: () => ++reads === 1 ? read.promise : Promise.resolve({ microphone: 'denied' }), open_settings: () => settings.promise })
  const first = subject.flow.show()
  subject.owner('account-b')
  await subject.flow.context_changed()
  read.resolve({ microphone: 'granted' })
  await first
  assert.equal(subject.state.status, 'denied')
  const opening = subject.flow.settings()
  subject.flow.hide()
  const snapshot = structuredClone(subject.state)
  await subject.flow.context_changed()
  settings.reject(new Error('Settings are unavailable.'))
  assert.equal(await opening, false)
  assert.deepEqual(subject.state, snapshot)
})
