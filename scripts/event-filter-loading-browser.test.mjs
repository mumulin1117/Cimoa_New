import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { event_filter_loading_regression } from './lib/event-filter-loading-regression.mjs'

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/event-filter-loading'), origin = 'http://127.0.0.1:47845'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false }
fs.mkdirSync(output, { recursive: true })
let browser, page
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
  page.setDefaultTimeout(8000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => { if (message.type() === 'warning') report.warnings.push(message.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.addInitScript(data => { if (!localStorage.getItem('cimoa_app_state_v2')) localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })) }, create_scenario('default', Date.now()))
  await page.goto(origin + '/#/pages/home/index'); await page.locator('.connection').first().waitFor()
  await page.getByRole('button', { name: 'Events', exact: true }).click(); await page.locator('.event-card').first().waitFor()
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
  report.shared = await page.evaluate(event_filter_loading_regression)
  const check = text => { report.checks.push(text); console.log('PASS ' + text) }
  const chip = text => page.getByRole('button', { name: text, exact: true })
  const active = () => page.locator('.events-chip--active').textContent()
  const settled = () => page.locator('.event-filter-loading').waitFor({ state: 'hidden' })
  const bytes = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  report.layouts = []
  for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }, { width: 440, height: 956 }]) {
    await page.setViewportSize(viewport)
    await page.locator('.main-tab-scroll .uni-scroll-view-scrollbar-hidden').first().evaluate(node => { node.scrollTop = node.scrollHeight })
    const target = (await active()) === 'Today' ? 'This week' : 'Today'
    await chip(target).click(); await page.locator('.event-filter-loading').waitFor({ state: 'visible' }); await page.waitForTimeout(190)
    const metrics = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect()
      const p = rect('.event-filter-surface'), h = rect('.events-header'), b = rect('.tabbar')
      return { width: innerWidth, top: p.top, bottom: p.bottom, left: p.left, right: p.right, header_bottom: h.bottom, tab_top: b.top, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    report.layouts.push(metrics)
    assert.ok(metrics.top >= metrics.header_bottom && metrics.bottom <= metrics.tab_top && metrics.left >= 0 && metrics.right <= metrics.width && !metrics.overflow, JSON.stringify(metrics))
    await page.screenshot({ path: path.join(output, `category-loading-${viewport.width}x${viewport.height}.png`) })
    await settled()
  }
  check('Normal, small-scrolled and large iPhone layouts keep the busy panel visible without covering fixed navigation')
  await page.setViewportSize({ width: 393, height: 852 })
  await chip((await active()) === 'Today' ? 'This week' : 'Today').click(); await page.locator('.event-filter-loading').waitFor({ state: 'visible' }); await page.waitForTimeout(190)
  const particle = () => page.locator('.event-filter-loading .refresh-orbit-flow .refresh-orbit-particle--cyan').evaluate(node => { const r = node.querySelector('circle[r="2.7"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  const first = await particle(); await page.waitForTimeout(60); const next = await particle()
  report.motion = { first, next, displacement: Math.hypot(next.x - first.x, next.y - first.y) }
  assert.ok(report.motion.displacement > 1, JSON.stringify(report.motion)); await settled()
  check('Independent browser render samples observe actual SVG particle movement after the entrance transition')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await chip((await active()) === 'Today' ? 'This week' : 'Today').click(); await page.locator('.event-filter-loading').waitFor({ state: 'visible' })
  assert.equal(await page.locator('.event-filter-loading animateMotion').count(), 0)
  assert.equal(await page.locator('.event-filter-loading').evaluate(node => getComputedStyle(node).transitionDuration), '0s')
  await settled(); await page.emulateMedia({ reducedMotion: 'no-preference' })
  check('Reduced-motion preference retains truthful static feedback without SVG or entrance animation')
  await chip((await active()) === 'Today' ? 'This week' : 'Today').click(); await page.locator('.event-filter-loading').waitFor({ state: 'visible' })
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
  assert.equal(await page.locator('.event-filter-loading animateMotion').count(), 0)
  await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) }); await settled()
  check('Background visibility pauses orbit animation and completion does not leave a stale spinner')
  const failed_before = await bytes(), previous = await active(), target = previous === 'Today' ? 'This week' : 'Today'
  await page.evaluate(() => { window.__category_set_item = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'cimoa_app_state_v2') throw Error('Couldn’t update events. Please try again.'); return window.__category_set_item.call(this, key, value) } })
  await chip(target).click(); await settled()
  assert.equal(await bytes(), failed_before); assert.equal(await active(), previous)
  await page.locator('.brand-toast').waitFor()
  await page.evaluate(() => { Storage.prototype.setItem = window.__category_set_item; delete window.__category_set_item })
  await chip(target).click(); await settled(); assert.equal(await active(), target)
  await page.reload(); await page.locator('.event-card').first().waitFor(); assert.equal(await active(), target)
  check('Failed persistence clears pending feedback and preserves old data; retry succeeds and restores after reload')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true
} catch (error) {
  report.failure = String(error.stack || error)
  report.diagnostic = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-800), geometry: Object.fromEntries(['.event-filter-anchor', '.event-filter-loading', '.event-filter-surface', '.brand-refresh', '.refresh-orbit svg'].map(selector => { const node = document.querySelector(selector); return [selector, node && { ...node.getBoundingClientRect().toJSON(), ns: node.namespaceURI, display: getComputedStyle(node).display, animations: [...node.querySelectorAll('animateMotion')].map(a => ({ ns: a.namespaceURI, start: a.getStartTime?.(), duration: a.getSimpleDuration?.() })) }] })) })).catch(() => null)
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => null)
  throw error
} finally {
  await browser?.close()
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
