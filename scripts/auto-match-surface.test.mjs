import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_auto_match_surface, create_send_surface } from '../src/utils/sendSurface.js'
import { MOTION } from '../src/config/navigation.js'

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }
const page = (route, id) => ({ route, $page: { id, fullPath: `/${route}` } })
function fixture({ reduced = false, available, scroll = false } = {}) {
  const source_page = page('pages/home/index', 1), target_page = page('pages/auto-match/index', 2)
  const state = { pages: [source_page], identity: { auth_context: 'account_a:session_a', user_id: 'user_a' }, hidden: false, pushes: 0, pops: 0, timers: new Map(), animations: [], attach: null, anchor: 'lightning' }
  const anchors = {
    lightning: { isConnected: true, getBoundingClientRect: () => ({ left: 319, top: 54, width: 54, height: 54 }) },
    empty: { isConnected: true, getBoundingClientRect: () => ({ left: 20, top: 470, width: 353, height: 62 }) },
    tail: { isConnected: true, getBoundingClientRect: () => ({ left: 20, top: 646 - (scroll ? source_scroll.scrollTop : 0), width: 353, height: 62 }) },
  }
  const source_node = { isConnected: true, getBoundingClientRect: () => ({ left: 0, top: 0, width: 393, height: 852 }) }
  const target_node = { isConnected: false }
  const make_scroller = root => {
    let top = 0, left = 0
    return { get isConnected() { return root.isConnected }, clientHeight: 491, scrollHeight: 514, clientWidth: 393, scrollWidth: 393,
      get scrollTop() { return top }, set scrollTop(value) { top = root.isConnected ? value : 0 },
      get scrollLeft() { return left }, set scrollLeft(value) { left = root.isConnected ? value : 0 },
      reset() { top = 0; left = 0 },
    }
  }
  const source_scroll = make_scroller(source_node), target_scroll = make_scroller(target_node)
  if (scroll) for (const [root, scroller] of [[source_node, source_scroll], [target_node, target_scroll]]) {
    root.querySelectorAll = () => [scroller]
    root.contains = node => node === root || node === scroller
    root.ownerDocument = { defaultView: { getComputedStyle: node => ({ overflowY: node === scroller ? 'auto' : 'hidden', overflowX: 'hidden' }) } }
  }
  const source = { identity: () => state.identity, element: () => source_node, anchor: () => anchors[state.anchor] }
  const target = { identity: () => ({ auth_context: 'account_a:session_a', user_id: 'user_a' }), element: () => target_node }
  let serial = 0
  let source_borrowed = false, target_borrowed = false
  const controller = create_auto_match_surface({
    get_pages: () => state.pages,
    next_tick: async () => {
      const current = controller.current, source_connected = current.source_borrowed || state.pages.at(-1) === source_page, target_connected = current.target_borrowed || state.pages.at(-1) === target_page
      if (scroll && (source_borrowed !== current.source_borrowed || source_node.isConnected !== source_connected)) source_scroll.reset()
      if (scroll && (target_borrowed !== current.target_borrowed || target_node.isConnected !== target_connected)) target_scroll.reset()
      source_borrowed = current.source_borrowed; target_borrowed = current.target_borrowed
      source_node.isConnected = source_connected; target_node.isConnected = target_connected
      const gate = state.tick_gate; state.tick_gate = null
      if (gate) await gate.promise
    },
    hidden: () => state.hidden,
    reduced: () => reduced,
    ...(available ? { available } : {}),
    schedule: (callback, delay) => { const id = ++serial; state.timers.set(id, { callback, delay }); return id },
    cancel: id => state.timers.delete(id),
    animate: (node, frames, options) => {
      let finish, reject
      const animation = { node, frames, options, finished: new Promise((resolve, fail) => { finish = resolve; reject = fail }), finish: () => finish(), cancel: () => reject(Error('cancelled')) }
      state.animations.push(animation)
      return animation
    },
  })
  const unregister = controller.register_source(source)
  const dispatch = () => {
    state.pushes++; state.pages.push(target_page)
    assert.equal(controller.enter(target), true)
    state.attach = controller.attach(target)
    return Promise.resolve(true)
  }
  const start = async () => { const pending = controller.navigate(source, 'user_a', dispatch); await flush(); return pending }
  const settle = async () => { await start(); state.animations.at(-1).finish(); await flush(); assert.equal(await state.attach, true) }
  const pop = () => { state.pops++; state.pages.pop(); return Promise.resolve(true) }
  return { controller, state, anchors, source_node, target_node, source_scroll, target_scroll, source, target, source_page, target_page, dispatch, start, settle, pop, unregister }
}
const available = () => true

