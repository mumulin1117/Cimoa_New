import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_startup_handoff } from '../src/utils/startupHandoff.js'
import { create_host_bridge } from '../src/utils/hostBridge.js'
import { MOTION } from '../src/config/navigation.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const microtasks = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail }); return { promise, resolve, reject } }
function harness({ native = true, splash = false, fonts = Promise.resolve(), animations = [], request } = {}) {
  let sequence = 0, requests = 0, cancelled_frames = 0
  const frames = new Map(), listeners = new Map()
  const document = { fonts: { ready: fonts }, visibilityState: 'visible', addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type) } }
  const element = { isConnected: true, closest: () => splash ? {} : null, getAnimations: () => animations }
  const controller = create_startup_handoff({ get_document: () => document, available: () => native,
    request: () => { requests++; return request ? request() : Promise.resolve({ finished: true }) },
    request_frame: callback => { const id = ++sequence; frames.set(id, callback); return id },
    cancel_frame: id => { if (frames.delete(id)) cancelled_frames++ },
  })
  const next_frame = async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); await microtasks() }
  return { controller, document, element, frames, listeners, next_frame, requests: () => requests, cancelled_frames: () => cancelled_frames }
}

test('ordinary browser and initial Splash do not dispatch or schedule a handoff', async () => {
  const browser = harness({ native: false })
  assert.deepEqual(await browser.controller.start(browser.element), { requested: false, reason: 'browser' })
  assert.equal(browser.requests(), 0); assert.equal(browser.frames.size, 0); assert.equal(browser.listeners.size, 0)
  const splash = harness({ splash: true })
  assert.deepEqual(await splash.controller.start(splash.element), { requested: false, reason: 'splash' })
  assert.equal(splash.requests(), 0); assert.equal(splash.frames.size, 0)
  const pending = splash.controller.start(splash.element, { allow_splash: true })
  await microtasks(); await splash.next_frame(); await splash.next_frame()
  assert.deepEqual(await pending, { requested: true })
  assert.equal(splash.requests(), 1)
})

test('native release waits for fonts, its finite entry animation and two distinct paint frames', async () => {
  const font = deferred(), entry = deferred()
  const h = harness({ fonts: font.promise, animations: [
    { effect: { getComputedTiming: () => ({ iterations: 1, endTime: 240 }) }, finished: entry.promise },
    { effect: { getComputedTiming: () => ({ iterations: Infinity, endTime: Infinity }) }, get finished() { throw Error('Infinite motion must never be awaited') } },
  ] })
  const pending = h.controller.start(h.element)
  assert.strictEqual(h.controller.start(h.element), pending, 'Mounted and shown hooks share the same in-flight handoff')
  await microtasks(); assert.equal(h.frames.size, 0); assert.equal(h.requests(), 0)
  font.resolve(); await microtasks(); assert.equal(h.frames.size, 0); assert.equal(h.requests(), 0)
  entry.resolve(); await microtasks(); assert.equal(h.frames.size, 1)
  await h.next_frame(); assert.equal(h.frames.size, 1); assert.equal(h.requests(), 0)
  await h.next_frame(); assert.deepEqual(await pending, { requested: true })
  assert.equal(h.requests(), 1); assert.equal(h.frames.size, 0); assert.equal(h.listeners.size, 0)
  assert.deepEqual(await h.controller.start(h.element), { requested: false, reason: 'complete' })
  const other = create_startup_handoff({ get_document: () => h.document, available: () => true, request: () => { throw Error('Later pages must not release launch again') } })
  assert.deepEqual(await other.start(h.element), { requested: false, reason: 'complete' })
})

test('cancel settles callers waiting on fonts or paint and allows a real later target', async () => {
  const font = deferred(), h = harness({ fonts: font.promise })
  const first = h.controller.start(h.element)
  h.controller.cancel(); assert.deepEqual(await first, { requested: false, reason: 'cancelled' })
  assert.equal(h.listeners.size, 0)
  font.resolve(); await microtasks(); assert.equal(h.requests(), 0); assert.equal(h.frames.size, 0)
  const next = h.controller.start(h.element)
  await microtasks(); assert.equal(h.frames.size, 1)
  h.controller.cancel(); assert.deepEqual(await next, { requested: false, reason: 'cancelled' })
  assert.equal(h.cancelled_frames(), 1); assert.equal(h.frames.size, 0)
  const last = h.controller.start(h.element)
  await microtasks(); await h.next_frame(); await h.next_frame()
  assert.deepEqual(await last, { requested: true }); assert.equal(h.requests(), 1)
})

test('hidden or removed targets cannot reveal launch and cancelled animations do not block readiness', async () => {
  const hidden = harness(), pending = hidden.controller.start(hidden.element)
  await microtasks(); hidden.document.visibilityState = 'hidden'; hidden.listeners.get('visibilitychange')()
  assert.deepEqual(await pending, { requested: false, reason: 'cancelled' }); assert.equal(hidden.frames.size, 0); assert.equal(hidden.requests(), 0)
  const removed = harness(), removed_pending = removed.controller.start(removed.element)
  await microtasks(); removed.element.isConnected = false; await removed.next_frame()
  assert.deepEqual(await removed_pending, { requested: false, reason: 'not-visible' }); assert.equal(removed.requests(), 0)
  const interrupted = deferred(), cancelled = harness({ animations: [{ effect: { getComputedTiming: () => ({ iterations: 1, endTime: 240 }) }, finished: interrupted.promise }] })
  const ready = cancelled.controller.start(cancelled.element)
  await microtasks(); interrupted.reject(Error('Entry animation was cancelled')); await microtasks(); await cancelled.next_frame(); await cancelled.next_frame()
  assert.deepEqual(await ready, { requested: true })
})

