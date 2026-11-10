import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { configure_store_runtime, use_app_store } from '../src/stores/store.js'
import { MATCH_MAJORS } from '../src/stores/matchingCatalog.js'

// Production routes in disposable touch contexts, fulfilled from the bundle.
// No server, installed app storage, microphone, purchase or service is used.
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/match-preferences-surface-2026-11-03')
const origin = 'http://127.0.0.1:47894', key = 'cimoa_app_state_v2', now = Date.now()
const selected = process.argv.find(value => value.startsWith('--case='))?.slice(7)
const source_ids = { index: 'amEntry.openPrefs.click.1', searching: 'amSearching.openPrefs.click.1', paused: 'amPaused.openPrefs.click.1', 'no-match': 'amNoMatch.adjustPrefs.click.1', discover: 'photo.openDiscoverFilters.click.1' }
const host = '[data-match-preferences-surface-phase]', source_slot = '#cimoa-match-preferences-surface-source', target_slot = '#cimoa-match-preferences-surface-target', target = '.auto-match-preferences'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const fixtures = {}
for (const source of Object.keys(source_ids)) {
  const data = create_scenario(['index', 'discover'].includes(source) ? 'default' : `match_${source.replace('-', '_')}`, now)
  if (['searching', 'paused'].includes(source)) Object.assign(data.match_sessions[0], { engine: 'device', search_ready_at: now + 3600000, search_remaining_ms: 3600000, expires_at: null, ...(source === 'paused' ? { paused_at: now } : {}) })
  for (const message of data.messages) message.read_by = [...new Set([...message.read_by, data.session.current_user_id])]
  const store = use_app_store(createPinia()); let disk = data
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(disk), write: (_, value) => { disk = clone_data(value) } } })
  assert.equal(store.hydrate().success, true); assert.equal(store.set_app_consent(true).success, true)
  assert.equal(store.begin_auto_match_guide(store.auth_context).success, true); assert.equal(store.finish_auto_match_guide('skipped', store.auth_context).success, true)
  assert.equal(store.begin_discover_guide(store.discover_people[store.discover_card_index].user_id, store.auth_context).success, true)
  for (const step of [1, 2, 3, 4, 5, 6]) assert.equal(store.move_discover_guide(step, store.auth_context).success, true)
  assert.equal(store.finish_discover_guide('completed', store.auth_context).success, true)
  fixtures[source] = clone_data(store.data); validate_data(fixtures[source])
}
const shared_file = fs.readdirSync(path.join(root, 'assets')).find(name => /^index-.*\.js$/.test(name) && fs.readFileSync(path.join(root, 'assets', name), 'utf8').includes('match-preferences-surface'))
assert.ok(shared_file, 'Build the Preferences surface before running its browser regression')
const shared_code = fs.readFileSync(path.join(root, 'assets', shared_file), 'utf8'), pages_symbol = shared_code.match(/function (\w+)\(\)\{return (\w+)\(\)\}function \2\(\)\{const \w+=\[\],\w+=\w+\.values\(\)/)?.[1]
const pages_export = shared_code.slice(shared_code.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${pages_symbol} as (\\w+)`))?.[1]
assert.ok(pages_export, 'The existing getCurrentPages export is available for read-only diagnostics')
const report = { passed: false, results: [], errors: [], warnings: [], screenshots: [], preview_server_started: false, native_verified: false, actual_user_storage_accessed: false, dist_index_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex'), limitations: ['Browser touch, injected visibility and storage failures do not replace WKWebView touch, keyboard or actual iOS background acceptance.', 'Paused WAAPI captures prove geometry only; separate unpaused passes retain the real 240/180ms timing.', 'Long matching deadlines and completed first-use guide receipts exist only in disposable fixtures; production data is unchanged.'] }
fs.mkdirSync(output, { recursive: true })
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
let browser
const button = (page, id) => page.locator(`[data-interaction="${id}"]:visible`).last()
const route_for = source => source === 'discover' ? '/pages/discover/index' : `/pages/auto-match/${source}${['index'].includes(source) ? '' : '?match_id=match_liam'}`
const read = page => page.evaluate(key => localStorage.getItem(key), key)
const data_for = async page => JSON.parse(await read(page)).data
const phase = page => page.locator(host).getAttribute('data-match-preferences-surface-phase')
const idle = page => page.waitForFunction(host => !['forward-pending', 'forward-ready', 'forward-running', 'back-ready', 'back-running', 'back-dispatched'].includes(document.querySelector(host)?.dataset.matchPreferencesSurfacePhase), host)
const wait_source = (page, item) => page.waitForFunction(route => location.hash.slice(1) === route, route_for(item.source))
const freeze = (page, time = 0) => page.evaluate(time => { window.__freeze_prefs = time }, time)
const frozen = (page, count) => page.waitForFunction(count => window.__prefs_animations.length === count && window.__prefs_animations.at(-1).playState === 'paused', count)
const resume = async page => { await page.evaluate(() => window.__prefs_animations.at(-1).play()); await idle(page); await page.waitForTimeout(40) }
const background = page => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) })
const touch = (cdp, type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }] })
async function screenshot(page, name) { await page.screenshot({ path: path.join(output, name + '.png') }); report.screenshots.push(name + '.png') }
async function prepare(item) {
  const context = await browser.newContext({ viewport: { width: item.width || 393, height: item.height || 852 }, isMobile: true, hasTouch: true, reducedMotion: item.reduced ? 'reduce' : 'no-preference' }), page = await context.newPage()
  page.setDefaultTimeout(10000); await page.clock.setFixedTime(now)
  page.on('pageerror', error => report.errors.push({ case: item.name, message: error.message }))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push({ case: item.name, message: event.text() }) })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Preferences motion regression</title>' })
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(origin + '/fixture-shell'); await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: fixtures[item.source] })
  await page.addInitScript(({ key, host, target }) => {
    const trace = window.__prefs_trace = { writes: [], attempts: [], animations: [], phases: [], css: [], loading: [], navigation: [] }; window.__prefs_animations = []
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) { trace.attempts.push(performance.now()); if (window.__fail_prefs_write) throw new DOMException('The changes could not be completed. Please try again.', 'QuotaExceededError'); trace.writes.push(performance.now()) } return write.call(this, name, value) }
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options)
      if (this.matches(target)) {
        const row = { start: performance.now(), frames: animation.effect.getKeyframes(), timing: animation.effect.getTiming() }; trace.animations.push(row); window.__prefs_animations.push(animation)
        if (window.__freeze_prefs !== undefined) { animation.pause(); animation.currentTime = window.__freeze_prefs; delete window.__freeze_prefs; row.diagnostic_paused = true }
        animation.finished.then(() => { row.finish = performance.now() }, () => { row.cancel = performance.now() })
      }
      return animation
    }
    document.addEventListener('animationstart', event => { if (event.target.closest?.(target)) trace.css.push({ name: event.animationName, target: event.target.className }) }, true)
    let previous = ''
    new MutationObserver(() => {
      const node = document.querySelector(host), phase = node?.dataset.matchPreferencesSurfacePhase
      if (phase !== previous) { trace.phases.push({ phase, route: location.hash, issue: node?.dataset.matchPreferencesSurfaceIssue }); previous = phase }
      if ([...document.querySelectorAll('.brand-action-loading')].some(node => node.getBoundingClientRect().width && getComputedStyle(node).visibility !== 'hidden')) trace.loading.push(performance.now())
    }).observe(document, { subtree: true, childList: true, attributes: true })
    document.addEventListener('DOMContentLoaded', () => { let count = 0; const safe = () => { if (window.CommonTemplateSafeAreaBridge) window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); else if (++count < 240) requestAnimationFrame(safe) }; safe() }, { once: true })
  }, { key, host, target })
  await page.goto(origin + '/index.html#' + route_for(item.source), { waitUntil: 'domcontentloaded' })
  const source_selector = item.source === 'discover' ? '.main-tab-frame.discover-request-deck' : `.auto-match-${item.source}`
  await page.locator(source_selector + ':visible').waitFor()
  if (item.source === 'discover') await page.locator('.discover-deck[data-entrance-phase="complete"]:visible').waitFor()
  await page.waitForTimeout(270)
  await page.evaluate(async ({ source_selector, shared_file, pages_export }) => {
    window.__prefs_original_source = document.querySelector(source_selector)
    window.__prefs_pages = (await import(`/assets/${shared_file}`))[pages_export]
    const router = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$router
    window.__prefs_router = router
    for (const method of ['push', 'go']) { const original = router[method]; router[method] = function (...args) { window.__prefs_trace.navigation.push({ method, at: performance.now(), path: args[0]?.path, delta: args[0] }); return original.apply(this, args) } }
  }, { source_selector, shared_file, pages_export })
  const entry = button(page, source_ids[item.source]); await entry.scrollIntoViewIfNeeded(); await page.waitForTimeout(50)
  return { context, page, entry, cdp: await context.newCDPSession(page) }
}
const snapshot = page => page.evaluate(({ host, source_slot, target_slot, target }) => {
  const source = window.__prefs_original_source, borrowed = document.querySelector(source_slot)?.firstElementChild, current = document.querySelector(target_slot)?.querySelector(target) || document.querySelector(target)
  const scroll = Math.max(0, ...[...source?.querySelectorAll('*') || []].filter(node => /auto|scroll/.test(getComputedStyle(node).overflowY)).map(node => node.scrollTop))
  const matrix = current ? getComputedStyle(current).transform : null
  return { phase: document.querySelector(host)?.dataset.matchPreferencesSurfacePhase, issue: document.querySelector(host)?.dataset.matchPreferencesSurfaceIssue, source_same: borrowed === source, source_connected: source?.isConnected, source_inert: !!borrowed?.closest('[inert]'), source_visible: !!borrowed && getComputedStyle(borrowed).visibility !== 'hidden' && Number(getComputedStyle(borrowed).opacity) > .9, scroll, front_id: source?.querySelector('.discover-photo-card--front')?.dataset.userId, target_height: current?.getBoundingClientRect().height, target_transform: matrix, target_clip: current ? getComputedStyle(current).clipPath : null, target_inert: !!current?.closest('[inert]'), target_aria_hidden: !!current?.closest('[aria-hidden="true"]'), source_children: document.querySelector(source_slot)?.childElementCount || 0, target_children: document.querySelector(target_slot)?.childElementCount || 0, stack: window.__prefs_pages?.().map(page => ({ route: page.route, id: page.$page?.id ?? page.$basePage?.id })) || [] }
}, { host, source_slot, target_slot, target })
const translate_y = transform => transform === 'none' ? 0 : Number(transform?.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+)\)/)?.[1])
const same_business = (before, after) => { for (const field of ['match_sessions', 'match_quota', 'coin_transactions', 'relationships', 'requests', 'conversations', 'messages']) assert.deepEqual(after[field], before[field], `${field} must not change during read-only navigation`) }
async function run(item) {
  const { context, page, entry, cdp } = await prepare(item), checks = [], check = (condition, message) => { assert.ok(condition, `${item.name}: ${message}`); checks.push(message) }
  try {
    if (item.source === 'discover') {
      const card = page.locator('.discover-photo-card--front:visible'), box = await card.boundingBox(), first = await card.getAttribute('data-user-id')
      await touch(cdp, 'touchStart', box.x + box.width * .8, box.y + box.height / 2); await touch(cdp, 'touchMove', box.x + box.width * .15, box.y + box.height / 2); await touch(cdp, 'touchEnd', 0, 0)
      await page.waitForFunction(first => document.querySelector('.discover-photo-card--front')?.dataset.userId !== first, first); await page.waitForTimeout(330)
    }
    const before = await read(page), initial = await snapshot(page)
    await freeze(page); await entry.tap(); await frozen(page, 1)
    const start = await snapshot(page), forward = await page.evaluate(() => window.__prefs_trace.animations[0])
    check(start.source_same && start.source_visible && start.source_inert, 'The exact real source remains a visible inert underlay')
    check(start.stack.length === initial.stack.length + 1 && start.stack[0].id === initial.stack[0].id, 'Preferences pushes exactly one real page over its original source identity')
    check(forward.timing.duration === 240 && start.target_height === (item.height || 852), 'The existing 240ms motion reveals the full-screen page, not a half sheet')
    if (item.reduced) check(forward.frames.every(frame => !frame.transform), 'Reduced motion uses opacity without vertical translation')
    else {
      check(forward.frames[0].transform === 'translateY(100%)' && /translateY\(0(?:px)?\)/.test(forward.frames.at(-1).transform), 'Normal entry moves from below the viewport to its final position')
      await page.evaluate(async () => { window.__prefs_animations[0].currentTime = 80; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      const middle = await snapshot(page); check(translate_y(middle.target_transform) > 0 && translate_y(middle.target_transform) < middle.target_height && middle.target_clip === 'none', 'The intermediate page genuinely rises vertically without a circular clip')
      await screenshot(page, item.name + '-enter-middle')
    }
    await resume(page); const arrived = await snapshot(page)
    check(arrived.source_children === 0 && arrived.target_children === 0 && !arrived.target_inert && !arrived.target_aria_hidden && translate_y(arrived.target_transform) === 0, 'Arrival restores normal ownership, final layout and accessibility')
    const close = button(page, 'amPrefs.goBack.click.1'), bounds = await close.boundingBox(); check(bounds.width >= 44 && bounds.height >= 44, 'X retains a minimum 44pt touch target')
    if (item.source === 'index') {
      // Tap the exposed backdrop, not its center (covered by the panel on 320pt screens).
      await button(page, 'amPrefs.openUniPicker.click.2').tap(); await page.getByRole('dialog', { name: 'University', exact: true }).waitFor(); await button(page, 'sheetUniPicker.closeSheet.click.1').tap({ position: { x: 8, y: 8 } }); await page.waitForTimeout(210)
      const interests = button(page, 'amPrefs.openInterestsPicker.click.1'); await interests.scrollIntoViewIfNeeded(); await interests.tap(); await page.getByRole('dialog', { name: 'Interests', exact: true }).waitFor(); await button(page, 'sheetInterestsPicker.closeSheet.click.2').tap(); await page.waitForTimeout(210)
      check(await page.evaluate(() => window.__prefs_trace.animations.length) === 1 && await read(page) === before, 'University and Interests remain their existing child dialogs without page motion or writes')
    }
    if (item.source === 'searching') await page.clock.setFixedTime(now + 5000)
    if (item.mode === 'save' || item.mode === 'failure') {
      const chip = page.locator('[data-interaction="amPrefs.o.pick.click.1"]:visible').nth(1); await chip.scrollIntoViewIfNeeded(); const chosen = MATCH_MAJORS[1][0]; await chip.tap()
      const draft_background = await chip.evaluate(node => getComputedStyle(node).backgroundColor)
      check(await read(page) === before, 'Selecting a preference edits only the current draft')
      await page.evaluate(fail => { window.__fail_prefs_write = fail; window.__prefs_submit_at = performance.now() }, item.mode === 'failure')
      const save = button(page, 'amPrefs.savePrefs.click.1'); await save.tap(); await save.dispatchEvent('click'); await save.dispatchEvent('click')
      if (item.mode === 'failure') {
        await page.waitForFunction(() => window.__prefs_trace.attempts.length === 1); await page.waitForTimeout(100)
        check(await phase(page) === 'settled' && await read(page) === before && await page.locator(target + ':visible').count() === 1, 'A failed persistence attempt stays on Preferences with no partial update or exit')
        check(await chip.evaluate(node => getComputedStyle(node).backgroundColor) === draft_background, 'The exact selected draft remains visibly selected after failure')
        await page.locator('.brand-toast--error:visible').waitFor()
        check(await page.locator('.brand-toast--error:visible').count() > 0 && await page.evaluate(() => window.__prefs_trace.animations.length) === 1, 'Failure gives real feedback and does not play a success return')
        await page.evaluate(() => { window.__fail_prefs_write = false })
        await close.tap(); await wait_source(page, item); await idle(page)
        check(await read(page) === before, 'Cancelling after failure discards the retained unsent draft without a write')
      } else {
        await wait_source(page, item); await idle(page)
        const after = await data_for(page), trace = await page.evaluate(() => ({ ...window.__prefs_trace, submitted_at: window.__prefs_submit_at }))
        check(after.match_preferences.find(row => row.owner_user_id === 'user_cimoa').major === chosen && trace.writes.length === 1, 'Save commits the selected preference exactly once despite repeated taps')
        check(trace.writes[0] - trace.submitted_at >= 400 && trace.loading.length > 0, 'Save retains the 400–600ms business Loading before its one write')
        same_business(JSON.parse(before).data, after)
        await page.locator('.brand-toast:visible').filter({ hasText: 'Preferences updated' }).waitFor()
        check(await page.locator('.brand-toast:visible').filter({ hasText: 'Preferences updated' }).count() === 1, 'Only the completed preference update receives its accurate success feedback')
      }
    } else {
      const chip = page.locator('[data-interaction="amPrefs.o.pick.click.1"]:visible').nth(1); await chip.scrollIntoViewIfNeeded(); await chip.tap()
      check(await read(page) === before, 'Unsaved preference choices remain transient until Save')
      await freeze(page); await close.tap(); await frozen(page, 2)
      const reverse = await page.evaluate(() => window.__prefs_trace.animations[1]); check(reverse.timing.duration === 180, 'X returns with one 180ms downward motion')
      if (!item.reduced) check(/translateY\(0(?:px)?\)/.test(reverse.frames[0].transform) && reverse.frames.at(-1).transform === 'translateY(100%)', 'The reverse moves the complete page down, without changing its layout')
      await screenshot(page, item.name + '-exit-start'); await resume(page); await wait_source(page, item)
      check(await read(page) === before, 'X and all read-only motion perform zero persistence writes')
    }
    const returned = await snapshot(page), trace = await page.evaluate(() => window.__prefs_trace)
    check(returned.source_connected && returned.stack.length === initial.stack.length && returned.stack[0].id === initial.stack[0].id && returned.scroll === initial.scroll, 'Real Back returns once to the same source instance and scroll position')
    check(!returned.issue && !trace.phases.some(row => row.issue) && trace.phases.filter(row => row.phase === 'idle').every(row => row.route.slice(1) === route_for(item.source)), 'Presentation cleanup waits for the actual correct source route with no hidden fallback issue')
    check(returned.source_children === 0 && returned.target_children === 0 && await phase(page) === 'idle', 'No Teleport frame, transition lock or transformed target remains')
    check(!trace.css.some(row => /page-leave|auth-content-rise|page-rise/.test(row.name)), 'The vertical page does not stack generic cRise or a second exit animation')
    if (initial.front_id) check(returned.front_id === initial.front_id, 'Discover returns to the same previously swiped card')
    if (item.source === 'searching') check((await page.locator('.auto-match-searching:visible').textContent()).includes('3595 sec'), 'The resumed search derives elapsed time from its original deadline rather than restarting')
    if (!item.mode) check(trace.writes.length === 0 && trace.loading.length === 0, 'Pure navigation never starts a Saving or Loading prompt')
    await screenshot(page, item.name + '-returned')
    return { ...item, passed: true, checks, returned, phases: trace.phases, animations: trace.animations, writes: trace.writes.length }
  } catch (error) { report.failed_case = item; report.failure_state = await snapshot(page).catch(() => null); report.failure_trace = await page.evaluate(() => window.__prefs_trace).catch(() => null); await screenshot(page, item.name + '-failure').catch(() => {}); throw error }
  finally { await context.close() }
}
async function interruptions() {
  const item = { name: 'interruptions', source: 'index' }, { context, page, entry } = await prepare(item), checks = [], check = (condition, message) => { assert.ok(condition, message); checks.push(message) }
  try {
    const before = await read(page)
    for (const reason of ['background', 'resize']) {
      const count = await page.evaluate(() => window.__prefs_animations.length)
      await freeze(page, 60); await entry.tap(); await frozen(page, count + 1)
      if (reason === 'background') await background(page); else await page.setViewportSize({ width: 392, height: 852 })
      await idle(page); const state = await snapshot(page)
      check(translate_y(state.target_transform) === 0 && state.source_children === 0 && state.target_children === 0, `${reason} clears the unfinished motion and restores a complete usable Preferences page`)
      await button(page, 'amPrefs.goBack.click.1').tap(); await wait_source(page, item); await idle(page); await page.waitForTimeout(210)
      if (reason === 'resize') { await page.setViewportSize({ width: 393, height: 852 }); await page.waitForTimeout(80) }
    }
    let count = await page.evaluate(() => window.__prefs_animations.length)
    await freeze(page, 60); await entry.tap(); await frozen(page, count + 1)
    await entry.dispatchEvent('click'); await entry.dispatchEvent('click'); await resume(page)
    check(await page.evaluate(() => window.__prefs_animations.length) === count + 1, 'Repeated opening clicks create only one real Preferences push')
    count = await page.evaluate(() => window.__prefs_animations.length)
    const close = button(page, 'amPrefs.goBack.click.1'); await freeze(page, 60); await close.tap(); await frozen(page, count + 1); await close.dispatchEvent('click'); await background(page); await idle(page); await page.waitForTimeout(260)
    check(page.url().endsWith('/pages/auto-match/preferences') && translate_y((await snapshot(page)).target_transform) === 0, 'Cancelling reverse prevents every late pop and restores the page')
    await close.tap(); await wait_source(page, item); await idle(page); await page.waitForTimeout(210)
    await entry.tap(); await idle(page); await button(page, 'amPrefs.savePrefs.click.1').tap(); await background(page); await page.waitForTimeout(620)
    check(await read(page) === before && await page.evaluate(() => window.__prefs_trace.writes.length) === 0, 'Background cancels an unfinished Save before its delayed Store write')
    await button(page, 'amPrefs.goBack.click.1').tap(); await wait_source(page, item); await idle(page)
    check((await snapshot(page)).source_connected && await read(page) === before, 'A fresh X works after cancellation and leaves all business entities unchanged')
    return { ...item, passed: true, checks }
  } finally { await context.close() }
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const cases = [...Object.keys(source_ids).map(source => ({ name: source + '-cancel', source })), { name: 'small-cancel', source: 'index', width: 320, height: 568 }, { name: 'reduced-cancel', source: 'index', reduced: true }, { name: 'save-once', source: 'index', mode: 'save' }, { name: 'save-failure', source: 'index', mode: 'failure' }].filter(item => !selected || item.name === selected)
  assert.ok(cases.length || selected === 'interruptions', 'The requested case exists')
  for (const item of cases) report.results.push(await run(item))
  if (!selected || selected === 'interruptions') report.results.push(await interruptions())
  assert.deepEqual(report.errors, [])
  report.expected_diagnostic_warnings = report.warnings.filter(row => row.message.includes('[uni统计 2.0]') && row.message.includes('Failed to fetch'))
  report.unexpected_warnings = report.warnings.filter(row => !report.expected_diagnostic_warnings.includes(row)); assert.deepEqual(report.unexpected_warnings, [])
  report.passed = true; console.log(`PASS Preferences vertical surface: ${report.results.length} cases, ${report.results.reduce((sum, row) => sum + row.checks.length, 0)} assertions; no server or installed app access`)
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
