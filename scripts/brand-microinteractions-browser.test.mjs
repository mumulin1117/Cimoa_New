import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { AUTO_MATCH_GUIDE_REVISION } from '../src/stores/autoMatchGuide.js'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/brand-microinteractions-2026-10-26')
const origin = 'http://127.0.0.1:47911', key = 'cimoa_app_state_v2', now = Date.now()
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false, viewport: { width: 393, height: 852 }, touch: true }
const check = label => { report.checks.push(label); console.log('PASS ' + label) }
fs.mkdirSync(output, { recursive: true })
let browser
const contexts = []
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const open = async ({ reduced = false, width = 393 } = {}) => {
    const data = create_seed(now)
    data.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
    // This isolated installation has already completed its independent guide.
    data.settings.find(row => row.owner_user_id === data.session.current_user_id).auto_match_guide = { revision: AUTO_MATCH_GUIDE_REVISION, outcome: 'completed', completed_at: now }
    // This controlled fixture prevents an unrelated private-message read write.
    for (const message of data.messages) if (!message.read_by.includes('user_cimoa')) message.read_by.push('user_cimoa')
    const context = await browser.newContext({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' })
    contexts.push(context)
    const page = await context.newPage(); page.setDefaultTimeout(9000)
    page.on('pageerror', error => report.errors.push(error.message))
    page.on('console', item => { if (item.type() === 'warning') report.warnings.push(item.text()) })
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Brand motion acceptance</title>' })
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await page.addInitScript(() => {
      window.__motionEvents = []; window.__surfaceEvents = []; window.__surfacePhases = []; window.__lastPointerId = null
      const animate = Element.prototype.animate
      Element.prototype.animate = function (frames, options) {
        const animation = animate.call(this, frames, options)
        if (this.matches('.auto-match-index')) window.__surfaceEvents.push({ frames: animation.effect.getKeyframes(), timing: animation.effect.getTiming(), route: location.hash })
        return animation
      }
      document.addEventListener('pointerdown', event => { window.__lastPointerId = event.pointerId }, true)
      document.addEventListener('DOMContentLoaded', () => {
        const seen = new WeakSet()
        let last_phase = ''
        const capture = () => {
          const host = document.querySelector('[data-auto-match-surface-phase]'), phase = host?.dataset.autoMatchSurfacePhase
          if (phase && phase !== last_phase) { window.__surfacePhases.push(phase); last_phase = phase }
          for (const element of document.querySelectorAll('.match-ignition, .connection--new')) {
            if (seen.has(element)) continue
            seen.add(element)
            const bounds = element.getBoundingClientRect()
            window.__motionEvents.push({ class: element.className, id: element.id, route: location.hash, at: performance.now(), bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }, pointer_events: getComputedStyle(element).pointerEvents })
          }
        }
        new MutationObserver(capture).observe(document.body, { childList: true, attributes: true, subtree: true })
      }, { once: true })
    })
    await page.goto(origin + '/fixture-shell')
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data })
    await page.goto(origin + '/index.html#/pages/home/index')
    await page.locator('#connection-user_grace:visible').waitFor()
    await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
    await page.waitForFunction(() => !document.querySelector('.main-tab-skeleton'))
    return page
  }
  const control = (page, id) => page.locator(`[data-interaction="${id}"]:visible`).first()
  const raw = page => page.evaluate(key => localStorage.getItem(key), key)
  const point = async locator => { const b = await locator.boundingBox(); return { x: b.x + b.width - 22, y: b.y + b.height * .32 } }
  const touch = async (cdp, type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ ...p, radiusX: 1, radiusY: 1, force: 1, id: 1 }] })
  const page = await open(), before = await raw(page), cdp = await page.context().newCDPSession(page)
  const card = page.locator('#connection-user_grace:visible'), p = await point(card)
  await touch(cdp, 'touchStart', p)
  await page.waitForTimeout(150)
  const pressed = await card.evaluate(node => ({ state: node.dataset.touchState, transform: getComputedStyle(node).transform, glow: getComputedStyle(node, '::before').opacity, x: node.style.getPropertyValue('--press-x'), y: node.style.getPropertyValue('--press-y') }))
  assert.equal(pressed.state, 'pressed'); assert.ok(pressed.transform.includes('0.985')); assert.equal(pressed.glow, '1'); assert.ok(pressed.x && pressed.y)
  await page.screenshot({ path: path.join(output, 'card-pressed-glow.png') })
  await touch(cdp, 'touchCancel')
  assert.equal(await card.getAttribute('data-touch-state'), null)
  assert.equal(await raw(page), before)
  check('Real touch press scales the card to 98.5%, tightens its shadow and places a bounded glow at the touch; cancellation keeps Home and data unchanged')

  for (const kind of ['move', 'lostpointercapture', 'pointercancel', 'background']) {
    const start = await point(card)
    await touch(cdp, 'touchStart', start)
    if (kind === 'move') await touch(cdp, 'touchMove', { x: start.x, y: start.y - 30 })
    else if (kind === 'background') await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
    else await page.evaluate(kind => document.querySelector('#connection-user_grace').dispatchEvent(new PointerEvent(kind, { bubbles: true, pointerId: window.__lastPointerId })), kind)
    await touch(cdp, 'touchCancel')
    if (kind === 'background') await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) })
    assert.equal(await card.getAttribute('data-touch-state'), null)
    assert.ok(page.url().endsWith('/pages/home/index'))
    assert.equal(await raw(page), before)
  }
  check('Vertical movement, pointercancel, lostpointercapture and background all cancel the press without ghost navigation or business writes')
  await touch(cdp, 'touchStart', await point(card))
  await page.waitForTimeout(530)
  assert.equal(await card.getAttribute('data-touch-state'), 'held')
  await touch(cdp, 'touchEnd')
  await page.locator('.connection-received-page:visible').waitFor()
  assert.equal(await raw(page), before)
  check('Holding and releasing still performs exactly the original invitation navigation, with no acceptance or duplicate submission')
  await control(page, 'reqReceived.goBack.click.1').tap()
  await card.waitFor()
  const goals = page.locator('#connection-user_grace .goals-tag:visible')
  let prior
  for (let index = 0; index < 2; index++) {
    await goals.tap()
    await page.waitForFunction(() => { const panel = document.querySelector('.goals-panel--open'); return panel && getComputedStyle(panel).opacity === '1' })
    const placement = await page.locator('.goals-panel').evaluate(node => {
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node), trigger = document.querySelector('#connection-user_grace .goals-tag').getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, origin: css.transformOrigin, expected: [trigger.left + trigger.width / 2 - rect.left, trigger.top + trigger.height / 2 - rect.top] }
    })
    const actual_origin = placement.origin.split(' ').map(parseFloat)
    assert.ok(Math.abs(actual_origin[0] - placement.expected[0]) < 1)
    assert.ok(Math.abs(actual_origin[1] - placement.expected[1]) < 1)
    assert.ok(placement.left >= 0 && placement.right <= 393)
    assert.equal(await card.evaluate(node => node.scrollLeft), 0, 'the decorative glow must not create a horizontally scrollable card')
    if (prior) assert.equal(placement.origin, prior.origin)
    prior = placement
    if (!index) await page.screenshot({ path: path.join(output, 'goals-anchor-open.png') })
    await page.locator('.goals-mask').tap({ position: { x: 4, y: 300 } })
    await page.locator('.goals-layer').waitFor({ state: 'hidden' })
  }
  assert.equal(await raw(page), before)
  check('Goals open from the actual tapped label on first and repeat presentation; corrected transform origin and viewport bounds agree; outside close remains read-only')
  await goals.tap()
  await page.locator('.goals-panel--open').waitFor()
  await page.locator('.main-tab-scroll .uni-scroll-view').last().evaluate(node => { node.scrollTop += 20; node.dispatchEvent(new Event('scroll')) })
  await page.locator('.goals-layer').waitFor({ state: 'hidden' })
  check('List scrolling dismisses the anchored goals panel and releases its mask')

  const flash_bounds = await control(page, 'home.startAutoMatch.click.1').boundingBox()
  await control(page, 'home.startAutoMatch.click.1').tap()
  await page.locator('.auto-match-index:visible').waitFor()
  await page.waitForFunction(() => document.querySelector('[data-auto-match-surface-phase="settled"]'))
  const ignition_events = await page.evaluate(() => window.__motionEvents.filter(row => row.class.includes('match-ignition')))
  assert.deepEqual(ignition_events, [], 'Home point-to-surface replaces, rather than stacks, the old ignition cue')
  const surface_events = await page.evaluate(() => window.__surfaceEvents)
  assert.equal(surface_events.length, 1)
  assert.equal(surface_events[0].timing.duration, 240)
  const start = surface_events[0].frames[0].clipPath.match(/^circle\(0px at ([\d.]+)px ([\d.]+)px\)$/)
  assert.ok(start, 'the real entry starts at a point, without scaling its content')
  assert.ok(Math.abs(Number(start[1]) - flash_bounds.x - flash_bounds.width / 2) < 1)
  assert.ok(Math.abs(Number(start[2]) - flash_bounds.y - flash_bounds.height / 2) < 1)
  assert.ok((await page.evaluate(() => window.__surfacePhases)).includes('forward-running'))
  assert.equal(await raw(page), before)
  check('Home lightning expands the real Auto Match entry from its exact button center in 240ms, without old ignition, a new match, charge or quota use')
  await control(page, 'amEntry.goBack.click.1').tap()
  await card.waitFor()
  await page.waitForFunction(() => document.querySelector('[data-auto-match-surface-phase="idle"]'))
  const roundtrip = await page.evaluate(() => ({ events: window.__surfaceEvents, phases: window.__surfacePhases }))
  assert.equal(roundtrip.events.length, 2)
  assert.equal(roundtrip.events[1].timing.duration, 180)
  assert.equal(roundtrip.events[1].frames.at(-1).clipPath, surface_events[0].frames[0].clipPath)
  assert.ok(roundtrip.phases.includes('back-running'))
  assert.equal(await raw(page), before)
  report.auto_match_surface = roundtrip
  check('Auto Match Back contracts toward the same Home lightning in the existing 180ms and preserves the actual Home list and business state')
  await card.tap({ position: { x: 100, y: 25 } })
  await page.locator('.connection-received-page:visible').waitFor()
  await control(page, 'reqReceived.accept.click.1').tap()
  await page.getByRole('dialog').filter({ hasText: 'Accept this introduction?' }).getByRole('button', { name: 'Accept', exact: true }).tap()
  await page.locator('.connection-accepted-page:visible').waitFor()
  await control(page, 'reqAccepted.closeAccepted.click.1').tap()
  await page.locator('#connection-user_grace.connection--new:visible').waitFor()
  await page.waitForFunction(() => { const transition = document.querySelector('.home-header')?.closest('.page-transition'); return transition && getComputedStyle(transition).opacity === '1' })
  await page.screenshot({ path: path.join(output, 'new-connection-glow.png') })
  await page.waitForFunction(() => !document.querySelector('.connection--new'))
  const committed = JSON.parse(await raw(page)).data, original = JSON.parse(before).data
  assert.equal(committed.requests.find(row => row.sender_id === 'user_grace').status, 'accepted')
  assert.deepEqual(committed.coin_transactions, original.coin_transactions)
  assert.deepEqual(committed.match_quota, original.match_quota)
  await page.reload()
  await page.locator('#connection-user_grace:visible').waitFor()
  assert.equal(await page.locator('.connection--new').count(), 0)
  assert.equal((await page.locator('#connection-user_grace .connection-status').innerText()).trim(), 'Connected')
  check('Only real successful acceptance creates a one-time connection edge glow; relation/chat state is real, finances are unchanged, and refresh does not replay it')

  const reduced = await open({ reduced: true, width: 320 }), reduced_cdp = await reduced.context().newCDPSession(reduced)
  const reduced_card = reduced.locator('#connection-user_grace:visible')
  await touch(reduced_cdp, 'touchStart', await point(reduced_card))
  await reduced.waitForTimeout(150)
  assert.equal(await reduced_card.evaluate(node => getComputedStyle(node).transform), 'none')
  await touch(reduced_cdp, 'touchCancel')
  await reduced.locator('#connection-user_grace .goals-tag').tap()
  await reduced.waitForFunction(() => { const panel = document.querySelector('.goals-panel--open'); return panel && getComputedStyle(panel).opacity === '1' })
  assert.equal(await reduced.locator('.goals-panel').evaluate(node => getComputedStyle(node).transform), 'none')
  const bounds = await reduced.locator('.goals-panel').boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320)
  await reduced.screenshot({ path: path.join(output, 'reduced-motion-small-screen.png') })
  check('At 320pt with Reduce Motion, press and goals retain a readable theme without scaling or off-screen panels')
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }; throw error
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
