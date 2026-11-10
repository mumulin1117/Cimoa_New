import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_send_surface } from '../src/utils/sendSurface.js'
import { send_surface_geometry } from '../src/utils/sendSurfaceGeometry.js'
import { MOTION, NAVIGATION, SEND_SURFACE_MOTION } from '../src/config/navigation.js'

const flush = async () => { for (let tick = 0; tick < 12; tick++) await Promise.resolve() }
function fixture({ reduced = false } = {}) {
  const source_page = { route: 'pages/discover/index', $page: { id: 11, fullPath: '/pages/discover/index' } }
  const target_page = { route: 'pages/discover/icebreaker/select', $page: { id: 12, fullPath: '/pages/discover/icebreaker/select?user_id=user_a' } }
  const viewport = { left: 0, top: 0, width: 393, height: 852 }, anchor = { left: 20, top: 714, width: 353, height: 60 }
  const state = { pages: [source_page], identity: { auth_context: 'account_a:session_a', user_id: 'user_a' }, hidden: false, available: true, measurable: true, pushes: 0, pops: 0, timers: new Map(), animations: [], changes: [], attach: null }
  const source_node = { isConnected: true }, target_node = { isConnected: false }
  let timer_id = 0
  const source = { identity: () => state.identity, element: () => source_node }, target = { identity: () => ({ auth_context: 'account_a:session_a', user_id: 'user_a' }), element: () => target_node }
  const controller = create_send_surface({
    get_pages: () => state.pages,
    next_tick: async () => {
      const current = controller.current
      source_node.isConnected = current.source_borrowed || state.pages.at(-1) === source_page
      target_node.isConnected = current.target_borrowed || state.pages.at(-1) === target_page
    },
    measure_source: () => state.measurable ? send_surface_geometry(anchor, viewport) : null,
    hidden: () => state.hidden,
    reduced: () => reduced,
    available: () => state.available,
    schedule: (callback, delay) => { const id = ++timer_id; state.timers.set(id, { callback, delay }); return id },
    cancel: id => state.timers.delete(id),
    animate: (node, frames, options) => {
      let finish, reject
      const animation = { node, frames, options, cancelled: 0, finished: new Promise((resolve, fail) => { finish = resolve; reject = fail }), finish: () => finish(), cancel: () => { animation.cancelled++; reject(Error('cancelled')) } }
      state.animations.push(animation)
      return animation
    },
  })
  const unregister = controller.register_source(source)
  controller.subscribe(value => state.changes.push(value))
  const dispatch_forward = () => {
    state.pushes++; state.pages.push(target_page)
    assert.equal(controller.enter(target), true)
    state.attach = controller.attach(target)
    return Promise.resolve({ arrived: true })
  }
  const start = async () => { const result = controller.navigate(source, 'user_a', dispatch_forward); await flush(); return result }
  const settle = async () => {
    await start(); state.animations.at(-1).finish(); await flush()
    assert.equal(await state.attach, true)
    assert.equal(controller.current.phase, 'settled')
  }
  const dispatch_back = () => { state.pops++; state.pages.pop(); return Promise.resolve({ arrived: true }) }
  return { controller, state, source, target, source_node, target_node, source_page, target_page, unregister, start, settle, dispatch_back, dispatch_forward }
}

