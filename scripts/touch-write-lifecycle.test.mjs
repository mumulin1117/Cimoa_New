import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_write_operation } from '../src/utils/writeOperation.js'
import { fake_clock } from './lib/fake-clock.mjs'

const deferred = () => { let resolve; const promise = new Promise(finish => { resolve = finish }); return { promise, resolve } }
const flush = async () => { for (let index = 0; index < 6; index++) await Promise.resolve() }
const events = () => {
  const listeners = new Map()
  return {
    visibilityState: 'visible',
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler) },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler) },
    emit(name) { for (const handler of [...(listeners.get(name) || [])]) handler() },
    count() { return [...listeners.values()].reduce((total, handlers) => total + handlers.size, 0) },
  }
}
const composable_source = fs.readFileSync(new URL('../src/composables/useWriteLoading.js', import.meta.url), 'utf8')
const instantiate_composable = new Function('onUnmounted', 'ref', 'onHide', 'onShow', 'create_write_operation', 'globalThis', `${composable_source.replace(/^import .*$/gm, '').replace('export const use_write_loading', 'const use_write_loading')}\nreturn use_write_loading()`)
const component = (clock, document = events(), window = events()) => {
  const hooks = { hide: [], show: [], unmount: [] }
  const value = instantiate_composable(handler => hooks.unmount.push(handler), value => ({ value }), handler => hooks.hide.push(handler), handler => hooks.show.push(handler), options => create_write_operation({ ...options, timers: clock }), { document, window })
  return { ...value, document, window, hide: () => hooks.hide.forEach(handler => handler()), show: () => hooks.show.forEach(handler => handler()), unmount: () => hooks.unmount.forEach(handler => handler()) }
}

test('rapid taps reserve busy synchronously and execute one write after the existing 500ms wait', async () => {
  const clock = fake_clock(), states = []
  let writes = 0
  const operation = create_write_operation({ timers: clock, set_loading: value => states.push(value) })
  const first = operation.run(() => { writes++; return { success: true } })
  for (let index = 0; index < 20; index++) assert.deepEqual(await operation.run(() => { writes++ }), { success: false, reason: 'busy' })
  await clock.advance(499); assert.equal(writes, 0)
  await clock.advance(1); assert.equal((await first).success, true)
  assert.equal(writes, 1); assert.deepEqual(states, [true, false]); assert.equal(clock.pending(), 0)
})

test('a synchronous Loading watcher cannot reenter before the operation owns its busy lock', async () => {
  const clock = fake_clock()
  let operation, repeated, writes = 0
  operation = create_write_operation({ timers: clock, set_loading(value) { if (value) repeated = operation.run(() => { writes++ }) } })
  const pending = operation.run(() => { writes++; return { success: true } })
  assert.equal((await repeated).reason, 'busy')
  await clock.advance(500); assert.equal((await pending).success, true); assert.equal(writes, 1)
})

test('cancellation by a synchronous Loading watcher settles without scheduling a delayed write', async () => {
  const clock = fake_clock()
  let operation, writes = 0
  operation = create_write_operation({ timers: clock, set_loading(value) { if (value) operation.cancel() } })
  assert.deepEqual(await operation.run(() => { writes++ }), { success: false, reason: 'cancelled' })
  await clock.advance(1000); assert.equal(writes, 0); assert.equal(clock.pending(), 0)
})

test('queued timer callbacks cannot execute cancelled writes even if WebKit already queued them', async () => {
  let callback, cleared = 0, writes = 0
  const operation = create_write_operation({ timers: { setTimeout(fn) { callback = fn; return 7 }, clearTimeout(id) { assert.equal(id, 7); cleared++ } } })
  const pending = operation.run(() => { writes++ })
  operation.cancel(); assert.equal((await pending).reason, 'cancelled')
  await callback(); assert.equal(writes, 0); assert.equal(cleared, 1)
})

test('the 400–600ms contract and a valid default survive invalid requested durations', async () => {
  for (const [duration, expected] of [[1, 400], [700, 600], [NaN, 500], [Infinity, 500]]) {
    const clock = fake_clock()
    let writes = 0
    const operation = create_write_operation({ timers: clock }), pending = operation.run(() => { writes++; return { success: true } }, duration)
    await clock.advance(expected - 1); assert.equal(writes, 0)
    await clock.advance(1); assert.equal((await pending).success, true); assert.equal(writes, 1)
  }
})

test('busy remains set for the actual asynchronous action, not just for the presentation delay', async () => {
  const clock = fake_clock(), result = deferred(), states = []
  const operation = create_write_operation({ timers: clock, set_loading: value => states.push(value) })
  const pending = operation.run(() => result.promise)
  await clock.advance(500); assert.deepEqual(states, [true]); assert.equal((await operation.run(() => {})).reason, 'busy')
  result.resolve({ success: true }); await flush()
  assert.equal((await pending).success, true); assert.deepEqual(states, [true, false])
})

