import test from 'node:test'
import assert from 'node:assert/strict'
import { create_match_preferences_surface } from '../src/utils/sendSurface.js'
import { full_surface_geometry } from '../src/utils/sendSurfaceGeometry.js'
import { MOTION, NAVIGATION } from '../src/config/navigation.js'

const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve() }
const make_page = (path, id) => ({ route: path.split('?')[0], $page: { id, fullPath: `/${path}` } })
function fixture({ route = 'pages/auto-match/index', reduced = false, rect = { left: 0, top: 0, width: 393, height: 852 }, options = {} } = {}) {
  const source_page = make_page(route, 10), target_page = make_page('pages/auto-match/preferences', 11)
  const state = { pages: [source_page], identity: { auth_context: 'account_a:session_a', user_id: 'user_a' }, target_identity: { auth_context: 'account_a:session_a', user_id: 'user_a' }, timers: new Map(), animations: [], hidden: false, available: true, pushes: 0, pops: 0, attach: null }
  const source_node = { isConnected: true, getBoundingClientRect: () => rect, ownerDocument: { defaultView: { innerWidth: 393, innerHeight: 852 } } }
  const target_node = { isConnected: false, getBoundingClientRect: () => ({ left: 0, top: 0, width: 393, height: 852 }) }
  const source = { identity: () => state.identity, element: () => source_node, anchor: () => { throw Error('Vertical presentation must not measure an anchor') } }
  const target = { identity: () => state.target_identity, element: () => target_node }
  let serial = 0
  const controller = create_match_preferences_surface({
    get_pages: () => state.pages,
    next_tick: async () => {
      source_node.isConnected = controller.current.source_borrowed || state.pages.at(-1) === source_page
      target_node.isConnected = controller.current.target_borrowed || state.pages.at(-1) === target_page
    },
    hidden: () => state.hidden, reduced: () => reduced, available: () => state.available,
    schedule: (callback, delay) => { const id = ++serial; state.timers.set(id, { callback, delay }); return id },
    cancel: id => state.timers.delete(id),
    animate: (node, frames, configuration) => {
      let resolve, reject
      const task = { node, frames, configuration, finished: new Promise((done, fail) => { resolve = done; reject = fail }), finish: () => resolve(), cancel: () => reject(Error('cancelled')) }
      state.animations.push(task)
      return task
    },
    ...options,
  })
  const unregister = controller.register_source(source)
  const dispatch = () => {
    state.pushes++; state.pages.push(target_page)
    assert.equal(controller.enter(target), true)
    state.attach = controller.attach(target)
    return Promise.resolve({ arrived: true })
  }
  const start = async () => { const pending = controller.navigate(source, 'user_a', dispatch); await flush(); return pending }
  const settle = async () => { await start(); state.animations.at(-1).finish(); await flush(); assert.equal(await state.attach, true) }
  const pop = () => { state.pops++; state.pages.pop(); return Promise.resolve({ arrived: true }) }
  return { controller, state, source, target, source_node, target_node, source_page, target_page, unregister, start, settle, dispatch, pop }
}

test('Preferences has its own fullscreen bottom presentation and empty non-business host destinations', () => {
  const f = fixture()
  assert.equal(f.controller.strategy, 'bottom')
  assert.equal(f.controller.current.strategy, 'bottom')
  assert.deepEqual(f.controller.presentation, { root_id: 'cimoa-match-preferences-surface-root', source_id: 'cimoa-match-preferences-surface-source', target_id: 'cimoa-match-preferences-surface-target', attribute_prefix: 'match-preferences-surface' })
})

