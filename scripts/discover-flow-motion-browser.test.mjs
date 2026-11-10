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
import { deck_layer_geometry } from '../src/utils/discoverSwipe.js'

// Every response is fulfilled from dist in an isolated browser context. This
// runner does not open a listening socket or touch an installed app's storage.
const root = path.resolve('dist/build/h5')
const output = path.resolve('artifacts/discover-flow-motion-2026-11-02')
const origin = 'http://127.0.0.1:47879', key = 'cimoa_app_state_v2', now = Date.now()
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const fixture = async (waiting = false) => {
  let disk = create_scenario('default', now)
  for (const message of disk.messages) message.read_by = [...new Set([...message.read_by, disk.session.current_user_id])]
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  if (waiting) {
    const user_id = store.discover_people[0].user_id
    const question_id = store.questions_for_user(user_id)[0].question_id
    assert.equal((await store.send_introduction({ user_id, question_id, text: 'A campus walk after class?', operation_id: 'discover-motion-waiting-fixture' })).success, true)
  }
  validate_data(store.data)
  return clone_data(store.data)
}
const data = await fixture(), waiting_data = await fixture(true)
const users = [...data.users].filter(user => Number.isInteger(user.discover_order)).sort((a, b) => a.discover_order - b.discover_order)
const question_for = user_id => data.icebreakers.filter(question => question.user_id === user_id)[1]
const report = {
  passed: false, results: [], screenshots: [], errors: [], warnings: [], blocked_external_requests: [],
  preview_server_started: false, actual_microphone_requested: false, business_submissions: 0,
  dist_index_sha256: hash(path.join(root, 'index.html')),
  limitations: [
    'CDP dispatchTouchEvent produces trusted browser-emulated touch/pointer input; it does not prove physical iPhone gesture latency or native safe-area correctness.',
    'pointercancel, lostpointercapture and visibility changes are explicit diagnostic DOM injections, not an actual iOS background transition.',
    'Safe-area values 62/34 are supplied through the real bridge for deterministic viewport-budget coverage, not hard-coded into application layout.',
    'No microphone, payment, introduction submission or real user container is used. Browser evidence does not replace WKWebView production acceptance.',
  ],
}
fs.mkdirSync(output, { recursive: true })
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
let browser

async function install_trace(page) {
  await page.addInitScript(({ key }) => {
    const trace = window.__discover_flow_trace = { writes: [], motions: [], surfaces: [], cues: [], pointer_events: [], microphone_requests: 0, loading_seen: [], safe_area_applied: false }
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      if (this.matches?.('.ice-select-page')) trace.surfaces.push({ frames, duration: options?.duration, at: performance.now() })
      return animate.call(this, frames, options)
    }
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) trace.writes.push({ at: performance.now(), bytes: value.length }); return write.call(this, name, value) }
    if (navigator.mediaDevices?.getUserMedia) navigator.mediaDevices.getUserMedia = () => { trace.microphone_requests++; return Promise.reject(Error('Microphone is deliberately unavailable in this visual regression.')) }
    const rect = node => { const r = node?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null }
    const page_kind = node => ['select', 'text', 'voice'].find(kind => node?.closest?.(`.ice-${kind}-page`))
    document.addEventListener('animationstart', event => {
      const kind = page_kind(event.target)
      if (!kind) return
      if (event.target.matches?.('.secondary-page-scroll')) {
        const frame = event.target.closest('.secondary-page-frame'), header = frame.querySelector('.secondary-page-header'), root = frame.querySelector('.page-transition')
        trace.motions.push({ kind, name: event.animationName, at: performance.now(), header: rect(header), header_transform: getComputedStyle(header).transform, header_animation: getComputedStyle(header).animationName, root_animation: getComputedStyle(root).animationName, root_opacity: getComputedStyle(root).opacity, duration: getComputedStyle(event.target).animationDuration })
      }
      if (event.target.matches?.('.ice-continuity-cue')) trace.cues.push({ kind, name: event.animationName, at: performance.now() })
    }, true)
    for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(name, event => {
      if (event.target?.closest?.('.discover-deck,.discover-send')) trace.pointer_events.push({ name, trusted: event.isTrusted, pointer_id: event.pointerId, pointer_type: event.pointerType, at: performance.now() })
    }, true)
    new MutationObserver(() => {
      for (const node of document.querySelectorAll('.brand-action-loading,.brand-action-blocker,.event-loading,uni-toast,.loading-mask')) {
        if (node.getBoundingClientRect().width && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden') trace.loading_seen.push(node.textContent.trim())
      }
    }).observe(document, { childList: true, attributes: true, subtree: true })
    document.addEventListener('DOMContentLoaded', () => {
      let frames = 0
      const safe = () => {
        if (window.CommonTemplateSafeAreaBridge) { window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); trace.safe_area_applied = true }
        else if (++frames < 240) requestAnimationFrame(safe)
      }
      safe()
    }, { once: true })
  }, { key })
}

