const precision = 1e6
const coordinate = value => Number(value.toFixed(6))
const measured_rect = value => {
  if (!value || ![value.left, value.top, value.width, value.height].every(Number.isFinite)) return null
  if (!(value.width > 0) || !(value.height > 0)) return null
  const rect = { left: value.left, top: value.top, width: value.width, height: value.height }
  rect.right = rect.left + rect.width; rect.bottom = rect.top + rect.height
  return [rect.right, rect.bottom].every(Number.isFinite) ? rect : null
}

// Full-screen vertical presentation needs only real visible-frame geometry;
// there is deliberately no button, circle origin or font scaling involved.
export function full_surface_geometry(source_rect, viewport_rect) {
  const source = measured_rect(source_rect), viewport = measured_rect(viewport_rect)
  if (!source || !viewport || source.right <= viewport.left || source.left >= viewport.right || source.bottom <= viewport.top || source.top >= viewport.bottom) return null
  return Object.freeze({ source: Object.freeze(source), viewport: Object.freeze(viewport) })
}

// Both rectangles use the same client-coordinate space. The returned px values
// are live measurements, never design dimensions or hard-coded device insets.
// A circle reveals the real destination at full scale; it does not stretch its
// text, duplicate its content or turn the route into a presentation-only Sheet.
export function send_surface_geometry(source_rect, viewport_rect) {
  const source = measured_rect(source_rect), viewport = measured_rect(viewport_rect)
  if (!source || !viewport) return null
  if (source.right <= viewport.left || source.left >= viewport.right || source.bottom <= viewport.top || source.top >= viewport.bottom) return null
  const x = source.left + source.width / 2 - viewport.left
  const y = source.top + source.height / 2 - viewport.top
  if (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x > viewport.width || y > viewport.height) return null
  const center = { x: coordinate(x), y: coordinate(y) }
  // Round the CSS origin first, then cover its actual four corners. Rounding
  // the radius upwards keeps the final clip from exposing a corner seam.
  const distance = Math.max(...[
    [0, 0], [viewport.width, 0], [0, viewport.height], [viewport.width, viewport.height],
  ].map(([corner_x, corner_y]) => Math.hypot(corner_x - center.x, corner_y - center.y)))
  const radius = Math.ceil(distance * precision) / precision
  if (!Number.isFinite(radius) || !(radius > 0)) return null
  const origin = `${center.x}px ${center.y}px`
  return Object.freeze({
    center: Object.freeze(center),
    radius,
    start_clip: `circle(0px at ${origin})`,
    end_clip: `circle(${radius}px at ${origin})`,
    source: Object.freeze(source),
    viewport: Object.freeze(viewport),
  })
}
