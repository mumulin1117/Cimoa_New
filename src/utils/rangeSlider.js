const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export const range_pointer_position = ({ client_x, left, width, inset = 0, min, max }) => {
  const available = Math.max(1, width - inset * 2)
  const ratio = clamp((client_x - left - inset) / available, 0, 1)
  return min + (max - min) * ratio
}

export const range_pointer_value = options => Math.round(range_pointer_position(options))

export const nearest_range_bound = (value, low, high, fallback = 'min') => {
  const low_distance = Math.abs(value - low), high_distance = Math.abs(value - high)
  if (low_distance === high_distance) return fallback === 'max' ? 'max' : 'min'
  return low_distance < high_distance ? 'min' : 'max'
}

export const range_with_bound = ({ bound, value, low, high }) => bound === 'max'
  ? { low, high: Math.max(low, value) }
  : { low: Math.min(value, high), high }
