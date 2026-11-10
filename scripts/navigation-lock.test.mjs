import test from 'node:test'
import assert from 'node:assert/strict'

let import_sequence = 0
const microtasks = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }
const outcome = promise => {
  const state = { status: 'pending', value: undefined, error: null }
  promise.then(value => { state.status = 'fulfilled'; state.value = value }, error => { state.status = 'rejected'; state.error = error })
  return state
}

// The platform route stack is the evidence; callbacks can be delayed or lost by
// a rejected/redirecting H5 router continuation. No production state is seeded.
async function harness(t, initial = ['pages/home/index']) {
  const previous = new Map(['uni', 'getCurrentPages', 'setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const calls = [], timers = new Map()
  let page_sequence = 0, clock = 0, timer_sequence = 0
  const page = route => ({ route: route.replace(/^\//, '').split('?')[0], options: Object.fromEntries(new URLSearchParams(route.split('?')[1] || '')), $page: { id: ++page_sequence, fullPath: route.startsWith('/') ? route : `/${route}` } })
  let pages = initial.map(page)
  const schedule = (callback, duration = 0) => { const id = ++timer_sequence; timers.set(id, { at: clock + Math.max(0, Number(duration) || 0), callback }); return id }
  const cancel = id => timers.delete(id)
  globalThis.setTimeout = schedule
  globalThis.clearTimeout = cancel
  globalThis.getCurrentPages = () => pages
  globalThis.uni = Object.fromEntries(['navigateTo', 'redirectTo', 'reLaunch', 'navigateBack'].map(method => [method, options => { calls.push({ method, options }); return undefined }]))
  t.after(() => {
    timers.clear()
    for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]
  })
  const routes = await import(`../src/utils/routeTransition.js?navigation-lock=${++import_sequence}`)
  const advance = async duration => {
    const until = clock + duration
    let iterations = 0
    while (true) {
      await microtasks()
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      assert.ok(++iterations < 10000, 'Navigation recovery is finite, not an unlimited poll loop')
      const [id, timer] = next
      clock = timer.at; timers.delete(id); timer.callback()
    }
    clock = until
    await microtasks()
  }
  const set_pages = rows => { pages = rows.map(row => typeof row === 'string' ? page(row) : row) }
  return { routes, calls, timers, advance, pages: () => pages, set_pages, arrive: rows => { set_pages(rows); routes.notify_route_ready() } }
}

test('pending navigation remains exclusive and successful callbacks allow the next real navigation', async t => {
  const h = await harness(t)
  const first = h.routes.push_route('/pages/auto-match/index')
  const repeated = h.routes.push_route('/pages/auto-match/index')
  assert.strictEqual(repeated, first, 'The same pending intent shares its original operation rather than navigating twice')
  await assert.rejects(h.routes.relaunch_route('/pages/home/index'), /progress/)
  assert.equal(h.calls.length, 1, 'Repeated clicks cannot invoke a second platform navigation')
  assert.equal(h.calls[0].options.animationType, 'none')
  assert.equal(h.calls[0].options.animationDuration, 0)
  h.set_pages(['pages/home/index', 'pages/auto-match/index'])
  h.calls[0].options.success({ accepted: true })
  assert.deepEqual(await first, { accepted: true })
  assert.deepEqual(await repeated, { accepted: true })
  const second = h.routes.back_route()
  assert.equal(h.calls.length, 2)
  h.set_pages(['pages/home/index']); h.calls[1].options.success()
  await second
  assert.equal(h.routes.current_route(), 'pages/home/index')
  assert.equal(h.timers.size, 0, 'Settled navigation owns no timer')
})

test('platform rejection releases the lock without changing the source stack', async t => {
  const h = await harness(t)
  const first = h.routes.push_route('/pages/auto-match/index')
  h.calls[0].options.fail({ errMsg: 'A navigation guard rejected this page.' })
  await assert.rejects(first, /guard rejected/)
  assert.deepEqual(h.pages().map(page => page.route), ['pages/home/index'])
  const retry = h.routes.push_route('/pages/auto-match/index')
  assert.equal(h.calls.length, 2)
  h.calls[1].options.success(); await retry
  assert.equal(h.timers.size, 0)
})

test('synchronous platform exceptions settle and release the exact operation', async t => {
  const h = await harness(t)
  globalThis.uni.navigateTo = () => { throw new Error('Platform navigation unavailable') }
  await assert.rejects(h.routes.push_route('/pages/auto-match/index'))
  globalThis.uni.navigateTo = options => h.calls.push({ method: 'navigateTo', options })
  const retry = h.routes.push_route('/pages/auto-match/index')
  assert.equal(h.calls.length, 1)
  h.calls[0].options.success(); await retry
  assert.equal(h.timers.size, 0)
})

test('a visible destination with a lost success callback cannot permanently block Return Home', async t => {
  const h = await harness(t, ['pages/home/index', 'pages/auto-match/found'])
  const entering = outcome(h.routes.replace_route('/pages/auto-match/passed?match_id=match-one'))
  assert.equal(h.calls.length, 1)
  // Reproduce the reported state: the new Match skipped page is actually in
  // the platform stack, but the preceding router Promise never called success.
  h.arrive(['pages/home/index', 'pages/auto-match/passed?match_id=match-one'])
  await h.advance(1000)
  const returning = outcome(h.routes.relaunch_route('/pages/home/index'))
  await microtasks()
  assert.notEqual(returning.status, 'rejected', 'A completed route cannot leave a stale global navigation lock')
  assert.equal(h.calls.length, 2, 'Return Home reaches the platform exactly once')
  assert.equal(entering.status, 'fulfilled', 'The previous caller is settled by actual arrival, not left pending')
  h.set_pages(['pages/home/index']); h.calls[1].options.success()
  await microtasks()
  assert.equal(returning.status, 'fulfilled')
  assert.equal(h.timers.size, 0)
})

test('the next invocation recovers a proven arrival even when its shown notification was missed', async t => {
  const h = await harness(t, ['pages/home/index', 'pages/auto-match/found'])
  const entering = outcome(h.routes.replace_route('/pages/auto-match/passed?match_id=match-one'))
  h.set_pages(['pages/home/index', 'pages/auto-match/passed?match_id=match-one'])
  const returning = outcome(h.routes.relaunch_route('/pages/home/index'))
  await microtasks()
  assert.equal(entering.status, 'fulfilled', 'Verified arrival recovers the prior operation immediately')
  assert.equal(returning.status, 'pending')
  assert.equal(h.calls.length, 2)
  h.set_pages(['pages/home/index']); h.calls[1].options.success()
  await microtasks()
  assert.equal(returning.status, 'fulfilled')
  assert.equal(h.timers.size, 0)
})

test('replace does not skip a different entity that shares the current page path', async t => {
  const h = await harness(t, ['pages/auto-match/passed?match_id=match-one'])
  const next = outcome(h.routes.replace_route('/pages/auto-match/passed?match_id=match-two'))
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].method, 'redirectTo')
  assert.equal(h.calls[0].options.url, '/pages/auto-match/passed?match_id=match-two')
  h.arrive(['pages/auto-match/passed?match_id=match-two'])
  await microtasks()
  assert.equal(next.status, 'fulfilled')
  assert.equal(h.timers.size, 0)
})

test('replace skips a genuinely identical destination even when query order differs', async t => {
  const h = await harness(t, ['pages/auto-match/passed?match_id=match-one&from=history'])
  assert.deepEqual(await h.routes.replace_route('/pages/auto-match/passed?from=history&match_id=match-one'), { unchanged: true })
  assert.equal(h.calls.length, 0)
  assert.equal(h.timers.size, 0)
})

test('back arrival without a callback releases navigation and does not pop twice', async t => {
  const h = await harness(t, ['pages/home/index', 'pages/profile/index', 'pages/auto-match/passed'])
  const back = outcome(h.routes.back_route())
  h.arrive(h.pages().slice(0, -1))
  await h.advance(1000)
  assert.equal(back.status, 'fulfilled', 'Observed stack arrival settles a missing navigateBack callback')
  const forward = h.routes.push_route('/pages/settings/index')
  assert.deepEqual(h.calls.map(call => call.method), ['navigateBack', 'navigateTo'])
  h.calls[1].options.success(); await forward
  assert.equal(h.pages().length, 2, 'Recovery must not issue a second back navigation')
  assert.equal(h.timers.size, 0)
})

test('no callbacks and no destination produce a bounded failure and permit a retry', async t => {
  const h = await harness(t, ['pages/auto-match/passed'])
  const blocked = outcome(h.routes.relaunch_route('/pages/home/index'))
  await h.advance(30000)
  assert.equal(blocked.status, 'rejected', 'Missing platform callbacks cannot keep the transaction pending forever')
  assert.ok(blocked.error instanceof Error)
  assert.doesNotMatch(blocked.error.message, /Navigation is already in progress|TypeError|undefined/)
  assert.deepEqual(h.pages().map(page => page.route), ['pages/auto-match/passed'], 'Failed navigation preserves its source')
  const retry = h.routes.relaunch_route('/pages/home/index')
  assert.equal(h.calls.length, 2)
  h.set_pages(['pages/home/index']); h.calls[1].options.success(); await retry
  assert.equal(h.timers.size, 0)
})

test('a different visible route is not proof that the requested destination completed', async t => {
  const h = await harness(t)
  const pending = outcome(h.routes.push_route('/pages/auto-match/passed?match_id=match-one'))
  h.arrive(['pages/home/index', 'pages/profile/index'])
  await h.advance(1000)
  assert.equal(pending.status, 'pending', 'An unrelated page cannot satisfy the in-flight route')
  await assert.rejects(h.routes.push_route('/pages/events/index'), /progress/)
  assert.equal(h.calls.length, 1)
  await h.advance(30000)
  assert.equal(pending.status, 'rejected', 'A missing requested destination is not reported as success')
  assert.equal(h.timers.size, 0)
})

test('arrival checks include entity query and a new destination instance, not just a matching path', async t => {
  const h = await harness(t, ['pages/auto-match/passed?match_id=match-one'])
  const original = h.pages()[0]
  const entering = outcome(h.routes.relaunch_route('/pages/auto-match/passed?match_id=match-one'))
  h.routes.notify_route_ready()
  await microtasks()
  assert.equal(entering.status, 'pending', 'A stale onShow from the original instance cannot complete reLaunch')
  h.arrive(['pages/auto-match/passed?match_id=match-two'])
  await microtasks()
  assert.equal(entering.status, 'pending', 'A different match sharing the path is not the requested entity')
  h.arrive([original])
  await microtasks()
  assert.equal(entering.status, 'pending', 'Returning to the original instance still is not a new destination')
  h.arrive(['pages/auto-match/passed?match_id=match-one'])
  await microtasks()
  assert.equal(entering.status, 'fulfilled', 'The correct newly created destination settles once')
  assert.equal(h.calls.length, 1)
  assert.equal(h.timers.size, 0)
})

test('late success/failure/complete from a settled old route cannot unlock its pending successor', async t => {
  const h = await harness(t)
  const old = outcome(h.routes.push_route('/pages/auto-match/passed?match_id=match-one'))
  const previous = h.calls[0].options
  h.arrive(['pages/home/index', 'pages/auto-match/passed?match_id=match-one'])
  await h.advance(1000)
  assert.equal(old.status, 'fulfilled')
  const next = outcome(h.routes.relaunch_route('/pages/home/index'))
  assert.equal(h.calls.length, 2)
  previous.success({ delayed: true }); previous.fail({ errMsg: 'Delayed failure' }); previous.complete?.({ errMsg: 'navigateTo:ok' })
  await microtasks()
  assert.equal(next.status, 'pending', 'Old callbacks do not settle a newer route')
  await assert.rejects(h.routes.push_route('/pages/events/index'), /progress/)
  assert.equal(h.calls.length, 2, 'Old callbacks cannot release another route’s exclusive lock')
  h.set_pages(['pages/home/index']); h.calls[1].options.success()
  await microtasks()
  assert.equal(next.status, 'fulfilled')
  assert.equal(h.timers.size, 0)
})

test('complete-only failure is terminal and allows another user navigation', async t => {
  const h = await harness(t)
  const first = outcome(h.routes.push_route('/pages/auto-match/index'))
  h.calls[0].options.complete?.({ errMsg: 'navigateTo:fail route guard refused' })
  await microtasks()
  assert.equal(first.status, 'rejected', 'A terminal platform complete failure is not left pending')
  const retry = h.routes.push_route('/pages/auto-match/index')
  assert.equal(h.calls.length, 2)
  h.calls[1].options.success(); await retry
  assert.equal(h.timers.size, 0)
})

test('Promise-only platform fulfillment and rejection both settle without callbacks', async t => {
  const h = await harness(t)
  globalThis.uni.navigateTo = () => Promise.resolve({ result: 'platform-confirmed' })
  assert.deepEqual(await h.routes.push_route('/pages/auto-match/index'), { result: 'platform-confirmed' })
  globalThis.uni.reLaunch = () => Promise.reject(new Error('Route guard rejected the request'))
  await assert.rejects(h.routes.relaunch_route('/pages/home/index'))
  globalThis.uni.navigateTo = options => h.calls.push({ method: 'navigateTo', options })
  const retry = h.routes.push_route('/pages/profile/index')
  assert.equal(h.calls.length, 1)
  h.calls[0].options.success(); await retry
  assert.equal(h.timers.size, 0)
})

test('a Toast dismiss callback exception cannot strand a successful route or its lock', async t => {
  const h = await harness(t)
  const { toast } = await import('../src/utils/toast.js')
  t.after(() => toast.clear())
  toast.show('Please check your connection.', { on_dismiss: () => { throw new Error('A presentation callback failed') } })
  const navigation = outcome(h.routes.push_route('/pages/auto-match/index'))
  assert.doesNotThrow(() => h.calls[0].options.success({ reached: true }))
  await microtasks()
  assert.equal(navigation.status, 'fulfilled', 'The real platform outcome wins over presentation cleanup')
  const next = h.routes.relaunch_route('/pages/home/index')
  assert.equal(h.calls.length, 2)
  h.calls[1].options.success(); await next
  assert.equal(h.timers.size, 0)
})

test('an already queued timer from an old operation cannot settle or unlock a new operation', async t => {
  const h = await harness(t)
  const first = h.routes.push_route('/pages/auto-match/passed?match_id=match-one')
  const stale_timers = [...h.timers.values()].map(timer => timer.callback)
  h.set_pages(['pages/home/index', 'pages/auto-match/passed'])
  h.calls[0].options.success(); await first
  const next = outcome(h.routes.relaunch_route('/pages/home/index'))
  stale_timers.forEach(callback => callback())
  await microtasks()
  assert.equal(next.status, 'pending')
  await assert.rejects(h.routes.push_route('/pages/events/index'), /progress/)
  assert.equal(h.calls.length, 2)
  h.set_pages(['pages/home/index']); h.calls[1].options.success()
  await microtasks()
  assert.equal(next.status, 'fulfilled')
  assert.equal(h.timers.size, 0)
})
