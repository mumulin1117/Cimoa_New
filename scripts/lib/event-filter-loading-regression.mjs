// Runs against the real H5 in either Chrome or an isolated WKWebView.
export async function event_filter_loading_regression() {
  const checks = [], delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const wait = async predicate => { for (let i = 0; i < 300; i++) { if (predicate()) return; await delay(20) } throw Error('Category condition timed out: ' + location.hash) }
  const visible = selector => [...document.querySelectorAll(selector)].find(node => node.getBoundingClientRect().width > 0)
  const assert = (condition, message) => { if (!condition) throw Error(message); checks.push(message) }
  const chip = text => [...document.querySelectorAll('.events-chip')].find(node => node.textContent === text && node.getBoundingClientRect().width > 0)
  const disk = () => localStorage.getItem('cimoa_app_state_v2')
  const active = () => visible('.events-chip--active')?.textContent
  const loading = () => visible('.event-filter-loading')
  await wait(() => !!visible('.event-card'))
  await delay(280)
  const before = disk(), old = active(), target = old === 'This week' ? 'Today' : 'This week'
  const old_cards = [...document.querySelectorAll('.event-card')].map(node => node.dataset.eventId).join('|')
  const first_card = visible('.event-card'), before_top = first_card.getBoundingClientRect().top
  chip(old).click(); await delay(30)
  assert(!loading() && disk() === before, 'Selecting the active category produces no Loading or persistence write')
  chip(target).click()
  await wait(() => !!loading())
  assert(!visible('.event-loading'), 'Category feedback replaces the full-screen action spinner only for filtering')
  assert(disk() === before && active() === old, 'Original category and exact persistence remain unchanged during pre-write Loading')
  assert(first_card.isConnected && Math.abs(first_card.getBoundingClientRect().top - before_top) < 1 && [...document.querySelectorAll('.event-card')].map(node => node.dataset.eventId).join('|') === old_cards, 'Existing activity cards stay mounted without layout shift during category Loading')
  assert(chip(target).getAttribute('aria-busy') === 'true' && chip(target).getAttribute('aria-pressed') === 'false', 'Pending category is announced without falsely selecting it')
  const panel = visible('.event-filter-surface').getBoundingClientRect(), header = visible('.events-header').getBoundingClientRect(), bar = visible('.tabbar').getBoundingClientRect()
  assert(panel.top >= header.bottom && panel.bottom <= bar.top && panel.left >= 0 && panel.right <= innerWidth, 'Compact feedback remains inside the content viewport, clear of Header and Tabbar')
  const refresh = loading().querySelector('.brand-refresh')
  assert(refresh.getAttribute('aria-label') === 'Updating events: ' + target && refresh.querySelectorAll('animateMotion').length === 2, 'Accessible category copy and two orbit particles share the Home refresh language')
  chip('My campus').click(); chip(old).click()
  await wait(() => !loading())
  assert(active() === target, 'Rapid repeated category taps finish only the first pending intent')
  const after = JSON.parse(disk()).data, expected = JSON.parse(before).data
  expected.event_preferences.find(row => row.owner_user_id === expected.session.current_user_id).active_tab = target
  assert(after.revision === expected.revision + 1 && after.updated_at >= expected.updated_at, 'Exactly one canonical transaction updates normal revision metadata')
  expected.revision = after.revision; expected.updated_at = after.updated_at
  assert(JSON.stringify(after) === JSON.stringify(expected), 'Filtering changes only the canonical category preference, not relationships, coins, messages or attendance')
  await delay(150)
  assert(!visible('.event-filter-loading animateMotion') && visible('.event-filter-loading') === undefined, 'Completed feedback removes SVG motion and clears transient pending state')
  // Tab navigation must remain usable and cancel the old page's delayed write.
  const before_cancel = disk()
  chip(old).click(); await wait(() => !!loading())
  visible('.tabbar [aria-label="Discover"]').click()
  await wait(() => !!visible('.discover-photo-card--front'))
  await delay(620)
  assert(disk() === before_cancel, 'Leaving Events during Loading cancels the pending write and preserves Discover state')
  visible('.tabbar [aria-label="Events"]').click()
  await wait(() => !!visible('.events-header'))
  assert(!loading() && active() === target, 'Returning to Events has no stale Loading, selection or delayed result')
  return { passed: true, checks, panel: { x: panel.x, y: panel.y, width: panel.width, height: panel.height }, touch_input: 'Scoped DOM category clicks on actual uni-app controls' }
}
