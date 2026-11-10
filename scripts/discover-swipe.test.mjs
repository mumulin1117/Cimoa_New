import test from 'node:test'
import assert from 'node:assert/strict'
import { DISCOVER_DECK } from '../src/config/discoverDeck.js'
import { swipe_commits, swipe_progress, deck_card_style, deck_layer_geometry, bind_card_pointer_events } from '../src/utils/discoverSwipe.js'

const space = { left: 20, right: 20, top: 0, bottom: 14 }
const style = (depth, x = 0, options = {}) => deck_card_style({ depth, x, y: 0, width: 353, height: 528, space, dragging: false, settling: false, resetting: false, duration: DISCOVER_DECK.exit_ms, ...options })
test('either direction commits only at one third of measured width, not a short high-speed flick', () => {
  for (const width of [280, 320, 353, 361, 400]) for (const direction of [-1, 1]) {
    for (const ratio of [0, .01, .1, .24, .32]) assert.equal(swipe_commits(direction * width * ratio, width), false)
    for (const ratio of [1 / 3, .34, .5, 1.2]) assert.equal(swipe_commits(direction * width * ratio, width), true)
  }
  for (const [x, width] of [[NaN, 353], [Infinity, 353], [100, 0], [100, -3], [100, Infinity], [100, NaN]]) assert.equal(swipe_commits(x, width), false)
  assert.equal(swipe_commits(117.66665649414062, 353), true, 'Browser float32 coordinate rounding at exact 1/3')
  assert.equal(swipe_commits(353 / 3 - 1.01, 353), false)
  assert.equal(swipe_commits(Math.floor(353 / 3), 353), true, 'WebKit integer client-coordinate rounding')
})
test('three staggered layers use opposite rotations and stable stacking with no changed text or color', () => {
  assert.match(style(0).transform, /translate3d\(0%,0%,0\) rotate\(0deg\)/)
  const layers = deck_layer_geometry({ width: 353, height: 528, space })
  assert.ok(layers[1].angle < -2.4 && layers[2].angle > 2.2)
  assert.ok(layers[1].x < 0 && layers[2].x > 0)
  assert.ok(style(1).transform.includes(`rotate(${layers[1].angle}deg) scale(0.95)`))
  assert.ok(style(2).transform.includes(`rotate(${layers[2].angle}deg) scale(0.91)`))
  assert.deepEqual([0, 1, 2].map(depth => style(depth).zIndex), [3, 2, 1])
  assert.deepEqual(Object.keys(style(0)).sort(), ['--deck-fan-angle', '--deck-shadow-duration', '--deck-shadow-strength', 'transform', 'transition', 'zIndex'])
  assert.deepEqual([0, 1, 2].map(depth => style(depth)['--deck-shadow-strength']), [1, .64, .36])
})
test('incoming and rear layers interpolate continuously and meet exact next-role transforms at release threshold', () => {
  assert.equal(swipe_progress(0, 353), 0); assert.ok(Math.abs(swipe_progress(353 / 6, 353) - .5) < 1e-12); assert.equal(swipe_progress(10000, 353), 1)
  for (const direction of [-1, 1]) {
    assert.equal(style(1, direction * 353 / 3).transform, 'translate3d(0%,0%,0) rotate(0deg) scale(1)')
    assert.equal(style(2, direction * 353 / 3).transform, style(1).transform)
  }
})
test('drag uses no CSS transition, exit/rebound are bounded and hide/reset can disable all transitions', () => {
  assert.equal(style(0, 70, { dragging: true }).transition, 'none')
  assert.match(style(0, 500, { dragging: true, settling: true }).transition, /^transform 260ms/)
  assert.match(style(0, 0, { settling: true, duration: DISCOVER_DECK.rebound_ms }).transition, /^transform 300ms/)
  assert.equal(style(2, 100, { resetting: true }).transition, 'none')
  assert.match(style(0, 10000, { y: 10000 }).transform, /8%,0\) rotate\(18deg\)/)
  assert.match(style(0, -10000, { y: -10000 }).transform, /-8%,0\) rotate\(-18deg\)/)
})
test('native H5 pointer binding registers all phases once and removes every listener', () => {
  const element = new EventTarget(), received = []
  const unbind = bind_card_pointer_events(element, Object.fromEntries(['start', 'move', 'end', 'cancel'].map(name => [name, () => received.push(name)])))
  const phases = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  for (const type of phases) element.dispatchEvent(new Event(type))
  assert.deepEqual(received, ['start', 'move', 'end', 'cancel', 'cancel'])
  unbind(); for (const type of phases) element.dispatchEvent(new Event(type)); assert.equal(received.length, 5)
})
