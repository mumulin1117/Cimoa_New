import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const evaluate = (path, args, exports) => {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace(/export (function|const)/g, '$1')
  return new Function(...Object.keys(args), `${source}\nreturn {${exports.join(',')}}`)(...Object.values(args))
}
const fake_controller = prefix => {
  const events = [], listeners = new Set()
  const controller = {
    presentation: { root_id: `${prefix}-root`, source_id: `${prefix}-source`, target_id: `${prefix}-target`, attribute_prefix: prefix },
    identity_keys: ['auth_context', 'user_id'], current: { phase: 'idle' }, events,
    subscribe(listener) { listeners.add(listener); listener(controller.current); return () => { events.push(['unsubscribe']); listeners.delete(listener) } },
    publish(value) { controller.current = value; for (const listener of listeners) listener(value) },
    register_source(endpoint) { events.push(['register', endpoint]); return () => events.push(['unregister', endpoint]) },
    route_changed() { events.push(['route']) },
    identity_changed(endpoint) { events.push(['identity', endpoint]) },
    navigate(...args) { events.push(['navigate', ...args]); return 'navigation' },
    enter(endpoint) { events.push(['enter', endpoint]); return true },
    attach(endpoint) { events.push(['attach', endpoint]) },
    release_target(endpoint) { events.push(['release', endpoint]) },
    back(...args) { events.push(['back', ...args]); return 'return' },
    clear(reason) { events.push(['clear', reason]) },
  }
  return controller
}
const composables = () => {
  const mounted = [], unmounted = [], shown = [], watches = []
  const send_surface = fake_controller('send-surface'), auto_match_surface = fake_controller('auto-match-surface')
  const api = evaluate('../src/composables/useSendSurface.js', {
    send_surface,
    computed: read => ({ get value() { return read() } }),
    ref: value => ({ value }), shallowRef: value => ({ value }),
    watch: (read, callback, options) => { const entry = { read, callback, options, stopped: false }; watches.push(entry); return () => { entry.stopped = true } },
    onMounted: callback => mounted.push(callback), onUnmounted: callback => unmounted.push(callback), onShow: callback => shown.push(callback),
  }, ['use_send_surface_source', 'use_send_surface_target'])
  return { ...api, mounted, unmounted, shown, watches, send_surface, auto_match_surface }
}

test('Home source composable delegates every lifecycle and route to its configured controller', () => {
  const h = composables(), controller = h.auto_match_surface
  const identity = () => ({ auth_context: 'session_a', user_id: 'user_a' }), element = () => ({}), anchor = () => ({})
  const source = h.use_send_surface_source({ controller, identity, element, anchor })
  const endpoint = controller.events[0][1]
  assert.equal(endpoint.identity, identity)
  assert.equal(endpoint.anchor, anchor)
  assert.deepEqual(h.watches[0].read(), ['session_a', 'user_a'])
  assert.equal(h.watches[0].options.flush, 'sync')
  h.watches[0].callback(); h.shown[0]()
  assert.deepEqual(controller.events.slice(1).map(row => row[0]), ['identity', 'route'])
  const dispatch = () => true
  assert.equal(source.navigate('user_a', dispatch), 'navigation')
  assert.deepEqual(controller.events.at(-1), ['navigate', endpoint, 'user_a', dispatch])
  controller.publish({ source: endpoint, source_borrowed: true })
  assert.equal(source.borrowed.value, true)
  assert.equal(source.busy.value, true)
  source.cancel(); assert.deepEqual(controller.events.at(-1), ['clear', 'source-cancelled'])
  for (const callback of h.unmounted) callback()
  assert.equal(h.watches[0].stopped, true)
  assert.ok(controller.events.some(row => row[0] === 'unregister'))
  assert.equal(h.send_surface.events.length, 0)
})