test('Home and Discover use separate destinations and the same controller implementation', () => {
  const home = create_auto_match_surface(), discover = create_send_surface()
  assert.deepEqual(home.presentation, { root_id: 'cimoa-auto-match-surface-root', source_id: 'cimoa-auto-match-surface-source', target_id: 'cimoa-auto-match-surface-target', attribute_prefix: 'auto-match-surface' })
  assert.equal(discover.presentation.source_id, 'cimoa-send-surface-source')
  assert.notEqual(home.presentation, discover.presentation)
  assert.equal(Object.isFrozen(home.presentation), true)
})

for (const anchor of ['lightning', 'empty', 'tail']) test(`${anchor} expands from the clicked anchor and returns to that same center`, async () => {
  const f = fixture({ available }); f.state.anchor = anchor
  await f.settle()
  const rect = f.anchors[anchor].getBoundingClientRect(), center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  assert.deepEqual(f.controller.current.geometry.center, center)
  assert.equal(f.state.animations[0].options.duration, MOTION.page)
  assert.equal(f.controller.current.user_id, 'user_a')
  assert.equal(f.source_node.isConnected, false)
  const returning = f.controller.back(f.target, f.pop); await flush()
  assert.equal(f.source_node.isConnected, true)
  assert.deepEqual(f.controller.current.geometry.center, center)
  assert.equal(f.state.animations.at(-1).options.duration, MOTION.back)
  assert.equal(f.state.pops, 0)
  f.state.animations.at(-1).finish()
  assert.equal(await returning, true)
  assert.equal(f.state.pops, 1)
  assert.equal(f.state.pages.at(-1), f.source_page)
  assert.equal(f.controller.current.phase, 'idle')
})

test('the default Home availability check uses Home destinations, never the Discover slots', async () => {
  const prior = globalThis.document, requests = []
  globalThis.document = { getElementById: id => { requests.push(id); return id.startsWith('cimoa-auto-match-surface-') ? {} : null } }
  try {
    const f = fixture()
    await f.settle()
    assert.deepEqual(requests, ['cimoa-auto-match-surface-source', 'cimoa-auto-match-surface-target'])
    f.controller.clear()
  } finally { if (prior === undefined) delete globalThis.document; else globalThis.document = prior }
})

test('Home association rejects Discover source and cannot consume a Say Hi target', async () => {
  const f = fixture({ available }); f.state.pages[0] = page('pages/discover/index', 1)
  let dispatches = 0
  assert.equal(await f.controller.navigate(f.source, 'user_a', () => { dispatches++; return true }), true)
  assert.equal(dispatches, 1)
  assert.equal(f.controller.current.phase, 'idle')
  const g = fixture({ available })
  assert.equal(await g.controller.navigate(g.source, 'user_a', () => {
    g.state.pages.push(page('pages/discover/icebreaker/select?user_id=user_a', 2))
    assert.equal(g.controller.enter(g.target), false)
    return true
  }), true)
  assert.equal(g.controller.current.issue, 'target-mismatch')
})

test('entry page needs no user_id query but must match the authenticated user endpoint', async () => {
  const f = fixture({ available })
  assert.equal(await f.controller.navigate(f.source, 'user_a', () => {
    f.state.pages.push(f.target_page)
    assert.equal(f.controller.enter({ ...f.target, identity: () => ({ auth_context: 'account_a:session_a', user_id: 'user_b' }) }), false)
    return true
  }), true)
  assert.equal(f.state.animations.length, 0)
  assert.equal(f.controller.current.issue, 'target-mismatch')
})

test('preferences and history preserve return ownership without replaying entry', async () => {
  const f = fixture({ available }); await f.settle()
  for (const path of ['pages/auto-match/preferences', 'pages/auto-match/history']) {
    f.state.pages.push(page(path, 3))
    assert.equal(f.controller.route_changed(), true)
    assert.equal(f.controller.enter(f.target), false)
    assert.equal(f.state.animations.length, 1)
    f.state.pages.pop()
    assert.equal(f.controller.route_changed(), true)
  }
})

for (const route of ['pages/auto-match/searching', 'pages/auto-match/paused', 'pages/auto-match/found', 'pages/auto-match/waiting', 'pages/auto-match/connected', 'pages/discover/profile', 'pages/coins/index', 'pages/auto-match/preferences/unknown']) test(`${route} cannot inherit the Home entry receipt`, async () => {
  const f = fixture({ available }); await f.settle()
  f.state.pages.push(page(route, 3))
  assert.equal(f.controller.route_changed(), false)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.issue, 'route-changed')
})

test('replacing the entry with an actual match invalidates the receipt', async () => {
  const f = fixture({ available }); await f.settle()
  f.state.pages[1] = page('pages/auto-match/searching', 3)
  assert.equal(f.controller.route_changed(), false)
  assert.equal(await f.controller.back(f.target, f.pop), null)
  assert.equal(f.state.pops, 0)
})

