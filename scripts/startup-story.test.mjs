import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { authenticated_destination, startup_destination, auth_destination } from '../src/utils/authNavigation.js'
import { MOTION, MAIN_TABS } from '../src/config/navigation.js'
import { create_campus_preloader, CAMPUS_PHOTO } from '../src/utils/startupCampus.js'
import { create_startup_handoff } from '../src/utils/startupHandoff.js'

const now = Date.UTC(2026, 9, 24), read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
function fixture(data = null) {
  let saved = clone_data(data), writes = 0
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(saved), write: (_, value) => { saved = clone_data(value); writes++ } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  return { store, writes: () => writes }
}
const registration = { email: 'startup.member@campus.edu', password: 'Campus1234', confirmation: 'Campus1234', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } }

test('startup story preserves established timings and the source Tab sequence', () => {
  assert.equal(MOTION.splash, 1800); assert.equal(MOTION.page, 240); assert.equal(MOTION.startup_handoff, 240); assert.equal(MOTION.skeleton, 600)
  assert.deepEqual(MAIN_TABS.map(tab => tab.id), ['home', 'discover', 'events'])
  assert.doesNotMatch(read('src/pages/auth/splash.vue'), /run_with_loading|show_toast|navigate_forward/)
})

test('complete authenticated sessions enter Home without creating new business state', () => {
  const { store, writes } = fixture(create_scenario('default', now)), before = clone_data(store.data)
  assert.equal(auth_destination('/pages/discover/index'), '/pages/discover/index')
  assert.equal(auth_destination('/pages/home/index'), '/pages/home/index')
  assert.equal(authenticated_destination(store), '/pages/home/index')
  assert.equal(startup_destination(store), '/pages/home/index')
  assert.deepEqual(clone_data(store.data), before); assert.equal(writes(), 0)
})

test('verification and incomplete profile resume their persisted steps before Home', async () => {
  const { store } = fixture(), registered = await store.register_local_account(registration)
  assert.equal(registered.success, true)
  assert.equal(startup_destination(store), '/pages/auth/verification/code')
  assert.equal((await store.login(registration.email, registration.password)).success, true)
  assert.equal(authenticated_destination(store), '/pages/auth/verification/code')
  assert.equal(store.apply_verification('009789', registered.data.account_id).success, true)
  assert.equal(store.begin_onboarding(registered.data.account_id).success, true)
  assert.equal(authenticated_destination(store), '/pages/onboarding/basic')
  assert.equal((await store.save_onboarding_step('basic', { user_name: 'Campus Member', date_of_birth: registration.date_of_birth, gender: 'Woman', pronouns: 'she / her' }, registered.data.account_id)).success, true)
  assert.equal(startup_destination(store), '/pages/onboarding/uni')
  const restored = fixture(store.data).store
  assert.equal(startup_destination(restored), '/pages/onboarding/uni')
})

test('guest and hydration failure retain honest Welcome and Retry routing', () => {
  const { store, writes } = fixture()
  assert.equal(startup_destination(store), '/pages/auth/welcome'); assert.equal(writes(), 0)
  store.hydration_status = 'error'; store.hydration_error = 'Your information couldn’t be loaded. Please try again.'
  assert.throws(() => startup_destination(store), /couldn’t be loaded/)
})

test('registration completion targets Home while retaining the existing content skeleton preparation', () => {
  const source = read('src/pages/onboarding/complete.vue')
  assert.match(source, /prepare_main_tab_skeleton\(store\.auth_context\)/)
  assert.match(source, /frame\.value\.navigate_relaunch\(AUTHENTICATED_MAIN_ROUTE\)/)
  assert.doesNotMatch(source, /\brelaunch_route\(/)
  for (const file of ['src/pages/auth/verification/code.vue', 'src/pages/auth/reset/code.vue']) assert.doesNotMatch(read(file), /009789|Show code again/)
})

test('campus preparation waits for genuine decode, deduplicates work and consumes its entrance once', async () => {
  let resolve, calls = 0, scheduled = 0
  const timers = new Map(), updates = []
  const preloader = create_campus_preloader({ prepare: source => { calls++; assert.equal(source, CAMPUS_PHOTO); return { ready: new Promise(done => { resolve = done }), cancel() {} } }, schedule: callback => { const id = ++scheduled; timers.set(id, callback); return id }, clear: id => timers.delete(id) })
  const unsubscribe = preloader.subscribe(value => updates.push(value.status))
  preloader.arm(); assert.equal(preloader.consume(), true); assert.equal(preloader.consume(), false)
  const pending = preloader.start()
  assert.equal(preloader.snapshot().status, 'loading'); assert.strictEqual(preloader.start(), pending); assert.equal(calls, 1)
  resolve(true); assert.equal((await pending).status, 'ready'); assert.equal(timers.size, 0)
  await preloader.start(); assert.equal(calls, 1); assert.deepEqual(updates, ['loading', 'ready'])
  unsubscribe(); preloader.cancel()
})

test('campus retry invalidates stale results, cancellation settles pending work and timeout offers an error', async () => {
  const preparations = [], timers = new Map(); let sequence = 0
  const preloader = create_campus_preloader({ prepare: () => { let resolve; const entry = { ready: new Promise(done => { resolve = done }), cancel() { resolve(false) }, resolve: value => resolve(value) }; preparations.push(entry); return entry }, schedule: (callback, ms) => { assert.equal(ms, 10000); const id = ++sequence; timers.set(id, callback); return id }, clear: id => timers.delete(id) })
  const first = preloader.start(), retry = preloader.start({ retry: true })
  assert.equal(preparations.length, 2); await first; assert.equal(preloader.snapshot().status, 'loading')
  preparations[0].resolve(true); await Promise.resolve(); assert.equal(preloader.snapshot().status, 'loading')
  preparations[1].resolve(false); await retry; assert.equal(preloader.snapshot().status, 'error'); assert.equal(timers.size, 0)
  const cancelled = preloader.start({ retry: true }); preloader.cancel(); await cancelled
  assert.equal(preloader.snapshot().status, 'idle'); assert.equal(timers.size, 0)
  const timeout = preloader.start(); const expire = [...timers.values()][0]; expire(); await timeout
  assert.equal(preloader.snapshot().status, 'error'); assert.equal(timers.size, 0)
})

const microtasks = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { resolve, promise } }
function handoff_fixture(native = false) {
  const frames = new Map(), listeners = new Map(), reveals = []; let sequence = 0, requests = 0
  const response = deferred(), fonts = deferred(), entry = deferred()
  const document = { fonts: { ready: fonts.promise }, visibilityState: 'visible', addEventListener(type, callback) { listeners.set(`document:${type}`, callback) }, removeEventListener(type) { listeners.delete(`document:${type}`) } }
  const window = { location: { href: 'http://127.0.0.1:47847/index.html?launch=attempt-7' }, addEventListener(type, callback) { listeners.set(type, callback) }, removeEventListener(type) { listeners.delete(type) } }
  const element = { isConnected: true, closest: () => null, getAnimations: () => [{ effect: { getComputedTiming: () => ({ iterations: 1, endTime: 240 }) }, finished: entry.promise }] }
  const handoff = create_startup_handoff({ get_document: () => document, get_window: () => window, available: () => native, browser_ready: true, on_reveal: () => reveals.push('reveal'), request: () => { requests++; return response.promise }, request_frame: callback => { const id = ++sequence; frames.set(id, callback); return id }, cancel_frame: id => frames.delete(id) })
  const frame = async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); await microtasks() }
  return { handoff, document, frames, listeners, reveals, response, fonts, entry, element, frame, requests: () => requests }
}

