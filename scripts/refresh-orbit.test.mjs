import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { REFRESH_ORBIT_PATH, REFRESH_ORBIT_REVERSE, refresh_orbit_presentation } from '../src/utils/refreshOrbit.js'

const source = fs.readFileSync(new URL('../src/utils/refreshOrbit.js', import.meta.url), 'utf8')
const component = fs.readFileSync(new URL('../src/components/BrandRefresh.vue', import.meta.url), 'utf8')
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`)

test('refresh presentation clamps progress and rejects non-finite/non-numeric values', () => {
  for (const [input, expected] of [[-1, 0], [0, 0], [.25, .25], [1, 1], [9, 1], [NaN, 0], [Infinity, 0], [-Infinity, 0], [undefined, 0], [null, 0], ['1', 0]]) {
    const model = refresh_orbit_presentation(input)
    assert.equal(model.progress, expected)
    assert.ok([model.cyan.x, model.cyan.y, model.pink.x, model.pink.y, model.track_opacity, model.dash_offset].every(Number.isFinite))
    assert.ok(model.track_opacity >= 0 && model.track_opacity <= 1)
    assert.ok(model.dash_offset >= 0 && model.dash_offset <= 100)
  }
})

test('pull, release and active labels describe actual controlled state', () => {
  for (const [progress, refreshing, state, label] of [
    [0, false, 'idle', 'Pull to refresh'],
    [.01, false, 'pulling', 'Pull to refresh'],
    [.999, false, 'pulling', 'Pull to refresh'],
    [1, false, 'ready', 'Release to refresh'],
    [5, false, 'ready', 'Release to refresh'],
    [0, true, 'refreshing', 'Refreshing your connections…'],
    [.5, true, 'refreshing', 'Refreshing your connections…'],
    [1, true, 'refreshing', 'Refreshing your connections…'],
    [NaN, true, 'refreshing', 'Refreshing your connections…'],
  ]) {
    const model = refresh_orbit_presentation(progress, refreshing)
    assert.equal(model.state, state)
    assert.equal(model.label, label)
    if (refreshing) assert.equal(model.track_opacity, 1)
  }
  // Retracting below the threshold returns to pulling; reaching it never starts refresh.
  assert.equal(refresh_orbit_presentation(.9).state, 'pulling')
  assert.equal(refresh_orbit_presentation(1).state, 'ready')
})

test('two particles remain symmetric and approach monotonically as the track forms', () => {
  let previous = refresh_orbit_presentation(0)
  let previous_distance = Math.hypot(previous.pink.x - previous.cyan.x, previous.pink.y - previous.cyan.y)
  assert.deepEqual(previous.cyan, { x: 12, y: 23 })
  assert.deepEqual(previous.pink, { x: 64, y: 23 })
  for (let i = 1; i <= 200; i++) {
    const model = refresh_orbit_presentation(i / 200)
    close(model.cyan.x + model.pink.x, 76)
    close(model.cyan.y + model.pink.y, 46)
    assert.ok(model.cyan.x >= previous.cyan.x)
    assert.ok(model.pink.x <= previous.pink.x)
    const distance = Math.hypot(model.pink.x - model.cyan.x, model.pink.y - model.cyan.y)
    assert.ok(distance <= previous_distance + 1e-9)
    assert.ok(model.track_opacity >= previous.track_opacity)
    assert.ok(model.dash_offset <= previous.dash_offset)
    previous = model; previous_distance = distance
  }
  close(previous.cyan.x, 35); close(previous.pink.x, 41)
  close(previous.cyan.y, 23); close(previous.pink.y, 23)
  close(previous_distance, 6)
  assert.equal(previous.track_opacity, 1)
  assert.equal(previous.dash_offset, 0)
})

test('presentation calls are deterministic, isolated and contain no business or timing access', () => {
  const first = refresh_orbit_presentation(.4)
  const snapshot = structuredClone(first)
  const second = refresh_orbit_presentation(.4)
  assert.deepEqual(first, second)
  assert.notStrictEqual(first, second)
  assert.notStrictEqual(first.cyan, second.cyan)
  assert.notStrictEqual(first.pink, second.pink)
  second.cyan.x = -900; second.pink.y = 500
  assert.deepEqual(first, snapshot)
  assert.deepEqual(refresh_orbit_presentation(.4), snapshot)
  assert.doesNotMatch(source, /\b(?:import|localStorage|indexedDB|uni|window|document|fetch|setTimeout|setInterval|Date|stores?)\b/)
})

const cubic_segments = path => {
  assert.match(path, /^M[\d .-]+(?:C[\d .-]+)+$/)
  const [move, ...curves] = path.split(/[MC]/).filter(Boolean).map(values => values.trim().split(/[ ,]+/).map(Number))
  assert.equal(move.length, 2)
  let point = move
  const segments = curves.map(values => {
    assert.equal(values.length, 6)
    const segment = { from: point, first: values.slice(0, 2), second: values.slice(2, 4), to: values.slice(4, 6) }
    point = segment.to
    return segment
  })
  return { move, point, segments }
}

test('particles follow distinct reverse crossing orbits, not the header Logo arc', () => {
  const forward = cubic_segments(REFRESH_ORBIT_PATH), reverse = cubic_segments(REFRESH_ORBIT_REVERSE)
  assert.notEqual(REFRESH_ORBIT_PATH, REFRESH_ORBIT_REVERSE)
  assert.deepEqual(forward.move, [38, 23]); assert.deepEqual(forward.point, forward.move)
  assert.deepEqual(reverse.move, forward.move); assert.deepEqual(reverse.point, forward.move)
  assert.ok(forward.segments.length >= 4)
  assert.equal(reverse.segments.length, forward.segments.length)
  for (const [i, segment] of forward.segments.entries()) {
    const reversed = reverse.segments.at(-1 - i)
    assert.deepEqual(reversed.from, segment.to)
    assert.deepEqual(reversed.first, segment.second)
    assert.deepEqual(reversed.second, segment.first)
    assert.deepEqual(reversed.to, segment.from)
  }
  const logo = fs.readFileSync(new URL('../src/components/CimoaBrand.vue', import.meta.url), 'utf8')
  const logo_paths = [...logo.matchAll(/\bd="([^"]+)"/g)].map(match => match[1])
  assert.ok(logo_paths.length > 0)
  assert.ok(!logo_paths.includes(REFRESH_ORBIT_PATH))
  assert.ok(!logo_paths.includes(REFRESH_ORBIT_REVERSE))
  assert.doesNotMatch(component, /CimoaBrand|M3 14C3 7|M3 16C3 9/)
})

test('component animation mounts only while active, visible and motion is allowed; no timers leak', () => {
  assert.doesNotMatch(component, /\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(/)
  assert.match(component, /const animate = computed\(\(\) => props\.refreshing && !reduced_motion\.value && document_visible\.value\)/)
  const flow = component.match(/<g v-if="animate" class="refresh-orbit-flow">([\s\S]*?)<g v-else class="refresh-orbit-rest">/)
  assert.ok(flow, 'moving particles must be gated by the controlled animate state')
  assert.equal((component.match(/<animateMotion\b/g) || []).length, 2)
  assert.equal((flow[1].match(/<animateMotion\b/g) || []).length, 2)
  assert.match(component, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/)
  for (const [event, callback] of [['change', 'motion_changed'], ['visibilitychange', 'visibility_changed']]) {
    assert.ok(component.includes(`addEventListener('${event}', ${callback})`))
    assert.ok(component.includes(`removeEventListener('${event}', ${callback})`))
  }
})