test('reduced motion preserves the real Home route and uses opacity only', async () => {
  const f = fixture({ available, reduced: true }); await f.settle()
  assert.deepEqual(f.state.animations[0].frames, [{ opacity: 0 }, { opacity: 1 }])
  const pending = f.controller.back(f.target, f.pop); await flush()
  assert.deepEqual(f.state.animations.at(-1).frames, [{ opacity: 1 }, { opacity: 0 }])
  f.state.animations.at(-1).finish(); await pending
  assert.equal(f.state.pops, 1)
})

test('busy forward and reverse gestures cannot dispatch a duplicate route', async () => {
  const f = fixture({ available }); await f.start()
  assert.equal(await f.controller.navigate(f.source, 'user_a', f.dispatch), false)
  assert.equal(f.state.pushes, 1)
  f.state.animations[0].finish(); await flush(); await f.state.attach
  const pending = f.controller.back(f.target, f.pop); await flush()
  assert.equal(await f.controller.back(f.target, f.pop), false)
  f.state.animations.at(-1).finish(); await pending
  assert.equal(f.state.pops, 1)
})

for (const reason of ['background', 'viewport-changed', 'host-removed']) test(`${reason} ends Home collapse without a late return`, async () => {
  const f = fixture({ available }); await f.settle()
  const pending = f.controller.back(f.target, f.pop); await flush()
  const animation = f.state.animations.at(-1)
  f.controller.clear(reason)
  assert.equal(await pending, false)
  animation.finish(); await flush()
  assert.equal(f.state.pops, 0)
  assert.equal(f.state.timers.size, 0)
})

test('an unmounted or outside-view clicked anchor falls back rather than flying to another button', async () => {
  const f = fixture({ available }); await f.settle()
  f.anchors.lightning.isConnected = false
  assert.equal(await f.controller.back(f.target, f.pop), null)
  assert.equal(f.state.pops, 0)
  assert.equal(f.controller.current.issue, 'return-unmeasurable')
})

test('account change clears Home ownership and does not revive on the same user ID', async () => {
  const f = fixture({ available }); await f.settle()
  f.state.identity = { ...f.state.identity, auth_context: 'account_b:session_b' }
  f.controller.identity_changed(f.source)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(await f.controller.back(f.target, f.pop), null)
})

