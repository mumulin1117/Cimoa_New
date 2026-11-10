import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { touch_policy_regression } from './lib/touch-policy-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/touch-policy-2026-10-24'), origin = 'http://127.0.0.1:47886'
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, cases: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false, microphone_or_payment_requested: false }
fs.mkdirSync(output, { recursive: true })
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const width of [320, 375, 393, 440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 852 }, isMobile: true, hasTouch: true })
    try {
      const page = await context.newPage(); page.setDefaultTimeout(8000)
      page.on('pageerror', cause => report.errors.push({ width, error: cause.message }))
      page.on('console', item => { if (item.type() === 'warning') report.warnings.push({ width, warning: item.text() }) })
      await page.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin !== origin) return route.abort()
        if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated touch acceptance</title>' })
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.goto(`${origin}/fixture-shell`)
      const now = Date.now(), data = create_seed(now)
      data.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
      await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), data)
      await page.goto(`${origin}/index.html#/pages/settings/privacy`)
      await page.locator('.settings-switch:visible').first().waitFor()
      await page.evaluate(small => window.CommonTemplateSafeAreaBridge?.update({ top: small ? 20 : 62, bottom: small ? 0 : 34 }), width === 320)
      await page.waitForFunction(() => parseFloat(document.documentElement.style.getPropertyValue('--app-touch-scale')) > 0)
      const result = await page.evaluate(touch_policy_regression)
      const targets = await page.locator('.settings-switch:visible,.flow-back:visible,.editor-back:visible').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label'), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })))
      for (const target of targets) assert.ok(target.width >= 43.98 && target.height >= 43.98, JSON.stringify(target))
      // Real browser touch events, not mouse hover or a synthetic business click.
      await page.evaluate(() => { const probe = document.createElement('div'); probe.id = 'physical-touch-probe'; probe.setAttribute('role', 'button'); probe.style.cssText = 'position:fixed;top:100px;left:30px;width:80px;height:80px;z-index:3000;background:var(--cimoa-surface-card)'; window.__touch_probe_count = 0; probe.addEventListener('click', () => window.__touch_probe_count++); document.body.append(probe) })
      const client = await context.newCDPSession(page)
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 60, y: 130 }] })
      await page.waitForFunction(() => document.getElementById('physical-touch-probe').dataset.touchState === 'held')
      assert.equal(await page.evaluate(() => window.__touch_probe_count), 0)
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      assert.equal(await page.evaluate(() => !!document.getElementById('physical-touch-probe').dataset.touchState), false)
      await page.touchscreen.tap(60, 130)
      assert.equal(await page.evaluate(() => window.__touch_probe_count), 1)
      await page.evaluate(() => document.getElementById('physical-touch-probe').remove())
      await page.screenshot({ path: path.join(output, `settings-${width}.png`) })
      if (width === 393) {
        await page.goto(`${origin}/index.html#/pages/discover/index`)
        const front = page.locator('.discover-photo-card--front:visible')
        await front.waitFor(); await page.waitForFunction(() => document.querySelector('.discover-photo-card--front')?.getAttribute('aria-disabled') === 'false')
        const before = await front.getAttribute('data-user-id'), bounds = await front.boundingBox()
        const x = bounds.x + bounds.width * 0.3, y = bounds.y + bounds.height * 0.45
        const drag = async cancel => {
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
          for (let step = 1; step <= 6; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + bounds.width * 0.42 * step / 6, y }] })
          await client.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] })
        }
        await drag(true)
        await page.waitForFunction(id => document.querySelector('.discover-photo-card--front')?.dataset.userId === id && !document.querySelector('.discover-photo-card--front')?.hasPointerCapture?.(2), before)
        assert.equal(await front.getAttribute('data-user-id'), before, 'Cancelled swipe changed the person')
        await page.waitForFunction(() => document.querySelector('.discover-photo-card--front')?.getAttribute('aria-disabled') === 'false')
        await drag(false)
        await page.waitForFunction(id => document.querySelector('.discover-photo-card--front')?.dataset.userId !== id, before)
        const after = await front.getAttribute('data-user-id')
        await page.waitForFunction(() => document.querySelector('.discover-photo-card--front')?.getAttribute('aria-disabled') === 'false')
        await front.tap()
        const back = page.locator('.expanded-round[aria-label="Back"]:visible')
        await back.waitFor(); const back_bounds = await back.boundingBox()
        assert.ok(back_bounds.width >= 43.98 && back_bounds.height >= 43.98)
        await back.tap(); await front.waitFor(); assert.equal(await front.getAttribute('data-user-id'), after, 'Return reset the active person')
        await page.locator('.tab[aria-label="Home"]:visible').tap()
        await page.locator('.home-header:visible').waitFor()
        await page.locator('.connection:visible').first().waitFor()
        // Large viewports may legitimately fit the entire seed list. Exercise
        // real scrolling in a short viewport, without manufacturing extra users.
        await page.setViewportSize({ width: 393, height: 568 })
        await page.waitForFunction(() => {
          const host = [...document.querySelectorAll('.main-tab-scroll')].find(node => node.getBoundingClientRect().height > 0)
          const scroller = host && [host, ...host.querySelectorAll('*')].find(node => /auto|scroll/.test(getComputedStyle(node).overflowY) && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 10)
          if (scroller) scroller.setAttribute('data-touch-scroll-acceptance', '')
          return !!scroller
        })
        const scroll = page.locator('[data-touch-scroll-acceptance]')
        const scroller = await scroll.boundingBox(), initial = await scroll.evaluate(node => node.scrollTop)
        const middle = scroller.x + scroller.width * 0.5, bottom = scroller.y + scroller.height * 0.8
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: middle, y: bottom }] })
        for (let step = 1; step <= 6; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: middle, y: bottom - scroller.height * 0.55 * step / 6 }] })
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await page.waitForFunction(previous => document.querySelector('[data-touch-scroll-acceptance]')?.scrollTop > previous + 10, initial)
        report.actual_page_touch_regression = { cancelled_swipe_retains_person: true, horizontal_swipe_advances_once: true, profile_tap_and_return_retains_person: true, native_vertical_scroll_unblocked: true }
      }
      report.cases.push({ width, ...result, important_targets: targets, native_browser_touch_hold_cancel_retap: true })
    } finally { await context.close() }
  }
  assert.equal(report.errors.length, 0)
  // External traffic is deliberately blocked in this isolated run. Preserve
  // the existing uni statistics SDK's failure warnings instead of faking its
  // server response or weakening checks for unrelated application warnings.
  report.expected_blocked_statistics_warnings = report.warnings.filter(item => item.warning.startsWith('[uni统计 2.0]')).length
  assert.equal(report.warnings.length, report.expected_blocked_statistics_warnings)
  report.passed = true
} finally {
  await browser?.close()
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log(`PASS ${report.cases.length} touch browser sizes, ${report.cases.reduce((sum, item) => sum + item.checks, 0)} DOM assertions; no preview server`)
