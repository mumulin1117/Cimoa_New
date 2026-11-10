// Self-contained UI driver for an isolated browser or non-persistent WKWebView.
// Fixtures are supplied before hydration; this driver never rewrites business data.
export async function match_return_regression(options = {}) {
  const { kind = 'found-home', match_id = '', repeat = true } = options
  const checks = [], trace = [], key = 'cimoa_app_state_v2'
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const raw = () => localStorage.getItem(key)
  const data = () => JSON.parse(raw()).data
  const current = selector => [...document.querySelectorAll(selector)].find(element => {
    const page = element.closest('uni-page'), pages = [...document.querySelectorAll('uni-page')]
    return (!page || page === pages.at(-1)) && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
  const snapshot = label => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const rendered = [...document.querySelectorAll('uni-page .page-transition')].map(element => ({ class: element.className, depth: element.closest('[data-page-depth]')?.dataset.pageDepth, route: element.closest('uni-page')?.getAttribute('data-page') }))
    const row = { label, at: performance.now(), route: location.hash, stack: pages.map(page => ({ route: page.route, options: page.options })), rendered_stack: rendered, text: document.body.innerText.slice(-1200) }
    trace.push(row); return row
  }
  const check = (value, label) => { if (!value) throw Error(`${label}: ${location.hash}`); checks.push(label) }
  const wait = async (predicate, label, timeout = 12000) => {
    const end = performance.now() + timeout
    while (performance.now() < end) { const result = predicate(); if (result) return result; await delay(25) }
    snapshot(`timeout:${label}`); throw Error(`${label}: ${location.hash}`)
  }
  const settle = async root => {
    await Promise.all(root.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await delay(35)
  }
  const activate = async (id, twice = repeat) => {
    const element = await wait(() => current(`[data-interaction="${id}"]`), `Missing action ${id}`)
    await settle(element.closest('.page-transition') || element)
    await wait(() => !element.closest('[inert]') && element.getAttribute('aria-disabled') !== 'true' && [...document.querySelectorAll('.send-surface-host')].every(host => [...host.attributes].filter(attribute => /-phase$/.test(attribute.name)).every(attribute => ['idle', 'settled', 'complete'].includes(attribute.value))), `Action ${id} is still being presented`)
    snapshot(`click:${id}`); element.click(); if (twice) element.click()
    return element
  }
  const root = document.querySelector('#app')?.__vue_app__, router = root?.config.globalProperties.$router
  const undo = [], unhandled = [], errors = [], callbacks = []
  let router_fault_used = false
  if (kind.startsWith('lost') && router?.replace) {
    const original = router.replace
    router.replace = function (to, ...args) {
      const destination = typeof to === 'string' ? to : to.path || to.fullPath || ''
      if (!router_fault_used && destination.includes('/auto-match/passed')) {
        router_fault_used = true
        trace.push({ label: 'diagnostic.router.replace', at: performance.now(), destination, fault: 'real-arrival-with-unsettled-router-promise' })
        const result = original.call(this, to, ...args)
        Promise.resolve(result).catch(error => trace.push({ label: 'diagnostic.actual-route-rejection', message: String(error) }))
        return new Promise(() => {})
      }
      return original.call(this, to, ...args)
    }
    undo.push(() => { router.replace = original })
  }
  const on_rejection = event => { unhandled.push(String(event.reason?.stack || event.reason)); snapshot('unhandledrejection') }
  const on_error = event => errors.push(String(event.error?.stack || event.message))
  addEventListener('unhandledrejection', on_rejection); addEventListener('error', on_error)
  if (router?.afterEach) undo.push(router.afterEach((to, from, failure) => trace.push({ label: 'router.afterEach', at: performance.now(), to: to.fullPath, from: from.fullPath, failure: failure ? String(failure) : null })))
  if (router?.onError) undo.push(router.onError(error => errors.push(String(error.stack || error))))
  const methods = ['navigateTo', 'redirectTo', 'reLaunch', 'navigateBack'], uni_ref = globalThis.uni, originals = {}
  for (const name of methods) if (typeof uni_ref?.[name] === 'function') {
    const original = uni_ref[name]; originals[name] = original
    uni_ref[name] = function (parameters) {
      const request = { label: `uni.${name}`, at: performance.now(), url: parameters.url, delta: parameters.delta, callbacks: [] }; trace.push(request)
      const forwarded = { ...parameters }
      for (const callback of ['success', 'fail', 'complete']) forwarded[callback] = value => { const result = { method: name, callback, at: performance.now(), value }; request.callbacks.push(result); callbacks.push(result); return parameters[callback]?.(value) }
      return original.call(this, forwarded)
    }
  }
  const before = raw(), before_data = data()
  let writes = 0, loading = false, original_set = Storage.prototype.setItem
  Storage.prototype.setItem = function (name, value) { if (name === key) { writes++; trace.push({ label: 'business.write', at: performance.now() }) } return original_set.call(this, name, value) }
  const observer = new MutationObserver(() => { if (current('.brand-action-loading')) loading = true })
  observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true })
  try {
    snapshot('begin')
    if (kind.startsWith('history')) {
      await wait(() => current('.home-header'), 'Home did not mount')
      await activate('home.startAutoMatch.click.1')
      await wait(() => current('.auto-match-index'), 'Home did not open Auto Match')
      await activate('amEntry.openHistory.click.1')
      await wait(() => current('.auto-match-history'), 'History did not mount')
      const history = await wait(() => current('[data-interaction="amHistory.h.go.click.1"]'), 'Passed history item missing')
      await settle(history.closest('.page-transition')); history.click(); if (repeat) history.click()
      await wait(() => current('.auto-match-passed'), 'History did not open the canonical Passed result')
      check(raw() === before && writes === 0, 'History navigation preserves all persisted business bytes')
    } else if (kind.startsWith('auto')) {
      await wait(() => current('.home-header'), 'Home did not mount')
      await activate('home.startAutoMatch.click.1')
      await wait(() => current('.auto-match-index'), 'Home did not open Auto Match')
      const start = performance.now(); await activate('amEntry.joinPool.click.1')
      await wait(() => current('.brand-action-loading'), 'Admission Loading missing')
      check(raw() === before, 'Admission presents branded Loading before business persistence')
      await wait(() => current('.auto-match-searching'), 'Admission did not open Searching')
      check(performance.now() - start >= 400, 'Admission retains the established write wait')
      const admitted = data().match_sessions.find(row => !before_data.match_sessions.some(old => old.match_id === row.match_id))
      check(!!admitted, 'Repeated admission commits one canonical match')
      await wait(() => current('.auto-match-found'), 'Searching did not follow its existing nine-second candidate deadline', 14000)
      check(data().match_sessions.filter(row => row.pool_id === admitted.match_id).length === 1, 'Automatic route following creates no duplicate admission')
    } else if (kind.startsWith('found') || kind.startsWith('stale') || kind.startsWith('lost')) await wait(() => current('.auto-match-found'), 'Found did not mount')
    else await wait(() => current('.auto-match-passed'), 'Passed did not mount')

    if (kind.startsWith('found') || kind.startsWith('stale') || kind.startsWith('auto') || kind.startsWith('lost')) {
      // The found-page Back opens the source confirmation; Pass remains a direct confirmed business decision.
      if (kind.includes('confirm')) { await activate('amFound.askLeaveMatch.click.1'); await activate('sheetAmFoundLeave.passMatch.click.1') }
      else await activate('amFound.passMatch.click.1')
      await wait(() => current('.brand-action-loading'), 'Pass did not retain branded write Loading')
      await wait(() => current('.auto-match-passed'), 'Pass did not open Passed')
      const saved = data(), row = saved.match_sessions.find(row => row.match_id === (match_id || saved.match_sessions.at(-1).match_id))
      check(row.status === 'passed', 'One true Pass action persists the terminal state')
      check(saved.match_sessions.filter(row => row.status === 'passed').length === 1, 'Repeated Pass creates one terminal match rather than duplicate results')
      check(JSON.stringify(saved.coin_transactions) === JSON.stringify(before_data.coin_transactions), 'Skipping does not add a coin charge')
    }
    const passed = await wait(() => current('.auto-match-passed'), 'Passed result is missing')
    await settle(passed)
    snapshot('passed-ready')
    const navigation_before = raw(), navigation_writes = writes, navigation_data = data()
    if (kind === 'retry') {
      await activate('amPassed.findAnother.click.1')
      await wait(() => current('.brand-action-loading'), 'Retry does not display its real write progress')
      check(raw() === navigation_before, 'Retry progress precedes the new search write')
      await wait(() => current('.auto-match-searching'), 'Retry did not reach Searching')
      const after = data(), previous = after.match_sessions.find(row => row.match_id === match_id), rows = after.match_sessions.filter(row => row.retry_of_match_id === match_id)
      check(rows.length === 1 && previous.next_match_id === rows[0].match_id && rows[0].pool_id === (previous.pool_id || previous.match_id), 'Repeated retry creates one linked search under the same admission')
      check(JSON.stringify(after.coin_transactions) === JSON.stringify(navigation_data.coin_transactions) && JSON.stringify(after.match_quota) === JSON.stringify(navigation_data.match_quota), 'Find Another Match never charges coins or consumes another daily quota')
    } else {
      const back = kind.endsWith('back'), id = back ? 'amPassed.goBack.click.1' : 'amPassed.returnHome.click.1'
      await activate(id)
      await wait(() => current('.home-header') && location.hash.split('?')[0] === '#/pages/home/index', `${back ? 'Top Back' : 'Return Home'} could not exit Passed to Home`, 4000)
      const home = current('.main-tab-frame'); await settle(home)
      check(Number(home.dataset.pageDepth) === 1, 'Terminal match return restores the single Home root without a stale match stack')
      check(raw() === navigation_before && writes === navigation_writes, 'Terminal Back/Home navigation preserves exact business bytes, quota and balance')
      check(!/Navigation is already in progress/i.test(document.body.innerText), 'Return exposes no stuck navigation-lock Toast')
      check(trace.filter(row => row.label === 'router.afterEach' && row.to?.split('?')[0] === '/pages/home/index' && !row.failure).length === 1, 'Rapid repeated return completes exactly one real Home route transition')
      // Opening another destination proves that the shared lock was actually released.
      await activate('home.startAutoMatch.click.1'); await wait(() => current('.auto-match-index'), 'A subsequent Auto Match entry remains blocked')
      await activate('amEntry.goBack.click.1'); await wait(() => current('.home-header'), 'Entry Back remains blocked after terminal return')
      check(raw() === navigation_before && writes === navigation_writes, 'The next entry and Back round trip also leaves all business bytes unchanged')
    }
    check(unhandled.length === 0 && errors.length === 0, 'The entire route chain has no uncaught errors or rejected promises')
    snapshot('end')
    return { passed: true, kind, checks, trace, errors, unhandled, callbacks, injected_uni_trace: globalThis.__match_return_uni_trace || [], writes, loading_seen: loading, route: location.hash }
  } catch (cause) { cause.match_return_diagnostic = { kind, checks, trace, errors, unhandled, callbacks, injected_uni_trace: globalThis.__match_return_uni_trace || [], writes, route: location.hash, text: document.body.innerText.slice(-2200) }; throw cause }
  finally {
    observer.disconnect(); Storage.prototype.setItem = original_set
    for (const [name, original] of Object.entries(originals)) uni_ref[name] = original
    for (const cleanup of undo) if (typeof cleanup === 'function') cleanup()
    removeEventListener('unhandledrejection', on_rejection); removeEventListener('error', on_error)
  }
}