test('configured surface code has no business write or alternate matching state', () => {
  const source = fs.readFileSync(new URL('../src/utils/sendSurface.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /start_match|transition_match|coin_balance|localStorage|indexedDB|cloneNode|appendChild/)
  assert.match(source, /create_auto_match_surface[\s\S]*return create_send_surface\(/)
})

test('native scroll survives source borrow, detached cache, reverse measurement and final owner restore', async () => {
  const f = fixture({ available, scroll: true }); f.state.anchor = 'tail'; f.source_scroll.scrollTop = 23
  await f.start()
  assert.equal(f.source_scroll.scrollTop, 23, 'Forward underlay must keep the list position before first paint')
  assert.equal(f.controller.current.geometry.center.y, 654)
  f.state.animations[0].finish(); await flush(); await f.state.attach
  assert.equal(f.source_node.isConnected, false)
  assert.equal(f.source_scroll.scrollTop, 0, 'Detached native scroller has no layout and must not replace the retained offset')
  f.target_scroll.scrollTop = 17
  const returning = f.controller.back(f.target, f.pop); await flush()
  assert.equal(f.source_scroll.scrollTop, 23)
  assert.equal(f.target_scroll.scrollTop, 17, 'Reverse must also retain the current target content')
  assert.equal(f.controller.current.geometry.center.y, 654, 'Reverse is measured only after source scroll restoration')
  f.state.animations.at(-1).finish(); await returning; await flush()
  assert.equal(f.source_node.isConnected, true)
  assert.equal(f.source_scroll.scrollTop, 23, 'Returning to the real owner must not lose list position')
})

test('a cancelled forward restores the still active Home native scroller after Teleport cleanup', async () => {
  const f = fixture({ available, scroll: true }); f.source_scroll.scrollTop = 18
  const pending = f.controller.navigate(f.source, 'user_a', () => false)
  assert.equal(await pending, false); await flush()
  assert.equal(f.source_node.isConnected, true)
  assert.equal(f.source_scroll.scrollTop, 18)
})

test('cancelled reverse retains source offset until its later real onShow activation', async () => {
  const f = fixture({ available, scroll: true }); f.source_scroll.scrollTop = 23; await f.settle()
  const pending = f.controller.back(f.target, f.pop); await flush()
  f.controller.clear('background'); assert.equal(await pending, false); await flush()
  assert.equal(f.source_node.isConnected, false)
  assert.equal(f.source_scroll.scrollTop, 0)
  f.state.pages.pop()
  assert.equal(f.controller.route_changed(), false); await flush()
  assert.equal(f.source_node.isConnected, true)
  assert.equal(f.source_scroll.scrollTop, 23)
})

test('auth changes discard queued scroll restoration rather than applying another account offset', async () => {
  const f = fixture({ available, scroll: true }); f.source_scroll.scrollTop = 23; await f.settle()
  f.controller.clear('background'); await flush()
  f.state.identity = { ...f.state.identity, auth_context: 'account_b:session_b' }; f.controller.identity_changed(f.source)
  f.state.pages.pop(); f.controller.route_changed(); await flush()
  assert.equal(f.source_scroll.scrollTop, 0)
})

test('an old cleanup microtask cannot restore a stale target scroll after a newer generation', async () => {
  const f = fixture({ available, scroll: true }); await f.settle(); f.target_scroll.scrollTop = 34
  const pending = f.controller.back(f.target, f.pop); await flush()
  let resolve
  f.state.tick_gate = { promise: new Promise(done => { resolve = done }) }
  f.controller.clear('viewport-changed')
  f.target_scroll.scrollTop = 76
  f.controller.clear('new-generation')
  resolve(); assert.equal(await pending, false); await flush()
  assert.equal(f.target_scroll.scrollTop, 76)
})

test('early navigateBack acknowledgement keeps the collapsed frame until the exact Home page actually arrives', async () => {
  const f = fixture({ available, scroll: true }); f.source_scroll.scrollTop = 23; await f.settle()
  let requests = 0, completed = false
  const pending = f.controller.back(f.target, async () => { requests++; return { acknowledged: true } })
  pending.then(() => { completed = true })
  await flush(); f.state.animations.at(-1).finish(); await flush()
  assert.equal(requests, 1)
  assert.equal(completed, false)
  assert.equal(f.controller.current.phase, 'back-dispatched')
  assert.equal(f.controller.current.source_borrowed, true)
  assert.equal(f.controller.current.target_borrowed, true)
  assert.equal(f.controller.current.issue, '')
  assert.equal(f.state.animations.at(-1).frames[1].clipPath, f.controller.current.geometry.start_clip)
  f.controller.release_target(f.target)
  assert.equal(f.controller.current.phase, 'back-dispatched', 'Actual target teardown cannot reveal it again while history is completing')
  f.state.pages.pop(); assert.equal(f.controller.route_changed(), true)
  assert.deepEqual(await pending, { acknowledged: true }); await flush()
  assert.equal(completed, true)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.issue, '')
  assert.equal(f.source_scroll.scrollTop, 23)
  assert.equal(f.state.animations.length, 2, 'No second fixed return animation is added')
  assert.equal(f.state.timers.size, 0)
})

test('source activation notification just before its stack update reconciles on the next Vue flush', async () => {
  const f = fixture({ available }); await f.settle()
  const pending = f.controller.back(f.target, async () => true)
  await flush(); f.state.animations.at(-1).finish(); await flush()
  assert.equal(f.controller.route_changed(), true)
  f.state.pages.pop()
  assert.equal(await pending, true)
  assert.equal(f.controller.current.issue, '')
})

test('missing actual source arrival has bounded cleanup rather than an infinite collapsed overlay', async () => {
  const f = fixture({ available }); await f.settle()
  const pending = f.controller.back(f.target, async () => true)
  await flush(); f.state.animations.at(-1).finish(); await flush()
  assert.equal(f.controller.current.phase, 'back-dispatched')
  const deadline = [...f.state.timers.values()][0]
  assert.equal(deadline.delay, 8000)
  deadline.callback()
  assert.equal(await pending, false)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.issue, 'return-arrival-timeout')
  assert.equal(f.controller.current.target_borrowed, false)
  assert.equal(f.state.pages.at(-1), f.target_page)
})

test('background cancels an acknowledged but not-yet-arrived return and cannot dispatch another pop', async () => {
  const f = fixture({ available }); await f.settle()
  let requests = 0
  const pending = f.controller.back(f.target, async () => { requests++; return true })
  await flush(); f.state.animations.at(-1).finish(); await flush()
  f.controller.clear('background')
  assert.equal(await pending, false)
  assert.equal(requests, 1)
  f.state.pages.pop(); f.controller.route_changed(); await flush()
  assert.equal(requests, 1)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.controller.current.issue, 'background')
})

test('another Home page instance cannot satisfy a delayed return arrival', async () => {
  const f = fixture({ available }); await f.settle()
  const pending = f.controller.back(f.target, async () => true)
  await flush(); f.state.animations.at(-1).finish(); await flush()
  f.state.pages = [page('pages/home/index', 99)]
  assert.equal(f.controller.route_changed(), false)
  assert.equal(await pending, false)
  assert.equal(f.controller.current.issue, 'route-changed')
})