test('a cancelled async action loses its Store scope and cannot hide or overwrite a newer operation', async () => {
  const clock = fake_clock(), old_result = deferred(), new_result = deferred(), states = []
  let old_scope, writes = 0
  const operation = create_write_operation({ timers: clock, set_loading: value => states.push(value) })
  const old = operation.run(async scope => { old_scope = scope; await old_result.promise; if (scope.is_current()) writes++; return { success: true } })
  await clock.advance(500); assert.equal(old_scope.is_current(), true)
  operation.cancel(); assert.equal((await old).reason, 'cancelled'); assert.equal(old_scope.is_current(), false)
  const next = operation.run(() => new_result.promise)
  await clock.advance(500); old_result.resolve(); await flush()
  assert.equal(writes, 0); assert.equal(states.at(-1), true); assert.equal((await operation.run(() => {})).reason, 'busy')
  new_result.resolve({ success: true, data: 'current' }); await flush()
  assert.deepEqual(await next, { success: true, data: 'current' }); assert.equal(states.at(-1), false)
})

test('inactive execution cancels both before run and before an already scheduled callback', async () => {
  const clock = fake_clock()
  let active = false, writes = 0
  const operation = create_write_operation({ timers: clock, is_active: () => active })
  assert.equal((await operation.run(() => { writes++ })).reason, 'cancelled'); assert.equal(clock.pending(), 0)
  active = true
  const pending = operation.run(() => { writes++ })
  active = false; await clock.advance(500)
  assert.equal((await pending).reason, 'cancelled'); assert.equal(writes, 0); assert.equal(clock.pending(), 0)
})

test('cancellation does not roll back an atomic commit or attempt to cancel an accepted Apple transaction', async () => {
  const clock = fake_clock(), response = deferred()
  let accepted = false, committed = false
  const operation = create_write_operation({ timers: clock })
  const pending = operation.run(async () => { accepted = true; committed = true; await response.promise; return { success: true } })
  await clock.advance(500); operation.cancel()
  assert.equal((await pending).reason, 'cancelled'); assert.equal(accepted, true); assert.equal(committed, true)
  response.resolve(); await flush(); assert.equal(accepted, true); assert.equal(committed, true)
})

test('non-Error failures become formal feedback and always release the busy state', async () => {
  const clock = fake_clock(), states = []
  const operation = create_write_operation({ timers: clock, set_loading: value => states.push(value) })
  const pending = operation.run(() => { throw null })
  await clock.advance(500)
  assert.deepEqual(await pending, { success: false, reason: 'operation_failed', message: 'This action couldn’t be completed. Please try again.' })
  assert.deepEqual(states, [true, false])
})

test('page hide settles and clears unexecuted writes; show permits a fresh operation only', async () => {
  const clock = fake_clock(), page = component(clock)
  let writes = 0
  const pending = page.run_with_loading(() => { writes++ })
  page.hide(); assert.equal((await pending).reason, 'cancelled'); assert.equal(page.is_loading.value, false)
  assert.equal((await page.run_with_loading(() => { writes++ })).reason, 'cancelled')
  await clock.advance(1000); assert.equal(writes, 0)
  page.show(); const fresh = page.run_with_loading(() => { writes++; return { success: true } })
  await clock.advance(500); assert.equal((await fresh).success, true); assert.equal(writes, 1)
  page.unmount()
})

test('page hide does not cancel a separate App instance recovery operation', async () => {
  const clock = fake_clock(), document = events(), window = events(), app = component(clock, document, window), page = component(clock, document, window)
  let app_writes = 0, page_writes = 0
  const app_pending = app.run_with_loading(() => { app_writes++; return { success: true } })
  const page_pending = page.run_with_loading(() => { page_writes++ })
  page.hide(); assert.equal((await page_pending).reason, 'cancelled')
  await clock.advance(500); assert.equal((await app_pending).success, true); assert.equal(app_writes, 1); assert.equal(page_writes, 0)
  app.unmount(); page.unmount(); assert.equal(document.count() + window.count(), 0)
})

test('App background visibility and pagehide cancel writes without automatically restarting them', async () => {
  for (const kind of ['visibilitychange', 'pagehide']) {
    const clock = fake_clock(), page = component(clock)
    let writes = 0
    const pending = page.run_with_loading(() => { writes++ })
    if (kind === 'visibilitychange') { page.document.visibilityState = 'hidden'; page.document.emit(kind) } else page.window.emit(kind)
    assert.equal((await pending).reason, 'cancelled'); assert.equal((await page.run_with_loading(() => { writes++ })).reason, 'cancelled')
    await clock.advance(1000); assert.equal(writes, 0); assert.equal(page.is_loading.value, false)
    page.document.visibilityState = 'visible'; page.document.emit('visibilitychange'); page.window.emit('pageshow')
    await clock.advance(1000); assert.equal(writes, 0)
    const fresh = page.run_with_loading(() => ({ success: true }))
    await clock.advance(500); assert.equal((await fresh).success, true)
    page.unmount()
  }
})

test('unmount resolves the caller, removes every listener, and permanently rejects stale callbacks', async () => {
  const clock = fake_clock(), page = component(clock)
  let writes = 0
  assert.equal(page.document.count(), 1); assert.equal(page.window.count(), 2)
  const pending = page.run_with_loading(() => { writes++ })
  page.unmount(); page.unmount()
  assert.equal((await pending).reason, 'cancelled'); assert.equal(page.document.count() + page.window.count(), 0)
  page.show(); page.window.emit('pageshow')
  assert.equal((await page.run_with_loading(() => { writes++ })).reason, 'cancelled')
  await clock.advance(1000); assert.equal(writes, 0); assert.equal(clock.pending(), 0)
})
