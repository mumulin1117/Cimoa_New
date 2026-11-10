import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { event_state_ux_regression } from './lib/event-state-ux-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/event-state-ux'), origin = 'http://127.0.0.1:47851'
const key = 'cimoa_app_state_v2', now = Date.now()
const make = (scenario = 'default', transform = () => {}) => {
  let disk = create_scenario(scenario, now)
  // Keep the source Today card order stable even when this fixture is generated after an event's source time.
  for (const event of disk.events) if (['event_picnic', 'event_mic', 'event_yoga'].includes(event.event_id) && !(scenario === 'event_past' && event.event_id === 'event_picnic')) Object.assign(event, { starts_at: now, ends_at: now + 7200000 })
  transform(disk)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } } })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  // Scenario messages are already read through the real Store so group navigation stays read-only.
  if (store.event_by_id('event_picnic').joined) assert.equal(store.mark_read('group_picnic').success, true)
  return store
}
const participants = make(), full = make('default', data => { data.events[0].capacity = 3 })
const ended = make('default', data => { Object.assign(data.events[0], { starts_at: now - 7200000, ends_at: now - 1 }) })
const joined_full = make('event_joined', data => { data.events[0].capacity = 4 })
const joined_ended = make('event_past', data => { data.events[0].capacity = 4 })
const fixture = (store, route, options) => ({ data: clone_data(store.data), route, options })
const fixtures = {
  participants: fixture(participants, '/pages/events/index', { mode: 'participants', event_id: 'event_mic', expected_user_ids: participants.event_people('event_mic').map(user => user.user_id) }),
  full_list: fixture(full, '/pages/events/index', { mode: 'blocked-list', event_id: 'event_picnic', label: 'Event full' }),
  full_detail: fixture(full, '/pages/events/detail?event_id=event_picnic', { mode: 'blocked-detail', event_id: 'event_picnic', label: 'Event full' }),
  ended_detail: fixture(ended, '/pages/events/detail?event_id=event_picnic', { mode: 'blocked-detail', event_id: 'event_picnic', label: 'Event ended' }),
  joined_full: fixture(joined_full, '/pages/events/detail?event_id=event_picnic', { mode: 'joined', event_id: 'event_picnic', conversation_id: 'group_picnic' }),
  joined_ended: fixture(joined_ended, '/pages/events/detail?event_id=event_picnic', { mode: 'joined', event_id: 'event_picnic', conversation_id: 'group_picnic' }),
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Six Store-validated event fixtures prepared; no browser or server started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], scenarios: [], screenshots: [], errors: [], warnings: [], preview_server_started: false }
let browser, page
try {
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  for (const [name, fixture] of Object.entries(fixtures)) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } })
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
      await page.goto(`${origin}/index.html?event_state=${name}#${fixture.route}`)
      await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
      await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
      const result = await page.evaluate(event_state_ux_regression, fixture.options)
      assert.equal(result.passed, true); report.scenarios.push({ name, ...result })
      const screenshot = `${name}-393x852.png`
      await page.screenshot({ path: path.join(output, screenshot) }); report.screenshots.push(screenshot)
      const message = `${name}: matching detail entry, preserved secondary actions, truthful booking state and zero unintended persistence writes`
      report.checks.push(message); console.log('PASS ' + message)
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true
} catch (error) { report.failure = String(error.stack || error); report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2000) })).catch(() => null); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
