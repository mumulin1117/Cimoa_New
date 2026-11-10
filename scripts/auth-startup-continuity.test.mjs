import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_startup_handoff, create_startup_reveal_settler } from '../src/utils/startupHandoff.js'
import { MOTION } from '../src/config/navigation.js'

const source = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const microtasks = async () => { for (let i = 0; i < 14; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const animation = finished => ({ effect: { getComputedTiming: () => ({ iterations: 1, endTime: 240 }) }, finished })
function fixture() {
  const listeners = new Map(), frames = new Map(), acknowledgment = deferred(), reveals = []
  let sequence = 0, requests = 0
  const document = { visibilityState: 'visible', fonts: { ready: Promise.resolve() }, addEventListener(type, listener) { listeners.set(`document:${type}`, listener) }, removeEventListener(type, listener) { if (listeners.get(`document:${type}`) === listener) listeners.delete(`document:${type}`) } }
  const window = { location: { href: 'http://127.0.0.1:47813/index.html?launch=current-attempt' }, addEventListener(type, listener) { listeners.set(type, listener) }, removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type) } }
  const element = { isConnected: true, closest: () => null, getAnimations: () => [] }
  const handoff = create_startup_handoff({ get_document: () => document, get_window: () => window, available: () => true, browser_ready: true, request: () => { requests++; return acknowledgment.promise }, on_reveal: () => reveals.push('revealed'), request_frame: callback => { const id = ++sequence; frames.set(id, callback); return id }, cancel_frame: id => frames.delete(id) })
  const frame = async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); await microtasks() }
  const emit = attempt => listeners.get('cimoa:launch-reveal')?.({ detail: { attempt } })
  return { handoff, document, element, acknowledgment, reveals, listeners, frame, emit, requests: () => requests }
}

test('cold static frame asks the host after real fonts/paint, then reveals once during the trusted cover fade', async () => {
  const h = fixture(), pending = h.handoff.start(h.element)
  await microtasks(); await h.frame(); assert.equal(h.requests(), 0)
  await h.frame(); assert.equal(h.requests(), 1)
  h.emit('stale-attempt'); assert.deepEqual(h.reveals, [])
  h.emit('current-attempt'); h.emit('current-attempt'); assert.deepEqual(h.reveals, ['revealed'])
  let resolved = false; pending.then(() => { resolved = true }); await microtasks(); assert.equal(resolved, false)
  h.acknowledgment.resolve({ ready: true }); assert.deepEqual(await pending, { requested: true })
  assert.deepEqual(h.reveals, ['revealed']); assert.equal(h.listeners.size, 0)
  const warm = h.handoff.start(h.element); await microtasks(); await h.frame(); await h.frame()
  assert.deepEqual(await warm, { requested: false, reason: 'complete' }); assert.equal(h.requests(), 1)
})

test('background cancellation cannot lose the only reveal or replay an already revealed entrance', async () => {
  for (const saw_reveal of [false, true]) {
    const h = fixture(), pending = h.handoff.start(h.element)
    await microtasks(); await h.frame(); await h.frame()
    if (saw_reveal) h.emit('current-attempt')
    h.document.visibilityState = 'hidden'; h.listeners.get('document:visibilitychange')()
    assert.deepEqual(await pending, { requested: false, reason: 'cancelled' })
    h.document.visibilityState = 'visible'
    const restored = h.handoff.start(h.element)
    await microtasks(); await h.frame(); await h.frame()
    h.acknowledgment.resolve({ ready: true }); assert.deepEqual(await restored, { requested: true })
    assert.deepEqual(h.reveals, ['revealed']); assert.equal(h.listeners.size, 0)
  }
})

test('EULA presentation observes real finite reveal animations, not infinite media or another timeout', async () => {
  const copy = deferred(), halo = deferred(), listeners = new Map()
  const document = { visibilityState: 'visible', addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: type => listeners.delete(type) }
  const settler = create_startup_reveal_settler({ get_document: () => document })
  const element = { isConnected: true, querySelectorAll(selector) { assert.equal(selector, '[data-startup-reveal]'); return [{ getAnimations: () => [animation(copy.promise), { effect: { getComputedTiming: () => ({ iterations: Infinity, endTime: Infinity }) }, get finished() { throw Error('An infinite accent must never gate EULA') } }] }, { getAnimations: () => [animation(halo.promise)] }] } }
  const pending = settler.wait(element); assert.strictEqual(settler.wait(element), pending)
  let complete = false; pending.then(() => { complete = true }); copy.resolve(); await microtasks(); assert.equal(complete, false)
  halo.resolve(); assert.equal(await pending, true); assert.equal(listeners.size, 0)
  assert.doesNotMatch(source('src/utils/startupHandoff.js'), /\b(?:setTimeout|setInterval)\b/)
})

test('cancelled, detached and hidden entrances settle without a late consent frame and can restore', async () => {
  const child = deferred(), listeners = new Map()
  const document = { visibilityState: 'visible', addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: type => listeners.delete(type) }
  const settler = create_startup_reveal_settler({ get_document: () => document })
  const element = { isConnected: true, querySelectorAll: () => [{ getAnimations: () => [animation(child.promise)] }] }
  const first = settler.wait(element); document.visibilityState = 'hidden'; listeners.get('visibilitychange')()
  assert.equal(await first, false); assert.equal(listeners.size, 0)
  child.resolve(); await microtasks(); document.visibilityState = 'visible'
  assert.equal(await settler.wait(element), true)
  element.isConnected = false; assert.equal(await settler.wait(element), false)
  element.isConnected = true; const cancelled = settler.wait(element); settler.cancel(); assert.equal(await cancelled, false)
  assert.equal(listeners.size, 0)
})

test('welcome/native presentation retains the precise timings, Retry and host readiness boundary', () => {
  assert.equal(MOTION.splash, 1800); assert.equal(MOTION.startup_handoff, 240); assert.equal(MOTION.skeleton, 600)
  const welcome = source('src/pages/auth/welcome.vue'), swift = source('ios/cimoaNeapo/Sources/WebViewController.swift')
  assert.match(welcome, /MOTION\.startup_handoff/)
  assert.match(welcome, /data-startup-story='cold'\] :deep\(\.page-transition\) \{ animation: none; opacity: 1; transform: none;/)
  assert.match(welcome, /await nextTick\(\)[\s\S]*await reveal_settler\.wait\(frame\.value\?\.\$el\)/)
  assert.match(welcome, /if \(!settled \|\| !visible \|\| token !== presentation\) return/)
  assert.match(welcome, /Retry photo/); assert.doesNotMatch(welcome, /setTimeout|await campus_preload\.start/)
  assert.match(welcome, /animation-play-state: paused/); assert.match(welcome, /prefers-reduced-motion: reduce/)
  assert.match(source('scripts/package-ios.mjs'), /handoff_ms: MOTION\.startup_handoff/)
  for (const boundary of [/message\.frameInfo\.isMainFrame/, /attemptInURL\(message\.frameInfo\.request\.url\) == attempt/, /document\.fonts\?\.status!==\'loaded\'/, /getComputedStyle\(frame\)\.opacity<\.99/, /startupCover\.beginHandoff\(duration: startupMotion\.handoff/, /if !handoffStarted, progressGradient\.animation/, /visibleScale.*presentation\(\)\?\.transform\.m11/, /closing\.duration = duration/]) assert.match(swift, boundary)
  assert.doesNotMatch(swift, /toValue = (?:100|1\.0)\b/)
})
