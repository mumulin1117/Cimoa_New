import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { nearest_range_bound, range_pointer_position, range_pointer_value, range_with_bound } from '../src/utils/rangeSlider.js'

test('pointer positions map to each existing integer preference range', () => {
  const input = { left: 20, width: 300, inset: 30, min: 18, max: 35 }
  assert.equal(range_pointer_value({ ...input, client_x: 20 }), 18)
  assert.equal(range_pointer_value({ ...input, client_x: 50 }), 18)
  assert.equal(range_pointer_value({ ...input, client_x: 170 }), 27)
  assert.equal(range_pointer_value({ ...input, client_x: 290 }), 35)
  assert.equal(range_pointer_value({ ...input, client_x: 400 }), 35)
  assert.equal(range_pointer_value({ left: 20, width: 300, inset: 30, min: 140, max: 200, client_x: 110 }), 155)
  assert.equal(range_pointer_value({ left: 20, width: 300, inset: 30, min: 0, max: 100, client_x: 230 }), 75)
  assert.equal(range_pointer_position({ ...input, client_x: 53 }), 18.2125)
})

test('a drag keeps ownership of its chosen bound and cannot cross the other handle', () => {
  assert.equal(nearest_range_bound(20, 18, 30), 'min')
  assert.equal(nearest_range_bound(29, 18, 30), 'max')
  assert.equal(nearest_range_bound(24, 18, 30, 'max'), 'max')
  assert.deepEqual(range_with_bound({ bound: 'min', value: 33, low: 18, high: 30 }), { low: 30, high: 30 })
  assert.deepEqual(range_with_bound({ bound: 'max', value: 17, low: 18, high: 30 }), { low: 18, high: 18 })
})

test('Preferences wires all three cancellable horizontal drags without changing Save persistence', () => {
  const page = fs.readFileSync(new URL('../src/pages/auto-match/preferences.vue', import.meta.url), 'utf8')
  assert.match(page, /create_pointer_gesture/)
  assert.match(page, /capture:'horizontal',cancel_vertical:true/)
  assert.match(page, /slop:\(\)=>2,horizontal_bias:\.7/)
  assert.match(page, /range_pointer_position/)
  assert.match(page, /data-range-bound="min"/)
  assert.match(page, /data-range-bound="max"/)
  assert.match(page, /kind:'height',min:140,max:200/)
  assert.match(page, /kind:'distance',min:0,max:100,value:'distance_max'/)
  assert.equal(page.match(/touch-action:\s*pan-y/g)?.length, 3)
  assert.match(page, /onUnmounted\(\(\)=>\{cancel_range_drags\(\);range_drags\.forEach/)
  assert.match(page, /action\('savePrefs'/)
})