async function prepare(item) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: true, hasTouch: true, reducedMotion: item.reduced ? 'reduce' : 'no-preference' })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => report.errors.push({ case: item.name, message: error.message }))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push({ case: item.name, message: event.text() }) })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) { report.blocked_external_requests.push(url.origin + url.pathname); return route.abort('blockedbyclient') }
    if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated Discover visual regression</title>' })
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(origin + '/fixture-shell')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: item.waiting ? waiting_data : data })
  await install_trace(page)
  await page.goto(origin + '/index.html#/pages/discover/index', { waitUntil: 'domcontentloaded' })
  await page.locator('.discover-deck:not([data-skeleton="discover"])[data-entrance-phase="complete"]').waitFor()
  await page.locator('.discover-photo-card--front .profile-photo[data-media-status="ready"]').waitFor()
  await page.waitForTimeout(280)
  return { context, page, cdp: await context.newCDPSession(page) }
}

const current = selector => `${selector}:visible`
const button = (page, id) => page.locator(current(`[data-interaction="${id}"]`)).last()
async function shot(page, name) { await page.screenshot({ path: path.join(output, name + '.png') }); report.screenshots.push(name + '.png') }
async function touch(cdp, type, x, y) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1, radiusX: 5, radiusY: 5, force: 1 }] }) }
async function tap(page, selector) { await page.locator(current(selector)).last().tap() }
async function settled(page) { await page.waitForFunction(() => { const deck = [...document.querySelectorAll('.discover-deck')].at(-1); return deck && deck.dataset.settling === 'false' && deck.dataset.resetting === 'false' }); await page.waitForTimeout(35) }
async function front_id(page) { return page.locator(current('.discover-photo-card--front')).getAttribute('data-user-id') }
async function drag(page, cdp, ratio, cancel = '') {
  const box = await page.locator(current('.discover-photo-card--front')).boundingBox(), start = { x: box.x + box.width / 2, y: box.y + box.height * .35 }
  await touch(cdp, 'touchStart', start.x, start.y)
  for (let step = 1; step <= 6; step++) { await touch(cdp, 'touchMove', start.x + box.width * ratio * step / 6, start.y); await page.waitForTimeout(12) }
  const moving = await page.locator(current('.discover-deck')).evaluate(node => ({ ...node.dataset, transforms: [...node.querySelectorAll('.discover-photo-card')].map(card => ({ depth: card.dataset.deckDepth, transform: getComputedStyle(card).transform, shadow: getComputedStyle(card.querySelector('.discover-card-face')).boxShadow })) }))
  if (cancel) {
    await page.locator(current('.discover-photo-card--front')).evaluate((node, type) => {
      if (type === 'visibility') {
        const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
        if (descriptor) Object.defineProperty(document, 'visibilityState', descriptor)
        else delete document.visibilityState
        document.dispatchEvent(new Event('visibilitychange'))
      } else {
        const pointer_id = window.__discover_flow_trace.pointer_events.filter(event => event.name === 'pointerdown').at(-1).pointer_id
        node.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: pointer_id, pointerType: 'touch', isPrimary: true }))
      }
    }, cancel)
    await touch(cdp, 'touchCancel', 0, 0)
  } else await touch(cdp, 'touchEnd', 0, 0)
  await page.waitForTimeout(20); await settled(page)
  return moving
}