test('forward borrows only the unique real source and dispatches before 240ms completes', async () => {
  const f = fixture()
  const result = await f.start()
  assert.equal(result.arrived, true)
  assert.equal(f.state.pushes, 1)
  assert.equal(f.controller.current.phase, 'forward-running')
  assert.equal(f.controller.current.source_borrowed, true)
  assert.equal(f.controller.current.target_borrowed, true)
  assert.equal(f.state.animations[0].node, f.target_node)
  assert.equal(f.state.animations[0].options.duration, MOTION.page)
  assert.equal(f.state.animations[0].options.easing, SEND_SURFACE_MOTION.enter_easing)
  assert.match(f.state.animations[0].frames[0].clipPath, /^circle\(0px at /)
  assert.match(f.state.animations[0].frames[1].clipPath, /^circle\([1-9]/)
  f.controller.clear()
})

test('the matching target receipt publishes an initial zero clip before mounted animation', async () => {
  const f = fixture()
  await f.start()
  const ready = f.state.changes.find(item => item.phase === 'forward-ready')
  assert.equal(ready.target, f.target)
  assert.equal(ready.busy, true)
  assert.match(ready.geometry.start_clip, /^circle\(0px at /)
  assert.ok(f.state.changes.indexOf(ready) < f.state.changes.findIndex(item => item.phase === 'forward-running'))
  f.controller.clear()
})

test('completion returns both Teleports to their owners and retains only the exact association', async () => {
  const f = fixture()
  await f.settle()
  assert.equal(f.controller.current.source_borrowed, false)
  assert.equal(f.controller.current.target_borrowed, false)
  assert.equal(f.controller.current.busy, false)
  assert.equal(f.source_node.isConnected, false)
  assert.equal(f.target_node.isConnected, true)
  assert.equal(f.state.timers.size, 0)
  assert.equal(f.state.animations[0].cancelled, 1)
})

test('return borrows the cached source, collapses for 180ms then pops once', async () => {
  const f = fixture()
  await f.settle()
  const result = f.controller.back(f.target, f.dispatch_back)
  await flush()
  assert.equal(f.controller.current.phase, 'back-running')
  assert.equal(f.source_node.isConnected, true)
  assert.equal(f.state.pops, 0)
  const back = f.state.animations.at(-1)
  assert.equal(back.options.duration, MOTION.back)
  assert.equal(back.options.easing, SEND_SURFACE_MOTION.exit_easing)
  assert.notEqual(back.options.easing, f.state.animations[0].options.easing, 'Contraction accelerates to the source instead of lingering as an almost invisible point')
  assert.match(back.frames[1].clipPath, /^circle\(0px at /)
  back.finish(); await flush()
  assert.equal((await result).arrived, true)
  assert.equal(f.state.pops, 1)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.source_borrowed, false)
  assert.equal(f.state.pages[0], f.source_page)
  assert.equal(f.state.timers.size, 0)
})

test('reduced motion uses only opacity while retaining the real route and durations', async () => {
  const f = fixture({ reduced: true })
  await f.settle()
  assert.deepEqual(f.state.animations[0].frames, [{ opacity: 0 }, { opacity: 1 }])
  const result = f.controller.back(f.target, f.dispatch_back); await flush()
  assert.deepEqual(f.state.animations.at(-1).frames, [{ opacity: 1 }, { opacity: 0 }])
  f.state.animations.at(-1).finish(); await result
  assert.equal(f.state.pops, 1)
})

test('duplicate Send during an active hand-off never dispatches a second push', async () => {
  const f = fixture()
  await f.start()
  let extra = 0
  assert.equal(await f.controller.navigate(f.source, 'user_a', () => { extra++ }), false)
  assert.equal(extra, 0)
  f.controller.clear()
})

test('duplicate return during collapse returns false and cannot trigger an ordinary fallback pop', async () => {
  const f = fixture(); await f.settle()
  const result = f.controller.back(f.target, f.dispatch_back); await flush()
  let extra = 0
  assert.equal(await f.controller.back(f.target, () => { extra++ }), false)
  assert.equal(extra, 0)
  f.state.animations.at(-1).finish(); await result
  assert.equal(f.state.pops, 1)
})

for (const reason of ['background', 'viewport-changed', 'identity-changed', 'host-removed']) test(`${reason} during collapse resolves false without a late pop`, async () => {
  const f = fixture(); await f.settle()
  const result = f.controller.back(f.target, f.dispatch_back); await flush()
  const animation = f.state.animations.at(-1)
  f.controller.clear(reason)
  assert.equal(await result, false)
  animation.finish(); await flush()
  assert.equal(f.state.pops, 0)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.issue, reason)
  assert.equal(f.controller.current.target_borrowed, false)
  assert.equal(f.state.timers.size, 0)
})

test('no retained source returns null for the frame-owned ordinary 180ms fallback', async () => {
  const f = fixture()
  assert.equal(await f.controller.back(f.target, () => { throw Error('must not dispatch') }), null)
})

test('failed return clears both borrowed flags and leaves a retryable real target', async () => {
  const f = fixture(); await f.settle()
  const result = f.controller.back(f.target, () => Promise.reject(Error('route refused')))
  const rejected = assert.rejects(result, /route refused/)
  await flush(); f.state.animations.at(-1).finish(); await rejected
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.issue, 'navigation-failed')
  assert.equal(f.state.pages.at(-1), f.target_page)
  assert.equal(await f.controller.back(f.target, () => {}), null)
})

test('a false route dispatcher is cancellation, not a visual success', async () => {
  const f = fixture()
  assert.equal(await f.controller.navigate(f.source, 'user_a', () => false), false)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.issue, 'navigation-cancelled')
  assert.equal(f.state.animations.length, 0)
})

