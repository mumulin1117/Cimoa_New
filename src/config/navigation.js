export const MAIN_TABS = Object.freeze([
  { id: 'home', label: 'Home', path: 'pages/home/index', icon: 'home' },
  { id: 'discover', label: 'Discover', path: 'pages/discover/index', icon: 'discover' },
  { id: 'events', label: 'Events', path: 'pages/events/index', icon: 'events' },
])
export const route_path = (url = '') => url.replace(/^\//, '').split('?')[0]
export const MOTION = Object.freeze({ home: 260, page: 240, back: 180, popover: 180, skeleton: 600 })
