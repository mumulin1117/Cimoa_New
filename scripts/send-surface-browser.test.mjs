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

// Isolated, offline browser fixtures. No server, installed app container,
// microphone, introduction submission or payment is involved in this runner.
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/send-surface-2026-11-02')
const engine_name = process.argv.find(value => value.startsWith('--engine='))?.slice(9) || 'chrome'
const preview_only = process.argv.includes('--preview')
const origin = 'http://127.0.0.1:47891', key = 'cimoa_app_state_v2', now = Date.now()
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const selectors = { source: '.main-tab-frame.discover-request-deck', target: '.secondary-page-frame.ice-select-page', host: '[data-send-surface-phase]', send: '.discover-send', source_portal: '#cimoa-send-surface-source', target_portal: '#cimoa-send-surface-target' }
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const fixture = async (kind = 'default') => {
  let disk = create_scenario('default', now)
  for (const message of disk.messages) message.read_by = [...new Set([...message.read_by, disk.session.current_user_id])]
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  const person = store.discover_people[0]
  // This runner measures motion, not first-use teaching. Complete only the
  // disposable fixture's receipt before tracing; never alter app seed data.
  assert.equal(store.begin_discover_guide(person.user_id, store.auth_context).success, true)
  for (const step of [1, 2, 3, 4, 5, 6]) assert.equal(store.move_discover_guide(step, store.auth_context).success, true)
  assert.equal(store.finish_discover_guide('completed', store.auth_context).success, true)
  if (kind === 'waiting') {
    const result = await store.send_introduction({ user_id: person.user_id, question_id: store.questions_for_user(person.user_id)[0].question_id, text: 'A campus walk after class?', operation_id: 'send-surface-waiting-fixture' })
    assert.equal(result.success, true)
  }
  const data = clone_data(store.data)
  if (kind === 'chat') {
    const me = data.session.current_user_id, other = person.user_id
    for (const [from_user_id, to_user_id] of [[me, other], [other, me]]) data.relationships.push({ relationship_id: `surface_${from_user_id}_${to_user_id}`, from_user_id, to_user_id, created_at: now })
    data.conversations.push({ conversation_id: 'conversation_surface_existing', kind: 'direct', participant_ids: [me, other], event_id: null })
  }
  validate_data(data)
  return { data, user_id: person.user_id, user_name: person.user_name }
}
const fixtures = { default: await fixture(), waiting: await fixture('waiting'), chat: await fixture('chat') }
// uni-app's getCurrentPages is an ES-module export rather than a window global.
// Locate that existing read-only export; do not patch or add an application API.
const shared_file = fs.readdirSync(path.join(root, 'assets')).find(name => /^index-.*\.js$/.test(name) && fs.readFileSync(path.join(root, 'assets', name), 'utf8').includes('send-surface-host'))
assert.ok(shared_file, 'The built app contains the Send surface host')
const shared_code = fs.readFileSync(path.join(root, 'assets', shared_file), 'utf8')
const pages_symbol = shared_code.match(/function (\w+)\(\)\{return (\w+)\(\)\}function \2\(\)\{const \w+=\[\],\w+=\w+\.values\(\)/)?.[1]
const pages_export = shared_code.slice(shared_code.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${pages_symbol} as (\\w+)`))?.[1]
assert.ok(pages_export, 'The existing getCurrentPages export can be observed without a source change')
const report = {
  passed: false, results: [], errors: [], warnings: [], screenshots: [], blocked_external_requests: [],
  engine: engine_name,
  preview_server_started: false, actual_microphone_requested: false, business_submissions: 0,
  dist_index_sha256: sha(path.join(root, 'index.html')),
  limitations: [
    'CDP trusted touch events cover browser-emulated touch, not physical iPhone latency or native safe-area correctness.',
    'Synthetic visibility/pointer cancellation and injected navigation failure are diagnostics, not actual iOS background transitions.',
    'Paused WAAPI screenshots show deterministic intermediate geometry only; separate unpaused traces verify the actual 240ms/180ms animation contract.',
    'Safe-area values are supplied through the existing bridge for viewport coverage, never written into application layout.',
    'Browser regression does not replace WKWebView production acceptance. No installed app storage, microphone, purchase or real submission is used.',
  ],
}
fs.mkdirSync(output, { recursive: true })
const { chromium, webkit } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
let browser

async function install_trace(page) {
  await page.addInitScript(({ key, selectors }) => {
    const trace = window.__send_surface_trace = { writes: [], animations: [], phases: [], css: [], pointers: [], microphone_requests: 0, loading_seen: [], routes: [], nav: [] }
    window.__surface_animations = []
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) trace.writes.push({ at: performance.now(), bytes: value.length }); return write.call(this, name, value) }
    if (navigator.mediaDevices?.getUserMedia) navigator.mediaDevices.getUserMedia = () => { trace.microphone_requests++; return Promise.reject(Error('Microphone is deliberately unavailable in this visual regression.')) }
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options)
      if (this.matches(selectors.target)) {
        const index = window.__surface_animations.push(animation) - 1
        const row = { index, start: performance.now(), frames: animation.effect.getKeyframes(), timing: animation.effect.getTiming(), phase: document.querySelector(selectors.host)?.dataset.sendSurfacePhase, route: location.hash, element_is_target: this === window.__original_select_frame || !window.__original_select_frame, state: animation.playState }
        trace.animations.push(row)
        if (!window.__original_select_frame) window.__original_select_frame = this
        if (window.__freeze_next_surface) { animation.pause(); animation.currentTime = Number(window.__freeze_next_surface.time || 0); window.__freeze_next_surface = null; row.diagnostic_paused = true }
        animation.finished.then(() => { row.finish = performance.now(); row.final_state = animation.playState }, () => { row.cancel = performance.now(); row.final_state = animation.playState })
      }
      return animation
    }
    document.addEventListener('animationstart', event => {
      if (event.target.closest?.('.ice-select-page,.ice-text-page,.ice-voice-page')) trace.css.push({ name: event.animationName, target: event.target.className, at: performance.now(), duration: getComputedStyle(event.target).animationDuration, route: location.hash })
    }, true)
    for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(name, event => {
      if (event.target?.closest?.('.discover-send')) trace.pointers.push({ name, trusted: event.isTrusted, pointer_id: event.pointerId, pointer_type: event.pointerType })
    }, true)
    const stack = () => typeof window.__get_surface_pages === 'function' ? window.__get_surface_pages().map(page => ({ route: page.route, id: page.$page?.id ?? page.$basePage?.id })) : []
    let last_phase = '', last_route = ''
    new MutationObserver(() => {
      const host = document.querySelector(selectors.host), phase = host?.dataset.sendSurfacePhase || ''
      if (phase !== last_phase) { trace.phases.push({ phase, at: performance.now(), route: location.hash, issue: host?.dataset.sendSurfaceIssue, stack: stack() }); last_phase = phase }
      if (location.hash !== last_route) { trace.routes.push({ route: location.hash, at: performance.now(), stack: stack() }); last_route = location.hash }
      for (const node of document.querySelectorAll('.brand-action-loading,.brand-action-blocker,uni-toast,.loading-mask')) if (node.getBoundingClientRect().width && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden') trace.loading_seen.push(node.textContent.trim())
    }).observe(document, { subtree: true, childList: true, attributes: true })
    document.addEventListener('DOMContentLoaded', () => {
      let frames = 0
      const setup = () => {
        if (window.CommonTemplateSafeAreaBridge) window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 })
        if (!window.CommonTemplateSafeAreaBridge && ++frames < 240) requestAnimationFrame(setup)
      }
      setup()
    }, { once: true })
  }, { key, selectors })
}

async function prepare(item) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: true, hasTouch: true, reducedMotion: item.reduced ? 'reduce' : 'no-preference' })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push({ case: item.name, message: error.message }))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push({ case: item.name, message: event.text() }) })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) { report.blocked_external_requests.push(url.origin + url.pathname); return route.abort('blockedbyclient') }
    if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated Send surface regression</title>' })
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  const fixture = fixtures[item.kind || 'default']
  await page.goto(origin + '/fixture-shell')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: fixture.data })
  await install_trace(page)
  await page.goto(origin + '/index.html#/pages/discover/index', { waitUntil: 'domcontentloaded' })
  await page.locator('.discover-deck:not([data-skeleton="discover"])[data-entrance-phase="complete"]').waitFor()
  await page.locator('.discover-photo-card--front .profile-photo[data-media-status="ready"]').waitFor()
  await page.waitForTimeout(270)
  await page.evaluate(async ({ selectors, shared_file, pages_export }) => {
    window.__original_discover_frame = document.querySelector(selectors.source)
    window.__original_send_button = document.querySelector(selectors.send)
    window.__get_surface_pages = (await import(`/assets/${shared_file}`))[pages_export]
    const router = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$router
    window.__surface_router = router
    for (const method of ['push', 'go']) {
      const original = router[method]
      router[method] = function (...args) {
        window.__send_surface_trace.nav.push({ method: method === 'push' ? 'navigateTo' : 'navigateBack', at: performance.now(), url: args[0]?.path, delta: typeof args[0] === 'number' ? -args[0] : null })
        return original.apply(this, args)
      }
    }
  }, { selectors, shared_file, pages_export })
  return { context, page, cdp: engine_name === 'chrome' ? await context.newCDPSession(page) : null, fixture }
}
const visible = selector => `${selector}:visible`
const button = (page, id) => page.locator(visible(`[data-interaction="${id}"]`)).last()
const wait_route = (page, part) => page.waitForFunction(part => location.hash.includes(part), part)
const phase = page => page.locator(selectors.host).getAttribute('data-send-surface-phase')
const idle = page => page.waitForFunction(selector => !['forward-pending', 'forward-ready', 'forward-running', 'back-ready', 'back-running', 'back-dispatched'].includes(document.querySelector(selector)?.dataset.sendSurfacePhase), selectors.host)
async function screenshot(page, name) { await page.screenshot({ path: path.join(output, name + '.png') }); report.screenshots.push(name + '.png') }
async function touch(cdp, type, x, y) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x, y, id: 1, radiusX: 5, radiusY: 5, force: 1 }] }) }
const snapshot = page => page.evaluate(selectors => {
  const box = element => { const r = element?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } : null }
  const source = document.querySelector(selectors.source_portal)?.querySelector(selectors.source), target = document.querySelector(selectors.target_portal)?.querySelector(selectors.target)
  const target_frame = target || document.querySelector(selectors.target), header = target_frame?.querySelector('.ice-header-title')
  return {
    phase: document.querySelector(selectors.host)?.dataset.sendSurfacePhase,
    issue: document.querySelector(selectors.host)?.dataset.sendSurfaceIssue,
    route: location.hash,
    source_same: source === window.__original_discover_frame,
    send_same: window.__original_discover_frame?.querySelector(selectors.send) === window.__original_send_button,
    source_portal_children: document.querySelector(selectors.source_portal)?.childElementCount || 0,
    target_portal_children: document.querySelector(selectors.target_portal)?.childElementCount || 0,
    source_inert: !!source?.closest('[inert]'), source_aria_hidden: !!source?.closest('[aria-hidden="true"]'),
    source_visible: !!source && getComputedStyle(source).display !== 'none' && getComputedStyle(source).visibility !== 'hidden' && Number(getComputedStyle(source).opacity) > .9,
    target_same: !target || target === window.__original_select_frame,
    target_transform: target_frame ? getComputedStyle(target_frame).transform : null,
    target_clip: target_frame ? getComputedStyle(target_frame).clipPath : null,
    target_inert: !!target_frame?.closest('[inert]'), target_aria_hidden: !!target_frame?.closest('[aria-hidden="true"]'),
    original_source_inert: !!window.__original_discover_frame?.closest('[inert]'),
    header_font: header ? getComputedStyle(header).fontSize : null,
    header_transform: header ? getComputedStyle(header).transform : null,
    target_box: box(target_frame), source_box: box(source), send: box(window.__original_send_button),
    send_background: window.__original_send_button ? getComputedStyle(window.__original_send_button).backgroundImage : null,
    send_opacity: window.__original_send_button ? getComputedStyle(window.__original_send_button).opacity : null,
    front_id: window.__original_discover_frame?.querySelector('.discover-photo-card--front')?.dataset.userId,
    source_connected: window.__original_discover_frame?.isConnected,
    source_count: document.querySelectorAll(selectors.source).length,
    target_count: document.querySelectorAll(selectors.target).length,
    stack: typeof window.__get_surface_pages === 'function' ? window.__get_surface_pages().map(page => ({ route: page.route, id: page.$page?.id ?? page.$basePage?.id })) : [],
  }
}, selectors)
async function freeze_next(page, time = 0) { await page.evaluate(time => { window.__freeze_next_surface = { time } }, time) }
async function frozen(page, expected_count) { await page.waitForFunction(count => window.__surface_animations.length >= count && window.__surface_animations.at(-1).playState === 'paused', expected_count) }
async function at_time(page, time) { await page.evaluate(async time => { const animation = window.__surface_animations.at(-1); animation.pause(); animation.currentTime = time; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) }, time) }
async function resume(page) { await page.evaluate(() => window.__surface_animations.at(-1).play()); await idle(page); await page.waitForTimeout(35) }
const circle = value => { const values = value?.match(/circle\(([-\d.]+)px at ([-\d.]+)px ([-\d.]+)px\)/)?.slice(1).map(Number); return values ? { radius: values[0], x: values[1], y: values[2] } : null }
const near = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance
async function background(page) { await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) }) }

async function run_case(item) {
  const { context, page, cdp, fixture } = await prepare(item), checks = [], metrics = []
  const check = (condition, message) => { assert.ok(condition, `${item.name}: ${message}`); checks.push(message) }
  try {
    const initial = await snapshot(page), before = await page.evaluate(key => localStorage.getItem(key), key)
    check(initial.front_id === fixture.user_id && initial.send.width >= 44 && initial.send.height >= 44, 'The current Store person and at-least-44pt Send target are ready')
    if (item.kind) {
      const send = page.locator(visible(selectors.send))
      check((await send.textContent()).trim() === (item.kind === 'waiting' ? 'Waiting for reply' : 'Chat'), 'Relationship-specific primary text remains unchanged')
      await send.dispatchEvent('click'); await page.waitForTimeout(320)
      check((await page.evaluate(() => window.__send_surface_trace.animations.length)) === 0, 'Waiting and Chat never play the new-introduction reveal')
      check(item.kind === 'waiting' ? page.url().includes('/pages/discover/index') : page.url().includes('conversation_surface_existing'), 'The relationship state still disables duplicate requests or opens the exact existing chat')
    } else {
      const send = page.locator(visible(selectors.send)), bounds = await send.boundingBox(), anchor = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      if (cdp) {
        await touch(cdp, 'touchStart', anchor.x, anchor.y); await touch(cdp, 'touchMove', anchor.x, anchor.y - 30); await touch(cdp, 'touchCancel', 0, 0); await page.waitForTimeout(210)
        check(page.url().endsWith('/pages/discover/index'), 'Moving and cancelling a Send touch never navigates')
        await touch(cdp, 'touchStart', anchor.x, anchor.y); await touch(cdp, 'touchCancel', 0, 0); await page.waitForTimeout(90)
        check(page.url().endsWith('/pages/discover/index') && !(await send.getAttribute('data-touch-state')), 'pointercancel clears a held Send press without opening a route')
      }
      const expected_radius = Math.max(...[[0, 0], [item.width, 0], [0, item.height], [item.width, item.height]].map(([x, y]) => Math.hypot(x - anchor.x, y - anchor.y)))
      await freeze_next(page); await send.tap(); await frozen(page, 1)
      const start = await snapshot(page), first = await page.evaluate(() => window.__send_surface_trace.animations[0])
      metrics.push({ stage: 'forward-start', snapshot: start, trace: first, expected_anchor: anchor, expected_radius })
      check(start.route.includes('/pages/discover/icebreaker/select') && start.route.includes(fixture.user_id), 'Send immediately enters the real Say Hi route for the current person')
      check(start.source_same && start.send_same && start.source_visible && start.source_inert && start.source_aria_hidden, 'The original cached source node is the visible inert, aria-hidden bottom frame')
      check(start.send_background === initial.send_background && start.send_opacity === initial.send_opacity, 'Navigation busy keeps the original brand gradient and opacity instead of flashing an unavailable grey button')
      check(start.target_same && start.target_count === 1 && start.source_count === 1, 'Teleport owns one real source and one real target; no business page is cloned')
      check(start.stack.length === initial.stack.length + 1 && start.stack[0].id === initial.stack[0].id, 'Forward adds exactly one real page above the original Discover page identity')
      check(first.timing.duration === 240, 'The forward animation uses the existing 240ms duration')
      if (item.reduced) {
        check(first.frames.every(frame => !frame.clipPath || frame.clipPath === 'none'), 'Reduced motion omits circular geometry')
      } else {
        const start_circle = circle(first.frames[0].clipPath), end_circle = circle(first.frames.at(-1).clipPath)
        check(start_circle && near(start_circle.radius, 0) && near(start_circle.x, anchor.x) && near(start_circle.y, anchor.y), 'Reveal starts from the measured Send button center, not a fixed screen coordinate')
        check(end_circle && end_circle.radius >= expected_radius - 1.5, 'The expanded circle covers all four viewport corners')
        await screenshot(page, item.name + '-forward-start')
        await at_time(page, 72)
        const middle = await snapshot(page); metrics.push({ stage: 'forward-middle', snapshot: middle })
        check(circle(middle.target_clip)?.radius > 0 && circle(middle.target_clip)?.radius < expected_radius, 'The deterministic middle frame shows genuine partial circular expansion')
        check(middle.target_transform === 'none' && middle.header_transform === 'none', 'The target page and typography are revealed, not scaled')
        await screenshot(page, item.name + '-forward-middle')
      }
      await resume(page); await wait_route(page, '/pages/discover/icebreaker/select')
      const arrived = await snapshot(page)
      check(arrived.source_portal_children === 0 && arrived.target_portal_children === 0 && arrived.target_clip === 'none' && !arrived.target_inert && !arrived.target_aria_hidden, 'Forward completion restores normal ownership, clipping, input and accessibility')
      check(arrived.header_font === start.header_font, 'Final and intermediate Say Hi title use exactly the same font size')
      check((await phase(page)) === 'settled', 'A successful reveal retains only its source association for the reverse route')
      await screenshot(page, item.name + '-say-hi')
      const chosen = page.locator(visible('[data-interaction="ibSelect.q.pick.click.1"]')).nth(1)
      await chosen.tap(); const question_text = (await chosen.textContent()).trim()
      await button(page, 'ibSelect.answerGo.click.1').tap(); await wait_route(page, '/pages/discover/icebreaker/text'); await page.waitForTimeout(280)
      check(await page.locator('textarea:visible').count() === 1 && await page.locator('textarea:focus').count() === 0, 'Text navigation retains its normal content transition without forcing keyboard focus')
      await button(page, 'ibText.goBack.click.1').tap(); await wait_route(page, '/pages/discover/icebreaker/select'); await page.waitForTimeout(230)
      check((await page.locator(visible('.ice-choice--selected')).textContent()).trim() === question_text, 'Nested Back preserves the chosen question on the retained Say Hi page')
      check((await page.evaluate(() => window.__send_surface_trace.animations.length)) === 1, 'Returning from an answer does not replay the circular reveal')
      await freeze_next(page); await button(page, 'ibSelect.goBack.click.1').tap(); await frozen(page, 2)
      const back_start = await snapshot(page), back_animation = await page.evaluate(() => window.__send_surface_trace.animations[1])
      check(back_start.source_same && back_start.send_same && back_start.source_visible, 'Reverse transition uses the original retained source and exact same Send button')
      check(back_animation.timing.duration === 180, 'The complete reverse transition takes 180ms, without a second generic return wait')
      if (!item.reduced) {
        const end = circle(back_animation.frames.at(-1).clipPath)
        check(end && near(end.radius, 0) && near(end.x, anchor.x) && near(end.y, anchor.y), 'Reverse contraction closes into the original measured Send anchor')
        await at_time(page, 90); await screenshot(page, item.name + '-back-middle')
      }
      await resume(page); await wait_route(page, '/pages/discover/index'); await page.waitForTimeout(120)
      const returned = await snapshot(page), trace = await page.evaluate(() => window.__send_surface_trace)
      metrics.push({ stage: 'returned', snapshot: returned, animations: trace.animations, phases: trace.phases })
      check(returned.source_connected && returned.send_same && returned.front_id === initial.front_id && !returned.original_source_inert, 'Real Back reconnects the same interactive source node, button and selected Discover person')
      check(returned.stack.length === initial.stack.length && returned.stack[0].id === initial.stack[0].id, 'Direct contraction pops exactly one real page and preserves the original stack identity')
      check(returned.source_portal_children === 0 && returned.target_portal_children === 0 && (await phase(page)) === 'idle', 'Back clears temporary portals, masks and association')
      check(!returned.issue && !trace.phases.some(row => row.issue), 'Successful reverse waits for actual source activation without return-not-arrived or fallback issues')
      check(!trace.css.some(entry => /page-leave|auth-content-rise/.test(entry.name) && entry.route.includes('/icebreaker/select')), 'The direct Say Hi reveal and contraction do not stack generic cRise or return animation')
      check(await page.locator(visible('.discover-deck')).getAttribute('data-skeleton') === null, 'Warm Discover Back does not replay a skeleton')
      await screenshot(page, item.name + '-returned')
      // A separate, unpaused pass verifies normal runtime durations and repeatability.
      const normal_start = await page.evaluate(() => window.__send_surface_trace.animations.length)
      await page.locator(visible(selectors.send)).tap(); await wait_route(page, '/pages/discover/icebreaker/select'); await idle(page)
      await button(page, 'ibSelect.goBack.click.1').tap(); await wait_route(page, '/pages/discover/index'); await idle(page)
      const normal = await page.evaluate(index => window.__send_surface_trace.animations.slice(index), normal_start)
      check(normal.length === 2 && normal.every(row => !row.diagnostic_paused && row.finish && !row.cancel), 'A fresh, unpaused forward/reverse pair finishes without cancellation')
      check(normal[0].timing.duration === 240 && normal[1].timing.duration === 180, 'Unpaused WAAPI traces preserve the actual 240ms forward / 180ms reverse contract')
      const normal_navigation = await page.evaluate(() => window.__send_surface_trace.nav)
      check(!(await snapshot(page)).issue && !(await page.evaluate(() => window.__send_surface_trace.phases)).some(row => row.issue), 'Unpaused return also confirms actual arrival before releasing the source underlay')
      const normal_pop = normal_navigation.filter(row => row.method === 'navigateBack').at(-1)
      if (normal_pop) check(normal_pop.at - normal[1].start < 325, 'The real pop dispatch follows the 180ms contraction, not a stacked extra 180ms generic exit')
      metrics.push({ stage: 'unpaused-runtime', animations: normal })
    }
    const after = await page.evaluate(key => localStorage.getItem(key), key), trace = await page.evaluate(() => window.__send_surface_trace)
    check(after === before && trace.writes.length === 0, 'All reveal, return, selection and navigation operations perform zero persistence writes')
    check(trace.microphone_requests === 0 && trace.loading_seen.length === 0, 'The read-only transition requests no microphone and adds no Saving or Loading Toast')
    return { ...item, passed: true, checks, metrics, navigation_trace: trace.nav, storage_writes: trace.writes.length }
  } catch (error) {
    report.failed_case = item
    report.visible_failure = await page.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-4000), trace: window.__send_surface_trace })).catch(() => null)
    await screenshot(page, item.name + '-failure').catch(() => {})
    throw error
  } finally { await context.close() }
}

async function run_interruptions() {
  const item = { name: 'interruptions-393x852', width: 393, height: 852 }, { context, page } = await prepare(item), checks = [], metrics = []
  const check = (condition, message) => { assert.ok(condition, `${item.name}: ${message}`); checks.push(message) }
  try {
    const before = await page.evaluate(key => localStorage.getItem(key), key)
    for (const cancellation of ['background', 'resize']) {
      const count = await page.evaluate(() => window.__surface_animations.length)
      await freeze_next(page, 70); await page.locator(visible(selectors.send)).tap(); await frozen(page, count + 1)
      if (cancellation === 'background') await background(page)
      else await page.setViewportSize({ width: 392, height: 852 })
      await idle(page); await page.waitForTimeout(80)
      const state = await snapshot(page)
      check(state.source_portal_children === 0 && state.target_portal_children === 0 && state.target_clip === 'none' && await phase(page) === 'idle', `${cancellation} restores normal target ownership with no clipping or portal mask`)
      const animation_count = await page.evaluate(() => window.__send_surface_trace.animations.length)
      await button(page, 'ibSelect.goBack.click.1').tap(); await wait_route(page, '/pages/discover/index'); await page.waitForTimeout(300)
      check((await page.evaluate(() => window.__send_surface_trace.animations.length)) === animation_count, `${cancellation} clears the invalid reverse association instead of flying to a stale origin`)
      if (cancellation === 'resize') { await page.setViewportSize({ width: 393, height: 852 }); await page.waitForTimeout(90) }
      metrics.push({ cancellation, state })
    }
    await page.locator(visible(selectors.send)).tap(); await wait_route(page, '/pages/discover/icebreaker/select'); await idle(page)
    const invalid_origin_count = await page.evaluate(() => {
      const button = window.__original_send_button
      window.__source_measurement = button.getBoundingClientRect
      button.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 })
      return window.__send_surface_trace.animations.length
    })
    await button(page, 'ibSelect.goBack.click.1').tap(); await wait_route(page, '/pages/discover/index'); await page.waitForTimeout(230)
    await page.evaluate(() => { window.__original_send_button.getBoundingClientRect = window.__source_measurement })
    check((await page.evaluate(() => window.__send_surface_trace.animations.length)) === invalid_origin_count && await phase(page) === 'idle', 'An unmeasurable original Send anchor falls back to a real Back without a stale-point collapse')
    await page.evaluate(() => {
      const remove = window.__surface_router.beforeEach(to => {
        if (!to.path.includes('/discover/icebreaker/select')) return
        remove()
        return false
      })
    })
    await page.locator(visible(selectors.send)).tap(); await page.waitForTimeout(180)
    check(page.url().endsWith('/pages/discover/index') && await phase(page) === 'idle', 'A rejected real Vue Router guard restores the source and clears the reveal association')
    const after_failure = await snapshot(page)
    check(after_failure.source_connected && after_failure.source_portal_children === 0 && after_failure.target_portal_children === 0, 'Navigation failure leaves the original source usable without a mask')
    const open_count = await page.evaluate(() => window.__send_surface_trace.animations.length)
    await freeze_next(page, 60)
    await page.locator(visible(selectors.send)).tap(); await frozen(page, open_count + 1)
    await page.evaluate(() => { for (let index = 0; index < 6; index++) window.__original_send_button.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await resume(page); await wait_route(page, '/pages/discover/icebreaker/select')
    check((await page.evaluate(() => window.__send_surface_trace.animations.length)) === open_count + 1, 'Repeated source clicks during reveal create only one route and animation')
    const back_count = await page.evaluate(() => window.__surface_animations.length)
    await freeze_next(page, 55); await button(page, 'ibSelect.goBack.click.1').tap(); await frozen(page, back_count + 1)
    await page.evaluate(() => { const back = document.querySelector('[data-interaction="ibSelect.goBack.click.1"]'); for (let index = 0; index < 6; index++) back?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await background(page); await idle(page); await page.waitForTimeout(260)
    check(page.url().includes('/pages/discover/icebreaker/select'), 'Cancelling a paused Back never dispatches a late pop after its old 180ms deadline')
    check((await snapshot(page)).target_clip === 'none', 'Cancelled Back restores the complete target instead of retaining partial clipping')
    await button(page, 'ibSelect.goBack.click.1').tap(); await wait_route(page, '/pages/discover/index'); await page.waitForTimeout(240)
    check((await snapshot(page)).send_same, 'A fresh Back after cancellation works and returns to the original button')
    const trace = await page.evaluate(() => window.__send_surface_trace)
    check(await page.evaluate(key => localStorage.getItem(key), key) === before && trace.writes.length === 0, 'Interruption, failure and rapid-tap diagnostics leave business storage untouched')
    metrics.push({ stage: 'interruption-trace', animations: trace.animations, phases: trace.phases, routes: trace.routes, navigation: trace.nav })
    return { ...item, passed: true, checks, metrics }
  } catch (error) { report.failed_case = item; report.visible_failure = await page.evaluate(() => ({ route: location.hash, trace: window.__send_surface_trace, runtime: { app_nodes: [...document.querySelectorAll('[data-v-app],uni-app,#app')].map(node => ({ tag: node.tagName, app: !!node.__vue_app__, keys: Object.keys(node.__vue_app__?.config.globalProperties || {}), router: !!node.__vue_app__?.config.globalProperties.$router })), first_page_vue: Object.keys(document.querySelector('uni-page') || {}).filter(key => /vue/i.test(key)), global_uni: typeof window.uni } })).catch(() => null); await screenshot(page, item.name + '-failure').catch(() => {}); throw error }
  finally { await context.close() }
}

async function run_preview() {
  assert.equal(engine_name, 'chrome', 'The dependency-free preview uses installed Chrome screencast frames')
  const item = { name: 'preview-393x852', width: 393, height: 852 }, { context, page, cdp } = await prepare(item)
  const frames = []
  let recording = false
  const receive = event => {
    frames.push({ data: event.data, timestamp: event.metadata.timestamp })
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
  }
  cdp.on('Page.screencastFrame', receive)
  try {
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: item.width, maxHeight: item.height, everyNthFrame: 1 })
    recording = true
    await page.waitForTimeout(600)
    await page.locator(visible(selectors.send)).tap(); await wait_route(page, '/pages/discover/icebreaker/select'); await idle(page)
    await page.waitForTimeout(900)
    await button(page, 'ibSelect.goBack.click.1').tap(); await wait_route(page, '/pages/discover/index'); await idle(page)
    await page.waitForTimeout(750)
    await cdp.send('Page.stopScreencast'); recording = false
    assert.ok(frames.length >= 8, 'The preview contains captured transition frames, not just endpoint stills')
    // Chrome's own MediaRecorder encodes only the captured browser frames in a
    // separate blank page. No dependency download or app DOM modification.
    const encoder = await context.newPage()
    const encoded = await encoder.evaluate(async ({ frames, width, height }) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
      document.body.append(canvas)
      const context = canvas.getContext('2d'), images = await Promise.all(frames.map(frame => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = 'data:image/jpeg;base64,' + frame.data })))
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(value => MediaRecorder.isTypeSupported(value))
      if (!mime) throw Error('No built-in WebM encoder is available.')
      const stream = canvas.captureStream(30), recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1500000 }), chunks = []
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      const complete = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject })
      context.drawImage(images[0], 0, 0, width, height); recorder.start(100)
      const beginning = performance.now(), first = frames[0].timestamp
      for (let index = 1; index < frames.length; index++) {
        const delay = (frames[index].timestamp - first) * 1000 - (performance.now() - beginning)
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delay, 1500)))
        context.drawImage(images[index], 0, 0, width, height)
      }
      await new Promise(resolve => setTimeout(resolve, 450))
      recorder.stop(); await complete; stream.getTracks().forEach(track => track.stop())
      const blob = new Blob(chunks, { type: mime })
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob) })
      return { data, mime, bytes: blob.size, captured_seconds: frames.at(-1).timestamp - first, frame_count: frames.length }
    }, { frames, width: item.width, height: item.height })
    const filename = 'send-say-hi-roundtrip-393x852.webm'
    fs.writeFileSync(path.join(output, filename), Buffer.from(encoded.data, 'base64'))
    const trace = await page.evaluate(() => window.__send_surface_trace)
    assert.equal(trace.animations.length, 2)
    assert.ok(trace.animations.every(row => !row.diagnostic_paused && row.finish))
    assert.equal(trace.writes.length, 0)
    report.preview = { file: filename, mime: encoded.mime, bytes: encoded.bytes, captured_seconds: encoded.captured_seconds, captured_frames: encoded.frame_count, animations: trace.animations, method: 'Chrome CDP JPEG frames re-encoded by isolated browser canvas MediaRecorder; no paused animation and no app code change', limitation: 'Visual preview only; browser screencast delivery and re-encoding are not evidence of native frame rate or exact animation duration.' }
    await encoder.close()
  } finally {
    if (recording) await cdp.send('Page.stopScreencast').catch(() => {})
    cdp.off('Page.screencastFrame', receive)
    await context.close()
  }
}

try {
  assert.ok(['chrome', 'webkit'].includes(engine_name), 'Only the installed Chrome or bundled WebKit engines are supported')
  browser = engine_name === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true })
  const selected = process.argv.find(value => value.startsWith('--case='))?.slice(7)
  const cases = [
    { name: 'small-320x568', width: 320, height: 568 },
    { name: 'reference-393x852', width: 393, height: 852 },
    { name: 'large-430x932', width: 430, height: 932 },
    { name: 'reduced-393x852', width: 393, height: 852, reduced: true },
    { name: 'waiting-393x852', width: 393, height: 852, kind: 'waiting' },
    { name: 'chat-393x852', width: 393, height: 852, kind: 'chat' },
  ].filter(item => !selected || item.name === selected)
  assert.ok(cases.length || selected === 'interruptions-393x852', 'The requested browser case exists')
  if (preview_only) await run_preview()
  else {
    for (const item of cases) report.results.push(await run_case(item))
    if (!selected || selected === 'interruptions-393x852') report.results.push(await run_interruptions())
  }
  assert.deepEqual(report.errors, [])
  report.expected_diagnostic_warnings = report.warnings.filter(warning => warning.message.includes('[uni统计 2.0]') && warning.message.includes('Failed to fetch'))
  report.unexpected_warnings = report.warnings.filter(warning => !report.expected_diagnostic_warnings.includes(warning))
  assert.deepEqual(report.unexpected_warnings, [])
  report.passed = true
  console.log(`PASS Send surface: ${report.results.length} isolated cases, ${report.results.reduce((total, result) => total + result.checks.length, 0)} assertions; no server, microphone or business submission`)
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, preview_only ? 'preview-report.json' : engine_name === 'chrome' ? 'browser-report.json' : `${engine_name}-report.json`), JSON.stringify(report, null, 2) + '\n') }
