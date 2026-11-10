import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { EVENT_COVERS } from '../src/stores/eventCovers.js'
import { test_events } from './lib/events-browser.mjs'
import { event_data_regression } from './lib/event-data-regression.mjs'

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const output = path.resolve('artifacts/event-data'), root = path.resolve('dist/build/h5')
const origin = 'http://127.0.0.1:47844'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false }
fs.mkdirSync(output, { recursive: true })
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => { if (message.type() === 'warning' && /Vue warn/.test(message.text())) report.warnings.push(message.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname
    const file = path.resolve(root, `.${requested === '/' ? '/index.html' : requested}`)
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.addInitScript(data => {
    if (!localStorage.getItem('cimoa_app_state_v2')) localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data }))
  }, create_scenario('default', Date.UTC(2026, 9, 13, 1)))
  await page.goto(`${origin}/#/pages/home/index`)
  await page.locator('.home-header').waitFor()
  const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
  await test_events({ page, origin, evidence: output, check })
  const now = Date.UTC(2026, 9, 13, 1), data = create_scenario('event_joined', now)
  data.event_preferences[0].active_tab = 'My campus'
  for (const event of data.events) event.image_url = EVENT_COVERS[event.event_id].legacy_url
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), data)
  await page.goto(`${origin}/index.html?eventData=1#/pages/events/index`)
  await page.locator('.events-chip--active').waitFor()
  report.shared = await page.evaluate(event_data_regression, Object.values(EVENT_COVERS).map(row => row.image_url))
  await page.reload()
  await page.locator('.events-empty').waitFor()
  assert.equal(await page.locator('.events-chip--active').textContent(), 'My campus')
  assert.match(await page.locator('.events-empty').textContent(), /haven’t joined any upcoming/)
  check('Empty My campus and its selected filter remain truthful after refresh')
  await page.screenshot({ path: path.join(output, 'my-campus-empty.png') })
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true
} finally {
  await browser?.close()
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
