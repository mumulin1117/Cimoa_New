// Runs unchanged in WKWebView. Synthetic touch events exercise uni-app's actual
// scroll-view refresher listeners; browser regression separately uses CDP touch input.
export async function content_loading_regression() {
  const results = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const wait = async predicate => { for (let i = 0; i < 250; i++) { if (predicate()) return; await delay(20) } throw Error('Content loading condition timed out at ' + location.hash) }
  const assert = (condition, text) => { if (!condition) throw Error(text); results.push(text) }
  const find = selector => [...document.querySelectorAll(selector)].find(node => node.getBoundingClientRect().width > 0)
  const skeleton = kind => find(`[data-skeleton="${kind}"]`)
  const click = selector => { const node = find(selector); if (!node) throw Error('Missing control: ' + selector); node.click() }
  const tab = name => click(`.tabbar [aria-label="${name}"]`)
  const state = () => localStorage.getItem('cimoa_app_state_v2')
  assert(!!skeleton('home'), 'Cold-start Home uses the content skeleton')
  assert(!!find('.home-header') && !!find('.tabbar'), 'Header and Tabbar stay present during skeleton')
  await wait(() => !skeleton('home') && find('.connection'))
  const before = state(), names = [...document.querySelectorAll('.connection-name')].map(node => node.textContent).join('|')
  tab('Discover'); await wait(() => !!skeleton('discover')); await wait(() => !skeleton('discover') && !!find('.discover-photo-card--front'))
  click('.discover-photo-card--front'); await wait(() => !!skeleton('profile'))
  assert(!!find('[data-interaction="expanded.collapse.click.1"]'), 'Profile Back stays available during loading')
  await wait(() => !!find('.expanded-photo-card'))
  click('[data-interaction="expanded.collapse.click.1"]'); await wait(() => !!find('.discover-photo-card--front'))
  click('.discover-photo-card--front'); await wait(() => !!find('.expanded-photo-card'))
  assert(!skeleton('profile'), 'Cached profile opens without another skeleton')
  click('[data-interaction="expanded.collapse.click.1"]'); await wait(() => !!find('.discover-photo-card--front'))
  tab('Events'); await wait(() => !!skeleton('events')); await wait(() => !!find('.event-card .event-cover'))
  click('.event-card .event-cover'); await wait(() => !!skeleton('event'))
  await delay(280) // Measure after the existing cRise transition, not its translated first frame.
  assert(Math.abs(skeleton('event').getBoundingClientRect().top) < 1, 'Event skeleton cover starts at the viewport top')
  assert(!!find('[data-interaction="evDetail.goBack.click.1"]'), 'Event Back stays available during loading')
  await wait(() => !!find('.event-detail-cover'))
  click('[data-interaction="evDetail.goBack.click.1"]'); await wait(() => !!find('.events-header'))
  click('.event-card .event-cover'); await wait(() => !!find('.event-detail-cover'))
  assert(!skeleton('event'), 'Cached event opens without another skeleton')
  click('[data-interaction="evDetail.goBack.click.1"]'); await wait(() => !!find('.events-header'))
  tab('Home'); await wait(() => !!find('.connection'))
  assert(!skeleton('home'), 'Warm Tab return does not replay the skeleton')
  await delay(280)
  const main = find('.main-tab-scroll .uni-scroll-view-scrollbar-hidden')
  const rect = main.getBoundingClientRect(), start = rect.top + 30
  const dispatch = (type, y) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    const touch = { identifier: 1, target: main, pageX: 180, clientX: 180, pageY: y, clientY: y }
    Object.defineProperties(event, { touches: { value: ['touchend', 'touchcancel'].includes(type) ? [] : [touch] }, changedTouches: { value: [touch] } })
    main.dispatchEvent(event)
  }
  dispatch('touchstart', start)
  for (let i = 1; i <= 9; i++) { dispatch('touchmove', start + i * 20); await delay(15) }
  dispatch('touchcancel', start + 180)
  await wait(() => document.querySelector('.uni-scroll-view-refresher').getBoundingClientRect().height === 0)
  assert(!find('.brand-refresh--active') && state() === before, 'Cancelled touch retracts the real refresher without starting a business refresh')
  dispatch('touchstart', start)
  for (let i = 1; i <= 9; i++) { dispatch('touchmove', start + i * 20); await delay(15) }
  dispatch('touchend', start + 180)
  await wait(() => !!find('.brand-refresh--active'))
  const refresh = find('.brand-refresh--active')
  assert(refresh.dataset.refreshState === 'refreshing' && refresh.querySelectorAll('animateMotion').length === 2, 'Encounter Orbit follows the controlled refreshing state with two moving particles')
  const particle = refresh.querySelector('.refresh-orbit-flow .refresh-orbit-particle--cyan')
  const first = particle.getCTM()
  await delay(90)
  const next = particle.getCTM()
  assert(Math.hypot(next.e - first.e, next.f - first.f) > 1, 'WKWebView renders the new particle path motion, not the title Logo')
  assert([...document.querySelectorAll('.connection-name')].map(node => node.textContent).join('|') === names, 'Pull refresh keeps all existing list content')
  assert(!!find('.tabbar') && !!find('.home-header'), 'Refresh does not cover navigation')
  await wait(() => !find('.brand-refresh--active'))
  assert(state() === before, 'Refresh and all read-only navigation preserve exact business persistence bytes')
  const shimmer = getComputedStyle(document.querySelector('.skeleton-block') || main).backgroundColor
  return { passed: true, checks: results, safe_top: getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top'), safe_bottom: getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom'), touch_input: 'DOM touch events through actual uni-app listeners, not physical simulator gestures', backdrop: shimmer }
}

