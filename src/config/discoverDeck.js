export const DISCOVER_DECK = Object.freeze({
  threshold_ratio: 1 / 3,
  threshold_coordinate_tolerance: 1,
  exit_ms: 260,
  rebound_ms: 300,
  exit_ratio: 1.55,
  click_guard_ms: 320,
  tap_slop_ratio: .018,
  easing: 'cubic-bezier(.2,.8,.25,1)',
  layers: Object.freeze([
    Object.freeze({ x: 0, y: 0, angle: 0, scale: 1 }),
    Object.freeze({ x: 0, y: 1.2, angle: -2.4, scale: .96 }),
    Object.freeze({ x: 1, y: 1.9, angle: 2.2, scale: .92 }),
  ]),
})
