import { DISCOVER_DECK } from '../config/discoverDeck.js'
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export const swipe_commits = (distance, width) => Number.isFinite(distance) && Number.isFinite(width) && width > 0 && Math.abs(distance) + DISCOVER_DECK.threshold_coordinate_tolerance >= width * DISCOVER_DECK.threshold_ratio
export const swipe_progress = (distance, width) => Number.isFinite(distance) && width > 0 ? clamp(Math.abs(distance) / (width * DISCOVER_DECK.threshold_ratio), 0, 1) : 0

// Measurements and allowance use the same coordinate space. Output translations
// remain percentages, so no device dimensions or design pixels enter the CSS.
export const deck_layer_bounds = (layer, width, height) => {
  const radians = layer.angle * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians)
  const origin_x = width * DISCOVER_DECK.origin.x, origin_y = height * DISCOVER_DECK.origin.y
  const points = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => ({
    x: origin_x + layer.scale * (cosine * (x - origin_x) - sine * (y - origin_y)) + width * layer.x / 100,
    y: origin_y + layer.scale * (sine * (x - origin_x) + cosine * (y - origin_y)) + height * layer.y / 100,
  }))
  return { left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)), top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)) }
}

let geometry_cache
export const deck_layer_geometry = ({ width, height, space = {} }) => {
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) return DISCOVER_DECK.layers.map(layer => ({ ...layer, x: 0, y: 0, angle: 0 }))
  const allowance = Object.fromEntries(['left', 'right', 'top', 'bottom'].map(edge => [edge, Number.isFinite(space[edge]) ? Math.max(0, space[edge]) : 0]))
  const cache_key = [width, height, allowance.left, allowance.right, allowance.top, allowance.bottom].join(':')
  if (geometry_cache?.key === cache_key) return geometry_cache.layers
  const layers_at = strength => DISCOVER_DECK.layers.map(layer => ({ ...layer, x: layer.x * strength, y: layer.y * strength, angle: layer.angle * strength }))
  const bounds_fit = (layer, reserve) => {
    const box = deck_layer_bounds(layer, width, height)
    const epsilon = 1e-7
    return box.left >= -allowance.left + reserve - epsilon && box.right <= width + allowance.right - reserve + epsilon && box.top >= -allowance.top + reserve - epsilon && box.bottom <= height + allowance.bottom - reserve + epsilon
  }
  const fits = strength => {
    const layers = layers_at(strength), reserve = Math.min(width, height) * DISCOVER_DECK.fit_clearance_ratio * strength
    // The path is curved when scale and angle change together. Test the path,
    // not just its endpoints; the small proportional reserve covers intervals.
    for (let depth = 1; depth < layers.length; depth++) for (let step = 0; step <= 16; step++) {
      const progress = step / 16, idle = layers[depth], next = layers[depth - 1]
      const layer = Object.fromEntries(Object.keys(idle).map(key => [key, idle[key] + (next[key] - idle[key]) * progress]))
      if (!bounds_fit(layer, reserve * (depth === 1 ? 1 - progress : 1))) return false
    }
    return true
  }
  const remember = strength => {
    const layers = Object.freeze(layers_at(strength).map(layer => Object.freeze(layer)))
    geometry_cache = { key: cache_key, layers }
    return layers
  }
  if (fits(1)) return remember(1)
  let low = 0, high = 1
  for (let count = 0; count < 24; count++) { const middle = (low + high) / 2; if (fits(middle)) low = middle; else high = middle }
  return remember(low)
}

// uni-app View does not forward unknown pointer events as DOM listeners.
// Keep this H5 binding scoped to the card and remove every listener on unmount.
export const bind_card_pointer_events = (element, handlers) => {
  if (!element?.addEventListener) return () => {}
  const listeners = { pointerdown: handlers.start, pointermove: handlers.move, pointerup: handlers.end, pointercancel: handlers.cancel, lostpointercapture: handlers.cancel }
  for (const [name, handler] of Object.entries(listeners)) element.addEventListener(name, handler, { passive: false })
  const document = element.ownerDocument, window = document?.defaultView
  const additional = event => handlers.additional?.(event)
  const suspend = () => { handlers.cancel(); handlers.suspend?.() }
  const resume = () => handlers.resume?.()
  const visibility = () => { if (document.hidden) suspend(); else resume() }
  const capture_options = { capture: true }
  document?.addEventListener('pointerdown', additional, capture_options)
  document?.addEventListener('pointerup', handlers.end, capture_options)
  document?.addEventListener('pointercancel', handlers.cancel, capture_options)
  document?.addEventListener('visibilitychange', visibility)
  window?.addEventListener('pagehide', suspend)
  window?.addEventListener('pageshow', resume)
  return () => {
    for (const [name, handler] of Object.entries(listeners)) element.removeEventListener(name, handler)
    document?.removeEventListener('pointerdown', additional, capture_options)
    document?.removeEventListener('pointerup', handlers.end, capture_options)
    document?.removeEventListener('pointercancel', handlers.cancel, capture_options)
    document?.removeEventListener('visibilitychange', visibility)
    window?.removeEventListener('pagehide', suspend)
    window?.removeEventListener('pageshow', resume)
  }
}