test('Discover remains the default controller when no new Home configuration is passed', () => {
  const h = composables()
  h.use_send_surface_source({ identity: () => ({}), element: () => null, anchor: () => null })
  assert.equal(h.send_surface.events[0][0], 'register')
  assert.equal(h.auto_match_surface.events.length, 0)
})

test('Home target publishes the initial clip and delegates enter, attach, return and release only once', () => {
  const h = composables(), controller = h.auto_match_surface
  const surface = h.use_send_surface_target({ controller, identity: () => ({ auth_context: 'session_a', user_id: 'user_a' }), element: () => ({}) })
  assert.equal(surface.surface_mode.value, false)
  assert.deepEqual(surface.style.value, {})
  assert.equal(surface.enter(), true)
  const endpoint = controller.events.at(-1)[1]
  const geometry = { start_clip: 'circle(0px at 346px 81px)', end_clip: 'circle(800px at 346px 81px)' }
  controller.publish({ target: endpoint, busy: true, target_borrowed: true, direction: 'forward', geometry })
  assert.deepEqual(surface.style.value, { clipPath: geometry.start_clip, WebkitClipPath: geometry.start_clip, pointerEvents: 'none' })
  assert.equal(surface.borrowed.value, true)
  assert.equal(surface.busy.value, true)
  for (const callback of h.mounted) callback()
  assert.deepEqual(controller.events.at(-1), ['attach', endpoint])
  const dispatch = () => true
  assert.equal(surface.back(dispatch), 'return')
  assert.deepEqual(controller.events.at(-1), ['back', endpoint, dispatch])
  controller.publish({ target: endpoint, busy: true, direction: 'back', geometry })
  assert.equal(surface.style.value.clipPath, geometry.end_clip)
  controller.publish({ target: endpoint, busy: true, direction: 'back', reduced: true, geometry })
  assert.deepEqual(surface.style.value, { opacity: 1, pointerEvents: 'none' })
  controller.publish({ target: endpoint, busy: false, geometry })
  assert.deepEqual(surface.style.value, {})
  for (const callback of h.unmounted) callback()
  assert.deepEqual(controller.events.at(-1), ['release', endpoint])
  assert.equal(h.send_surface.events.length, 0)
})

const event_target = () => {
  const listeners = new Map()
  return {
    addEventListener(event, callback) { const set = listeners.get(event) || new Set(); set.add(callback); listeners.set(event, set) },
    removeEventListener(event, callback) { listeners.get(event)?.delete(callback) },
    fire(event) { for (const callback of [...listeners.get(event) || []]) callback() },
    get count() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0) },
  }
}
const hosts = () => {
  const roots = [], rendered = [], media = event_target(), win = { ...event_target(), matchMedia: () => media }
  const doc = { ...event_target(), visibilityState: 'visible', body: { appendChild: root => roots.push(root) }, createElement: () => ({ style: {}, removed: false, remove() { this.removed = true } }) }
  const send_surface = fake_controller('cimoa-send-surface'), auto_match_surface = fake_controller('cimoa-auto-match-surface'), match_preferences_surface = fake_controller('cimoa-match-preferences-surface')
  const api = evaluate('../src/utils/sendSurfaceHost.js', {
    send_surface, auto_match_surface, match_preferences_surface, SendSurfaceHost: {}, h: (component, props) => ({ component, props }), render: (component, root) => rendered.push({ component, root }),
  }, ['install_send_surface_host', 'install_auto_match_surface_host', 'install_match_preferences_surface_host'])
  return { ...api, doc, win, media, roots, rendered, send_surface, auto_match_surface, match_preferences_surface }
}

