import { age_from_date } from './localAuth.js'

export const utc_date_key = now => new Date(now).toISOString().slice(0, 10)
const parts = now => utc_date_key(now).split('-').map(Number)
const bound = (value, max) => Math.max(0, Math.min(max, Number.isInteger(value) ? value : 0))
export const days_in_month = (year, month) => [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]

export function normalize_date_indices(value, now) {
  const [year, month, day] = parts(now), input = Array.isArray(value) ? value : []
  const y = bound(input[0], year), m = bound(input[1], y === year ? month - 1 : 11)
  const maximum = y === year && m === month - 1 ? day : days_in_month(y, m + 1)
  return [y, m, bound(input[2], maximum - 1)]
}
export function initial_date_indices(value, now) {
  if (age_from_date(value, now) !== null) {
    const [y, m, d] = value.split('-').map(Number)
    return normalize_date_indices([y, m - 1, d - 1], now)
  }
  const [y, m, d] = parts(now), year = Math.max(0, y - 18)
  return normalize_date_indices([year, m - 1, Math.min(d, days_in_month(year, m)) - 1], now)
}
export function date_picker_columns(value, now) {
  const [year, month, day] = parts(now), [y, m] = normalize_date_indices(value, now)
  const sequence = count => Array.from({ length: count }, (_, i) => i + 1)
  return [Array.from({ length: year + 1 }, (_, i) => i), sequence(y === year ? month : 12), sequence(y === year && m === month - 1 ? day : days_in_month(y, m + 1))]
}
export function date_from_indices(value, now) {
  const [y, m, d] = normalize_date_indices(value, now)
  return [String(y).padStart(4, '0'), String(m + 1).padStart(2, '0'), String(d + 1).padStart(2, '0')].join('-')
}
