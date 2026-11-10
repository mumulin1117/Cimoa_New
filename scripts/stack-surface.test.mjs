import test from 'node:test'
import assert from 'node:assert/strict'
import { create_stack_surface, is_stack_route } from '../src/utils/stackSurface.js'
import { stack_surface_edge, stack_surface_family, stack_surface_route, stack_surface_target } from '../src/utils/stackSurfaceRoutes.js'
import { MOTION, NAVIGATION, STACK_SURFACE_MOTION } from '../src/config/navigation.js'

const flush = async () => { for (let tick = 0; tick < 30; tick++) await Promise.resolve() }
function fixture({ source = '/pages/events/index', reduced = false } = {}) {
  let page_id = 0, timer_id = 0
  const state = { pages: [], endpoints: [], animations: [], timers: new Map(), changes: [], auth: 'account_a:session_a', hidden: false, available: true, pushes: 0, pops: 0 }
  let controller
  const refresh_nodes = () => {
    const value = controller.current
    for (const endpoint of state.endpoints) {
      endpoint.node.isConnected = endpoint.page === state.pages.at(-1) || value.source === endpoint && value.source_borrowed || value.target === endpoint && value.target_borrowed
      endpoint.scroller.isConnected = endpoint.node.isConnected
      // Native scroll nodes can lose their offsets when Teleport changes owner.
      if (endpoint.reset_on_flush) { endpoint.scroller.scrollTop = 0; endpoint.reset_on_flush = false }
    }
  }
  controller = create_stack_surface({
    get_pages: () => state.pages,
    next_tick: async () => { refresh_nodes() },
    reduced: () => reduced,
    hidden: () => state.hidden,
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
  controller.subscribe(value => state.changes.push(value))
  const make_page = url => ({ route: url.replace(/^\//, '').split('?')[0], $page: { id: ++page_id, fullPath: url } })
  const endpoint_for = page => {
    const scroller = { isConnected: true, scrollTop: 0, scrollLeft: 0 }
    const node = { isConnected: true, scrollTop: 0, scrollLeft: 0, getBoundingClientRect: () => ({ left: 0, top: 0, width: 393, height: 852 }), querySelectorAll: () => [scroller], contains: child => child === scroller }
    const endpoint = { page, node, scroller, element: () => node, identity: () => ({ auth_context: state.auth }) }
    state.endpoints.push(endpoint)
    endpoint.unregister = controller.register(endpoint)
    return endpoint
  }
  const first_page = make_page(source)
  state.pages.push(first_page)
  const first = endpoint_for(first_page)
  const finish = async () => { for (const animation of state.animations.slice(-2)) animation.finish(); await flush() }
  const push = (from, url, options = {}) => {
    let target
    const result = controller.forward(from, url, () => {
      state.pushes++
      if (options.dispatch) return options.dispatch()
      const page = make_page(options.actual_url || url)
      state.pages.push(page)
      if (!options.late) {
        target = endpoint_for(page)
        controller.enter(target)
        target.attach = controller.attach(target)
      }
      return { arrived: true }
    })
    return { result, get target() { return target } }
  }
  const settle = async (from, url) => {
    const operation = push(from, url)
    await flush(); await finish()
    assert.equal((await operation.result).arrived, true)
    assert.equal(await operation.target.attach, true)
    return operation.target
  }
  const pop = (target, dispatch = () => { state.pops++; state.pages.pop(); return { arrived: true } }) => controller.back(target, dispatch)
  return { controller, state, first, make_page, endpoint_for, finish, push, settle, pop, refresh_nodes }
}

test('scope uses explicit authorized cross-module edges, never a global transition', () => {
  for (const source of ['/pages/auth/welcome', '/pages/auth/login', '/pages/auth/verification/code', '/pages/onboarding/complete', '/pages/events/index', '/pages/events/group?event_id=e1', '/pages/profile/index', '/pages/discover/profile', '/pages/home/index', '/pages/settings/index', '/pages/coins/index', '/pages/safety/reports', '/pages/legal/terms']) assert.equal(is_stack_route(source), true, source)
  for (const excluded of ['/pages/auth/splash', '/pages/auth/index', '/pages/permissions/mic', '/pages/events/unknown', '/pages/profile/unknown', '/pages/settings/unknown', '/pages/auto-match/preferences', 'https://cimoa.invalid/pages/events/detail', '//host/pages/auth/login']) assert.equal(is_stack_route(excluded), false, excluded)
  assert.equal(stack_surface_family('/pages/onboarding/basic'), 'auth')
  assert.equal(stack_surface_edge('/pages/auth/welcome', '/pages/auth/login'), true)
  assert.equal(stack_surface_edge('/pages/auth/verification/success', '/pages/onboarding/basic'), true)
  assert.equal(stack_surface_edge('/pages/events/detail?event_id=e1', '/pages/events/participants?event_id=e1'), true)
  assert.equal(stack_surface_edge('/pages/events/participants', '/pages/discover/profile'), true)
  for (const [from, to] of [
    ['/pages/home/index', '/pages/profile/index'], ['/pages/discover/index', '/pages/discover/profile'],
    ['/pages/messages/chat', '/pages/discover/profile'], ['/pages/connections/received', '/pages/safety/report-user'],
    ['/pages/profile/edit', '/pages/profile/basic'], ['/pages/profile/index', '/pages/settings/index'],
    ['/pages/settings/index', '/pages/safety/reports'], ['/pages/safety/report-detail', '/pages/settings/support'],
    ['/pages/settings/index', '/pages/coins/index'], ['/pages/coins/help', '/pages/legal/privacy'],
    ['/pages/auto-match/searching', '/pages/coins/processing'], ['/pages/discover/icebreaker/text', '/pages/coins/index'],
  ]) assert.equal(stack_surface_edge(from, to), true, `${from} → ${to}`)
  for (const [from, to] of [
    ['/pages/home/index', '/pages/auto-match/index'], ['/pages/discover/index', '/pages/discover/icebreaker/select'],
    ['/pages/discover/profile', '/pages/discover/icebreaker/select'], ['/pages/discover/profile', '/pages/messages/chat'],
    ['/pages/auto-match/index', '/pages/auto-match/preferences'], ['/pages/home/index', '/pages/discover/index'],
    ['/pages/auth/community', '/pages/legal/privacy'], ['/pages/onboarding/photos', '/pages/permissions/photos'],
    ['/pages/settings/index', '/pages/auth/welcome'], ['/pages/coins/success', '/pages/home/index'],
  ]) assert.equal(stack_surface_edge(from, to), false, `${from} → ${to} keeps its existing presentation`)
  assert.equal(stack_surface_edge('/pages/events/detail', '/pages/auth/login'), false)
  assert.equal(stack_surface_target('/pages/auth/welcome'), false)
  assert.equal(stack_surface_target('/pages/events/index'), false)
  assert.equal(stack_surface_target('/pages/home/index'), false)
  assert.equal(stack_surface_target('/pages/messages/chat'), false)
  assert.equal(stack_surface_route('/pages/events/detail?event_id=e1'), 'pages/events/detail')
})

test('push presents the original frames concurrently with 240ms native-style transforms', async () => {
  const f = fixture(), operation = f.push(f.first, '/pages/events/detail?event_id=e1')
  assert.equal(f.controller.current.phase, 'forward-pending')
  assert.equal(f.controller.current.busy, true)
  await flush()
  assert.equal(f.state.pushes, 1)
  assert.equal(f.controller.current.phase, 'forward-running')
  assert.equal(f.controller.current.source, f.first)
  assert.equal(f.controller.current.target, operation.target)
  assert.equal(f.controller.current.source_borrowed, true)
  assert.equal(f.controller.current.target_borrowed, true)
  assert.equal(f.state.animations[0].node, f.first.node)
  assert.equal(f.state.animations[1].node, operation.target.node)
  assert.deepEqual(f.state.animations[0].frames, [{ transform: 'translate3d(0%,0,0)' }, { transform: 'translate3d(-30%,0,0)' }])
  assert.deepEqual(f.state.animations[1].frames, [{ transform: 'translate3d(100%,0,0)' }, { transform: 'translate3d(0%,0,0)' }])
  assert.equal(f.state.animations[0].options.duration, MOTION.page)
  assert.equal(f.state.animations[0].options.easing, STACK_SURFACE_MOTION.enter_easing)
  assert.ok(f.state.changes.findIndex(value => value.phase === 'forward-ready') < f.state.changes.findIndex(value => value.phase === 'forward-running'))
  await f.finish(); await operation.result
  assert.equal(f.controller.current.phase, 'settled')
  assert.equal(f.controller.current.busy, false)
  assert.equal(f.controller.current.source_borrowed, false)
  assert.equal(f.controller.current.target_borrowed, false)
  assert.equal(f.first.node.isConnected, false)
  assert.equal(operation.target.node.isConnected, true)
  assert.equal(f.controller.managed(operation.target), true)
  assert.equal(f.state.timers.size, 0)
  assert.ok(f.state.animations.every(animation => animation.cancelled === 1))
})

test('pop runs the exact inverse for 180ms and only then dispatches one real return', async () => {
  const f = fixture(), target = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  const operation = f.pop(target)
  await flush()
  assert.equal(f.state.pops, 0)
  assert.equal(f.controller.current.phase, 'back-running')
  assert.equal(f.first.node.isConnected, true)
  assert.deepEqual(f.state.animations.at(-2).frames, [{ transform: 'translate3d(-30%,0,0)' }, { transform: 'translate3d(0%,0,0)' }])
  assert.deepEqual(f.state.animations.at(-1).frames, [{ transform: 'translate3d(0%,0,0)' }, { transform: 'translate3d(100%,0,0)' }])
  assert.equal(f.state.animations.at(-1).options.duration, MOTION.back)
  assert.equal(f.state.animations.at(-1).options.easing, STACK_SURFACE_MOTION.exit_easing)
  await f.finish()
  assert.equal((await operation).arrived, true)
  assert.equal(f.state.pops, 1)
  assert.equal(f.state.pages.at(-1), f.first.page)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.state.timers.size, 0)
})

test('nested A → B → C returns C → B → A without replacing the older link', async () => {
  const f = fixture(), b = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  b.scroller.scrollTop = 318
  const c = await f.settle(b, '/pages/events/participants?event_id=e1')
  assert.equal(f.controller.managed(b), true)
  assert.equal(f.controller.managed(c), true)
  const first_pop = f.pop(c); await flush(); await f.finish(); await first_pop
  assert.equal(f.state.pages.at(-1), b.page)
  assert.equal(b.scroller.scrollTop, 318)
  assert.equal(f.controller.managed(b), true)
  const second_pop = f.pop(b); await flush(); await f.finish(); await second_pop
  assert.equal(f.state.pages.length, 1)
  assert.equal(f.state.pages.at(-1), f.first.page)
  assert.equal(f.state.pops, 2)
  assert.equal(f.controller.current.phase, 'idle')
})

test('an early Back callback retains both real frames until the exact source activates', async () => {
  const f = fixture(), b = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  let resolved = false
  const operation = f.pop(b, () => { f.state.pops++; return { acknowledged: true } }).then(value => { resolved = true; return value })
  await flush(); await f.finish()
  assert.equal(resolved, false)
  assert.equal(f.controller.current.phase, 'back-dispatched')
  assert.equal(f.controller.current.source_borrowed, true)
  assert.equal(f.controller.current.target_borrowed, true)
  assert.equal(f.state.animations.at(-1).cancelled, 0)
  f.state.pages.pop(); f.controller.enter(f.first); f.controller.route_changed(); await flush()
  assert.equal((await operation).acknowledged, true)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(f.state.pops, 1)
})

test('pending target arrival is bounded and a late target cannot claim an expired operation', async () => {
  const f = fixture(), operation = f.push(f.first, '/pages/events/detail?event_id=e1', { late: true })
  await flush()
  assert.equal(f.controller.current.phase, 'forward-pending')
  const deadline = [...f.state.timers.values()].find(timer => timer.delay === NAVIGATION.callback_timeout_ms)
  deadline.callback(); await flush()
  assert.equal(await operation.result, false)
  const late = f.endpoint_for(f.state.pages.at(-1))
  assert.equal(f.controller.enter(late), false)
  assert.equal(await f.controller.attach(late), false)
  assert.equal(f.controller.managed(late), false)
  assert.equal(f.state.animations.length, 0)
  assert.equal(f.state.timers.size, 0)
})

test('a delayed target can still attach to the exact pending route before the deadline', async () => {
  const f = fixture(), operation = f.push(f.first, '/pages/events/detail?event_id=e1', { late: true })
  await flush()
  const target = f.endpoint_for(f.state.pages.at(-1))
  assert.equal(f.controller.enter(target), true)
  const attached = f.controller.attach(target)
  await flush(); await f.finish()
  assert.equal(await attached, true)
  assert.equal((await operation.result).arrived, true)
})

test('reordered query keys match while changed entity or additional context does not', async () => {
  const f = fixture(), operation = f.push(f.first, '/pages/events/detail?event_id=e1&origin=upcoming', { actual_url: '/pages/events/detail?origin=upcoming&event_id=e1' })
  await flush(); await f.finish()
  assert.equal((await operation.result).arrived, true)
  f.controller.clear()
  for (const actual_url of ['/pages/events/detail?event_id=e2', '/pages/events/detail?event_id=e1&origin=other']) {
    const g = fixture(), wrong = g.push(g.first, '/pages/events/detail?event_id=e1', { actual_url })
    await flush()
    assert.equal(await wrong.result, false)
    assert.equal(g.controller.current.issue, 'target-mismatch')
    assert.equal(g.state.animations.length, 0)
  }
})

test('duplicate push and pop cannot dispatch another navigation during presentation', async () => {
  const f = fixture(), operation = f.push(f.first, '/pages/events/detail?event_id=e1')
  let duplicates = 0
  assert.equal(await f.controller.forward(f.first, '/pages/events/detail?event_id=e1', () => { duplicates++ }), false)
  await flush(); await f.finish(); await operation.result
  const returned = f.pop(operation.target); await flush()
  assert.equal(await f.controller.back(operation.target, () => { duplicates++ }), false)
  assert.equal(duplicates, 0)
  await f.finish(); await returned
  assert.equal(f.state.pushes, 1)
  assert.equal(f.state.pops, 1)
})

for (const reason of ['background', 'viewport-changed', 'host-removed', 'motion-preference-changed']) test(`${reason} cancels an unfinished pop without late dispatch or lock`, async () => {
  const f = fixture(), target = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  const operation = f.pop(target); await flush()
  f.controller.clear(reason)
  assert.equal(await operation, false)
  for (const animation of f.state.animations) animation.finish()
  await flush()
  assert.equal(f.state.pops, 0)
  assert.equal(f.controller.current.busy, false)
  assert.equal(f.controller.current.source_borrowed, false)
  assert.equal(f.state.timers.size, 0)
  assert.equal(await f.controller.back(target, () => { throw Error('must use ordinary fallback') }), null)
})

test('auth change cancels old presentation and never transfers a prior account link', async () => {
  const f = fixture(), operation = f.push(f.first, '/pages/events/detail?event_id=e1')
  await flush()
  f.state.auth = 'account_b:session_b'; f.controller.identity_changed(operation.target)
  assert.equal(await operation.result, false)
  assert.equal(f.controller.current.issue, 'identity-changed')
  assert.equal(f.controller.managed(operation.target), false)
  assert.equal(f.controller.page_route(operation.target), '/pages/events/detail?event_id=e1')
  assert.equal(f.state.timers.size, 0)
})

test('route failure restores the source and retains a valid older parent link', async () => {
  const f = fixture(), b = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  const failed = f.controller.forward(b, '/pages/events/participants?event_id=e1', () => { throw Error('guard rejected') })
  await assert.rejects(failed, /guard rejected/)
  await flush()
  assert.equal(f.controller.current.busy, false)
  assert.equal(b.node.isConnected, true)
  assert.equal(f.controller.managed(b), true)
  const returned = f.pop(b); await flush(); await f.finish(); await returned
  assert.equal(f.state.pages.at(-1), f.first.page)
})

test('a rejected pop dispatch ends locks without an ordinary second return', async () => {
  const f = fixture(), target = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  const operation = f.pop(target, () => false)
  await flush(); await f.finish()
  assert.equal(await operation, false)
  assert.equal(f.state.pages.at(-1), target.page)
  assert.equal(f.controller.current.busy, false)
  assert.equal(f.state.timers.size, 0)
})

test('source and target unmount cancel a pending push, while pop target unmount may precede arrival', async () => {
  for (const side of ['source', 'target']) {
    const f = fixture(), operation = f.push(f.first, '/pages/events/detail?event_id=e1')
    await flush(); (side === 'source' ? f.first : operation.target).unregister()
    assert.equal(await operation.result, false)
    assert.equal(f.controller.current.busy, false)
    assert.equal(f.state.timers.size, 0)
  }
  const f = fixture(), target = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  const operation = f.pop(target, () => { f.state.pops++; target.unregister(); return true })
  await flush(); await f.finish()
  assert.equal(f.controller.current.phase, 'back-dispatched')
  f.state.pages.pop(); f.controller.enter(f.first); await flush()
  assert.equal(await operation, true)
  assert.equal(f.state.pops, 1)
})

test('scroll is restored through both Teleport hand-offs without stale replay on later scrolling', async () => {
  const f = fixture()
  f.first.scroller.scrollTop = 243
  const operation = f.push(f.first, '/pages/events/detail?event_id=e1')
  f.first.reset_on_flush = true
  await flush()
  assert.equal(f.first.scroller.scrollTop, 243)
  await f.finish(); await operation.result
  operation.target.scroller.scrollTop = 411
  f.controller.route_changed(); await flush()
  assert.equal(operation.target.scroller.scrollTop, 411, 'initial target snapshot is no longer replayed')
  const returned = f.pop(operation.target)
  f.first.reset_on_flush = true; operation.target.reset_on_flush = true
  await flush()
  assert.equal(f.first.scroller.scrollTop, 243)
  assert.equal(operation.target.scroller.scrollTop, 411)
  await f.finish(); await returned
  f.first.scroller.scrollTop = 320
  f.controller.route_changed(); await flush()
  assert.equal(f.first.scroller.scrollTop, 320, 'after arrival an old underlay snapshot cannot overwrite a new user scroll')
})

test('unapproved cross-module descendants keep parent identity without a stack animation', async () => {
  const f = fixture(), b = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  const before = f.state.animations.length
  let dispatches = 0
  await f.controller.forward(b, '/pages/discover/icebreaker/select?user_id=u1', () => { dispatches++; f.state.pages.push(f.make_page('/pages/discover/icebreaker/select?user_id=u1')); return true })
  f.controller.route_changed(); await flush()
  assert.equal(dispatches, 1)
  assert.equal(f.state.animations.length, before)
  assert.equal(f.controller.managed(b), true)
  f.state.pages.pop(); f.controller.enter(b); f.controller.route_changed()
  const returned = f.pop(b); await flush(); await f.finish(); await returned
  assert.equal(f.state.pages.at(-1), f.first.page)
})

test('Home → Profile → Settings → Coins → Legal retains every real source and scroll on Pop', async () => {
  const f = fixture({ source: '/pages/home/index' }), chain = [f.first]
  for (const url of ['/pages/profile/index', '/pages/settings/index', '/pages/coins/index?return_context_id=d1', '/pages/coins/help?return_context_id=d1', '/pages/legal/privacy?origin=coins&return_context_id=d1']) {
    chain.at(-1).scroller.scrollTop = chain.length * 73
    chain.push(await f.settle(chain.at(-1), url))
  }
  for (let index = chain.length - 1; index > 0; index--) {
    const returned = f.pop(chain[index]); await flush(); await f.finish(); await returned
    assert.equal(f.state.pages.at(-1), chain[index - 1].page)
    assert.equal(chain[index - 1].scroller.scrollTop, index * 73)
  }
  assert.equal(f.state.pops, 5)
  assert.equal(f.state.timers.size, 0)
})

test('Discover → exact person → report returns the same card frame, not Home', async () => {
  const f = fixture({ source: '/pages/discover/index' })
  const person = await f.settle(f.first, '/pages/discover/profile?user_id=person_6')
  const report = await f.settle(person, '/pages/safety/report-user?target_user_id=person_6')
  for (const current of [report, person]) { const returned = f.pop(current); await flush(); await f.finish(); await returned }
  assert.equal(f.state.pages.at(-1), f.first.page)
  assert.equal(f.state.pushes, 2)
  assert.equal(f.state.pops, 2)
})

test('replace/reLaunch prune destroyed page identities instead of fabricating a pop', async () => {
  const f = fixture(), target = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  f.state.pages = [f.make_page('/pages/events/detail?event_id=e1')]
  f.controller.route_changed()
  assert.equal(f.controller.managed(target), false)
  assert.equal(f.controller.current.phase, 'idle')
  assert.equal(await f.controller.back(target, () => { throw Error('no synthesized return') }), null)
})

test('a real browser Back prunes only the popped child and restores its retained parent scroll', async () => {
  const f = fixture(), b = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  b.scroller.scrollTop = 268
  const c = await f.settle(b, '/pages/events/participants?event_id=e1')
  f.state.pages.pop(); b.reset_on_flush = true
  f.controller.enter(b); f.controller.route_changed(); await flush()
  assert.equal(f.controller.managed(c), false)
  assert.equal(f.controller.managed(b), true)
  assert.equal(b.scroller.scrollTop, 268)
  const returned = f.pop(b); await flush(); await f.finish(); await returned
  assert.equal(f.state.pages.at(-1), f.first.page)
  assert.equal(f.state.pops, 1, 'the already-completed browser Back is not repeated')
})

test('return arrival timeout ends the pending caller without a second dispatch', async () => {
  const f = fixture(), target = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  const operation = f.pop(target, () => { f.state.pops++; return true })
  await flush(); await f.finish()
  assert.equal(f.controller.current.phase, 'back-dispatched')
  const timer = [...f.state.timers.values()].find(item => item.delay === NAVIGATION.callback_timeout_ms)
  timer.callback(); await flush()
  assert.equal(await operation, false)
  assert.equal(f.state.pops, 1)
  assert.equal(f.controller.current.issue, 'return-arrival-timeout')
  assert.equal(f.state.timers.size, 0)
  assert.equal(f.controller.current.busy, false)
})

test('cancellation before the first Vue flush prevents an undispatched push', async () => {
  const f = fixture(), operation = f.push(f.first, '/pages/events/detail?event_id=e1')
  f.controller.clear('background'); await flush()
  assert.equal(await operation.result, false)
  assert.equal(f.state.pushes, 0)
  assert.equal(f.state.animations.length, 0)
  assert.equal(f.state.pages.length, 1)
})

test('scroll snapshots avoid computed-style reads for non-overflowing descendants', async () => {
  const f = fixture()
  let computed_reads = 0
  const passive_nodes = Array.from({ length: 300 }, () => ({ isConnected: true, scrollTop: 0, scrollLeft: 0, scrollHeight: 10, clientHeight: 10, scrollWidth: 10, clientWidth: 10 }))
  f.first.node.querySelectorAll = () => passive_nodes
  f.first.node.ownerDocument = { defaultView: { getComputedStyle() { computed_reads++; return {} } } }
  const operation = f.push(f.first, '/pages/events/detail?event_id=e1')
  await flush(); await f.finish(); await operation.result
  assert.equal(computed_reads, 0)
})

test('reduced motion keeps the real stack and uses opacity only', async () => {
  const f = fixture({ reduced: true }), target = await f.settle(f.first, '/pages/events/detail?event_id=e1')
  assert.deepEqual(f.state.animations[0].frames, [{ opacity: 1 }, { opacity: 1 }])
  assert.deepEqual(f.state.animations[1].frames, [{ opacity: 0 }, { opacity: 1 }])
  const returned = f.pop(target); await flush()
  assert.deepEqual(f.state.animations.at(-1).frames, [{ opacity: 1 }, { opacity: 0 }])
  await f.finish(); await returned
  assert.equal(f.state.pages.at(-1), f.first.page)
})

test('missing host, invalid route or unmeasurable source dispatches only ordinary navigation', async () => {
  for (const reason of ['host', 'measure', 'route']) {
    const f = fixture()
    if (reason === 'host') f.state.available = false
    if (reason === 'measure') f.first.node.getBoundingClientRect = () => ({ width: 0, height: 0 })
    let dispatches = 0
    const result = await f.controller.forward(f.first, reason === 'route' ? '/pages/auto-match/index' : '/pages/events/detail?event_id=e1', () => { dispatches++; return true })
    assert.equal(result, true)
    assert.equal(dispatches, 1)
    assert.equal(f.state.animations.length, 0)
    assert.equal(f.controller.current.busy, false)
  }
})
