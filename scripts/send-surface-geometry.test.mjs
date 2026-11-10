import test from 'node:test'
import assert from 'node:assert/strict'
import { send_surface_geometry } from '../src/utils/sendSurfaceGeometry.js'

const viewport = (width = 393, height = 852, left = 0, top = 0) => ({ left, top, width, height })
const button = (left = 20, top = 664, width = 353, height = 60) => ({ left, top, width, height })
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-6, `${actual} should equal ${expected}`)
const covers = geometry => {
  const { center, radius, viewport: bounds } = geometry
  for (const [x, y] of [[0, 0], [bounds.width, 0], [0, bounds.height], [bounds.width, bounds.height]]) {
    assert.ok(Math.hypot(x - center.x, y - center.y) <= radius, JSON.stringify({ geometry, x, y }))
  }
  assert.match(geometry.start_clip, /^circle\(0px at [-\d.]+px [-\d.]+px\)$/)
  assert.match(geometry.end_clip, /^circle\([\d.]+px at [-\d.]+px [-\d.]+px\)$/)
  assert.doesNotMatch(geometry.start_clip + geometry.end_clip, /(?:NaN|Infinity|undefined|rpx)/)
}

test('point-to-surface starts at the measured Send center and covers every target corner', () => {
  const geometry = send_surface_geometry(button(), viewport())
  assert.deepEqual(geometry.center, { x: 196.5, y: 694 })
  assert.equal(geometry.start_clip, 'circle(0px at 196.5px 694px)')
  close(geometry.radius, Math.hypot(196.5, 694))
  covers(geometry)
})

test('viewport offsets do not move the actual source point or duplicate safe-area insets', () => {
  const base = send_surface_geometry(button(), viewport())
  for (const [left, top] of [[0, 62], [13, 35], [-2.5, 60.25], [15.25, -6.5]]) {
    const geometry = send_surface_geometry(button(20 + left, 664 + top), viewport(393, 852, left, top))
    assert.deepEqual(geometry.center, base.center)
    assert.equal(geometry.start_clip, base.start_clip)
    assert.equal(geometry.end_clip, base.end_clip)
    covers(geometry)
  }
})

for (const [width, height] of [[320, 568], [375, 667], [393, 852], [402, 874], [430, 932], [852, 393], [932, 430]]) {
  test(`measured ${width} × ${height} viewport is fully covered without device-specific dimensions`, () => {
    const geometry = send_surface_geometry(button(width * .05, height * .78, width * .9, height * .07), viewport(width, height))
    close(geometry.center.x, width / 2)
    close(geometry.center.y, height * .815)
    covers(geometry)
  })
}

test('asymmetric and fractional sources retain their real center instead of assuming screen center', () => {
  for (const source of [button(5, 9, 44, 44), button(303, 749, 55, 63), button(13.123456789, 599.987654321, 293.765432123, 53.876543211)]) {
    const geometry = send_surface_geometry(source, viewport())
    close(geometry.center.x, source.left + source.width / 2)
    close(geometry.center.y, source.top + source.height / 2)
    covers(geometry)
  }
})

test('partially clipped source is allowed only while its real center remains inside the viewport', () => {
  for (const source of [button(-10, 20, 44, 44), button(370, 20, 44, 44), button(20, -10, 44, 44), button(20, 830, 44, 44)]) {
    covers(send_surface_geometry(source, viewport()))
  }
  for (const source of [button(-30, 20, 44, 44), button(380, 20, 44, 44), button(20, -30, 44, 44), button(20, 831, 44, 44)]) {
    assert.equal(send_surface_geometry(source, viewport()), null)
  }
})

test('completely offscreen, edge-only and stale source rectangles safely decline the effect', () => {
  for (const source of [button(-44, 20, 44, 44), button(393, 20, 44, 44), button(20, -44, 44, 44), button(20, 852, 44, 44), button(400, 900, 80, 50)]) {
    assert.equal(send_surface_geometry(source, viewport()), null)
  }
})

test('non-finite, missing, coerced and non-positive measurements never produce invalid CSS', () => {
  for (const value of [undefined, null, {}, [], { left: 0, top: 0, width: 0, height: 852 }, { left: 0, top: 0, width: -393, height: 852 }]) {
    assert.equal(send_surface_geometry(value, viewport()), null)
    assert.equal(send_surface_geometry(button(), value), null)
  }
  for (const property of ['left', 'top', 'width', 'height']) {
    for (const value of [NaN, Infinity, -Infinity, '393', null, undefined]) {
      assert.equal(send_surface_geometry({ ...button(), [property]: value }, viewport()), null)
      assert.equal(send_surface_geometry(button(), { ...viewport(), [property]: value }), null)
    }
  }
  assert.equal(send_surface_geometry(button(1e308, 0, 1e308, 60), viewport()), null)
})

test('geometry is presentation-only immutable data and does not modify the measured inputs', () => {
  const source = button(), bounds = viewport()
  const before_source = { ...source }, before_bounds = { ...bounds }
  const geometry = send_surface_geometry(source, bounds)
  assert.deepEqual(source, before_source); assert.deepEqual(bounds, before_bounds)
  assert.equal(Object.isFrozen(geometry), true)
  for (const key of ['center', 'source', 'viewport']) assert.equal(Object.isFrozen(geometry[key]), true)
  assert.throws(() => { geometry.center.x = 0 }, TypeError)
  assert.equal(Object.hasOwn(geometry, 'user_id'), false)
  assert.equal(Object.hasOwn(geometry, 'account_id'), false)
})
