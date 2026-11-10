import test from 'node:test'
import assert from 'node:assert/strict'
import { create_auth_keyboard_handoff } from '../src/utils/authKeyboard.js'

const microtasks = async () => { for (let index = 0; index < 4; index++) await Promise.resolve() }
const result_of = promise => {
  const state = { status: 'pending', result: null }
  promise.then(result => { state.status = 'settled'; state.result = result })
  return state
}
const event_target = () => {
  const events = new Map()
  return {
    addEventListener(type, callback) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(callback) },
    removeEventListener(type, callback) { events.get(type)?.delete(callback) },
    emit(type, event = {}) { for (const callback of [...events.get(type) || []]) callback(event) },
    listener_count() { return [...events.values()].reduce((sum, rows) => sum + rows.size, 0) },
  }
}
function harness({ viewport_available = true, initially_focused = false, layout_height = 840, viewport_height = 840 } = {}) {
  const viewport = { ...event_target(), height: viewport_height, width: 390, offsetTop: 0, scale: 1 }
  const doc = { ...event_target(), activeElement: { tagName: 'BODY' }, visibilityState: 'visible', hidden: false, documentElement: { clientHeight: layout_height } }
  const win = { ...event_target(), visualViewport: viewport_available ? viewport : null, innerHeight: layout_height }
  const timers = new Map(), frames = new Map()
  let sequence = 0, hide_count = 0
  const input = (tagName = 'INPUT', type = 'text') => ({
    tagName, type, blur_count: 0,
    blur() { this.blur_count++; doc.activeElement = { tagName: 'BODY' }; doc.emit('focusout', { target: this }) },
  })
  const first = input()
  if (initially_focused) doc.activeElement = first
  const handoff = create_auth_keyboard_handoff({
    get_document: () => doc, get_window: () => win,
    hide_keyboard: () => { hide_count++ },
    schedule: (callback, duration) => { const id = ++sequence; timers.set(id, { callback, duration }); return id },
    cancel_timer: id => timers.delete(id),
    request_frame: callback => { const id = ++sequence; frames.set(id, callback); return id },
    cancel_frame: id => frames.delete(id),
    timeout_ms: 1200,
  })
  const focus = node => { doc.activeElement = node; doc.emit('focusin', { target: node }) }
  const resize = (height, top = 0) => { viewport.height = height; viewport.offsetTop = top; viewport.emit('resize') }
  const frame = async () => {
    const callbacks = [...frames.values()]; frames.clear()
    callbacks.forEach(callback => callback())
    await microtasks()
  }
  const close = async () => { resize(layout_height); for (let index = 0; index < 4; index++) await frame() }
  const expire = async () => {
    const callbacks = [...timers.values()]; timers.clear()
    callbacks.forEach(({ callback }) => callback())
    await microtasks()
  }
  return { handoff, viewport, doc, win, first, input, focus, resize, frame, close, expire, timers, frames, hide_count: () => hide_count }
}

test('no edit or measured keyboard passes synchronously without timer, blur, or platform call', async () => {
  const h = harness()
  assert.deepEqual(await h.handoff.prepare(), { ready: true, reason: 'no-keyboard' })
  assert.equal(h.hide_count(), 0)
  assert.equal(h.timers.size, 0)
  assert.equal(h.frames.size, 0)
  h.handoff.dispose()
})

test('delayed iOS resize cannot be mistaken for a closed keyboard after two stationary frames', async () => {
  const h = harness()
  h.focus(h.first); h.resize(470, 12)
  const pending = h.handoff.prepare(), result = result_of(pending)
  assert.equal(h.first.blur_count, 1)
  assert.equal(h.hide_count(), 1)
  for (let index = 0; index < 12; index++) await h.frame()
  assert.equal(result.status, 'pending', 'Blur precedes the actual closing animation; short stable frames are not closure')
  h.resize(565, 6); await h.frame(); await h.frame()
  assert.equal(result.status, 'pending')
  h.resize(730); await h.frame(); await h.frame()
  assert.equal(result.status, 'pending', 'Intermediate close animation frames cannot permit navigation')
  await h.close()
  assert.deepEqual(await pending, { ready: true, reason: 'closed' })
  assert.equal(h.timers.size, 0)
  assert.equal(h.frames.size, 0)
  h.handoff.dispose()
})