test('forward rejection restores presentation and propagates the real route error', async () => {
  const f = fixture()
  await assert.rejects(f.controller.navigate(f.source, 'user_a', () => Promise.reject(Error('navigation failed'))), /navigation failed/)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.source_borrowed, false)
  assert.equal(f.state.timers.size, 0)
})

test('cancel before the first Vue flush prevents the undispatched navigation', async () => {
  const f = fixture()
  const result = f.controller.navigate(f.source, 'user_a', f.dispatch_forward)
  f.controller.clear('background')
  assert.equal(await result, false)
  assert.equal(f.state.pushes, 0)
})

test('cancellation ends a pending route-result promise without waiting for its callback', async () => {
  const f = fixture()
  let finish
  const result = f.controller.navigate(f.source, 'user_a', () => new Promise(resolve => { finish = resolve }))
  await flush(); f.controller.clear('background')
  assert.equal(await result, false)
  finish(true); await flush()
  assert.equal(f.controller.current.phase, 'idle')
})

test('a stale pre-dispatch microtask cannot clear a newer source receipt', async () => {
  const f = fixture()
  const old = f.controller.navigate(f.source, 'user_a', f.dispatch_forward)
  f.controller.clear('background')
  const fresh = f.controller.navigate(f.source, 'user_a', f.dispatch_forward)
  await flush()
  assert.equal(await old, false)
  assert.equal((await fresh).arrived, true)
  assert.equal(f.state.pushes, 1)
  assert.equal(f.controller.current.phase, 'forward-running')
  f.controller.clear()
})

test('matching IDs with a different real source-page identity cannot retain a return', async () => {
  const f = fixture(); await f.settle()
  f.state.pages[0] = { ...f.source_page, $page: { ...f.source_page.$page, id: 99 } }
  assert.equal(await f.controller.back(f.target, f.dispatch_back), null)
  assert.equal(f.state.pops, 0)
  assert.equal(f.controller.current.phase, 'idle')
})

test('a target for another user cannot consume the source receipt', async () => {
  const f = fixture()
  const result = f.controller.navigate(f.source, 'user_a', () => {
    f.state.pages.push({ ...f.target_page, $page: { ...f.target_page.$page, fullPath: '/pages/discover/icebreaker/select?user_id=user_b' } })
    assert.equal(f.controller.enter(f.target), false)
    return true
  })
  await result
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.state.animations.length, 0)
})

test('account and current-card changes remove the exact association', async () => {
  const f = fixture(); await f.settle()
  f.state.identity = { ...f.state.identity, auth_context: 'account_b:session_b' }
  f.controller.identity_changed(f.source)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(await f.controller.back(f.target, f.dispatch_back), null)
})

test('nested answer, preview and coin routes retain association but never replay entry', async () => {
  const f = fixture(); await f.settle()
  for (const path of ['pages/discover/icebreaker/text', 'pages/discover/icebreaker/voice', 'pages/discover/icebreaker/preview', 'pages/coins/index', 'pages/coins/history']) {
    f.state.pages.push({ route: path, $page: { id: 20, fullPath: `/${path}?user_id=user_a` } })
    assert.equal(f.controller.route_changed(), true)
    assert.equal(f.controller.current.phase, 'settled')
    assert.equal(f.state.animations.length, 1)
    f.state.pages.pop()
  }
  assert.equal(f.controller.route_changed(), true)
})