for (const route of ['pages/auto-match/index', 'pages/auto-match/searching?match_id=match_a', 'pages/auto-match/paused?match_id=match_a', 'pages/auto-match/no-match?match_id=match_a&view=options', 'pages/discover/index']) test(`${route} opens the same real Preferences page upwards without reading a button anchor`, async () => {
  const f = fixture({ route }); await f.settle()
  assert.equal(f.state.pushes, 1)
  assert.deepEqual(f.state.animations[0].frames, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }])
  assert.equal(f.state.animations[0].configuration.duration, MOTION.page)
  assert.equal(f.state.animations[0].node, f.target_node)
  assert.equal(f.controller.current.geometry.center, undefined)
  assert.equal(f.controller.current.geometry.radius, undefined)
  assert.equal(f.source_node.isConnected, false)
  const pending = f.controller.back(f.target, f.pop); await flush()
  assert.deepEqual(f.state.animations.at(-1).frames, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }])
  assert.equal(f.state.animations.at(-1).configuration.duration, MOTION.back)
  assert.equal(f.state.pops, 0)
  f.state.animations.at(-1).finish(); await pending
  assert.equal(f.state.pops, 1)
  assert.equal(f.state.pages.at(-1), f.source_page)
  assert.equal(f.state.pages.at(-1).$page.fullPath, `/${route}`)
  assert.equal(f.controller.current.issue, '')
})

test('only the actual allowed source route can own Preferences presentation', async () => {
  for (const route of ['pages/home/index', 'pages/profile/index', 'pages/auto-match/found', 'pages/auto-match/history', 'pages/auto-match/preferences']) {
    const f = fixture({ route })
    let dispatches = 0
    assert.equal(await f.controller.navigate(f.source, 'user_a', () => { dispatches++; return true }), true)
    assert.equal(dispatches, 1)
    assert.equal(f.controller.current.phase, 'idle')
    assert.equal(f.controller.current.issue, 'source-unavailable')
  }
})

test('generic source route predicates are supported without broadening the configured Preferences route list', async () => {
  const f = fixture({ route: 'pages/auto-match/paused?match_id=match_a', options: { source_route: (path, page) => path === 'pages/auto-match/paused' && page.$page.fullPath.includes('match_id=match_a') } })
  await f.settle()
  assert.equal(f.controller.current.phase, 'settled')
  f.controller.clear()
})

for (const rect of [{ left: 0, top: 900, width: 393, height: 852 }, { left: 400, top: 0, width: 393, height: 852 }, { left: 0, top: 0, width: 0, height: 852 }, { left: 0, top: 0, width: NaN, height: 852 }]) test(`invalid fullscreen source measurement ${JSON.stringify(rect)} uses real navigation without faking a slide`, async () => {
  const f = fixture({ rect }); let dispatches = 0
  await f.controller.navigate(f.source, 'user_a', () => { dispatches++; return true })
  assert.equal(dispatches, 1)
  assert.equal(f.state.animations.length, 0)
  assert.equal(f.controller.current.issue, 'source-unmeasurable')
})

test('Preferences identity remains tied to the authenticated user, not a query or other source page', async () => {
  const f = fixture()
  f.state.target_identity = { auth_context: 'account_b:session_b', user_id: 'user_a' }
  await f.controller.navigate(f.source, 'user_a', () => {
    f.state.pages.push(f.target_page)
    assert.equal(f.controller.enter(f.target), false)
    return true
  })
  assert.equal(f.controller.current.issue, 'target-mismatch')
  assert.equal(f.state.animations.length, 0)
})

test('reduced motion uses only opacity for Preferences and leaves the same route and timing', async () => {
  const f = fixture({ reduced: true }); await f.settle()
  assert.deepEqual(f.state.animations[0].frames, [{ opacity: 0 }, { opacity: 1 }])
  assert.equal(f.state.animations[0].configuration.duration, MOTION.page)
  const pending = f.controller.back(f.target, f.pop); await flush()
  assert.deepEqual(f.state.animations.at(-1).frames, [{ opacity: 1 }, { opacity: 0 }])
  assert.equal(f.state.animations.at(-1).configuration.duration, MOTION.back)
  f.state.animations.at(-1).finish(); await pending
})