test('same in-flight handoff coalesces and calls native close once', async () => {
  const h = harness()
  h.focus(h.first); h.resize(480)
  const first = h.handoff.prepare(), repeated = h.handoff.prepare()
  assert.strictEqual(repeated, first)
  assert.equal(h.hide_count(), 1)
  await h.close()
  assert.equal((await first).ready, true)
  h.handoff.dispose()
})

test('hardware keyboard and missing visualViewport do not introduce a cosmetic wait', async () => {
  const h = harness({ viewport_available: false })
  h.focus(h.first)
  assert.deepEqual(await h.handoff.prepare(), { ready: true, reason: 'unobservable' })
  assert.equal(h.first.blur_count, 1)
  assert.equal(h.hide_count(), 1)
  assert.equal(h.timers.size, 0)
  assert.equal(h.frames.size, 0)
  h.handoff.dispose()
})

test('missing resize events use the finite observation deadline but do not assert a still-open keyboard is closed', async () => {
  const h = harness()
  h.focus(h.first); h.resize(480)
  const pending = h.handoff.prepare()
  assert.equal([...h.timers.values()][0].duration, 1200)
  await h.expire()
  assert.deepEqual(await pending, { ready: false, reason: 'observation-timeout' })
  assert.equal(h.frames.size, 0)
  assert.deepEqual(h.handoff.state(), { phase: 'cancelled', pending: false })
  h.resize(840)
  assert.equal((await h.handoff.prepare()).ready, true, 'A real later close permits a fresh attempt')
  h.handoff.dispose()
})

test('closed measurements at the observation deadline can complete without retaining a stale lock', async () => {
  const h = harness()
  h.focus(h.first); h.resize(480)
  const pending = h.handoff.prepare()
  h.viewport.height = 840 // Platform value updated but resize/rAF delivery was lost.
  await h.expire()
  assert.deepEqual(await pending, { ready: true, reason: 'observation-timeout' })
  assert.equal(h.frames.size, 0)
  h.handoff.dispose()
})

test('new editing intent cancels prior handoff and late resize cannot navigate it', async () => {
  const h = harness()
  h.focus(h.first); h.resize(480)
  const pending = h.handoff.prepare(), next = h.input('TEXTAREA')
  h.focus(next)
  assert.deepEqual(await pending, { ready: false, reason: 'refocused' })
  assert.strictEqual(h.doc.activeElement, next, 'No global input or selection interception is installed')
  assert.equal(next.blur_count, 0)
  assert.equal(h.frames.size, 0)
  assert.equal(h.timers.size, 0)
  await h.close()
  assert.deepEqual(h.handoff.state(), { phase: 'cancelled', pending: false })
  h.handoff.dispose()
})

test('background and page hiding settle cancellation, clear pending work and allow later retry', async () => {
  const h = harness()
  h.focus(h.first); h.resize(480)
  const pending = h.handoff.prepare()
  h.doc.hidden = true; h.doc.visibilityState = 'hidden'; h.doc.emit('visibilitychange')
  assert.deepEqual(await pending, { ready: false, reason: 'hidden' })
  assert.equal(h.frames.size, 0)
  assert.equal(h.timers.size, 0)
  assert.deepEqual(await h.handoff.prepare(), { ready: false, reason: 'hidden' })
  h.doc.hidden = false; h.doc.visibilityState = 'visible'; h.doc.emit('visibilitychange')
  const retried = h.handoff.prepare()
  h.win.emit('pagehide')
  assert.deepEqual(await retried, { ready: false, reason: 'page-hidden' })
  h.handoff.dispose()
})