test('Home and Discover install idempotent independent real Vue destinations', () => {
  const h = hosts(), options = { document: h.doc, window: h.win }
  const discover = h.install_send_surface_host(options), home = h.install_auto_match_surface_host(options)
  assert.notEqual(discover, home)
  assert.equal(h.install_send_surface_host(options), discover)
  assert.equal(h.install_auto_match_surface_host(options), home)
  assert.equal(h.roots.length, 2)
  assert.deepEqual(h.roots.map(root => root.id), ['cimoa-send-surface-root', 'cimoa-auto-match-surface-root'])
  assert.equal(h.rendered[0].component.props.controller, h.send_surface)
  assert.equal(h.rendered[1].component.props.controller, h.auto_match_surface)
  home(); assert.equal(h.roots[1].removed, true); assert.equal(h.roots[0].removed, false)
  home(); assert.equal(h.auto_match_surface.events.length, 1, 'Repeated cleanup is inert')
  h.win.fire('hashchange')
  assert.equal(h.send_surface.events.at(-1)[0], 'route')
  assert.equal(h.auto_match_surface.events.length, 1)
  discover()
  assert.equal(h.win.count, 0); assert.equal(h.doc.count, 0); assert.equal(h.media.count, 0)
  assert.equal(h.roots[0].removed, true)
})

test('configured host handles lifecycle cancellation, routes and reduced-motion changes', () => {
  const h = hosts(), controller = h.auto_match_surface
  const dispose = h.install_auto_match_surface_host({ document: h.doc, window: h.win })
  for (const event of ['resize', 'orientationchange', 'pagehide', 'hashchange', 'popstate']) h.win.fire(event)
  h.doc.visibilityState = 'hidden'; h.doc.fire('visibilitychange')
  controller.current.busy = true; h.media.fire('change')
  assert.deepEqual(controller.events, [['clear', 'viewport-changed'], ['clear', 'viewport-changed'], ['clear', 'background'], ['route'], ['route'], ['clear', 'background'], ['clear', 'motion-preference-changed']])
  assert.equal(h.send_surface.events.length, 0)
  dispose()
  assert.equal(h.win.count, 0); assert.equal(h.doc.count, 0); assert.equal(h.media.count, 0)
})

test('bottom presentation styles are whole-page translation only, with opacity reserved for reduced motion', () => {
  const h = composables(), controller = h.auto_match_surface
  const surface = h.use_send_surface_target({ controller, identity: () => ({ auth_context: 'session_a', user_id: 'user_a' }), element: () => ({}) })
  surface.enter()
  const target = controller.events.at(-1)[1], geometry = { viewport: { width: 393, height: 852 } }
  controller.publish({ target, strategy: 'bottom', busy: true, direction: 'forward', geometry })
  assert.deepEqual(surface.style.value, { transform: 'translateY(100%)', pointerEvents: 'none' })
  controller.publish({ target, strategy: 'bottom', busy: true, direction: 'back', geometry })
  assert.deepEqual(surface.style.value, { transform: 'translateY(0)', pointerEvents: 'none' })
  controller.publish({ target, strategy: 'bottom', busy: true, direction: 'forward', geometry, reduced: true })
  assert.deepEqual(surface.style.value, { opacity: 0, pointerEvents: 'none' })
  controller.publish({ target, strategy: 'bottom', busy: false, direction: 'forward', geometry })
  assert.deepEqual(surface.style.value, {})
})

test('Preferences installs its own independent idempotent host without replacing either point host', () => {
  const h = hosts(), options = { document: h.doc, window: h.win }
  const discover = h.install_send_surface_host(options), home = h.install_auto_match_surface_host(options), preferences = h.install_match_preferences_surface_host(options)
  assert.equal(h.install_match_preferences_surface_host(options), preferences)
  assert.deepEqual(h.roots.map(root => root.id), ['cimoa-send-surface-root', 'cimoa-auto-match-surface-root', 'cimoa-match-preferences-surface-root'])
  assert.equal(h.rendered[2].component.props.controller, h.match_preferences_surface)
  preferences()
  assert.equal(h.roots[2].removed, true)
  assert.equal(h.roots[0].removed, false)
  assert.equal(h.roots[1].removed, false)
  discover(); home()
  assert.equal(h.win.count, 0); assert.equal(h.doc.count, 0); assert.equal(h.media.count, 0)
})
