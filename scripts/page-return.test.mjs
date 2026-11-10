import test from 'node:test'
import assert from 'node:assert/strict'
import { create_page_return } from '../src/utils/pageReturn.js'
import { MOTION } from '../src/config/navigation.js'
const harness = (navigate = async () => 'returned') => {
  const timers = new Map(), states = []; let id = 0
  const controller = create_page_return({ navigate, duration: MOTION.back, on_state: value => states.push(value), schedule: (callback, ms) => { assert.equal(ms, 180); timers.set(++id, callback); return id }, clear: id => timers.delete(id) })
  return { controller, timers, states, fire: async () => { const callbacks = [...timers.values()]; timers.clear(); await Promise.all(callbacks.map(fn => fn())) } }
}
test('return merges repeated taps and dispatches once after existing 180ms', async () => {
  let pops = 0; const h = harness(async delta => { pops += delta; return true })
  const first = h.controller.run(); assert.strictEqual(h.controller.run(), first)
  assert.equal(await h.controller.run(2), false); assert.equal(pops, 0)
  await h.fire(); assert.equal(await first, true); assert.equal(pops, 1); assert.deepEqual(h.states, [true, false])
})
test('hide, background and disposal settle pending returns without a late pop', async () => {
  for (const dispose of [false, true]) {
    let pops = 0; const h = harness(async () => { pops++ })
    const pending = h.controller.run(); dispose ? h.controller.dispose() : h.controller.cancel()
    assert.equal(await pending, false); await h.fire(); assert.equal(pops, 0); assert.equal(h.timers.size, 0)
    if (dispose) assert.equal(await h.controller.run(), false)
    else { const retry = h.controller.run(); await h.fire(); await retry; assert.equal(pops, 1) }
  }
})
test('failed real return releases presentation state and can retry', async () => {
  let calls = 0; const h = harness(async () => { if (!calls++) throw Error('retry'); return true })
  const failed = h.controller.run(), rejection = assert.rejects(failed, /retry/)
  await h.fire(); await rejection; assert.equal(h.controller.state().pending, false)
  const retry = h.controller.run(); await h.fire(); assert.equal(await retry, true)
})
test('hiding after the real pop starts does not pretend to cancel a completed navigation', async () => {
  let done; const h = harness(() => new Promise(resolve => { done = resolve }))
  const pending = h.controller.run(); const fired = h.fire(); h.controller.cancel()
  assert.equal(h.controller.state().dispatched, true); done('real'); await fired
  assert.equal(await pending, 'real'); assert.equal(h.controller.state().pending, false)
})
