import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_page_return } from '../src/utils/pageReturn.js'
import { MOTION, NAVIGATION } from '../src/config/navigation.js'

const drain = async () => { for (let index = 0; index < 8; index++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const fixture = () => {
  const hooks = {}, timers = new Map(), calls = []
  let serial = 0, keyboard_ready = true, api, on_pop
  const args = {
    ref: value => ({ value }), defineProps: () => ({ contentMotion: false, surfaceMotion: true }), defineEmits: () => () => {}, defineExpose: value => { api = value },
    onMounted() {}, onShow: fn => { hooks.show = fn }, onHide: fn => { hooks.hide = fn }, onUnload: fn => { hooks.unload = fn }, onUnmounted: fn => { hooks.unmount = fn }, MOTION, NAVIGATION,
    push_route: async () => true, replace_route: async () => true, relaunch_route: async () => true,
    back_route: async delta => { calls.push(delta); on_pop?.(); return 'real-return' }, notify_route_ready() {},
    create_startup_handoff: () => ({ start: async () => ({ reason: 'complete' }), cancel() {} }),
    create_auth_keyboard_handoff: () => ({ prepare: async () => ({ ready: keyboard_ready, reason: keyboard_ready ? 'stable' : 'cancelled' }), cancel() {}, dispose() {} }),
    create_page_return: options => create_page_return({ ...options, schedule: (callback, duration) => { assert.equal(duration, 180); timers.set(++serial, callback); return serial }, clear: id => timers.delete(id) }),
  }
  const source = fs.readFileSync(new URL('../src/components/PageTransition.vue', import.meta.url), 'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  new Function(...Object.keys(args), source)(...Object.values(args))
  return { api, hooks, timers, calls, set_keyboard: value => { keyboard_ready = value }, on_pop: fn => { on_pop = fn }, fire: async () => { const jobs = [...timers.values()]; timers.clear(); for (const callback of jobs) await callback() } }
}

test('a point-surface return owns the existing route lock and never adds the generic 180ms timer', async () => {
  const h = fixture(), gate = deferred()
  let presentations = 0
  const present = async dispatch => { presentations++; await gate.promise; return dispatch() }
  const pending = h.api.navigate_back_with(present)
  assert.strictEqual(h.api.navigate_back_with(present), pending)
  await drain()
  assert.equal(presentations, 1); assert.equal(h.timers.size, 0); assert.deepEqual(h.calls, [])
  gate.resolve(); assert.equal(await pending, 'real-return'); assert.deepEqual(h.calls, [1])
})

test('an unavailable origin uses the ordinary 180ms return once, not a wrong point or immediate pop', async () => {
  const h = fixture(), pending = h.api.navigate_back_with(async () => null)
  await drain(); assert.equal(h.timers.size, 1); assert.deepEqual(h.calls, [])
  await h.fire(); assert.equal(await pending, 'real-return'); assert.deepEqual(h.calls, [1])
})

test('cancelled presentation never becomes a fallback return', async () => {
  const h = fixture()
  assert.equal(await h.api.navigate_back_with(async () => false), false)
  assert.equal(h.timers.size, 0); assert.deepEqual(h.calls, [])
})

test('hide, page unload or unmount prevents a late presentation callback from popping the page', async () => {
  for (const event of ['hide', 'unload', 'unmount']) {
    const h = fixture(), gate = deferred()
    const pending = h.api.navigate_back_with(async dispatch => { await gate.promise; return dispatch() })
    await drain(); h.hooks[event](); gate.resolve()
    assert.equal(await pending, false); assert.deepEqual(h.calls, []); assert.equal(h.timers.size, 0)
  }
})

test('an unloaded frame cannot be reactivated by a late page Show', async () => {
  const h = fixture()
  h.hooks.unload(); h.hooks.show()
  assert.equal(await h.api.navigate_relaunch('/pages/home/index'), false)
  assert.equal(await h.api.navigate_forward('/pages/auto-match/index'), false)
  assert.deepEqual(h.calls, [])
})

test('cancellation before a null fallback cannot schedule a return on a hidden page', async () => {
  const h = fixture(), gate = deferred()
  const pending = h.api.navigate_back_with(async () => { await gate.promise; return null })
  await drain(); h.hooks.hide(); gate.resolve()
  assert.equal(await pending, false); assert.equal(h.timers.size, 0); assert.deepEqual(h.calls, [])
})

test('real keyboard handoff still gates presentation and a cancelled keyboard attempt can retry', async () => {
  const h = fixture(); h.set_keyboard(false)
  let presentations = 0
  const present = dispatch => { presentations++; return dispatch() }
  assert.equal(await h.api.navigate_back_with(present), false); assert.equal(presentations, 0)
  h.set_keyboard(true)
  assert.equal(await h.api.navigate_back_with(present), 'real-return'); assert.equal(presentations, 1)
})

test('a presentation failure releases navigation for a subsequent real retry', async () => {
  const h = fixture()
  await assert.rejects(h.api.navigate_back_with(async () => { throw Error('Retry') }), /Retry/)
  assert.equal(await h.api.navigate_back_with(dispatch => dispatch()), 'real-return')
  assert.deepEqual(h.calls, [1])
})

test('hiding after real pop dispatch preserves the committed route result', async () => {
  const h = fixture(); h.on_pop(() => h.hooks.hide())
  assert.equal(await h.api.navigate_back_with(dispatch => dispatch()), 'real-return')
  assert.deepEqual(h.calls, [1]); assert.equal(h.timers.size, 0)
})