test('Preferences repeated activation and return cannot duplicate push or pop', async () => {
  const f = fixture(); await f.start()
  assert.equal(await f.controller.navigate(f.source, 'user_a', f.dispatch), false)
  assert.equal(f.state.pushes, 1)
  f.state.animations[0].finish(); await flush(); await f.state.attach
  const pending = f.controller.back(f.target, f.pop); await flush()
  assert.equal(await f.controller.back(f.target, f.pop), false)
  f.state.animations.at(-1).finish(); await pending
  assert.equal(f.state.pops, 1)
})

for (const reason of ['background', 'viewport-changed', 'host-removed', 'motion-preference-changed']) test(`${reason} cancels unfinished downward motion with no delayed pop`, async () => {
  const f = fixture(); await f.settle()
  const pending = f.controller.back(f.target, f.pop); await flush()
  const task = f.state.animations.at(-1)
  f.controller.clear(reason)
  assert.equal(await pending, false)
  task.finish(); await flush()
  assert.equal(f.state.pops, 0)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.target_borrowed, false)
  assert.equal(f.state.timers.size, 0)
})

test('a platform acknowledgement retains the downward end frame until the exact source arrives', async () => {
  const f = fixture({ route: 'pages/auto-match/paused?match_id=match_a' }); await f.settle()
  let done = false, requests = 0
  const pending = f.controller.back(f.target, async () => { requests++; return true })
  pending.then(() => { done = true })
  await flush(); f.state.animations.at(-1).finish(); await flush()
  assert.equal(done, false)
  assert.equal(f.controller.current.phase, 'back-dispatched')
  assert.equal(f.controller.current.target_borrowed, true)
  assert.equal(f.controller.current.issue, '')
  assert.equal(requests, 1)
  f.state.pages.pop(); f.controller.route_changed()
  assert.equal(await pending, true)
  assert.equal(f.controller.current.issue, '')
  assert.equal(f.state.pages.at(-1).$page.fullPath, '/pages/auto-match/paused?match_id=match_a')
})

test('actual arrival is bounded and a missing source cannot leave Preferences permanently out of reach', async () => {
  const f = fixture(); await f.settle()
  const pending = f.controller.back(f.target, async () => true)
  await flush(); f.state.animations.at(-1).finish(); await flush()
  const deadline = [...f.state.timers.values()][0]
  assert.equal(deadline.delay, NAVIGATION.callback_timeout_ms)
  deadline.callback()
  assert.equal(await pending, false)
  assert.equal(f.controller.current.issue, 'return-arrival-timeout')
  assert.equal(f.controller.current.target_borrowed, false)
})

test('Preferences has no nested route receipt: university and interests remain current-page modals', async () => {
  const f = fixture(); await f.settle()
  assert.equal(f.controller.route_changed(), true)
  f.state.pages.push(make_page('pages/auto-match/history', 12))
  assert.equal(f.controller.route_changed(), false)
  assert.equal(f.controller.current.phase, 'idle')
})

test('a destroyed or replaced source cannot receive a downward return', async () => {
  const f = fixture(); await f.settle()
  f.state.pages[0] = make_page('pages/auto-match/index', 99)
  assert.equal(await f.controller.back(f.target, f.pop), null)
  assert.equal(f.state.pops, 0)
  assert.equal(f.controller.current.issue, 'return-mismatch')
})

test('fullscreen geometry is immutable visible-frame data, never an invented point origin', () => {
  const source = { left: 0, top: 0, width: 393, height: 852 }, viewport = { ...source }
  const geometry = full_surface_geometry(source, viewport)
  assert.deepEqual(Object.keys(geometry), ['source', 'viewport'])
  assert.equal(Object.isFrozen(geometry), true)
  assert.equal(Object.isFrozen(geometry.source), true)
  assert.equal(full_surface_geometry({ ...source, top: 852 }, viewport), null)
  assert.equal(full_surface_geometry({ ...source, height: -1 }, viewport), null)
  assert.deepEqual(source, viewport)
})
