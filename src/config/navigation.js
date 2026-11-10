export const MAIN_TABS = Object.freeze([
  { id: 'home', label: 'Home', path: 'pages/home/index', icon: 'home' },
  { id: 'discover', label: 'Discover', path: 'pages/discover/index', icon: 'discover' },
  { id: 'events', label: 'Events', path: 'pages/events/index', icon: 'events' },
])
export const route_path = (url = '') => url.replace(/^\//, '').split('?')[0]
export const NAVIGATION = Object.freeze({ callback_timeout_ms: 8000, keyboard_timeout_ms: 1200 })
export const SEND_SURFACE_MOTION = Object.freeze({ enter_easing: 'cubic-bezier(.2,.8,.25,1)', exit_easing: 'cubic-bezier(.4,0,1,1)' })
export const STACK_SURFACE_MOTION = Object.freeze({ enter_easing: 'cubic-bezier(.22,.75,.2,1)', exit_easing: 'cubic-bezier(.32,0,.22,1)', parallax: 0.3 })
export const MOTION = Object.freeze({ home: 260, discover: 260, events: 260, sheet: 240, page: 240, back: 180, popover: 180, skeleton: 600, skeleton_shimmer: 1000, skeleton_reveal: 440, skeleton_stagger: 60, content_refresh: 600, refresh_orbit: 1200, refresh_settle: 260, refresh_fade: 180, event_filter_enter: 180, event_filter_leave: 140, splash: 1800, splash_progress: 1500, startup_handoff: 240, startup_arc: 1200, coin_pulse: 1800, coin_spend_pulse: 1600, match_pulse: 2600, match_pulse_delay: 400, match_connected: 520, toast_enter: 220, toast_leave: 160, action_orbit: 1200, action_breathe: 1800, press_in: 120, press_out: 180, tab_slide: 260, tab_icon: 260, match_ignite: 240, avatar_relay: 240, connection_glint: 900 })
