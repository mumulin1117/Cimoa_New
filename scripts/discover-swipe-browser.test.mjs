import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { serve_h5, set_safe_area, write_comparison } from './lib/pixel-acceptance.mjs'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/discover-request-deck/swipe-2026-10-20'), key = 'cimoa_app_state_v2'
const report = { result: 'failed', checks: [], errors: [], viewports: [] }, check = text => { report.checks.push(text); console.log('PASS ' + text) }
let server, browser, active_page
const front = page => page.locator('.discover-photo-card--front')
const current = page => front(page).getAttribute('data-user-id')
const settled = page => page.waitForFunction(() => { const e = document.querySelector('.discover-deck'); return e && e.dataset.settling === 'false' && e.dataset.resetting === 'false' })
async function drag(page, ratio, { hold = 0, finish = true, dy = 0 } = {}) {
  const b = await front(page).boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + b.width * ratio, y + dy, { steps: 12 })
  await page.waitForTimeout(hold || 32)
  report.gestures ??= []; report.gestures.push(await page.evaluate(() => ({ ...document.querySelector('.discover-deck')?.dataset })))
  if (finish) { await page.mouse.up(); await settled(page); await page.waitForTimeout(50) }
}
const pointer = (page, events, clickAfter = false) => page.evaluate(({ events, clickAfter }) => {
  const e = document.querySelector('.discover-photo-card--front'), r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2
  for (const event of events) e.dispatchEvent(new PointerEvent(event.type, { bubbles: true, cancelable: true, pointerId: event.id || 41, isPrimary: event.primary !== false, pointerType: event.pointerType || 'touch', button: event.button || 0, clientX: x + (event.ratio || 0) * r.width, clientY: y + (event.dy || 0) }))
  if (clickAfter) e.click()
}, { events, clickAfter })
try {
  fs.mkdirSync(folder, { recursive: true }); server = await serve_h5(); report.server_pid = server.pid
  console.log(`Temporary Discover swipe preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true }), page = await context.newPage(); page.setDefaultTimeout(10000)
  active_page = page
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(server.origin)
  const seed = create_scenario('default', Date.now())
  fs.writeFileSync(path.join(folder, 'native-fixture.json'), JSON.stringify({ type: 'object', data: seed }, null, 2) + '\n')
  const load = async (data = seed) => {
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data })
    await page.goto(`${server.origin}/?swipe=${Date.now()}#/pages/discover/index`); await front(page).waitFor(); await set_safe_area(page, 54, 0)
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.discover-photo-card img')].map(e => e.decode())); for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish() })
  }
  const bytes = () => page.evaluate(key => localStorage.getItem(key), key)
  await load(); const before = await bytes()
  assert.equal(await page.locator('.discover-photo-card').count(), 3); assert.equal(await current(page), 'user_zane')
  assert.deepEqual(await page.locator('.discover-photo-card').evaluateAll(es => es.map(e => e.dataset.deckDepth)), ['2', '1', '0'])
  await page.screenshot({ path: path.join(folder, 'actual-browser.png') })
  report.comparison = await write_comparison(browser, folder, 'docs/ui-restoration/discover-request-deck/actual-browser.png', path.join(folder, 'actual-browser.png'))
  report.comparison_note = 'Historical source actual versus user-approved staggered deck; the 14px reserved space and rear layers are intentional deltas, not a zero-diff acceptance.'
  check('Three Store-backed layers have stable IDs, opposite rear rotations and unchanged front content/controls')
  for (const ratio of [-.1, .24, -.32, 1 / 3, -.34]) {
    const id = await current(page); await drag(page, ratio)
    assert.equal((await current(page)) !== id, Math.abs(ratio) >= 1 / 3, `${ratio} release`)
  }
  assert.equal(await bytes(), before)
  check('Both directions use one-third width: short/24%/32% releases return, 1/3 and 34% advance exactly once without writes')
  await load()
  await page.evaluate(() => { window.swipeIncoming = document.querySelector('.discover-photo-card--back'); window.swipeIncomingPhoto = window.swipeIncoming.querySelector('img') })
  await drag(page, -.2, { finish: false, hold: 1200 })
  assert.equal(await page.locator('.discover-deck').getAttribute('data-dragging'), 'true', 'Store clock tick must not cancel the drag')
  const follow = await front(page).evaluate(e => { const m = new DOMMatrixReadOnly(getComputedStyle(e).transform); return { x: m.m41, width: e.clientWidth, duration: getComputedStyle(e).transitionDuration } })
  assert.ok(Math.abs(follow.x / follow.width + .2) < .015); assert.equal(follow.duration, '0s')
  await page.screenshot({ path: path.join(folder, 'dragging-browser.png') })
  const b = await front(page).boundingBox(); await page.mouse.move(0, b.y + b.height / 2, { steps: 8 }); await page.mouse.up(); await settled(page)
  assert.equal(await current(page), 'user_linden')
  assert.equal(await page.evaluate(() => document.querySelector('.discover-photo-card--front') === window.swipeIncoming && document.querySelector('.discover-photo-card--front img') === window.swipeIncomingPhoto), true)
  check('Long drag survives clock hydration ticks, follows without transition, captures outside card and reuses the incoming DOM/photo node')
  await load(); await pointer(page, [{ type: 'pointerdown' }, { type: 'pointermove', ratio: -.45 }, { type: 'pointercancel', ratio: -.45 }]); await settled(page)
  assert.equal(await current(page), 'user_zane')
  await pointer(page, [{ type: 'pointerdown' }, { type: 'pointermove', ratio: .01, dy: 70 }, { type: 'pointerup', ratio: .4, dy: 100 }]); await settled(page)
  assert.equal(await current(page), 'user_zane')
  await pointer(page, [{ type: 'pointerdown', primary: false }, { type: 'pointermove', ratio: .5, primary: false }, { type: 'pointerup', ratio: .5, primary: false }])
  await pointer(page, [{ type: 'pointerdown', button: 2 }, { type: 'pointermove', ratio: .5, button: 2 }, { type: 'pointerup', ratio: .5, button: 2 }])
  assert.equal(await current(page), 'user_zane')
  check('Cancellation, vertical gesture, secondary pointer and right mouse input do not skip or open a profile')
  await pointer(page, [{ type: 'pointerdown' }, { type: 'pointermove', ratio: -.1 }, { type: 'pointerup', ratio: -.34 }], true); await settled(page)
  assert.equal(await current(page), 'user_linden')
  assert.ok(page.url().includes('/pages/discover/index'))
  await page.waitForTimeout(350); await front(page).click(); await page.locator('.expanded-profile-page').waitFor(); assert.ok(page.url().includes('user_linden'))
  await page.locator('[data-interaction="expanded.collapse.click.1"]:visible').click(); await front(page).waitFor(); assert.equal(await current(page), 'user_linden')
  assert.equal(await bytes(), before)
  check('Release flushes the final coordinate, suppresses accidental click and keeps correct detail/Back ownership without mutation')
  await page.waitForTimeout(350)
  await page.evaluate(() => { window.swipeTouchTrace = []; for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, e => { if (e.pointerType === 'touch') window.swipeTouchTrace.push({ type: e.type, id: e.pointerId, primary: e.isPrimary, x: e.clientX, y: e.clientY, target: e.target.className }) }, true) })
  const cdp = await context.newCDPSession(page), touchBox = await front(page).boundingBox(), tx = touchBox.x + touchBox.width / 2, ty = touchBox.y + touchBox.height / 2, touchId = await current(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty, id: 7 }] })
  for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx - touchBox.width * .36 * step / 8, y: ty + 5, id: 7 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settled(page); await cdp.detach()
  report.touch_trace = await page.evaluate(() => window.swipeTouchTrace)
  assert.notEqual(await current(page), touchId); assert.ok(page.url().includes('/pages/discover/index'))
  check('Browser touchscreen input (not only dispatched DOM events) completes one skip without opening a profile')
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 393, height: 852 }, { width: 402, height: 874 }, { width: 430, height: 932 }, { width: 440, height: 956 }]) {
    await page.setViewportSize(viewport); await set_safe_area(page, 62, 34); await page.waitForTimeout(350)
    const metrics = await page.evaluate(() => {
      const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
      const active = document.querySelector('.discover-photo-card--front'), content = document.querySelector('.discover-content'), scroll = document.querySelector('.main-tab-scroll .uni-scroll-view')
      scroll.scrollTop = 999
      return { card: box(active), info: box(active.querySelector('.discover-info')), tags: [...active.querySelectorAll('.discover-tag')].map(box), layers: [...document.querySelectorAll('.discover-photo-card')].map(box), content: box(content), cta: box(document.querySelector('.discover-send')), bar: box(document.querySelector('.tabbar')), scroll: scroll.scrollTop, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    assert.ok(metrics.card.height > 0 && metrics.info.y >= metrics.card.y - 1 && metrics.info.bottom <= metrics.card.bottom + 1)
    for (const tag of metrics.tags) assert.ok(tag.x >= metrics.card.x && tag.right <= metrics.card.right && tag.bottom <= metrics.card.bottom)
    for (const layer of metrics.layers) assert.ok(layer.x >= metrics.content.x - 1 && layer.right <= metrics.content.right + 1 && layer.bottom <= metrics.content.bottom + 1)
    assert.ok(metrics.card.bottom < metrics.cta.y && metrics.cta.bottom <= metrics.bar.y); assert.equal(metrics.scroll, 0); assert.equal(metrics.overflow, false)
    report.viewports.push({ ...viewport, ...metrics }); await page.screenshot({ path: path.join(folder, `actual-${viewport.width}x${viewport.height}.png`) })
    const id = await current(page); await drag(page, -.34); assert.notEqual(await current(page), id)
  }
  check('Seven iPhone sizes keep full front information, rear corners, CTA, Tabbar and safe areas in one non-scrolling view')
  await page.setViewportSize({ width: 393, height: 852 }); await load()
  await pointer(page, [{ type: 'pointerdown' }, { type: 'pointermove', ratio: -.45 }]); await page.getByRole('button', { name: 'Home', exact: true }).click(); await page.locator('.home-header').waitFor()
  await page.getByRole('button', { name: 'Discover', exact: true }).click(); await front(page).waitFor(); await page.waitForTimeout(400)
  assert.equal(await page.locator('.discover-deck').getAttribute('data-settling'), 'false'); assert.equal(await page.locator('.discover-deck').getAttribute('data-dragging'), 'false'); assert.equal(await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth'), '1')
  assert.equal(await page.locator('.main-skeleton').count(), 0); assert.equal(await bytes(), before)
  check('Interrupted drag/Tab switch clears capture, RAF, timers and click lock without extra skeleton or business writes')
  await load()
  await pointer(page, [{ type: 'pointerdown' }, { type: 'pointermove', ratio: -.4 }, { type: 'pointerup', ratio: -.4 }, { type: 'pointerdown', id: 42 }, { type: 'pointermove', id: 42, ratio: -.5 }, { type: 'pointerup', id: 42, ratio: -.5 }]); await settled(page)
  assert.equal(await current(page), 'user_linden'); assert.equal(await page.locator('.discover-deck').getAttribute('data-card-index'), '1'); assert.equal(await bytes(), before)
  check('A second gesture during the exit animation is ignored; rapid repeats advance one entity only')
  const single = structuredClone(seed); for (const row of single.users) if (row.user_id !== 'user_zane') row.discoverable = false
  await load(single); const singleBefore = await bytes(); assert.equal(await page.locator('.discover-photo-card').count(), 1)
  await drag(page, -.5); assert.equal(await current(page), 'user_zane'); assert.equal(await bytes(), singleBefore); assert.ok(page.url().includes('/pages/discover/index'))
  const empty = structuredClone(single); empty.users.find(row => row.user_id === 'user_zane').discoverable = false
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: empty }); await page.goto(`${server.origin}/?empty=1#/pages/discover/index`); await page.locator('.discover-empty').waitFor(); assert.equal(await page.locator('.discover-photo-card').count(), 0)
  check('Singleton gestures spring back without accidental navigation; an empty filtered pool renders the existing empty state, not fake rear cards')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) { report.failure = String(error.stack || error); if (active_page) { report.failure_state = await active_page.evaluate(() => ({ url: location.href, deck: { ...document.querySelector('.discover-deck')?.dataset }, text: document.body.innerText.slice(0, 1600) })); await active_page.screenshot({ path: path.join(folder, 'failure-browser.png') }) } throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; if (report.result === 'passed') fs.rmSync(path.join(folder, 'failure-browser.png'), { force: true }); fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