async function geometry(page) {
  return page.evaluate(() => {
    const active = [...document.querySelectorAll('uni-page')].at(-1) || document
    const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
    const front = active.querySelector('.discover-photo-card--front'), content = active.querySelector('.discover-content')
    return { content: box(content), deck: box(active.querySelector('.discover-deck')), front: box(front), info: box(front.querySelector('.discover-info')), tags: [...front.querySelectorAll('.discover-tag')].map(box), send: box(active.querySelector('.discover-send')), tabbar: box(active.querySelector('.tabbar')), backs: [...active.querySelectorAll('.discover-photo-card:not(.discover-photo-card--front)')].map(node => ({ depth: node.dataset.deckDepth, box: box(node), transform: getComputedStyle(node).transform, shadow: getComputedStyle(node.querySelector('.discover-card-face')).boxShadow })), scroll_width: document.documentElement.scrollWidth, scroll_positions: [...active.querySelectorAll('.main-tab-scroll .uni-scroll-view')].map(node => node.scrollTop), safe_top: getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-top'), safe_bottom: getComputedStyle(document.documentElement).getPropertyValue('--native-safe-area-bottom') }
  })
}

async function run_case(item) {
  const { context, page, cdp } = await prepare(item), checks = [], metrics = []
  const check = (condition, message) => { assert.ok(condition, `${item.name}: ${message}`); checks.push(message) }
  try {
    const before = await page.evaluate(key => localStorage.getItem(key), key)
    const initial = await front_id(page), boxes = await geometry(page)
    metrics.push({ stage: 'ready', geometry: boxes })
    check(initial === users[0].user_id, 'The Store cursor selects the expected first person')
    check(boxes.front.y >= boxes.content.y - 1 && boxes.front.bottom < boxes.send.y && boxes.send.bottom <= boxes.tabbar.y + 1, 'The complete front card, Send and fixed Tabbar fit one viewport')
    check(boxes.info.bottom <= boxes.front.bottom + 1 && boxes.tags.length === 3 && boxes.tags.every(tag => tag.bottom <= boxes.front.bottom + 1), 'Name and all three profile tags remain inside the card')
    check(boxes.scroll_width <= item.width && boxes.scroll_positions.every(top => top === 0), 'There is no horizontal page overflow or vertical card-list scroll')
    check(boxes.backs.length === 2 && boxes.backs.every(card => card.box.x >= boxes.content.x - 1 && card.box.right <= boxes.content.right + 1 && card.box.y >= boxes.content.y - 1 && card.box.bottom <= boxes.content.bottom + 1), 'Both fanned rear cards stay inside the real content clipping boundary')
    const measured_space = { left: Math.max(0, boxes.deck.x - boxes.content.x), right: Math.max(0, boxes.content.right - boxes.deck.right), top: Math.max(0, boxes.deck.y - boxes.content.y), bottom: Math.max(0, Math.min(boxes.content.bottom, boxes.send.y) - boxes.deck.bottom) }
    const expected_layers = deck_layer_geometry({ width: boxes.deck.width, height: boxes.deck.height, space: measured_space })
    check(boxes.backs.every(card => {
      const matrix = card.transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number), layer = expected_layers[Number(card.depth)]
      if (!matrix || !layer) return false
      return Math.abs(Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI - layer.angle) < .01 && Math.abs(matrix[4] - layer.x / 100 * boxes.deck.width) < .02 && Math.abs(matrix[5] - layer.y / 100 * boxes.deck.height) < .02
    }), 'Initial rear transforms use measured card geometry and actual content space, not a default 1px card')
    const rotations = boxes.backs.map(card => { const matrix = card.transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number); return matrix ? Math.atan2(matrix[1], matrix[0]) : 0 })
    check(rotations[0] * rotations[1] < 0, 'Rear cards visibly fan to opposite sides while the front stays straight')
    await shot(page, item.name + '-deck')
    if (item.name === 'reference-393x852') {
      for (const viewport of [{ width: 320, height: 568 }, { width: 430, height: 932 }, { width: item.width, height: item.height }]) {
        await page.setViewportSize(viewport); await page.waitForTimeout(320)
        const resized = await geometry(page)
        check(resized.backs.every(card => card.box.x >= resized.content.x - 1 && card.box.right <= resized.content.right + 1 && card.box.y >= resized.content.y - 1 && card.box.bottom <= resized.content.bottom + 1) && await front_id(page) === initial, `ResizeObserver refits the same selected card at ${viewport.width}×${viewport.height}`)
        metrics.push({ stage: 'resized', viewport, geometry: resized })
      }
    }
    if (item.waiting) {
      const send = page.locator(current('.discover-send'))
      check(await send.textContent() === 'Waiting for reply' && await send.getAttribute('aria-disabled') === 'true', 'A pending request exposes the grey, disabled Waiting for reply action')
      await send.dispatchEvent('click'); await page.waitForTimeout(320)
      check(page.url().endsWith('/pages/discover/index'), 'A pending request cannot open another introduction')
    } else {
      const rebound = await drag(page, cdp, -.18)
      check(await front_id(page) === initial, 'A short touch drag rebounds to the same person')
      const cancelled = await drag(page, cdp, -.36, 'pointercancel')
      check(await front_id(page) === initial, 'pointercancel beyond one third never commits a browse')
      await drag(page, cdp, -.36, 'lostpointercapture')
      check(await front_id(page) === initial, 'lostpointercapture cancels a long drag and allows a fresh gesture')
      await drag(page, cdp, -.36, 'visibility')
      check(await front_id(page) === initial, 'Diagnostic background visibility cancels without advancing the person')
      const advanced = await drag(page, cdp, -1 / 3)
      const selected = await front_id(page)
      check(selected === users[1].user_id, 'A trusted one-third touch swipe advances exactly one person')
      metrics.push({ stage: 'gesture-progress', rebound, cancelled, advanced })
      await page.waitForTimeout(350)
      const send = page.locator(current('.discover-send')), box = await send.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2
      await touch(cdp, 'touchStart', x, y); await page.waitForTimeout(140)
      check(['pressed', 'held'].includes(await send.getAttribute('data-touch-state')), 'Send uses the shared touch press state')
      await touch(cdp, 'touchMove', x, y - 24); await touch(cdp, 'touchCancel', 0, 0); await page.waitForTimeout(100)
      check(page.url().endsWith('/pages/discover/index') && await send.getAttribute('data-touch-state') === null, 'A moved/cancelled Send press clears feedback and does not navigate')
      await shot(page, item.name + '-after-swipe')
      await send.tap()
      await page.locator(current('.ice-select-page')).waitFor()
      check(new URL(page.url()).hash.includes(`user_id=${selected}`), 'Send opens the real full select route for the visible person')
      await page.waitForTimeout(290)
      check(await page.locator(current('.ice-select-page .ice-person')).textContent().then(text => text.includes(users[1].user_name)), 'The target page retains the selected person entity')
      await shot(page, item.name + '-select')
      const question = question_for(selected)
      await page.locator(current('[data-interaction="ibSelect.q.pick.click.1"]')).nth(1).tap()
      await button(page, 'ibSelect.answerGo.click.1').tap()
      await page.locator(current('.ice-text-page')).waitFor(); await page.waitForTimeout(290)
      check(page.url().includes(encodeURIComponent(question.question_id)), 'The answer route carries the chosen stable question ID')
      check(await page.locator(current('.ice-text-page .ice-person-question')).textContent().then(text => text.trim() === question.text), 'Text answer shows the same question without rewritten copy')
      const field = page.locator('textarea:visible'), reply = 'A walk around campus and coffee after the afternoon lecture.'
      await field.fill(reply); await page.waitForTimeout(160)
      check(await field.inputValue() === reply, 'Manual answer input remains editable')
      await shot(page, item.name + '-text')
      await button(page, 'ibText.switchToVoice.click.1').tap()
      await page.locator(current('.ice-voice-page')).waitFor(); await page.waitForTimeout(290)
      check(page.url().includes(selected) && page.url().includes(question.question_id), 'Switch to voice keeps the same person, question and real route')
      check(await page.locator(current('.ice-voice-page .ice-question')).textContent().then(text => text.includes(question.text)), 'Voice answer retains the exact selected question')
      check(await page.locator(current('.ice-voice-page .ice-header-title')).textContent() === 'Your answer', 'Voice answer preserves its approved title and no More control')
      check(await page.locator(current('.ice-voice-page .ice-menu')).count() === 0, 'Voice answer has no unsourced More entry')
      await shot(page, item.name + '-voice')
      await button(page, 'ibVoice.goBack.click.1').tap()
      await page.locator(current('.ice-select-page')).waitFor(); await page.waitForTimeout(230)
      check(await page.locator(current('.ice-choice--selected')).textContent().then(text => text.trim() === question.text), 'Warm Back restores the selected question')
      await button(page, 'ibSelect.pickText.click.1').tap(); await button(page, 'ibSelect.answerGo.click.1').tap()
      await page.locator(current('.ice-text-page')).waitFor(); await page.waitForTimeout(260)
      check(await page.locator('textarea:visible').inputValue() === reply, 'Switching modes and Back retain the in-memory unsent answer without persistence')
      await button(page, 'ibText.goBack.click.1').tap(); await page.locator(current('.ice-select-page')).waitFor(); await page.waitForTimeout(220)
      await button(page, 'ibSelect.goBack.click.1').tap(); await page.locator(current('.discover-deck')).waitFor(); await page.waitForTimeout(240)
      check(await front_id(page) === selected, 'Real Back restores the exact Discover cursor rather than refreshing the deck')
      check(await page.locator(current('.discover-deck')).getAttribute('data-skeleton') === null, 'Warm Discover return does not consume another skeleton')
      await shot(page, item.name + '-returned')
      const trace = await page.evaluate(() => window.__discover_flow_trace)
      const entries = trace.motions.filter(motion => /^auth-content-/.test(motion.name))
      const returns = trace.motions.filter(motion => /^page-leave/.test(motion.name))
      check(['text', 'voice'].every(kind => trace.motions.some(motion => motion.kind === kind)), 'Text and voice retain the body-only motion contract')
      check(trace.surfaces.length === 2 && trace.surfaces[0].duration === 240 && trace.surfaces[1].duration === 180, 'Direct Send/Select return uses one 240ms expansion and one 180ms contraction without a warm replay')
      check(trace.motions.every(motion => motion.header_transform === 'none' && motion.header_animation === 'none' && motion.root_animation === 'none' && Number(motion.root_opacity) > .99), 'Headers and page roots remain still and fully visible while only the content animates')
      check(entries.every(motion => motion.duration.split(',').every(value => Math.abs(parseFloat(value) - .24) < .001)), 'Content entry stays within the existing 240ms rhythm')
      check(returns.every(motion => motion.duration.split(',').every(value => Math.abs(parseFloat(value) - .18) < .001)), 'Real Back retains the existing 180ms return rhythm')
      check(trace.cues.filter(cue => cue.kind === 'select').length <= 1, 'Returning to the retained select page never replays its continuity cue')
      if (item.reduced) {
        check(entries.every(motion => /fade/.test(motion.name)), 'Reduced motion uses fade-only content entry')
        check(trace.cues.length === 0, 'Reduced motion disables decorative continuity light')
      } else check(trace.cues.every(cue => cue.kind !== 'select') && trace.cues.some(cue => cue.kind === 'text') && trace.cues.some(cue => cue.kind === 'voice'), 'Select does not stack its old edge light on the point-surface effect; answer cues remain scoped')
      metrics.push({ stage: 'flow-trace', motions: trace.motions, surfaces: trace.surfaces, cues: trace.cues })
    }
    const after = await page.evaluate(key => localStorage.getItem(key), key), trace = await page.evaluate(() => window.__discover_flow_trace)
    check(after === before && trace.writes.length === 0, 'Presentation, gestures, unsent input and navigation make zero business persistence writes')
    check(trace.microphone_requests === 0, 'Voice navigation never requests microphone access automatically')
    check(trace.loading_seen.length === 0, 'Read-only flow adds no Loading Toast or Saving presentation')
    if (!item.waiting) check(trace.pointer_events.some(event => event.trusted && event.pointer_type === 'touch'), 'Swipe coverage includes trusted browser-emulated touch input')
    return { ...item, passed: true, checks, metrics, storage_writes: trace.writes.length, microphone_requests: trace.microphone_requests }
  } catch (error) {
    report.failed_case = item
    report.visible_failure = await page.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-4000), trace: window.__discover_flow_trace })).catch(() => null)
    await shot(page, item.name + '-failure').catch(() => {})
    throw error
  } finally { await context.close() }
}

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const selected_case = process.argv.find(value => value.startsWith('--case='))?.slice('--case='.length)
  const cases = [
    { name: 'small-320x568', width: 320, height: 568 },
    { name: 'reference-393x852', width: 393, height: 852 },
    { name: 'large-430x932', width: 430, height: 932 },
    { name: 'reduced-393x852', width: 393, height: 852, reduced: true },
    { name: 'waiting-393x852', width: 393, height: 852, waiting: true },
  ].filter(item => !selected_case || item.name === selected_case)
  assert.ok(cases.length, 'The requested case exists')
  for (const item of cases) report.results.push(await run_case(item))
  assert.deepEqual(report.errors, [])
  report.expected_diagnostic_warnings = report.warnings.filter(warning => warning.message.includes('[uni统计 2.0]') && warning.message.includes('Failed to fetch'))
  report.unexpected_warnings = report.warnings.filter(warning => !report.expected_diagnostic_warnings.includes(warning))
  assert.deepEqual(report.unexpected_warnings, [])
  report.passed = true
  console.log(`PASS Discover flow motion: ${report.results.length} isolated cases, ${report.results.reduce((total, result) => total + result.checks.length, 0)} assertions; no preview server, microphone or business submission`)
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