test('explicit page cancellation and disposal clear every listener, timer and animation callback', async () => {
  const h = harness()
  h.focus(h.first); h.resize(480)
  const cancelled = h.handoff.prepare()
  h.handoff.cancel('page-hidden')
  assert.deepEqual(await cancelled, { ready: false, reason: 'page-hidden' })
  const disposed = h.handoff.prepare()
  h.handoff.dispose(); h.handoff.dispose()
  assert.deepEqual(await disposed, { ready: false, reason: 'disposed' })
  assert.equal(h.frames.size, 0)
  assert.equal(h.timers.size, 0)
  assert.equal(h.doc.listener_count() + h.win.listener_count() + h.viewport.listener_count(), 0)
  assert.deepEqual(await h.handoff.prepare(), { ready: false, reason: 'disposed' })
})

test('real layout height can recover closure geometry if component was created with keyboard already open', async () => {
  const h = harness({ initially_focused: true, viewport_height: 480 })
  const pending = h.handoff.prepare(), result = result_of(pending)
  await h.frame(); await h.frame(); await h.frame()
  assert.equal(result.status, 'pending')
  await h.close()
  assert.deepEqual(await pending, { ready: true, reason: 'closed' })
  h.handoff.dispose()
})

test('mounting after blur does not learn a still-short visual viewport as the closed baseline', async () => {
  const h = harness({ viewport_height: 480, layout_height: 840 })
  const pending = h.handoff.prepare(), result = result_of(pending)
  assert.equal(h.hide_count(), 1, 'A measured native keyboard inset is handled even after focus already left')
  for (let index = 0; index < 6; index++) await h.frame()
  assert.equal(result.status, 'pending', 'The initial short but unfocused geometry is not proof of closure')
  h.resize(650); await h.frame(); await h.frame(); await h.frame()
  assert.equal(result.status, 'pending')
  await h.close()
  assert.deepEqual(await pending, { ready: true, reason: 'closed' })
  assert.equal(h.timers.size, 0)
  assert.equal(h.frames.size, 0)
  h.handoff.dispose()
  assert.equal(h.doc.listener_count() + h.win.listener_count() + h.viewport.listener_count(), 0)
})

test('a post-blur short initial viewport times out safely and can be cancelled without leaking work', async () => {
  const h = harness({ viewport_height: 480, layout_height: 840 })
  const pending = h.handoff.prepare()
  await h.expire()
  assert.deepEqual(await pending, { ready: false, reason: 'observation-timeout' })
  assert.equal(h.timers.size, 0)
  assert.equal(h.frames.size, 0)
  const retry = h.handoff.prepare()
  h.handoff.cancel('page-hidden')
  assert.deepEqual(await retry, { ready: false, reason: 'page-hidden' })
  assert.equal(h.timers.size, 0)
  assert.equal(h.frames.size, 0)
  h.handoff.dispose()
  assert.equal(h.doc.listener_count() + h.win.listener_count() + h.viewport.listener_count(), 0)
})

test('unknown initial keyboard geometry cannot be declared closed using unchanged short frames', async () => {
  const h = harness({ initially_focused: true, viewport_height: 480, layout_height: 480 })
  const pending = h.handoff.prepare(), result = result_of(pending)
  for (let index = 0; index < 5; index++) await h.frame()
  assert.equal(result.status, 'pending')
  await h.expire()
  assert.deepEqual(await pending, { ready: false, reason: 'observation-timeout' })
  h.handoff.dispose()
})

test('orientation or viewport scale changes cancel instead of navigating against invalid keyboard geometry', async () => {
  const h = harness()
  h.focus(h.first); h.resize(480)
  const pending = h.handoff.prepare()
  h.viewport.width = 680; h.viewport.height = 390
  await h.frame()
  assert.deepEqual(await pending, { ready: false, reason: 'layout-changed' })
  assert.equal(h.frames.size, 0)
  h.handoff.dispose()
})

test('validation callers that do not prepare preserve active input and its editing behavior', () => {
  const h = harness()
  h.focus(h.first); h.resize(480)
  h.doc.emit('selectionchange'); h.doc.emit('beforeinput'); h.doc.emit('paste')
  assert.strictEqual(h.doc.activeElement, h.first)
  assert.equal(h.first.blur_count, 0)
  assert.equal(h.hide_count(), 0)
  assert.equal(h.frames.size, 0)
  assert.equal(h.timers.size, 0)
  h.handoff.dispose()
})