// One physical gesture has one owner. Cancellation never enters the completion
// callback, and a cancelled/moved gesture cannot synthesize a profile click.
export const create_pointer_gesture = ({ element, can_start = () => true, can_continue = can_start, start = () => {}, move = () => {}, end = () => {}, cancel = () => {}, capture = true, cancel_vertical = false, prevent_move = true, slop = () => 8, horizontal_bias = 1 }) => {
  let active = null, suppress_click = false
  const point = event => ({ pointerId: event?.pointerId ?? event?.detail?.pointerId ?? 'primary', clientX: Number(event?.clientX ?? event?.detail?.clientX), clientY: Number(event?.clientY ?? event?.detail?.clientY), button: Number(event?.button ?? 0), isPrimary: event?.isPrimary !== false })
  const release = row => {
    try { if (element()?.hasPointerCapture?.(row.pointerId)) element().releasePointerCapture(row.pointerId) } catch { /* WebKit may already have released capture. */ }
  }
  const take_capture = row => { try { element()?.setPointerCapture?.(row.pointerId) } catch { /* Detached nodes and synthetic events have no platform capture. */ } }
  const finish = (event, cancelled) => {
    if (!active || event && point(event).pointerId !== active.pointerId) return
    if (!cancelled && !can_continue(event)) { finish(event, true); return }
    const row = active
    if (!cancelled && event) update(event)
    if (!active) return
    active = null
    suppress_click ||= cancelled || row.axis !== null
    const payload = { ...row, ...(event ? point(event) : {}), cancelled }
    try { if (cancelled) cancel(payload); else end(payload) } finally { release(row) }
  }
  const update = event => {
    if (!active || point(event).pointerId !== active.pointerId) return
    if (!can_continue(event)) { finish(event, true); return }
    const next = point(event)
    if (!Number.isFinite(next.clientX) || !Number.isFinite(next.clientY)) return
    const dx = next.clientX - active.startX, dy = next.clientY - active.startY
    if (!active.axis && Math.hypot(dx, dy) >= slop(active)) active.axis = Math.abs(dx) >= Math.abs(dy) * horizontal_bias ? 'horizontal' : 'vertical'
    if (active.axis === 'vertical' && cancel_vertical) { finish(event, true); return }
    if (active.axis === 'horizontal' && capture === 'horizontal') take_capture(active)
    if (prevent_move && active.axis === 'horizontal') event.preventDefault?.()
    move({ ...active, ...next, dx, dy })
  }
  return {
    start(event) {
      const next = point(event)
      if (active) { if (next.pointerId !== active.pointerId) finish(null, true); return }
      if (!can_start(event) || next.button !== 0 || !next.isPrimary || !Number.isFinite(next.clientX) || !Number.isFinite(next.clientY)) return
      const bounds = element()?.getBoundingClientRect?.() || {}
      suppress_click = false
      active = { ...next, startX: next.clientX, startY: next.clientY, cardWidth: bounds.width, cardHeight: bounds.height, axis: null }
      if (capture === true) take_capture(active)
      start({ ...active })
    },
    move: update,
    end: event => finish(event, false),
    cancel: event => finish(event, true),
    additional(event) { if (active && point(event).pointerId !== active.pointerId) finish(null, true) },
    can_click: () => !active && !suppress_click,
  }
}

export const deck_card_style = ({ depth, x, y, width, height, space, dragging, settling, resetting, duration }) => {
  const progress = swipe_progress(x, width), layers = deck_layer_geometry({ width, height, space }), idle = layers[depth], lifted = layers[Math.max(0, depth - 1)]
  const blend = key => progress === 1 ? lifted[key] : progress === 0 ? idle[key] : idle[key] + (lifted[key] - idle[key]) * progress
  const transform = depth === 0
    ? `translate3d(${x / width * 100}%,${clamp(y * .12 / height * 100, -8, 8)}%,0) rotate(${clamp(x / width * 12, -18, 18)}deg)`
    : `translate3d(${blend('x')}%,${blend('y')}%,0) rotate(${blend('angle')}deg) scale(${blend('scale')})`
  const immediate = dragging && !settling || resetting
  // The existing one-time fan folds slightly inward before returning to its
  // resting spread. It never pushes a fitted rear corner farther outwards.
  const fan_angle = -Math.sign(idle.angle) * Math.min(DISCOVER_DECK.entrance.fan_angle, Math.abs(idle.angle) / 2)
  return { transform, zIndex: 3 - depth, '--deck-fan-angle': `${fan_angle}deg`, '--deck-shadow-strength': depth === 0 ? idle.shadow : blend('shadow'), '--deck-shadow-duration': immediate ? '0ms' : `${duration}ms`, transition: immediate ? 'none' : `transform ${duration}ms ${DISCOVER_DECK.easing}` }
}
