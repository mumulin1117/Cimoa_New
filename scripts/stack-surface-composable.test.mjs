import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const evaluate = args => {
  const source = fs.readFileSync(new URL('../src/composables/useStackSurface.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace(/export function/g, 'function')
  return new Function(...Object.keys(args), `${source}\nreturn { use_stack_surface, stack_surface_context }`)(...Object.values(args))
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }
function harness({ route = 'pages/auth/login', enter = true, auth_context = '' } = {}) {
  const events = [], listeners = new Set(), hooks = { before_mount: [], mounted: [], shown: [], unmounted: [] }, watches = []
  const store = { auth_context, session: { account_id: null, current_user_id: null, expires_at: null, is_authenticated: false }, auth_draft: { flow_id: 'flow_a' } }, active = { managed: false, route, enter }, default_controller = { name: 'unused' }
  let endpoint
  const controller = {
    current: { phase: 'idle', busy: false },
    presentation: { source_id: 'stack-source', target_id: 'stack-target' },
    subscribe(callback) { listeners.add(callback); callback(controller.current); events.push(['subscribe']); return () => { listeners.delete(callback); events.push(['unsubscribe']) } },
    publish(value) { controller.current = value; for (const callback of listeners) callback(value) },
    register(value) { endpoint = value; events.push(['register', value]); return () => events.push(['unregister', value]) },
    enter(value) { events.push(['enter', value]); active.managed ||= active.enter; return active.enter },
    attach(value) { events.push(['attach', value]); return true },
    managed(value) { assert.equal(value, endpoint); return active.managed },
    page_route(value) { assert.equal(value, endpoint); return active.route },
    identity_changed(value) { events.push(['identity', value]); active.managed = false },
    route_changed() { events.push(['route']) },
    forward(...args) { events.push(['forward', ...args]); return 'forward-result' },
    back(...args) { events.push(['back', ...args]); return 'back-result' },
  }
  const api = evaluate({
    computed: read => ({ get value() { return read() } }), shallowRef: value => ({ value }), nextTick: () => Promise.resolve(),
    watch(read, callback, options) { const value = { read, callback, options, stopped: false }; watches.push(value); return () => { value.stopped = true } },
    onBeforeMount: callback => hooks.before_mount.push(callback), onMounted: callback => hooks.mounted.push(callback), onShow: callback => hooks.shown.push(callback), onUnmounted: callback => hooks.unmounted.push(callback),
    use_app_store: () => { events.push(['store']); return store }, stack_surface: default_controller,
    STACK_SURFACE_MOTION: { parallax: 0.3 },
    is_stack_route: value => /^(pages\/auth\/|pages\/onboarding\/|pages\/events\/)/.test(value),
  })
  return { use: api.use_stack_surface, context: api.stack_surface_context, controller, events, hooks, watches, store, active, get endpoint() { return endpoint }, get listener_count() { return listeners.size } }
}

test('registers and consumes a managed target during setup before the child transition can paint', () => {
  const h = harness(), root = {}, surface = h.use({ element: () => root, controller: h.controller })
  assert.deepEqual(h.events.map(event => event[0]), ['store', 'subscribe', 'register', 'enter'])
  assert.equal(h.endpoint.element(), root)
  assert.deepEqual(h.endpoint.identity(), { auth_context: h.context(h.store) }, 'Guest auth pages have a valid scoped identity too')
  assert.equal(surface.suppress.value, true)
  assert.equal(surface.eligible.value, true)
  assert.equal(surface.busy.value, false)
  assert.equal(surface.borrowed.value, false)
  assert.deepEqual(surface.style.value, {})
  assert.equal(h.events.some(event => event[0] === 'attach'), false, 'No frame can be attached before mounting')
})

test('initial paint holds the actual forward target at the right edge without moving its text independently', () => {
  const h = harness(), surface = h.use({ element: () => ({}), controller: h.controller })
  h.controller.publish({ phase: 'pending', source: {}, target: h.endpoint, target_borrowed: true, busy: true, direction: 'forward' })
  assert.equal(surface.borrowed.value, true)
  assert.equal(surface.destination.value, '#stack-target')
  assert.equal(surface.busy.value, true)
  assert.deepEqual(surface.style.value, { transform: 'translateX(100%)', pointerEvents: 'none' })
  h.controller.publish({ phase: 'running', source: {}, target: h.endpoint, target_borrowed: true, busy: true, direction: 'back' })
  assert.deepEqual(surface.style.value, { transform: 'translateX(0)', pointerEvents: 'none' })
})

test('the genuine source is locked immediately and returns from the same parallax offset', () => {
  const h = harness({ route: 'pages/events/index', enter: false }), surface = h.use({ element: () => ({}), controller: h.controller })
  h.controller.publish({ phase: 'pending', source: h.endpoint, source_borrowed: false, busy: true, direction: 'forward' })
  assert.equal(surface.busy.value, true, 'Do not wait for the Vue Teleport to lock the real source')
  assert.equal(surface.borrowed.value, false)
  assert.equal(surface.destination.value, '#stack-source')
  assert.deepEqual(surface.style.value, { transform: 'translateX(0)', pointerEvents: 'none' })
  h.controller.publish({ source: h.endpoint, source_borrowed: true, busy: true, direction: 'back' })
  assert.equal(surface.borrowed.value, true)
  assert.deepEqual(surface.style.value, { transform: 'translateX(-30%)', pointerEvents: 'none' })
})

test('only the relevant endpoint is borrowed or made busy, and reduced motion uses opacity only', () => {
  const h = harness(), surface = h.use({ element: () => ({}), controller: h.controller })
  h.controller.publish({ target: {}, source: {}, target_borrowed: true, source_borrowed: true, busy: true })
  assert.equal(surface.borrowed.value, false)
  assert.equal(surface.busy.value, false)
  assert.deepEqual(surface.style.value, {})
  h.controller.publish({ target: h.endpoint, target_borrowed: true, busy: true, direction: 'forward', reduced: true })
  assert.deepEqual(surface.style.value, { opacity: 0, pointerEvents: 'none' })
  h.controller.publish({ target: h.endpoint, busy: true, direction: 'back', reduced: true })
  assert.deepEqual(surface.style.value, { opacity: 1, pointerEvents: 'none' })
  h.controller.publish({ source: h.endpoint, busy: true, direction: 'back', reduced: true })
  assert.deepEqual(surface.style.value, { opacity: 1, pointerEvents: 'none' })
})

test('mounted frames attach after Vue layout, repeated show reconciles the actual route, and warm pop stays suppressed', async () => {
  const h = harness(), surface = h.use({ element: () => ({}), controller: h.controller })
  h.hooks.before_mount[0]()
  h.hooks.mounted[0]()
  h.hooks.shown[0]()
  assert.equal(h.events.some(event => event[0] === 'attach'), false)
  await flush()
  assert.equal(h.events.filter(event => event[0] === 'attach').length, 1, 'A mounting show cannot attach the target twice')
  assert.equal(h.events.filter(event => event[0] === 'route').length, 1)
  h.active.enter = false
  h.controller.publish({ phase: 'settled', target: null, source: null, busy: false })
  h.hooks.shown[0](); await flush()
  assert.equal(surface.suppress.value, true, 'Retained incoming links suppress old cRise during a warm nested return')
  assert.deepEqual(surface.style.value, {})
})

test('delegates navigation to the configured controller without a second route or state write', () => {
  const h = harness(), identity = () => ({ auth_context: 'account_a:session_a' }), surface = h.use({ element: () => ({}), identity, controller: h.controller }), dispatch = () => true
  assert.equal(h.events.some(event => event[0] === 'store'), false, 'Explicit isolated identity does not create another Store')
  assert.equal(surface.forward('/pages/events/detail?event_id=one', dispatch), 'forward-result')
  assert.deepEqual(h.events.at(-1), ['forward', h.endpoint, '/pages/events/detail?event_id=one', dispatch])
  assert.equal(surface.back(dispatch), 'back-result')
  assert.deepEqual(h.events.at(-1), ['back', h.endpoint, dispatch])
})

test('keyboard eligibility comes from the captured real page rather than whichever cached page is currently active', () => {
  const h = harness({ route: 'pages/discover/index', enter: false }), surface = h.use({ element: () => ({}), controller: h.controller })
  assert.equal(surface.eligible.value, false)
  assert.equal(surface.suppress.value, false)
  h.active.route = 'pages/auto-match/preferences'
  assert.equal(surface.eligible.value, false)
  h.active.route = 'pages/events/group-chat'
  assert.equal(surface.eligible.value, true)
  h.active.route = 'pages/auth/login'
  assert.equal(surface.eligible.value, true)
})

test('auth changes notify synchronously and destroy cleans observer, endpoint and pending layout work', async () => {
  const h = harness(), surface = h.use({ element: () => ({}), controller: h.controller })
  assert.equal(h.watches[0].read(), h.context(h.store))
  assert.equal(h.watches[0].options.flush, 'sync')
  h.store.session = { account_id: 'account_b', current_user_id: 'user_b', expires_at: 9000, is_authenticated: true }
  assert.equal(h.watches[0].read(), h.context(h.store))
  h.watches[0].callback()
  assert.deepEqual(h.events.at(-1), ['identity', h.endpoint])
  assert.equal(surface.suppress.value, false)
  h.hooks.mounted[0]()
  h.hooks.unmounted[0]()
  await flush()
  assert.equal(h.events.some(event => event[0] === 'attach'), false, 'Unmount before nextTick cannot reattach a destroyed frame')
  assert.equal(h.watches[0].stopped, true)
  assert.equal(h.listener_count, 0)
  assert.equal(h.events.filter(event => event[0] === 'unregister').length, 1)
})

test('registration metadata and drafts do not change ownership inside the same guest flow', () => {
  const h = harness(), before = h.context(h.store)
  h.store.auth_context = 'changed-business-context'
  h.store.auth_draft = { ...h.store.auth_draft, pending_registration_account_id: 'pending_one', step: 'verified', email: 'one@connect.edu', verification_request_id: 'request_one', profile_draft: { name: 'One' } }
  assert.equal(h.context(h.store), before)
  h.store.auth_draft.flow_id = 'flow_b'
  assert.notEqual(h.context(h.store), before, 'A genuinely new guest flow cannot reuse prior page ownership')
})

test('session changes and expiration invalidate ownership, authenticated draft edits do not', () => {
  const h = harness()
  h.store.session = { account_id: 'account_a', current_user_id: 'user_a', expires_at: 9000, is_authenticated: true }
  const before = h.context(h.store)
  h.store.auth_draft = { flow_id: 'any_later_flow', pending_registration_account_id: 'pending_other' }
  assert.equal(h.context(h.store), before)
  for (const patch of [{ account_id: 'account_b' }, { current_user_id: 'user_b' }, { expires_at: 10000 }, { is_authenticated: false }]) {
    const original = { ...h.store.session }
    Object.assign(h.store.session, patch)
    assert.notEqual(h.context(h.store), before)
    h.store.session = original
  }
})
