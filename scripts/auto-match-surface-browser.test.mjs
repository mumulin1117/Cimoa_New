import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'

// Real, bundled Vue routes in disposable touch-enabled browser contexts. Every
// resource is fulfilled from disk; no listener, installed app or payment is used.
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/auto-match-surface-2026-11-02')
const origin = 'http://127.0.0.1:47893', key = 'cimoa_app_state_v2', now = Date.now()
const engine = process.argv.find(value => value.startsWith('--engine='))?.slice(9) || 'chrome'
const selected = process.argv.find(value => value.startsWith('--case='))?.slice(7)
const preview = process.argv.includes('--preview')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const selectors = { source: '.main-tab-frame:has(.home-header)', target: '.auto-match-index', host: '[data-auto-match-surface-phase]', source_portal: '#cimoa-auto-match-surface-source', target_portal: '#cimoa-auto-match-surface-target' }
const active_phases = ['forward-pending', 'forward-ready', 'forward-running', 'back-ready', 'back-running', 'back-dispatched']
const fixtures = {}
for (const kind of ['default', 'home_empty']) {
  let disk = create_scenario(kind, now)
  for (const message of disk.messages) message.read_by = [...new Set([...message.read_by, disk.session.current_user_id])]
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  assert.equal(store.begin_auto_match_guide(store.auth_context).success, true)
  assert.equal(store.finish_auto_match_guide('skipped', store.auth_context).success, true)
  assert.equal(store.begin_discover_guide(store.discover_people[store.discover_card_index].user_id, store.auth_context).success, true)
  for (const step of [1, 2, 3, 4, 5, 6]) assert.equal(store.move_discover_guide(step, store.auth_context).success, true)
  assert.equal(store.finish_discover_guide('completed', store.auth_context).success, true)
  fixtures[kind] = clone_data(store.data)
  validate_data(fixtures[kind])
}
const shared_file = fs.readdirSync(path.join(root, 'assets')).find(name => /^index-.*\.js$/.test(name) && fs.readFileSync(path.join(root, 'assets', name), 'utf8').includes('auto-match-surface'))
assert.ok(shared_file, 'Build H5 with the Auto Match surface host before this regression')
const shared_code = fs.readFileSync(path.join(root, 'assets', shared_file), 'utf8')
const pages_symbol = shared_code.match(/function (\w+)\(\)\{return (\w+)\(\)\}function \2\(\)\{const \w+=\[\],\w+=\w+\.values\(\)/)?.[1]
const pages_export = shared_code.slice(shared_code.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${pages_symbol} as (\\w+)`))?.[1]
assert.ok(pages_export, 'Observe the existing getCurrentPages module export without adding a production API')
const report = {
  passed: false, results: [], errors: [], warnings: [], screenshots: [], blocked_external_requests: [], engine,
  preview_server_started: false, actual_user_storage_accessed: false, native_verified: false,
  dist_index_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex'),
  limitations: [
    'Trusted CDP touch events are mobile browser emulation, not physical iPhone frame-rate or WKWebView acceptance.',
    'Visibility and pointer cancellation injection diagnose cancellation only, not actual iOS background handling.',
    'Paused screenshots measure intermediate circular geometry; separate unpaused pairs verify runtime durations.',
    'First-use guide receipts are completed through Store actions only in isolated fixtures before tracing; existing guide regression covers the guide itself.',
    'The safe-area bridge receives diagnostic 62/34pt values for browser layout coverage; these do not prove native measurements.',
  ],
}
fs.mkdirSync(output, { recursive: true })
const { chromium, webkit } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
let browser
const button = (page, id) => page.locator(`[data-interaction="${id}"]:visible`).last()
const phase = page => page.locator(selectors.host).getAttribute('data-auto-match-surface-phase')
const idle = page => page.waitForFunction(({ selectors, active_phases }) => !active_phases.includes(document.querySelector(selectors.host)?.dataset.autoMatchSurfacePhase), { selectors, active_phases })
const wait_route = (page, route) => page.waitForFunction(route => location.hash.split('?')[0].endsWith(route), route)
const near = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance
const circle = value => { const numbers = value?.match(/circle\(([-\d.]+)px at ([-\d.]+)px ([-\d.]+)px\)/)?.slice(1).map(Number); return numbers ? { radius: numbers[0], x: numbers[1], y: numbers[2] } : null }
const raw = page => page.evaluate(key => localStorage.getItem(key), key)
const touch = (cdp, type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] })
const freeze_next = (page, time = 0) => page.evaluate(time => { window.__freeze_match_surface = { time } }, time)
const frozen = (page, count) => page.waitForFunction(count => window.__match_surface_animations.length >= count && window.__match_surface_animations.at(-1).playState === 'paused', count)
const at_time = (page, time) => page.evaluate(async time => { const animation = window.__match_surface_animations.at(-1); animation.pause(); animation.currentTime = time; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) }, time)
const resume = async page => { await page.evaluate(() => window.__match_surface_animations.at(-1).play()); await idle(page); await page.waitForTimeout(40) }
const background = page => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) })
async function screenshot(page, name) { await page.screenshot({ path: path.join(output, name + '.png') }); report.screenshots.push(name + '.png') }
async function prepare(item) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: true, hasTouch: true, reducedMotion: item.reduced ? 'reduce' : 'no-preference' })
  const page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push({ case: item.name, message: error.message }))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push({ case: item.name, message: event.text() }) })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) { report.blocked_external_requests.push(url.origin + url.pathname); return route.abort('blockedbyclient') }
    if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated Auto Match transition</title>' })
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(origin + '/fixture-shell')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: fixtures[item.empty ? 'home_empty' : 'default'] })
  await page.addInitScript(({ key, selectors }) => {
    const trace = window.__match_surface_trace = { writes: [], animations: [], css: [], phases: [], navigation: [], loading: [], ignition: false }
    window.__match_surface_animations = []
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) trace.writes.push({ at: performance.now(), bytes: value.length }); return write.call(this, name, value) }
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options)
      if (this.matches(selectors.target)) {
        const row = { start: performance.now(), timing: animation.effect.getTiming(), frames: animation.effect.getKeyframes(), route: location.hash }
        trace.animations.push(row); window.__match_surface_animations.push(animation)
        if (!window.__original_match_target) window.__original_match_target = this
        if (window.__freeze_match_surface) { animation.pause(); animation.currentTime = window.__freeze_match_surface.time; window.__freeze_match_surface = null; row.diagnostic_paused = true }
        animation.finished.then(() => { row.finish = performance.now() }, () => { row.cancel = performance.now() })
      }
      return animation
    }
    document.addEventListener('animationstart', event => { if (event.target.closest?.(selectors.target)) trace.css.push({ name: event.animationName, target: event.target.className, route: location.hash }) }, true)
    let last_phase = ''
    new MutationObserver(() => {
      const host = document.querySelector(selectors.host), phase = host?.dataset.autoMatchSurfacePhase || ''
      if (phase !== last_phase) { trace.phases.push({ phase, at: performance.now(), route: location.hash, issue: host?.dataset.autoMatchSurfaceIssue }); last_phase = phase }
      if (document.querySelector('.match-ignition')) trace.ignition = true
      for (const node of document.querySelectorAll('.brand-action-loading,.brand-action-blocker,uni-toast,.loading-mask')) if (node.getBoundingClientRect().width && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden') trace.loading.push(node.textContent.trim())
    }).observe(document, { subtree: true, childList: true, attributes: true })
    document.addEventListener('DOMContentLoaded', () => {
      let count = 0
      const safe = () => { if (window.CommonTemplateSafeAreaBridge) window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); else if (++count < 240) requestAnimationFrame(safe) }
      safe()
    }, { once: true })
  }, { key, selectors })
  await page.goto(origin + '/index.html#/pages/home/index', { waitUntil: 'domcontentloaded' })
  await page.locator('.home-header:visible').waitFor()
  await page.waitForFunction(() => !document.querySelector('.main-skeleton'))
  await page.waitForTimeout(300)
  await page.evaluate(async ({ selectors, shared_file, pages_export }) => {
    window.__original_home_source = document.querySelector(selectors.source)
    window.__get_match_surface_pages = (await import(`/assets/${shared_file}`))[pages_export]
    const router = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$router
    window.__match_surface_router = router
    for (const method of ['push', 'go']) {
      const original = router[method]
      router[method] = function (...args) { window.__match_surface_trace.navigation.push({ method, at: performance.now(), path: args[0]?.path, delta: typeof args[0] === 'number' ? args[0] : null }); return original.apply(this, args) }
    }
  }, { selectors, shared_file, pages_export })
  return { context, page, cdp: engine === 'chrome' ? await context.newCDPSession(page) : null }
}
const snapshot = page => page.evaluate(selectors => {
  const box = node => { const r = node?.getBoundingClientRect(); return r ? { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom } : null }
  const source = document.querySelector(selectors.source_portal)?.querySelector('.main-tab-frame'), target = document.querySelector(selectors.target_portal)?.querySelector(selectors.target) || document.querySelector(selectors.target)
  const original = window.__original_home_source, anchor = window.__original_match_anchor
  const scrolls = [...original?.querySelectorAll('.main-tab-scroll,.main-tab-scroll *') || []].filter(node => /auto|scroll/.test(getComputedStyle(node).overflowY))
  return {
    route: location.hash, phase: document.querySelector(selectors.host)?.dataset.autoMatchSurfacePhase,
    issue: document.querySelector(selectors.host)?.dataset.autoMatchSurfaceIssue,
    source_same: source === original, source_connected: original?.isConnected,
    anchor_same: !!anchor && original?.contains(anchor), anchor_box: box(anchor),
    source_visible: !!source && getComputedStyle(source).visibility !== 'hidden' && getComputedStyle(source).display !== 'none' && Number(getComputedStyle(source).opacity) > .9,
    source_inert: !!source?.closest('[inert]'), source_aria_hidden: !!source?.closest('[aria-hidden="true"]'),
    original_inert: !!original?.closest('[inert]'), source_children: document.querySelector(selectors.source_portal)?.childElementCount || 0,
    target_children: document.querySelector(selectors.target_portal)?.childElementCount || 0,
    target_same: !target || target === window.__original_match_target,
    target_clip: target ? getComputedStyle(target).clipPath : null, target_transform: target ? getComputedStyle(target).transform : null,
    target_inert: !!target?.closest('[inert]'), target_aria_hidden: !!target?.closest('[aria-hidden="true"]'),
    header_font: target ? getComputedStyle(target.querySelector('.am-1466-6')).fontSize : null,
    header_transform: target ? getComputedStyle(target.querySelector('.am-1466-6')).transform : null,
    source_count: document.querySelectorAll('.home-header').length, target_count: document.querySelectorAll(selectors.target).length,
    anchor_background: anchor ? getComputedStyle(anchor).backgroundImage : null,
    anchor_opacity: anchor ? getComputedStyle(anchor).opacity : null,
    scroll: Math.max(0, ...scrolls.map(node => node.scrollTop)),
    scroll_nodes: scrolls.map(node => ({ class: node.className, scroll: node.scrollTop, height: node.clientHeight, content: node.scrollHeight })),
    stack: window.__get_match_surface_pages?.().map(page => ({ route: page.route, id: page.$page?.id ?? page.$basePage?.id })) || [],
  }
}, selectors)
async function select_anchor(page, item) {
  const id = `home.startAutoMatch.click.${item.header ? '1' : item.empty ? '2' : '3'}`
  const anchor = button(page, id)
  if (!item.header) await anchor.scrollIntoViewIfNeeded()
  else await page.locator('.main-tab-scroll:visible').evaluate(root => { const node = [...root.querySelectorAll('*')].find(node => /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight); if (node) { node.scrollTop = Math.min(65, node.scrollHeight - node.clientHeight); node.dispatchEvent(new Event('scroll')) } })
  await page.waitForTimeout(90)
  await anchor.evaluate(node => { window.__original_match_anchor = node })
  return anchor
}
async function case_failure(page, item, error) {
  report.failed_case = item
  report.failure_snapshot = await snapshot(page).catch(() => null)
  report.visible_failure = await page.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-3000), trace: window.__match_surface_trace })).catch(() => null)
  await screenshot(page, item.name + '-failure').catch(() => {})
  throw error
}
async function run_case(item) {
  const { context, page, cdp } = await prepare(item), checks = [], metrics = []
  const check = (condition, message) => { assert.ok(condition, `${item.name}: ${message}`); checks.push(message) }
  try {
    let retained_discover_person = null
    if (item.name === 'tail-393x852' && cdp) {
      await page.locator('.tab[aria-label="Discover"]:visible').tap()
      await page.locator('.discover-deck[data-entrance-phase="complete"]:visible').waitFor()
      const first = await page.locator('.discover-photo-card--front:visible').getAttribute('data-user-id')
      const bounds = await page.locator('.discover-photo-card--front:visible').boundingBox(), y = bounds.y + bounds.height / 2
      await touch(cdp, 'touchStart', bounds.x + bounds.width * .75, y)
      await touch(cdp, 'touchMove', bounds.x + bounds.width * .2, y)
      await touch(cdp, 'touchEnd', 0, 0)
      await page.waitForFunction(first => document.querySelector('.discover-photo-card--front')?.dataset.userId !== first, first)
      await page.waitForTimeout(340)
      retained_discover_person = await page.locator('.discover-photo-card--front:visible').getAttribute('data-user-id')
      check(retained_discover_person && retained_discover_person !== first, 'A real touch swipe establishes a noninitial Discover cursor before testing Home')
      await page.locator('.tab[aria-label="Home"]:visible').tap(); await wait_route(page, '/pages/home/index'); await page.waitForTimeout(290)
      await page.evaluate(selector => { window.__original_home_source = document.querySelector(selector) }, selectors.source)
    }
    const anchor = await select_anchor(page, item), before = await raw(page)
    let initial = await snapshot(page), center = { x: initial.anchor_box.left + initial.anchor_box.width / 2, y: initial.anchor_box.top + initial.anchor_box.height / 2 }
    check(initial.anchor_box.width >= 44 && initial.anchor_box.height >= 44, 'The actual Home entry is a minimum-44pt touch target')
    check(item.header || initial.scroll > 0 || item.empty, 'The populated-list tail CTA is measured at its real scrolled position')
    if (cdp) {
      await touch(cdp, 'touchStart', center.x, center.y); await touch(cdp, 'touchMove', center.x, center.y - 30); await touch(cdp, 'touchCancel', 0, 0); await page.waitForTimeout(150)
      check(page.url().endsWith('/pages/home/index'), 'A moved or cancelled touch never opens Auto Match')
      await touch(cdp, 'touchStart', center.x, center.y); await touch(cdp, 'touchCancel', 0, 0); await page.waitForTimeout(100)
      check(page.url().endsWith('/pages/home/index') && !(await anchor.getAttribute('data-touch-state')), 'pointercancel clears the pressed entry and allows a fresh tap')
      await touch(cdp, 'touchStart', center.x, center.y)
      await anchor.dispatchEvent('lostpointercapture', { pointerId: 1, pointerType: 'touch', bubbles: true })
      await touch(cdp, 'touchCancel', 0, 0); await page.waitForTimeout(90)
      check(page.url().endsWith('/pages/home/index') && !(await anchor.getAttribute('data-touch-state')), 'lostpointercapture cancels a held entry without navigation')
    }
    initial = await snapshot(page)
    center = { x: initial.anchor_box.left + initial.anchor_box.width / 2, y: initial.anchor_box.top + initial.anchor_box.height / 2 }
    report.active_initial = initial
    await freeze_next(page); await anchor.tap(); await frozen(page, 1)
    const start = await snapshot(page), forward = await page.evaluate(() => window.__match_surface_trace.animations[0])
    metrics.push({ stage: 'forward-start', center, snapshot: start, animation: forward })
    check(start.route.endsWith('/pages/auto-match/index'), 'The tap immediately pushes the real Auto Match entry route')
    check(start.source_same && start.source_visible && start.source_inert && start.source_aria_hidden && start.anchor_same, 'The original Home frame and exact selected button remain the inert, accessible-hidden underlay')
    check(start.source_count === 1 && start.target_count === 1 && start.target_same, 'Teleport retains only one actual Home and one actual Auto Match business page')
    check(start.anchor_background === initial.anchor_background && start.anchor_opacity === initial.anchor_opacity, 'Navigation busy retains the entry gradient and never flashes a disabled grey state')
    check(near(start.scroll, initial.scroll, 1), 'Borrowing Home preserves its real list scroll position')
    check(start.stack.length === initial.stack.length + 1 && start.stack[0].id === initial.stack[0].id, 'Forward adds one real page above the original Home stack identity')
    check(forward.timing.duration === 240, 'Forward uses the existing 240ms page duration')
    if (item.reduced) check(forward.frames.every(frame => !frame.clipPath || frame.clipPath === 'none'), 'Reduced motion uses opacity only, without geometric expansion')
    else {
      const from = circle(forward.frames[0].clipPath), to = circle(forward.frames.at(-1).clipPath)
      const required = Math.max(...[[0, 0], [item.width, 0], [0, item.height], [item.width, item.height]].map(([x, y]) => Math.hypot(x - center.x, y - center.y)))
      check(from && near(from.radius, 0) && near(from.x, center.x) && near(from.y, center.y), 'The reveal starts at the precise tapped CTA or lightning center')
      check(to && to.radius >= required - 1.5, 'The ending circle reaches every viewport corner')
      await at_time(page, 72); const middle = await snapshot(page)
      check(circle(middle.target_clip)?.radius > 0 && circle(middle.target_clip)?.radius < required, 'The deterministic intermediate frame genuinely expands from point to page')
      check(middle.target_transform === 'none' && middle.header_transform === 'none', 'Page typography is revealed in place, not scaled')
      await screenshot(page, item.name + '-forward-middle')
    }
    await resume(page); const arrived = await snapshot(page)
    check(arrived.source_children === 0 && arrived.target_children === 0 && arrived.target_clip === 'none' && !arrived.target_inert && !arrived.target_aria_hidden, 'Arrival restores normal ownership, clipping and accessibility')
    check(arrived.header_font === start.header_font && await phase(page) === 'settled', 'The title keeps one font size and the source association is ready for reverse')
    await screenshot(page, item.name + '-entry')
    for (const [entry, route, back] of [['amEntry.openPrefs.click.1', '/pages/auto-match/preferences', 'amPrefs.goBack.click.1'], ['amEntry.openHistory.click.1', '/pages/auto-match/history', 'amHistory.goBack.click.1']]) {
      await button(page, entry).tap(); await wait_route(page, route); await page.waitForTimeout(270)
      await button(page, back).tap(); await wait_route(page, '/pages/auto-match/index'); await page.waitForTimeout(220)
      check(await page.evaluate(() => window.__match_surface_trace.animations.length) === 1, `${route.split('/').at(-1)} returns to the retained entry without replaying its circular reveal`)
    }
    await freeze_next(page); await button(page, 'amEntry.goBack.click.1').tap(); await frozen(page, 2)
    const reverse = await page.evaluate(() => window.__match_surface_trace.animations[1]), back_start = await snapshot(page)
    check(reverse.timing.duration === 180 && back_start.source_same && back_start.anchor_same && back_start.source_visible, 'The same actual source and button receive one 180ms contraction')
    if (!item.reduced) {
      const end = circle(reverse.frames.at(-1).clipPath)
      check(end && near(end.radius, 0) && near(end.x, center.x) && near(end.y, center.y), 'Reverse closes into the clicked button, never the other Home entry')
      await at_time(page, 90); await screenshot(page, item.name + '-back-middle')
    }
    await resume(page); await wait_route(page, '/pages/home/index'); await page.waitForTimeout(100)
    const returned = await snapshot(page), trace = await page.evaluate(() => window.__match_surface_trace)
    check(returned.source_connected && returned.anchor_same && !returned.original_inert && near(returned.scroll, initial.scroll, 1), 'Real Back reconnects the original interactive Home, same entry and unchanged list scroll')
    check(returned.stack.length === initial.stack.length && returned.stack[0].id === initial.stack[0].id, 'Reverse performs exactly one real pop to the original Home page')
    check(returned.source_children === 0 && returned.target_children === 0 && await phase(page) === 'idle', 'Reverse leaves no temporary frame, clip or navigation association')
    check(!returned.issue && !trace.phases.some(row => row.issue) && trace.phases.filter(row => row.phase === 'idle').every(row => row.route.endsWith('/pages/home/index')), 'A successful round trip reaches the actual source before cleanup, without fallback or presentation issues')
    check(!trace.ignition && !trace.css.some(row => /page-leave|page-rise|auth-content-rise/.test(row.name) && row.route.endsWith('/auto-match/index')), 'Direct motion does not stack old ignition, whole-page cRise or a generic reverse animation')
    check(await page.locator('.main-skeleton:visible').count() === 0, 'Warm Home return never consumes another skeleton')
    await screenshot(page, item.name + '-returned')
    const count = trace.animations.length
    await anchor.tap(); await wait_route(page, '/pages/auto-match/index'); await idle(page)
    await button(page, 'amEntry.goBack.click.1').tap(); await wait_route(page, '/pages/home/index'); await idle(page)
    const runtime = await page.evaluate(index => window.__match_surface_trace.animations.slice(index), count)
    check(runtime.length === 2 && runtime.every(row => !row.diagnostic_paused && row.finish && !row.cancel), 'A separate unpaused forward/reverse pair completes normally')
    check(runtime[0].timing.duration === 240 && runtime[1].timing.duration === 180, 'Unpaused runtime preserves exactly 240ms/180ms durations')
    const end_trace = await page.evaluate(() => window.__match_surface_trace), last_pop = end_trace.navigation.filter(row => row.method === 'go').at(-1)
    check(!(await snapshot(page)).issue && !end_trace.phases.some(row => row.issue) && end_trace.phases.filter(row => row.phase === 'idle').every(row => row.route.endsWith('/pages/home/index')), 'The unpaused reverse also completes at Home with no return-not-arrived or hidden fallback issue')
    if (last_pop) check(last_pop.at - runtime[1].start < 325, 'Real Back dispatch follows contraction without a second 180ms exit delay')
    check(await raw(page) === before && end_trace.writes.length === 0, 'Opening, nested navigation and returning perform zero writes: sessions, quota, wallet, relationships and messages remain identical')
    check(end_trace.loading.length === 0, 'Visual navigation shows no Saving or Loading Toast')
    if (retained_discover_person) {
      await page.locator('.tab[aria-label="Discover"]:visible').tap(); await wait_route(page, '/pages/discover/index'); await page.waitForTimeout(300)
      check(await page.locator('.discover-photo-card--front:visible').getAttribute('data-user-id') === retained_discover_person, 'Discover retains the same previously swiped person after Home point transitions and Tab replacement')
      check(await page.locator('.main-skeleton:visible').count() === 0 && await raw(page) === before, 'Returning to Discover neither replays its skeleton nor changes business storage')
    }
    metrics.push({ stage: 'returned', snapshot: returned, runtime, phases: end_trace.phases, navigation: end_trace.navigation })
    return { ...item, passed: true, checks, metrics }
  } catch (error) { return await case_failure(page, item, error) }
  finally { await context.close() }
}
async function interruptions() {
  const item = { name: 'interruptions-393x852', width: 393, height: 852 }, { context, page } = await prepare(item), checks = []
  const check = (condition, message) => { assert.ok(condition, `${item.name}: ${message}`); checks.push(message) }
  try {
    const anchor = await select_anchor(page, item), before = await raw(page)
    for (const kind of ['background', 'resize']) {
      const count = await page.evaluate(() => window.__match_surface_animations.length)
      await freeze_next(page, 70); await anchor.tap(); await frozen(page, count + 1)
      if (kind === 'background') await background(page)
      else await page.setViewportSize({ width: 392, height: 852 })
      await idle(page); await page.waitForTimeout(90)
      const current = await snapshot(page)
      check(current.target_clip === 'none' && current.source_children === 0 && current.target_children === 0 && await phase(page) === 'idle', `${kind} restores the complete target and clears temporary ownership`)
      const animations = await page.evaluate(() => window.__match_surface_animations.length)
      await button(page, 'amEntry.goBack.click.1').tap(); await wait_route(page, '/pages/home/index'); await page.waitForTimeout(240)
      check(await page.evaluate(() => window.__match_surface_animations.length) === animations, `${kind} invalidates the stale origin and uses a real generic Back`)
      if (kind === 'resize') { await page.setViewportSize({ width: 393, height: 852 }); await page.waitForTimeout(90) }
    }
    await page.evaluate(() => { const remove = window.__match_surface_router.beforeEach(to => { if (!to.path.endsWith('/auto-match/index')) return; remove(); return false }) })
    await anchor.tap(); await page.waitForTimeout(200)
    const failed = await snapshot(page)
    check(page.url().endsWith('/pages/home/index') && await phase(page) === 'idle' && failed.source_connected && failed.source_children === 0, 'A rejected real router guard restores Home with no portal or lock')
    let count = await page.evaluate(() => window.__match_surface_animations.length)
    await freeze_next(page, 60); await anchor.tap(); await frozen(page, count + 1)
    await page.evaluate(() => { for (let i = 0; i < 6; i++) window.__original_match_anchor.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await resume(page)
    check(await page.evaluate(() => window.__match_surface_animations.length) === count + 1, 'Rapid source clicks create only one route and one reveal')
    count = await page.evaluate(() => window.__match_surface_animations.length)
    await freeze_next(page, 55); await button(page, 'amEntry.goBack.click.1').tap(); await frozen(page, count + 1)
    await page.evaluate(() => { const back = document.querySelector('[data-interaction="amEntry.goBack.click.1"]'); for (let i = 0; i < 6; i++) back?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await background(page); await idle(page); await page.waitForTimeout(260)
    check(page.url().endsWith('/pages/auto-match/index') && (await snapshot(page)).target_clip === 'none', 'Cancelled reverse never performs a late pop and restores the full entry page')
    await button(page, 'amEntry.goBack.click.1').tap(); await wait_route(page, '/pages/home/index'); await page.waitForTimeout(220)
    check((await snapshot(page)).anchor_same, 'A fresh Back after cancellation reaches the exact original Home button')
    await anchor.tap(); await wait_route(page, '/pages/auto-match/index'); await idle(page)
    count = await page.evaluate(() => { const anchor = window.__original_match_anchor; window.__anchor_measure = anchor.getBoundingClientRect; anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }); return window.__match_surface_animations.length })
    await button(page, 'amEntry.goBack.click.1').tap(); await wait_route(page, '/pages/home/index'); await page.waitForTimeout(230)
    await page.evaluate(() => { window.__original_match_anchor.getBoundingClientRect = window.__anchor_measure })
    check(await page.evaluate(() => window.__match_surface_animations.length) === count && await phase(page) === 'idle', 'An unmeasurable clicked anchor falls back to a true Back, never the other Home button')
    const trace = await page.evaluate(() => window.__match_surface_trace)
    check(await raw(page) === before && trace.writes.length === 0, 'Cancellation, guard rejection and rapid taps leave every persisted entity unchanged')
    return { ...item, passed: true, checks, phases: trace.phases, animations: trace.animations }
  } catch (error) { return await case_failure(page, item, error) }
  finally { await context.close() }
}
async function record_preview() {
  assert.equal(engine, 'chrome', 'The installed Chrome encoder records the preview')
  const item = { name: 'preview-393x852', width: 393, height: 852 }, { context, page, cdp } = await prepare(item), frames = []
  const receive = event => { frames.push({ data: event.data, timestamp: event.metadata.timestamp }); void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {}) }
  let recording = false
  cdp.on('Page.screencastFrame', receive)
  try {
    const anchor = await select_anchor(page, item)
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 393, maxHeight: 852, everyNthFrame: 1 }); recording = true
    await page.waitForTimeout(450); await anchor.tap(); await wait_route(page, '/pages/auto-match/index'); await idle(page)
    await page.waitForTimeout(750); await button(page, 'amEntry.goBack.click.1').tap(); await wait_route(page, '/pages/home/index'); await idle(page); await page.waitForTimeout(450)
    const lightning = await select_anchor(page, { ...item, header: true })
    await lightning.tap(); await wait_route(page, '/pages/auto-match/index'); await idle(page)
    await page.waitForTimeout(650); await button(page, 'amEntry.goBack.click.1').tap(); await wait_route(page, '/pages/home/index'); await idle(page); await page.waitForTimeout(450)
    await cdp.send('Page.stopScreencast'); recording = false
    const encoder = await context.newPage()
    const encoded = await encoder.evaluate(async frames => {
      const canvas = document.createElement('canvas'); canvas.width = 393; canvas.height = 852; document.body.append(canvas)
      const context = canvas.getContext('2d'), images = await Promise.all(frames.map(frame => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = 'data:image/jpeg;base64,' + frame.data })))
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type)), stream = canvas.captureStream(30), recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1500000 }), chunks = []
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      const complete = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject })
      context.drawImage(images[0], 0, 0); recorder.start(100)
      const start = performance.now(), first = frames[0].timestamp
      for (let i = 1; i < frames.length; i++) { const delay = (frames[i].timestamp - first) * 1000 - (performance.now() - start); if (delay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delay, 1500))); context.drawImage(images[i], 0, 0) }
      await new Promise(resolve => setTimeout(resolve, 350)); recorder.stop(); await complete; stream.getTracks().forEach(track => track.stop())
      const blob = new Blob(chunks, { type: mime }), data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob) })
      return { data, mime, bytes: blob.size }
    }, frames)
    const filename = 'home-auto-match-buttons-roundtrip-393x852.webm'
    fs.writeFileSync(path.join(output, filename), Buffer.from(encoded.data, 'base64'))
    report.preview = { file: filename, mime: encoded.mime, bytes: encoded.bytes, captured_frames: frames.length, seconds: frames.at(-1).timestamp - frames[0].timestamp, limitation: 'Actual unpaused CDP frames encoded in a separate blank canvas; visual illustration, not a native frame-rate measurement.' }
    assert.ok(frames.length > 8)
    assert.equal(await page.evaluate(() => window.__match_surface_trace.writes.length), 0)
    const animations = await page.evaluate(() => window.__match_surface_trace.animations)
    assert.equal(animations.length, 4)
    assert.ok(animations.every((row, index) => !row.diagnostic_paused && row.finish && row.timing.duration === (index % 2 ? 180 : 240)))
    assert.deepEqual(await page.evaluate(() => window.__match_surface_trace.phases.filter(row => row.issue)), [], 'Preview round trips must not silently fall back before actual route arrival')
    assert.ok(await page.evaluate(() => window.__match_surface_trace.phases.filter(row => row.phase === 'idle').every(row => row.route.endsWith('/pages/home/index'))), 'Preview releases its underlay only after the actual Home route has arrived')
    await encoder.close()
  } finally { if (recording) await cdp.send('Page.stopScreencast').catch(() => {}); cdp.off('Page.screencastFrame', receive); await context.close() }
}
try {
  assert.ok(['chrome', 'webkit'].includes(engine))
  browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true })
  const cases = [
    { name: 'tail-393x852', width: 393, height: 852 },
    { name: 'lightning-393x852', width: 393, height: 852, header: true },
    { name: 'empty-393x852', width: 393, height: 852, empty: true },
    { name: 'small-320x568', width: 320, height: 568 },
    { name: 'large-430x932', width: 430, height: 932, header: true },
    { name: 'reduced-393x852', width: 393, height: 852, reduced: true },
  ].filter(item => !selected || item.name === selected)
  assert.ok(preview || cases.length || selected === 'interruptions-393x852', 'The selected browser case exists')
  if (preview) await record_preview()
  else {
    for (const item of cases) report.results.push(await run_case(item))
    if (!selected || selected === 'interruptions-393x852') report.results.push(await interruptions())
  }
  assert.deepEqual(report.errors, [])
  report.expected_diagnostic_warnings = report.warnings.filter(row => row.message.includes('[uni统计 2.0]') && row.message.includes('Failed to fetch'))
  report.unexpected_warnings = report.warnings.filter(row => !report.expected_diagnostic_warnings.includes(row))
  assert.deepEqual(report.unexpected_warnings, [])
  report.passed = true
  console.log(`PASS Home Auto Match surface: ${report.results.length} cases, ${report.results.reduce((sum, result) => sum + result.checks.length, 0)} assertions; no server or business writes`)
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, preview ? 'preview-report.json' : engine === 'chrome' ? 'browser-report.json' : `${engine}-report.json`), JSON.stringify(report, null, 2) + '\n') }
