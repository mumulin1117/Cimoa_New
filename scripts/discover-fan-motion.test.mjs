import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DISCOVER_DECK } from '../src/config/discoverDeck.js'
import { deck_layer_bounds, deck_layer_geometry, deck_card_style, swipe_commits } from '../src/utils/discoverSwipe.js'

const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} should equal ${expected}`)
const interpolate = (idle, next, progress) => Object.fromEntries(Object.keys(idle).map(key => [key, idle[key] + (next[key] - idle[key]) * progress]))
const fitted = (layer, width, height, space) => {
  const bounds = deck_layer_bounds(layer, width, height), epsilon = 1e-6
  assert.ok(bounds.left >= -space.left - epsilon && bounds.right <= width + space.right + epsilon, JSON.stringify({ layer, width, height, bounds, space }))
  assert.ok(bounds.top >= -space.top - epsilon && bounds.bottom <= height + space.bottom + epsilon, JSON.stringify({ layer, width, height, bounds, space }))
}
const style = (depth, progress, options = {}) => deck_card_style({ depth, x: 353 / 3 * progress, y: 0, width: 353, height: 528, space: { left: 20, right: 20, top: 0, bottom: 14 }, dragging: true, settling: false, resetting: false, duration: DISCOVER_DECK.exit_ms, ...options })

test('front remains unscaled and upright while the two rear layers spread in opposite directions', () => {
  const layers = deck_layer_geometry({ width: 280, height: 260, space: { left: 20, right: 20, top: 0, bottom: 14 } })
  assert.deepEqual(layers[0], DISCOVER_DECK.layers[0])
  assert.equal(layers[1].angle, -3.4); assert.equal(layers[2].angle, 3.8)
  assert.ok(layers[1].x < 0 && layers[2].x > 0)
  assert.ok(layers[1].scale > layers[2].scale && layers[1].scale < 1)
  assert.equal(style(0, 0).transform, 'translate3d(0%,0%,0) rotate(0deg)')
})

test('actual spare space limits the fan without shrinking the whole deck or hard-coding a device size', () => {
  const width = 353, height = 528
  const narrow = deck_layer_geometry({ width, height, space: { left: 0, right: 0, top: 0, bottom: 0 } })
  const roomy = deck_layer_geometry({ width, height, space: { left: 40, right: 40, top: 20, bottom: 25 } })
  assert.ok(Math.abs(narrow[1].angle) < Math.abs(roomy[1].angle))
  assert.deepEqual(narrow[0], roomy[0]); assert.equal(narrow[1].scale, roomy[1].scale)
  assert.ok(Math.abs(roomy[1].angle) > 3 && roomy[2].angle > 3)
  for (const [card_width, card_height] of [[280, 230], [280, 420], [335, 400], [353, 528], [390, 542], [353.7, 760], [160, 1000]]) {
    for (const space of [{ left: 0, right: 0, top: 0, bottom: 0 }, { left: 20, right: 20, top: 0, bottom: 14 }, { left: 6, right: 11, top: 0, bottom: 4 }]) {
      const layers = deck_layer_geometry({ width: card_width, height: card_height, space })
      for (let depth = 1; depth < 3; depth++) for (let step = 0; step <= 100; step++) {
        fitted(interpolate(layers[depth], layers[depth - 1], step / 100), card_width, card_height, space)
      }
      for (const layer of layers.slice(1)) {
        const inward = -Math.sign(layer.angle) * Math.min(DISCOVER_DECK.entrance.fan_angle, Math.abs(layer.angle) / 2)
        fitted({ ...layer, angle: layer.angle + inward, scale: layer.scale * DISCOVER_DECK.entrance.fan_scale }, card_width, card_height, space)
      }
    }
  }
})

test('drag progress continuously promotes geometry and shadow to exactly the next role', () => {
  const layers = deck_layer_geometry({ width: 353, height: 528, space: { left: 20, right: 20, top: 0, bottom: 14 } })
  for (const direction of [-1, 1]) {
    assert.equal(style(1, direction).transform, 'translate3d(0%,0%,0) rotate(0deg) scale(1)')
    assert.equal(style(2, direction).transform, style(1, 0).transform)
    assert.equal(style(1, direction)['--deck-shadow-strength'], 1)
    assert.equal(style(2, direction)['--deck-shadow-strength'], layers[1].shadow)
  }
  for (const depth of [1, 2]) {
    const start = style(depth, 0), half = style(depth, .5), end = style(depth, 1)
    approximately(half['--deck-shadow-strength'], (start['--deck-shadow-strength'] + end['--deck-shadow-strength']) / 2)
    assert.equal(half['--deck-shadow-duration'], '0ms')
    assert.equal(style(depth, 1, { settling: true })['--deck-shadow-duration'], `${DISCOVER_DECK.exit_ms}ms`)
    assert.equal(style(depth, 0, { settling: true, duration: DISCOVER_DECK.rebound_ms })['--deck-shadow-duration'], '300ms')
    assert.match(half.transform, /translate3d\([^)]*%[^)]*\) rotate\([^)]*deg\) scale\(/)
    assert.doesNotMatch(half.transform, /(?:px|rpx|vw|NaN|Infinity)/)
  }
})

test('threshold, exit/rebound rhythm, cancellation and reduced-motion remain existing contracts', () => {
  assert.equal(DISCOVER_DECK.threshold_ratio, 1 / 3)
  assert.equal(DISCOVER_DECK.exit_ms, 260); assert.equal(DISCOVER_DECK.rebound_ms, 300)
  assert.equal(swipe_commits(353 / 3, 353), true); assert.equal(swipe_commits(353 * .30, 353), false)
  assert.equal(style(1, .5, { resetting: true }).transition, 'none')
  const card = fs.readFileSync('src/components/DiscoverProfileCard.vue', 'utf8')
  assert.match(card, /var\(--cimoa-shadow-discover-deck-layer\)/)
  assert.match(card, /prefers-reduced-motion: reduce/)
  assert.match(card, /\.discover-card-face \{ transition: none;/)
  assert.doesNotMatch(card, /:hover/)
  const theme = JSON.parse(fs.readFileSync('src/config/theme.json', 'utf8'))
  assert.match(theme.shadows.discover_deck_layer, /var\(--deck-shadow-strength/)
})

test('missing or invalid measurements produce safe upright rear placeholders, never invalid CSS', () => {
  for (const [width, height] of [[0, 0], [NaN, 100], [100, Infinity], [-1, 500]]) {
    const layers = deck_layer_geometry({ width, height })
    for (const layer of layers) assert.equal(layer.x + layer.y + layer.angle, 0)
  }
})
