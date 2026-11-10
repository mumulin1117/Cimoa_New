import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { event_cell_navigation_regression } from './lib/event-cell-navigation-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/event-cell-navigation'), origin = 'http://127.0.0.1:47861'
const key = 'cimoa_app_state_v2', now = Date.now()
const make = (scenario = 'default', transform = () => {}) => {
  let disk = create_scenario(scenario, now)
  for (const event of disk.events) if (['event_picnic', 'event_mic', 'event_yoga'].includes(event.event_id)) Object.assign(event, { starts_at: now, ends_at: now + 7200000 })
  transform(disk)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } } })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  return store
}
const available = make(), joined = make('event_joined'), full = make('default', data => { data.events.find(event => event.event_id === 'event_picnic').capacity = 3 })
const cover_error = make('default', data => { data.events.find(event => event.event_id === 'event_picnic').image_url = '/static/assets/events/event-cell-unavailable.jpg' })
assert.equal(joined.join_event('event_mic').success, true)
const fixture = (store, options) => ({ data: clone_data(store.data), route: '/pages/events/index', options })
const fixtures = {
  first_and_later_cells: fixture(available, { mode: 'navigation', event_ids: available.event_feed.slice(0, 2).map(event => event.event_id) }),
  joined_cells: fixture(joined, { mode: 'joined', event_ids: joined.event_feed.slice(0, 2).map(event => event.event_id) }),
  join_primary: fixture(available, { mode: 'join', event_id: 'event_picnic' }),
  full_primary: fixture(full, { mode: 'disabled', event_id: 'event_picnic' }),
  failed_cover: fixture(cover_error, { mode: 'cover-error', event_id: 'event_picnic' }),
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Five Store-validated event cell fixtures prepared; no browser or server started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], scenarios: [], screenshots: [], errors: [], warnings: [], preview_server_started: false }
let browser, page
try {
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  for (const [name, fixture] of Object.entries(fixtures)) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
    try {
      page = await context.newPage(); page.setDefaultTimeout(10000)
      page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push(`${name}: ${event.text()}`) })
      await page.clock.setFixedTime(new Date(now))
      await page.route(`${origin}/**`, async route => {
        const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.addInitScript(({ data, origin, key }) => { if (location.origin === origin && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ type: 'object', data })) }, { data: fixture.data, origin, key })
      await page.goto(`${origin}/index.html?event_cell=${name}#${fixture.route}`)
      await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
      await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
      const result = await page.evaluate(event_cell_navigation_regression, fixture.options)
      assert.equal(result.passed, true); report.scenarios.push({ name, ...result })
      const screenshot = `${name}-393x852.png`
      await page.screenshot({ path: path.join(output, screenshot) }); report.screenshots.push(screenshot)
      report.checks.push(`${name}: canonical detail targets, one-page stack, restored carousel and unchanged Join behavior`)
      console.log('PASS ' + report.checks.at(-1))
    } catch (error) {
      report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2200) })).catch(() => null)
      throw error
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} catch (error) {
  report.failure = String(error.stack || error)
  report.visible_failure ||= await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2200) })).catch(() => null)
  throw error
} finally {
  await browser?.close(); report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