test('ordinary-browser reveal shares cRise, then waits for paint without native waits or added timers', async () => {
  const h = handoff_fixture(), pending = h.handoff.start(h.element)
  assert.deepEqual(h.reveals, ['reveal']); assert.strictEqual(h.handoff.start(h.element), pending)
  h.fonts.resolve(); await microtasks(); assert.equal(h.frames.size, 0)
  h.entry.resolve(); await microtasks(); await h.frame(); await h.frame()
  assert.deepEqual(await pending, { requested: false, reason: 'browser' }); assert.equal(h.requests(), 0)
  assert.equal(h.listeners.size, 0); assert.equal(h.frames.size, 0)
  const warm = h.handoff.start(h.element); await microtasks(); await h.frame(); await h.frame()
  assert.deepEqual(await warm, { requested: false, reason: 'complete' }); assert.deepEqual(h.reveals, ['reveal'])
})

test('native reveal accepts only the current attempt once and presentation waits for the fade acknowledgment', async () => {
  const h = handoff_fixture(true), pending = h.handoff.start(h.element); let presented = false
  pending.then(() => { presented = true })
  const emit = attempt => h.listeners.get('cimoa:launch-reveal')?.({ detail: { attempt } })
  emit('stale-attempt'); assert.deepEqual(h.reveals, [])
  h.fonts.resolve(); h.entry.resolve(); await microtasks(); await h.frame(); await h.frame()
  assert.equal(h.requests(), 1); assert.equal(presented, false)
  emit('attempt-7'); emit('attempt-7'); assert.deepEqual(h.reveals, ['reveal']); assert.equal(presented, false)
  h.response.resolve({ finished: true }); assert.deepEqual(await pending, { requested: true }); assert.equal(h.listeners.size, 0)
  emit('attempt-7'); assert.deepEqual(h.reveals, ['reveal'])
})

test('cancelled startup presentation removes reveal/visibility/paint listeners and ignores a late host completion', async () => {
  const h = handoff_fixture(true), pending = h.handoff.start(h.element)
  h.fonts.resolve(); h.entry.resolve(); await microtasks(); await h.frame(); await h.frame()
  h.handoff.cancel(); assert.deepEqual(await pending, { requested: false, reason: 'cancelled' })
  assert.equal(h.listeners.size, 0); assert.equal(h.frames.size, 0)
  h.response.resolve({ finished: true }); await microtasks(); assert.deepEqual(h.reveals, [])
})

test('a browser presentation cancelled while hidden can complete its real paint after visible restoration', async () => {
  const h = handoff_fixture(), pending = h.handoff.start(h.element)
  h.document.visibilityState = 'hidden'; h.listeners.get('document:visibilitychange')()
  assert.deepEqual(await pending, { requested: false, reason: 'cancelled' }); assert.equal(h.listeners.size, 0)
  h.fonts.resolve(); h.entry.resolve(); await microtasks(); assert.equal(h.frames.size, 0)
  h.document.visibilityState = 'visible'
  // PageTransition owns the document-visible restart. The controller must not
  // consider an interrupted paint completed or require a new business delay.
  const restored = h.handoff.start(h.element)
  await microtasks(); await h.frame(); await h.frame()
  assert.deepEqual(await restored, { requested: false, reason: 'browser' }); assert.equal(h.requests(), 0)
  assert.equal(h.frames.size, 0); assert.equal(h.listeners.size, 0)
})
