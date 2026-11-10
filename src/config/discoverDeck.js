export const DISCOVER_DECK = Object.freeze({
  threshold_ratio: 1 / 3,
  threshold_coordinate_tolerance: 1,
  exit_ms: 260,
  rebound_ms: 300,
  exit_ratio: 1.55,
  click_guard_ms: 320,
  tap_slop_ratio: .018,
  easing: 'cubic-bezier(.2,.8,.25,1)',
  entrance: Object.freeze({ fan_ms: 560, sweep_ms: 800, fade_ms: 240, fan_angle: .85, fan_scale: 1.006 }),
  origin: Object.freeze({ x: .5, y: .92 }),
  fit_clearance_ratio: .003,
  layers: Object.freeze([
    Object.freeze({ x: 0, y: 0, angle: 0, scale: 1, shadow: 1 }),
    Object.freeze({ x: -2.2, y: .6, angle: -3.4, scale: .95, shadow: .64 }),
    Object.freeze({ x: 3.2, y: 1.2, angle: 3.8, scale: .91, shadow: .36 }),
  ]),
})
