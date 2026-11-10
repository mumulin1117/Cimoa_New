import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { event_cover_layout } from './lib/event-cover-layout.mjs'
import { event_report_navigation } from './lib/event-report-navigation.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5')
const output = path.resolve('artifacts/event-cover')
const origin = 'http://127.0.0.1:47839'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const report = { passed: false, checks: [], errors: [], previewServerStarted: false }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
fs.mkdirSync(output, { recursive: true })
let browser
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  page.setDefaultTimeout(7000)
  page.on('pageerror', error => report.errors.push(error.message))
  // Browser interception serves the built files without starting an HTTP process.
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname
    const file = path.resolve(root, `.${requested === '/' ? '/index.html' : requested}`)
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  const now = Date.UTC(2026, 9, 13, 1)
  await page.clock.setFixedTime(new Date(now))
  await page.goto(origin)
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', now))
  await page.goto(`${origin}/#/pages/events/index`)
  await page.reload()
  await page.locator('[data-interaction="events.openEvent.click.1"]').click()
  const detail = page.locator('.event-detail-page:visible')
  await detail.locator('.profile-photo[data-media-status="ready"]').first().waitFor()
  await detail.locator('.page-transition').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
  const before = await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  report.layouts = []
  for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 402, height: 874 }, { width: 440, height: 956 }, { width: 852, height: 393 }]) {
    await page.setViewportSize(viewport)
    for (const insets of [{ top: 0, bottom: 0 }, { top: 59, bottom: 34 }]) {
      await page.evaluate(insets => window.CommonTemplateSafeAreaBridge.update(insets), insets)
      await page.waitForFunction(() => Math.abs(document.querySelector('.event-detail-cover').getBoundingClientRect().width - innerWidth) < 1)
      const metrics = await page.evaluate(event_cover_layout)
      assert.equal(metrics.safeTop, insets.top)
      assert.equal(metrics.safeBottom, insets.bottom)
      report.layouts.push(metrics)
      check(`${viewport.width}x${viewport.height}, top=${insets.top}: full-bleed cover, one safe-area owner, usable controls and fixed footer`)
      if (viewport.width === 393 && insets.top) await page.screenshot({ path: path.join(output, 'browser-393x852.png') })
    }
  }
  await page.setViewportSize({ width: 393, height: 852 })
  await page.waitForFunction(() => Math.abs(document.querySelector('.event-detail-cover').getBoundingClientRect().width - innerWidth) < 1)
  const fixed = await detail.locator('.event-page-footer').boundingBox()
  await detail.locator('.secondary-page-scroll').evaluate(element => {
    const scroll = [...element.querySelectorAll('*')].find(node => node.scrollHeight > node.clientHeight + 10 && ['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    if (!scroll) throw Error('Missing content scroll container')
    scroll.scrollTop = scroll.scrollHeight
  })
  assert.deepEqual(await detail.locator('.event-page-footer').boundingBox(), fixed)
  report.reportNavigation = [await page.evaluate(event_report_navigation)]
  await detail.locator('[data-interaction="evDetail.goBack.click.1"]').click()
  await page.locator('.events-header:visible').waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), before)
  check('Scrolling keeps the footer fixed; More directly opens the correct report and Back works without business writes')
  await page.goto(`${origin}/#/pages/events/detail?event_id=event_mic`)
  await page.locator('.event-detail-page:visible .event-page-title').waitFor()
  report.reportNavigation.push(await page.evaluate(event_report_navigation))
  check('Another event uses its own report identity; double activation and keyboard each push once and return correctly')
  await page.goto(`${origin}/#/pages/events/detail?event_id=missing`)
  await page.reload()
  const failure = page.locator('.event-detail-page:visible')
  await failure.getByRole('alert').waitFor()
  const alert = await failure.getByRole('alert').boundingBox()
  const header = await failure.locator('.secondary-page-header').boundingBox()
  assert.ok(alert.y + parseFloat(await failure.getByRole('alert').evaluate(element => getComputedStyle(element).paddingTop)) >= header.y + header.height)
  await failure.locator('[data-interaction="evDetail.goBack.click.1"]').click()
  await page.locator('.events-header:visible').waitFor()
  check('Invalid event remains readable below controls and returns to Events')
  assert.deepEqual(report.errors, [])
  report.passed = true
} finally {
  await browser?.close()
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