test('unmount cancels an already dispatched bridge request and removes its timeout', async () => {
  let payload, resolve_native, timer_id = 0
  const timers = new Map()
  const bridge = create_host_bridge({ timers: { setTimeout: callback => { const id = ++timer_id; timers.set(id, callback); return id }, clearTimeout: id => timers.delete(id) },
    send: value => { payload = value; return new Promise(resolve => { resolve_native = resolve }) },
  })
  const h = harness({ request: () => bridge.request('finishLaunch') }), pending = h.controller.start(h.element)
  await microtasks(); await h.next_frame(); await h.next_frame()
  assert.equal(payload.method, 'finishLaunch'); assert.deepEqual(Object.keys(payload).sort(), ['method', 'request_id', 'version'])
  assert.equal(timers.size, 1)
  h.controller.cancel(); assert.deepEqual(await pending, { requested: false, reason: 'cancelled' }); assert.equal(timers.size, 0)
  resolve_native({ version: 1, request_id: payload.request_id, success: true, result: {} })
  await microtasks(); assert.equal(h.requests(), 1)
  const retry = h.controller.start(h.element)
  await microtasks(); await h.next_frame(); await h.next_frame()
  assert.equal(h.requests(), 2)
  resolve_native({ version: 1, request_id: payload.request_id, success: true, result: {} })
  assert.deepEqual(await retry, { requested: true }); assert.equal(timers.size, 0)
})

test('host errors remain non-blocking and cannot mark a failed handoff completed', async () => {
  const h = harness({ request: () => Promise.reject(Error('Native unavailable')) })
  const pending = h.controller.start(h.element)
  await microtasks(); await h.next_frame(); await h.next_frame()
  assert.deepEqual(await pending, { requested: false, reason: 'host-unavailable' }); assert.equal(h.listeners.size, 0)
  const retry = h.controller.start(h.element)
  await microtasks(); await h.next_frame(); await h.next_frame()
  assert.deepEqual(await retry, { requested: false, reason: 'host-unavailable' }); assert.equal(h.requests(), 2)
})

test('Splash preserves geometry, theme, session routing and timing while making motion visible', () => {
  const splash = read('src/pages/auth/splash.vue'), transition = read('src/components/PageTransition.vue')
  assert.equal(MOTION.splash, 1800); assert.equal(MOTION.splash_progress, 1500)
  assert.match(splash, /width: 286\.26rpx; height: 7\.634rpx/)
  assert.match(splash, /width: 122\.137rpx/)
  assert.match(splash, /background: var\(--cimoa-gradient-primary\)/)
  assert.match(splash, /transform-origin: left center/); assert.match(splash, /opacity: 1/)
  assert.match(splash, /scaleX\(\.2\)/); assert.match(splash, /scaleX\(2\.1\)/)
  assert.match(splash, /animation-play-state: paused/); assert.match(splash, /animation-play-state: running/)
  assert.match(splash, /prefers-reduced-motion: reduce[\s\S]*animation: none/)
  assert.match(splash, /if \(pending \|\| !active\) return/)
  assert.match(splash, /timer = setTimeout\(proceed, MOTION\.splash\)/)
  assert.match(splash, /navigate_replace\(store\.has_app_consent \? destination : '\/pages\/auth\/welcome'\)/)
  assert.match(splash, /if \(active\) void transition\.value\?\.finish_startup_handoff\(\)/)
  assert.match(transition, /onMounted\(\(\) => \{[\s\S]*document\.addEventListener\('visibilitychange', visibility_changed\)[\s\S]*void prepare_startup_handoff\(\)/)
  const hidden = transition.match(/onHide\(\(\) => \{([^}]+)\}\)/)?.[1]
  assert.ok(hidden, 'page hiding owns startup and pending navigation cleanup')
  assert.match(hidden, /active = false/)
  assert.match(hidden, /settled\.value = true/)
  assert.match(hidden, /presentation\+\+/)
  assert.match(hidden, /cancel_pending\(\)/)
  assert.match(hidden, /startup_handoff\.cancel\(\)/)
  assert.match(transition, /if \(!active \|\| disposed\) return/)
  assert.match(transition, /if \(active && !disposed && document\.visibilityState !== 'hidden'\) void prepare_startup_handoff\(\)/)
  assert.match(transition, /onUnmounted\([\s\S]*disposed = true; active = false;[\s\S]*document\.removeEventListener\('visibilitychange', visibility_changed\)/)
  assert.match(transition, /startup_handoff\.cancel\(\)/)
  assert.match(transition, /animation: page-rise var\(--page-duration\) ease both/)
  assert.doesNotMatch(read('src/utils/startupHandoff.js'), /\b(?:setTimeout|setInterval|localStorage|indexedDB|hydrate|create_seed)\b/)
})

test('iOS packaging emits shared startup motion inside the encrypted H5 resources', () => {
  const script = read('scripts/package-ios.mjs')
  assert.match(script, /import \{ MOTION \} from '\.\.\/src\/config\/navigation\.js'/)
  const motion = script.indexOf("'startup-motion.json'"), entries = script.indexOf('const entries = academicFiles.map'), packaging = script.indexOf('campusOrientationEngine(academicFiles)')
  assert.ok(motion >= 0 && entries > motion && packaging > entries)
  assert.equal(MOTION.startup_handoff, 240)
  assert.match(script, /progress_ms: MOTION\.splash_progress, handoff_ms: MOTION\.startup_handoff/)
  assert.doesNotMatch(script, /handoff_ms:\s*MOTION\.page\b/)
  assert.match(script, /compression_layers: 2, encryption: 'AES-256-GCM'/)
})
