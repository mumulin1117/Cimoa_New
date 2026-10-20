import { DISCOVER_DECK } from '../config/discoverDeck.js'
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export const swipe_commits = (distance, width) => Number.isFinite(distance) && Number.isFinite(width) && width > 0 && Math.abs(distance) + DISCOVER_DECK.threshold_coordinate_tolerance >= width * DISCOVER_DECK.threshold_ratio
export const swipe_progress = (distance, width) => Number.isFinite(distance) && width > 0 ? clamp(Math.abs(distance) / (width * DISCOVER_DECK.threshold_ratio), 0, 1) : 0

// uni-app View does not forward unknown pointer events as DOM listeners.
// Keep this H5 binding scoped to the card and remove every listener on unmount.
export const bind_card_pointer_events = (element, handlers) => {
  const listeners = { pointerdown: handlers.start, pointermove: handlers.move, pointerup: handlers.end, pointercancel: handlers.cancel, lostpointercapture: handlers.cancel }
  for (const [name, handler] of Object.entries(listeners)) element.addEventListener(name, handler, { passive: false })
  return () => { for (const [name, handler] of Object.entries(listeners)) element.removeEventListener(name, handler) }
}

export const deck_card_style = ({ depth, x, y, width, height, dragging, settling, resetting, duration }) => {
  const progress = swipe_progress(x, width), idle = DISCOVER_DECK.layers[depth], lifted = DISCOVER_DECK.layers[Math.max(0, depth - 1)]
  const blend = key => progress === 1 ? lifted[key] : progress === 0 ? idle[key] : idle[key] + (lifted[key] - idle[key]) * progress
  const transform = depth === 0
    ? `translate3d(${x / width * 100}%,${clamp(y * .12 / height * 100, -8, 8)}%,0) rotate(${clamp(x / width * 12, -18, 18)}deg)`
    : `translate3d(${blend('x')}%,${blend('y')}%,0) rotate(${blend('angle')}deg) scale(${blend('scale')})`
  return { transform, zIndex: 3 - depth, transition: dragging && !settling || resetting ? 'none' : `transform ${duration}ms ${DISCOVER_DECK.easing}` }
}
