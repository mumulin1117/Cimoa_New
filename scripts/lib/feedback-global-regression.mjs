// Self-contained and reusable in an isolated WKWebView. No production test hooks.
export async function feedback_global_regression({ mode = 'media', selector = '', ready_selector = '', portrait = false, toast_export = '' } = {}) {
  const checks = [], metrics = [], key = 'cimoa_app_state_v2'
  const check = (value, label) => { if (!value) throw Error(label); checks.push(label) }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const visible = element => { const rect = element?.getBoundingClientRect(); return !!rect && rect.width > 0 && rect.height > 0 && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden' }
  const current = query => [...document.querySelectorAll(query)].find(element => { const page = element.closest('uni-page'); return (!page || page === [...document.querySelectorAll('uni-page')].at(-1)) && visible(element) })
  const wait = async (predicate, label) => { for (let attempt = 0; attempt < 500; attempt++) { const value = predicate(); if (value) return value; await delay(16) } throw Error(`${label} (${location.hash})`) }
  const raw = () => localStorage.getItem(key), before = raw()
  const brand = element => {
    const mark = element.querySelector('.brand-progress-mark'), svg = mark?.querySelector('svg') || (mark?.matches('svg') ? mark : null)
    check(!!svg, 'Pending content uses the shared brand SVG progress mark')
    const rect = mark.getBoundingClientRect()
    check(rect.width > 0 && rect.height > 0 && rect.right <= innerWidth + 1 && rect.left >= -1, 'Brand mark is visible inside the viewport')
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) check(!mark.getAnimations({ subtree: true }).some(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations === Infinity), 'Reduced motion leaves the brand progress mark static')
    metrics.push({ width: rect.width, height: rect.height, x: rect.x, y: rect.y })
  }
  if (mode === 'media') {
    const element = await wait(() => current(selector), `Missing pending media ${selector}`)
    brand(element)
    const button = element.matches('[role="button"]') ? element : null
    if (button) {
      check(button.getAttribute('aria-busy') === 'true' && button.getAttribute('aria-disabled') === 'true', 'Pending media button exposes busy and disabled semantics')
      button.click(); button.click(); button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      check(button.getAttribute('aria-busy') === 'true', 'Repeated taps do not end the unresolved media loading state')
    }
    if (portrait) check(!element.closest('.profile-photo-status')?.textContent.trim(), 'Portrait loading avoids fitting redundant text inside a thumbnail')
    check(!current('.brand-action-blocker,.brand-action-loading'), 'Read-only media loading does not create a global interaction blocker')
    check(!current('.loading-mask,.loading-card,.event-loading-ring,.chat-action-loading__ring,uni-toast'), 'No legacy or native feedback skin is visible')
    await wait(() => !current(selector), 'Media loading does not resolve')
    if (ready_selector) await wait(() => current(ready_selector), `Media did not become ready: ${ready_selector}`)
    check(raw() === before, 'Media preparation and repeated pending taps do not mutate business persistence')
  } else if (mode === 'system') {
    const panel = await wait(() => current('.flow-state-panel[aria-busy="true"]'), 'System loading panel missing')
    check(panel.getAttribute('role') === 'status', 'System loading retains a persistent accessible state panel')
    brand(panel)
    check(!current('.brand-action-blocker,.brand-action-loading'), 'System read state does not impersonate a blocking business write')
    check(raw() === before, 'Viewing system loading changes no business persistence')
  } else if (mode === 'toast') {
    const scripts = [...document.querySelectorAll('script[type="module"][src]')]
    const main = scripts.find(script => /\/assets\/index-[^/]+\.js/.test(script.src))
    check(!!main, 'Built application entry module is discoverable without adding a production test hook')
    const module = await import(main.src)
    const show = module[toast_export]
    check(typeof show === 'function', 'Presentation test uses the existing exported show_toast function mapped from this exact build')
    for (const [tone, text] of [['info', 'Your preferences are up to date.'], ['warning', 'Check your connection and try again.'], ['error', 'Couldn’t send your introduction. Please try again.'], ['success', 'Profile updated']]) {
      show(text, { tone })
      const card = await wait(() => current(`#cimoa-toast-root .brand-toast--${tone}:not(.brand-toast-leave-active)`), `Missing ${tone} Toast`)
      await wait(() => +getComputedStyle(card).opacity > .99, `${tone} Toast did not finish entering`)
      const rect = card.getBoundingClientRect(), safe = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top')) || 0
      check(document.querySelectorAll('#cimoa-toast-root').length === 1 && [...document.querySelectorAll('.brand-toast')].filter(visible).length === 1, `${tone} uses one shared host and one visible brand card`)
      check(rect.top >= safe && Math.abs(rect.left + rect.width / 2 - innerWidth / 2) < 1 && rect.right <= innerWidth + 1, `${tone} card is top-centered inside the safe area`)
      check(getComputedStyle(card).backgroundImage.includes('gradient') && getComputedStyle(card.querySelector('.brand-toast-card')).backgroundColor.startsWith('rgba'), `${tone} has a gradient fine border and translucent surface`)
      check(!!card.querySelector('.brand-toast-icon svg') && !card.querySelector('.brand-progress-mark'), `${tone} retains its state icon rather than a busy spinner`)
      check(card.getAttribute('aria-live') === (tone === 'error' ? 'assertive' : 'polite') && card.getAttribute('aria-busy') === 'false', `${tone} accessible announcement matches its true non-busy state`)
      check(!current('.brand-action-blocker'), `${tone} feedback does not block the page`)
      metrics.push({ tone, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } })
      card.querySelector('.brand-toast-close').click()
      await wait(() => !current('.brand-toast:not(.brand-toast-leave-active)'), `${tone} Toast did not dismiss`)
    }
    check(raw() === before, 'Presentation-only Toast tone checks perform no business writes or simulated deliveries')
  } else if (mode === 'skeleton') {
    const skeleton = kind => current(`[data-skeleton="${kind}"]`)
    check(!!await wait(() => skeleton('home'), 'Cold Home skeleton missing'), 'Cold Home displays its dedicated content skeleton')
    check(!!current('.home-header') && !!current('.tabbar'), 'Home skeleton keeps Header and Tabbar available')
    await wait(() => !skeleton('home') && current('.connection'), 'Home content did not resolve')
    const tab = name => { const element = current(`.tabbar [aria-label="${name}"]`); check(!!element, `${name} Tab remains reachable`); element.click() }
    for (const [name, kind, ready] of [['Discover', 'discover', '.discover-photo-card--front'], ['Events', 'events', '.event-card']]) {
      tab(name); await wait(() => skeleton(kind), `${name} first skeleton missing`)
      check(!current('.brand-action-blocker'), `${name} skeleton remains content-local`)
      await wait(() => !skeleton(kind) && current(ready), `${name} did not show its existing data`)
    }
    for (const [name, kind, ready] of [['Home', 'home', '.connection'], ['Discover', 'discover', '.discover-photo-card--front'], ['Events', 'events', '.event-card']]) {
      tab(name); await wait(() => current(ready), `${name} warm content missing`)
      check(!skeleton(kind), `${name} warm Tab return does not replay the skeleton`)
    }
    check(raw() === before, 'Skeleton consumption and warm Tab navigation preserve exact business persistence')
  } else throw Error(`Unknown feedback global mode ${mode}`)
  return { passed: true, mode, selector, checks, metrics, route: location.hash, actual_microphone_requested: false }
}
