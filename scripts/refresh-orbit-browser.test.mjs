import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/refresh-orbit'), origin = 'http://127.0.0.1:47843'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false }
const record_video = process.env.CIMOA_RECORD_VIDEO === '1'
const check = text => { report.checks.push(text); console.log('PASS ' + text) }
let browser, page, context, video
try {
  fs.mkdirSync(output, { recursive: true })
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, ...(record_video ? { recordVideo: { dir: path.join(output, 'video'), size: { width: 393, height: 852 } } } : {}) })
  page = await context.newPage(); video = page.video(); page.setDefaultTimeout(8000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(origin)
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', Date.now()))
  await page.goto(`${origin}/#/pages/home/index`); await page.reload()
  await page.locator('.connection').first().waitFor()
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
  const bytes = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const before = await bytes(), names = await page.locator('.connection-name').allTextContents()
  const cdp = await page.context().newCDPSession(page)
  const area = () => page.locator('.main-tab-scroll').boundingBox()
  let touch_x = 180, touch_y = 0
  const start = async () => { const rect = await area(); touch_x = rect.x + rect.width * .45; touch_y = rect.y + 35; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch_x, y: touch_y, id: 1 }] }) }
  const move = async dy => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch_x, y: touch_y + dy, id: 1 }] }); await page.waitForTimeout(55) }
  const end = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const model = () => page.locator('.brand-refresh').evaluate(node => ({ state: node.dataset.refreshState, progress: Number(node.dataset.refreshProgress), label: node.textContent.trim(), height: node.closest('.uni-scroll-view-refresher').getBoundingClientRect().height, threshold: node.closest('.uni-scroll-view-refresher-container').getBoundingClientRect().height, animations: node.querySelectorAll('animateMotion').length }))
  const shot = name => page.screenshot({ path: path.join(output, name + '.png') })
  const closed = () => page.waitForFunction(() => document.querySelector('.uni-scroll-view-refresher')?.getBoundingClientRect().height === 0)
  await start(); await move(20); await move(55)
  report.pulling = await model(); assert.equal(report.pulling.state, 'pulling'); assert.ok(report.pulling.progress > 0 && report.pulling.progress < .8)
  assert.equal(await page.locator('.refresh-arc').count(), 0); await shot('01-pulling-393x852')
  await move(80); report.below_threshold = await model()
  assert.ok(report.below_threshold.height < report.below_threshold.threshold); assert.equal(report.below_threshold.state, 'pulling'); assert.match(report.below_threshold.label, /Pull to refresh/)
  await shot('02-below-threshold-393x852')
  await move(100); report.ready = await model()
  assert.ok(report.ready.height >= report.ready.threshold); assert.equal(report.ready.state, 'ready'); assert.equal(report.ready.progress, 1); assert.equal(report.ready.animations, 0)
  await shot('03-ready-393x852')
  await move(60); assert.equal((await model()).state, 'pulling'); await end(); await closed()
  assert.equal(await bytes(), before); check('Real staged touch progress agrees with the actual refresher threshold; pulling back cancels with no write')
  await start(); await move(20); await move(100)
  await page.evaluate(() => { window.__orbit_cancel_started = false; window.__orbit_cancel_observer = new MutationObserver(() => { if (document.querySelector('.brand-refresh--active')) window.__orbit_cancel_started = true }); window.__orbit_cancel_observer.observe(document.body, { subtree: true, attributes: true, childList: true }) })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await closed(); assert.equal((await model()).state, 'idle'); assert.equal(await bytes(), before)
  assert.equal(await page.evaluate(() => { window.__orbit_cancel_observer.disconnect(); return window.__orbit_cancel_started }), false)
  check('A genuine cancelled touch retracts the refresher area and leaves no ready state or business write')
  await start(); await move(20); await move(100); await end()
  await page.locator('.brand-refresh--active').waitFor(); report.refreshing = await model()
  assert.equal(report.refreshing.state, 'refreshing'); assert.equal(report.refreshing.animations, 2)
  assert.deepEqual(await page.locator('.connection-name').allTextContents(), names)
  const particle = () => page.locator('.refresh-orbit-flow .refresh-orbit-particle--cyan').evaluate(node => { const point = node.getCTM(); return { x: point.e, y: point.f } })
  const p1 = await particle(); await page.waitForTimeout(90); const p2 = await particle()
  assert.ok(Math.hypot(p2.x - p1.x, p2.y - p1.y) > 1); await shot('04-refreshing-393x852')
  await closed(); assert.equal(await bytes(), before)
  check('The two orbit particles actually move along SVG paths with short trails; list and exact business bytes remain unchanged')
  await start(); await move(20); await move(100); await end(); await page.locator('.brand-refresh--active').waitFor()
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
  assert.equal(await page.locator('.brand-refresh animateMotion').count(), 0)
  await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) })
  await closed(); assert.equal(await bytes(), before)
  check('Hidden-document motion is removed without an extra refresh or stale animation')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(); await move(20); await move(100)
  assert.equal((await model()).state, 'ready'); assert.equal(await page.locator('.refresh-orbit-rest').evaluate(node => getComputedStyle(node).animationName), 'none')
  await end(); await page.locator('.brand-refresh--active').waitFor(); assert.equal((await model()).animations, 0)
  await shot('05-reduced-motion-393x852'); await closed(); assert.equal(await bytes(), before)
  check('Reduced motion removes both the threshold pulse and SVG motion, retaining static particles and truthful state text')
  await page.emulateMedia({ reducedMotion: 'no-preference' }); report.layouts = []
  for (const viewport of [{ width: 320, height: 568 }, { width: 440, height: 956 }]) {
    await page.setViewportSize(viewport); await page.reload(); await page.locator('.connection').first().waitFor()
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
    await start(); await move(20); await move(110)
    const metrics = await page.locator('.refresh-composition').evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x, right: r.right, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth } })
    assert.ok(metrics.x >= 0 && metrics.right <= metrics.width); assert.equal(metrics.overflow, false); report.layouts.push(metrics)
    await shot(`06-ready-${viewport.width}x${viewport.height}`); await move(30); await end(); await closed()
  }
  assert.equal(await bytes(), before); check('Small and large iPhone layouts retain a compact composition, fixed navigation and no horizontal clipping')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} catch (error) { report.failure = String(error.stack || error); report.diagnostic = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-800), refresh: document.querySelector('.brand-refresh')?.outerHTML.slice(0, 2500), height: document.querySelector('.uni-scroll-view-refresher')?.getBoundingClientRect().height })).catch(() => null); throw error }
finally { await context?.close(); if (video) await video.saveAs(path.join(output, 'motion-preview.webm')); await browser?.close(); fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
