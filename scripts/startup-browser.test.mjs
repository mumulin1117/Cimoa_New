import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/startup-motion'), origin = 'http://127.0.0.1:47847'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false }
const check = message => { report.checks.push(message); console.log('PASS ' + message) }
let browser
try {
  fs.mkdirSync(output, { recursive: true })
  const now = Date.now(), valid = create_scenario('default', now)
  valid.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
  fs.writeFileSync(path.join(output, 'native-fixture.json'), JSON.stringify(valid))
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const open = async ({ data = null, native = false, viewport = { width: 393, height: 852 }, reduced = false } = {}) => {
    const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' })
    await context.addInitScript(({ data, native }) => {
      if (data !== null) localStorage.setItem('cimoa_app_state_v2', typeof data === 'string' ? data : JSON.stringify({ type: 'object', data }))
      window.__startupReady = []
      if (native) window.webkit = { messageHandlers: { CimoaHost: { postMessage(payload) {
        if (payload.method === 'finishLaunch') {
          const root = [...document.querySelectorAll('.page-transition')].find(node => node.getBoundingClientRect().height > 0 && !node.closest('.splash-page'))
          window.__startupReady.push({ route: location.hash, fonts: document.fonts.status, opacity: root ? getComputedStyle(root).opacity : null, error: !!document.querySelector('.splash-error'), at: performance.now() })
        }
        return Promise.resolve({ version: 1, request_id: payload.request_id, success: true, result: { ready: true } })
      } } } }
    }, { data, native })
    const page = await context.newPage(); page.setDefaultTimeout(8000)
    page.on('pageerror', error => report.errors.push(error.message))
    page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
    await page.route(`${origin}/**`, async route => {
      const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
      await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await page.goto(`${origin}/#/pages/auth/splash`)
    await page.locator('.splash-page').waitFor(); await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
    return { page, context }
  }
  const { page, context } = await open()
  await page.waitForTimeout(300)
  const geometry = () => page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, centerY: r.y + r.height / 2 } }
    const fill = document.querySelector('.splash-progress'), style = getComputedStyle(fill)
    return { track: rect('.splash-track'), fill: rect('.splash-progress'), content: rect('.splash-content'), matrix: style.transform, opacity: style.opacity, gradient: style.backgroundImage }
  })
  const first = await geometry(); await page.waitForTimeout(220); const second = await geometry()
  assert.notEqual(first.matrix, second.matrix); assert.ok(Math.abs(first.fill.width - second.fill.width) > 3)
  assert.ok(Math.abs(first.track.width - 150) < 1 && Math.abs(first.track.height - 4) < 1)
  assert.ok(Math.abs(first.content.centerY - (62 + (852 - 62 - 34) / 2)) < 1)
  assert.equal(first.opacity, '1'); assert.match(first.gradient, /gradient/)
  report.motion = { first, second }; await page.screenshot({ path: path.join(output, 'splash-animated-393x852.png') })
  await page.locator('.welcome-page').waitFor(); assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null)
  assert.deepEqual(await page.evaluate(() => window.__startupReady), [])
  await page.screenshot({ path: path.join(output, 'welcome-393x852.png') }); await context.close()
  check('No-host browser: visible colorful growing bar, original 150×4 track/safe-area layout, automatic Welcome, no storage write or host wait')
  for (const [name, data, target] of [['guest', null, '.welcome-page'], ['valid', valid, '.home-header'], ['corrupt', '{corrupt', '.splash-error']]) {
    const { page, context } = await open({ data, native: true })
    await page.locator(target).waitFor(); await page.waitForFunction(() => window.__startupReady.length > 0)
    const notices = await page.evaluate(() => window.__startupReady)
    assert.equal(notices.length, 1); assert.equal(notices[0].fonts, 'loaded')
    if (name === 'corrupt') {
      assert.ok(notices[0].error); assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), '{corrupt')
      assert.match(await page.locator('.splash-error').innerText(), /Retry/)
    } else { assert.doesNotMatch(notices[0].route, /splash/); assert.equal(notices[0].opacity, '1') }
    report[name] = notices[0]; await context.close()
  }
  check('Paint-ready protocol fires once after guest Welcome / valid Home cRise and fonts, or exposes real corrupt-storage Retry; no Splash-ready false positive')
  const double = await open({ data: valid, native: true })
  await double.page.locator('.splash-page').dblclick({ position: { x: 4, y: 4 } }); await double.page.locator('.home-header').waitFor()
  await double.page.waitForTimeout(1950)
  assert.match(double.page.url(), /pages\/home\/index$/)
  assert.equal(await double.page.locator('.main-tab-frame').getAttribute('data-page-depth'), '1')
  assert.equal(await double.page.evaluate(() => window.__startupReady.length), 1); await double.context.close()
  check('Full-screen double tap plus automatic timer still navigates and reveals the host only once')
  for (const viewport of [{ width: 320, height: 568 }, { width: 440, height: 956 }, { width: 852, height: 393 }]) {
    const { page, context } = await open({ viewport, reduced: true })
    const layout = await page.locator('.splash-track').boundingBox()
    assert.ok(layout.x >= 0 && layout.x + layout.width <= viewport.width && layout.y >= 62 && layout.y + layout.height <= viewport.height - 34)
    assert.equal(await page.locator('.splash-progress').evaluate(node => getComputedStyle(node).animationName), 'none')
    await context.close()
  }
  check('Small/large/landscape layouts fit real safe areas; reduced motion retains the brand bar without continuous animation')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
