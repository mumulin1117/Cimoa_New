// Self-contained browser/WKWebView driver. Business fixtures are supplied by the runner.
export async function home_tail_match_regression({ kind = 'default', mode = 'inspect', expected_cards, expected_match_status, style_reference, activation = 'repeat-click' } = {}) {
  const checks = [], key = 'cimoa_app_state_v2', tail_id = 'home.startAutoMatch.click.3'
  const check = (condition, message) => { if (!condition) throw Error(message); checks.push(message) }
  const delay = duration => new Promise(resolve => setTimeout(resolve, duration))
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const wait = async (predicate, message) => { for (let attempt = 0; attempt < 320; attempt++) { const value = predicate(); if (value) return value; await delay(25) } throw Error(message) }
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const page = element.closest('uni-page'), pages = [...document.querySelectorAll('uni-page')]
    return (!page || page === pages.at(-1)) && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
  const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
  const same_box = (a, b) => Object.keys(a).every(name => Math.abs(a[name] - b[name]) <= 1)
  const raw = () => localStorage.getItem(key)
  const settle = async root => {
    await document.fonts?.ready
    await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await frame()
  }
  const style = element => {
    const result = {}, computed = getComputedStyle(element)
    for (const name of ['display', 'alignItems', 'justifyContent', 'minHeight', 'borderRadius', 'gap', 'backgroundImage', 'color', 'boxShadow', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing']) result[name] = computed[name]
    const icon = element.querySelector('.empty-flash'), svg = icon?.querySelector('svg')
    result.icon = icon ? { width: getComputedStyle(icon).width, height: getComputedStyle(icon).height, view_box: svg?.getAttribute('viewBox'), path: svg?.querySelector('path')?.getAttribute('d'), fill: svg ? getComputedStyle(svg).fill : '' } : null
    return result
  }
  if (mode === 'suppressed') {
    const selector = kind === 'skeleton' ? '[data-skeleton="home"]' : kind === 'error' ? '.home-read-error' : '.welcome-page'
    await wait(() => current(selector), `${kind} state did not render`)
    check(!current(`[data-interaction="${tail_id}"]`), `${kind} never exposes the populated-list CTA`)
    if (kind === 'skeleton') check(!!current('.home-header') && !!current('.tabbar'), 'Skeleton retains the fixed Home header and Tabbar')
    if (kind === 'error') check(!current('.connection,.empty-actions'), 'Storage errors do not become an empty or populated success state')
    if (kind === 'session_expired') check(!current('.home-header,.home-content,.tabbar'), 'Expired sessions expose no protected Home content')
    return { passed: true, kind, mode, checks, route: location.hash }
  }
  if (!['inspect', 'navigation'].includes(mode) || !['repeat-click', 'enter'].includes(activation)) throw Error('Invalid Home tail match regression mode')
  const root = await wait(() => current('.main-tab-frame') && !current('[data-skeleton="home"]') && current('.home-content') && current('.main-tab-frame'), 'Home content did not finish its initial skeleton')
  await settle(root)
  const before = raw(), header = root.querySelector('.home-header'), tabbar = root.querySelector('.tabbar')
  const content = root.querySelector('.home-content'), cards = [...root.querySelectorAll('.connection')], order = cards.map(card => card.id)
  if (expected_cards) check(JSON.stringify(order) === JSON.stringify(expected_cards.map(id => `connection-${id}`)), 'The canonical fixture card order is preserved')
  if (expected_match_status !== undefined) check((root.querySelector('.match-status')?.dataset.target || null) === expected_match_status, 'The existing active-match status card retains its exact canonical target')
  const empty = kind === 'home_empty', buttons = [...root.querySelectorAll(`[data-interaction="${tail_id}"]`)]
  check(buttons.length === (empty ? 0 : 1), 'The populated-list CTA appears exactly once only when the canonical list has cards')
  check(cards.length === (empty ? 0 : cards.length) && (empty || cards.length > 0), 'The fixture uses real empty or populated Home entities')
  check(root.querySelectorAll('.main-tab-scroll').length === 1, 'Home retains its single main content scroll-view')
  const primary = empty ? root.querySelector('[data-interaction="home.startAutoMatch.click.2"]') : buttons[0]
  check(!!primary && primary.innerText.trim() === 'Start Auto Match', 'The source primary action retains its visible English label')
  check(primary.getAttribute('role') === 'button' && primary.getAttribute('tabindex') === '0', 'Start Auto Match remains a focusable semantic button')
  check(primary.dataset.target === '/pages/auto-match/index', 'The action targets the existing Auto Match entry')
  if (empty) {
    check(root.querySelectorAll('.empty-actions').length === 1 && !!root.querySelector('[data-interaction="home.exploreDiscover.click.1"]'), 'The original empty-state actions remain available')
  } else {
    const actions = primary.parentElement, last = root.querySelector('.match-status') || cards.at(-1)
    check(actions.classList.contains('home-list-actions') && actions === content.lastElementChild, 'The CTA wrapper is the final item in the Home scroll content')
    check(!!(last.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING), 'The CTA follows all cards and the optional active-match status card')
    check(!root.querySelector('.empty-actions,[data-interaction="home.exploreDiscover.click.1"]'), 'A populated Home adds only the requested primary action')
  }
  const scroll = [...root.querySelectorAll('.main-tab-scroll .uni-scroll-view')].find(element => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))
  check(!!scroll, 'The actual uni-app vertical scroll owner is available')
  scroll.scrollTop = 0; await frame()
  const fixed = { header: box(header), tabbar: box(tabbar) }
  scroll.scrollTop = scroll.scrollHeight; await frame()
  await wait(() => Math.abs(scroll.scrollTop - Math.max(0, scroll.scrollHeight - scroll.clientHeight)) <= 2, 'The main content did not reach its real scroll end')
  const metrics = { viewport: { width: innerWidth, height: innerHeight }, header: box(header), tabbar: box(tabbar), primary: box(primary), scroll: box(scroll), scroll_top: scroll.scrollTop, scroll_max: scroll.scrollHeight - scroll.clientHeight, cards: order, match_status: root.querySelector('.match-status')?.dataset.target || null, style: style(primary) }
  check(same_box(fixed.header, metrics.header) && same_box(fixed.tabbar, metrics.tabbar), 'Header and Tabbar stay fixed while the actual list scrolls')
  check(metrics.primary.width > 0 && metrics.primary.x >= -1 && metrics.primary.right <= innerWidth + 1, 'The primary action fits the viewport width')
  check(metrics.primary.y >= metrics.scroll.y - 1 && metrics.primary.bottom <= metrics.scroll.bottom + 1 && metrics.primary.bottom <= metrics.tabbar.y + 1, 'At the real scroll end the whole CTA is visible above the fixed Tabbar')
  const safe_bottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom')) || 0
  check(metrics.primary.bottom <= innerHeight - safe_bottom + 1, 'The primary action remains above the injected physical bottom safe area')
  for (const [x, y] of [[.5, .5], [.15, .5], [.85, .5]]) {
    const hit = document.elementFromPoint(metrics.primary.x + metrics.primary.width * x, metrics.primary.y + metrics.primary.height * y)
    check(hit === primary || primary.contains(hit), 'The visible CTA receives pointer input without an overlay')
  }
  check(document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1 && document.body.scrollHeight <= innerHeight + 1 && document.documentElement.scrollTop === 0 && document.body.scrollTop === 0, 'The outer document has no horizontal or vertical overflow')
  check(metrics.style.backgroundImage.includes('linear-gradient') && !!metrics.style.icon?.path, 'The existing gradient primary and source lightning icon are rendered')
  if (style_reference) check(JSON.stringify(metrics.style) === JSON.stringify(style_reference), 'The populated CTA computed style exactly matches the empty-state primary')
  check(raw() === before, 'Reading and scrolling Home leaves persistent bytes unchanged')
  if (mode === 'inspect') return { passed: true, kind, mode, checks, metrics }

  const original_set = Storage.prototype.setItem, original_remove = Storage.prototype.removeItem, original_clear = Storage.prototype.clear
  let writes = 0, loading_seen = false
  const observe = () => { if (current('.event-loading,.write-loading,.business-loading')) loading_seen = true }
  const observer = new MutationObserver(observe)
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
  Storage.prototype.setItem = function (name, value) { if (name === key) writes++; return original_set.call(this, name, value) }
  Storage.prototype.removeItem = function (name) { if (name === key) writes++; return original_remove.call(this, name) }
  Storage.prototype.clear = function () { writes++; return original_clear.call(this) }
  try {
    const depth = Number(root.dataset.pageDepth), scroll_top = scroll.scrollTop
    if (activation === 'enter') { primary.focus(); primary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })) }
    else { primary.click(); primary.click(); primary.click() }
    const entry = await wait(() => current('.auto-match-index'), 'Start Auto Match did not open the existing entry page')
    await settle(entry); observe()
    check(location.hash.split('?')[0] === '#/pages/auto-match/index', 'The CTA opens Auto Match entry without entering the pool')
    check(Number(entry.dataset.pageDepth) === depth + 1 && document.querySelectorAll('.auto-match-index').length === 1, 'Repeated activation pushes one entry page')
    check(!loading_seen, 'Pure matching navigation does not display business Loading')
    check(raw() === before && writes === 0, 'Opening the entry creates no match, quota, coin or other persistent writes')
    const entry_data = JSON.parse(raw()).data, original_data = JSON.parse(before).data
    for (const name of ['match_sessions', 'match_quota', 'coin_transactions']) check(JSON.stringify(entry_data[name]) === JSON.stringify(original_data[name]), `${name} remains unchanged on entry`)
    const back = entry.querySelector('[data-interaction="amEntry.goBack.click.1"]')
    check(!!back, 'The existing Auto Match Back action is present'); back.click()
    await wait(() => current('.main-tab-frame') === root && !current('.auto-match-index'), 'Back did not restore the original Home instance')
    await settle(root)
    check(Number(root.dataset.pageDepth) === depth && depth === 1, 'Back restores the original single root Home')
    check(JSON.stringify([...root.querySelectorAll('.connection')].map(card => card.id)) === JSON.stringify(order), 'Back retains canonical cards and their order')
    check(Math.abs(scroll.scrollTop - scroll_top) <= 2, 'Back retains the actual Home list scroll position')
    check(!root.querySelector('[data-skeleton="home"]'), 'A warm Back does not replay the Home skeleton')
    check(raw() === before && writes === 0, 'The complete entry and Back round trip preserves storage byte for byte')
    check(!loading_seen, 'The complete navigation round trip has no business Loading')
    return { passed: true, kind, mode, activation, checks, metrics, destination: '/pages/auto-match/index', writes }
  } finally {
    observer.disconnect(); Storage.prototype.setItem = original_set; Storage.prototype.removeItem = original_remove; Storage.prototype.clear = original_clear
  }
}
