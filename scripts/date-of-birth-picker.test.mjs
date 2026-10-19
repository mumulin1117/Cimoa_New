import test from 'node:test'
import assert from 'node:assert/strict'
import { days_in_month, normalize_date_indices, initial_date_indices, date_picker_columns, date_from_indices } from '../src/utils/dateOfBirthPicker.js'
import { age_from_date } from '../src/utils/localAuth.js'
const now = Date.UTC(2026, 9, 19, 12)
test('calendar obeys leap years, centuries, short months and year zero without Date.UTC 1900 aliasing', () => {
  assert.equal(days_in_month(2000, 2), 29); assert.equal(days_in_month(1900, 2), 28); assert.equal(days_in_month(2024, 2), 29); assert.equal(days_in_month(0, 2), 29)
  assert.equal(date_from_indices([2024, 1, 30], now), '2024-02-29'); assert.equal(date_from_indices([2025, 1, 28], now), '2025-02-28'); assert.equal(date_from_indices([2000, 3, 30], now), '2000-04-30')
})
test('picker prevents future calendar values, retains minors and imposes no new maximum-age rule', () => {
  assert.equal(date_from_indices([2027, 11, 30], now), '2026-10-19'); assert.equal(date_from_indices([0, 0, 0], now), '0000-01-01')
  assert.deepEqual(date_picker_columns([2026, 9, 18], now).map(rows => rows.length), [2027, 10, 19]); assert.equal(date_from_indices([2020, 0, 0], now), '2020-01-01')
  assert.deepEqual(normalize_date_indices([-1, -3, NaN], now), [0, 0, 0])
})
test('saved date reopens exactly; empty draft previews but does not invent a committed DOB; exact 18 boundary is unchanged', () => {
  assert.deepEqual(initial_date_indices('2000-02-29', now), [2000, 1, 28]); assert.equal(date_from_indices(initial_date_indices('', now), now), '2008-10-19')
  assert.equal(age_from_date(date_from_indices([2008, 9, 18], now), now), 18); assert.equal(age_from_date(date_from_indices([2008, 9, 19], now), now), 17)
  assert.equal(date_from_indices(initial_date_indices('', Date.UTC(2024, 1, 29)), Date.UTC(2024, 1, 29)), '2006-02-28')
})