test('unrelated nested navigation clears the association rather than linking another page', async () => {
  const f = fixture(); await f.settle()
  f.state.pages.push({ route: 'pages/profile/index', $page: { id: 44, fullPath: '/pages/profile/index' } })
  assert.equal(f.controller.route_changed(), false)
  assert.equal(f.controller.current.phase, 'idle')
})

test('an answer route for a different user clears the association even below the retained select page', async () => {
  const f = fixture(); await f.settle()
  f.state.pages.push({ route: 'pages/discover/icebreaker/text', $page: { id: 44, fullPath: '/pages/discover/icebreaker/text?user_id=user_b' } })
  assert.equal(f.controller.route_changed(), false)
  assert.equal(f.controller.current.phase, 'idle')
})

test('source and target destruction cancel incomplete hand-offs', async () => {
  const f = fixture(); await f.start()
  f.unregister(); await flush()
  assert.equal(await f.state.attach, false)
  assert.equal(f.controller.current.issue, 'source-unmounted')
  const g = fixture(); await g.settle(); g.controller.release_target(g.target)
  assert.equal(g.controller.current.issue, 'target-unmounted')
})

test('target unmount caused by the one dispatched return does not undo its source hand-off', async () => {
  const f = fixture(); await f.settle()
  const result = f.controller.back(f.target, () => {
    f.controller.release_target(f.target)
    assert.equal(f.controller.current.phase, 'back-dispatched')
    return f.dispatch_back()
  })
  await flush(); f.state.animations.at(-1).finish()
  assert.equal((await result).arrived, true)
  assert.equal(f.state.pops, 1)
})

test('a stale callback after clearing cannot clear a newer association', async () => {
  const f = fixture(); await f.start()
  const old = f.state.animations[0]
  f.controller.clear('background'); await flush()
  f.state.pages = [f.source_page]
  await f.start()
  old.finish(); await flush()
  assert.equal(f.controller.current.phase, 'forward-running')
  assert.equal(f.state.pushes, 2)
  f.controller.clear()
})

test('missing geometry or host never fakes an expansion and leaves the real dispatcher usable', async () => {
  for (const field of ['available', 'measurable']) {
    const f = fixture(); f.state[field] = false
    let dispatched = 0
    assert.equal(await f.controller.navigate(f.source, 'user_a', () => { dispatched++; return true }), true)
    assert.equal(dispatched, 1)
    assert.equal(f.controller.current.phase, 'idle')
    assert.equal(f.state.animations.length, 0)
  }
})

test('a missing target mount has a bounded cleanup, not a permanent portal', async () => {
  const f = fixture()
  await f.controller.navigate(f.source, 'user_a', () => { f.state.pages.push(f.target_page); return true })
  assert.equal(f.controller.current.phase, 'forward-pending')
  const timer = [...f.state.timers.values()][0]
  assert.equal(timer.delay, NAVIGATION.callback_timeout_ms)
  timer.callback()
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.issue, 'presentation-timeout')
})

test('the host has only two inert destinations and never clones or manually moves cached page trees', () => {
  const host = fs.readFileSync(new URL('../src/components/SendSurfaceHost.vue', import.meta.url), 'utf8')
  const source = fs.readFileSync(new URL('../src/utils/sendSurface.js', import.meta.url), 'utf8')
  const composable = fs.readFileSync(new URL('../src/composables/useSendSurface.js', import.meta.url), 'utf8')
  assert.match(host, /:id="source_id"[^>]+inert aria-hidden="true"/)
  assert.match(host, /:id="target_id"[^>]+inert aria-hidden="true"/)
  assert.match(source, /source_id = 'cimoa-send-surface-source'/)
  assert.match(source, /target_id = 'cimoa-send-surface-target'/)
  assert.match(host, /font-family: -apple-system/)
  assert.doesNotMatch(source + composable, /cloneNode|appendChild|insertBefore|innerHTML|localStorage|indexedDB|canvas|iframe/)
  assert.match(composable, /clipPath:/)
  assert.match(source, /MOTION\.page : MOTION\.back/)
})
