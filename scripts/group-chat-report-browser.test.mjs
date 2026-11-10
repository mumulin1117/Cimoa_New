import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { group_chat_report_regression } from './lib/group-chat-report-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/group-chat-report'), origin = 'http://127.0.0.1:47864'
const key = 'cimoa_app_state_v2', now = Date.now(), event_id = 'event_picnic', conversation_id = 'group_picnic'
const group_route = `/pages/events/group?event_id=${event_id}&conversation_id=${conversation_id}`
const report_route = `/pages/events/report?event_id=${event_id}&target_type=group&origin_conversation_id=${conversation_id}`
const fixture = ({ old_report = false, joined = true } = {}) => {
  let disk = create_scenario(joined ? 'event_joined' : 'default', now)
  const owner = disk.session.current_user_id
  for (const message of disk.messages.filter(row => row.conversation_id === conversation_id)) message.read_by = [...new Set([...message.read_by, owner])]
  validate_data(disk)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  if (old_report) store.data.reports.push({ report_id: 'report_legacy_event', owner_user_id: owner, target_type: 'event', target_id: event_id, context_id: null, reason: store.event_report_reasons[0], description: '', status: 'local_saved', created_at: now - 1 })
  validate_data(store.data)
  return clone_data(store.data)
}
const joined_data = fixture({ old_report: true })
const fixtures = {
  baseline: { data: fixture(), route: `/pages/events/report?event_id=${event_id}`, options: { mode: 'baseline', event_id, conversation_id } },
  group: { data: joined_data, route: group_route, options: { mode: 'flow', event_id, conversation_id } },
  invalid: { data: clone_data(joined_data), route: `/pages/events/report?event_id=${event_id}&target_type=group&origin_conversation_id=group_unrelated`, options: { mode: 'invalid', event_id, conversation_id: 'group_unrelated' } },
  unjoined: { data: fixture({ joined: false }), route: report_route, options: { mode: 'invalid', event_id, conversation_id } },
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Store-hydrated isolated group-report fixtures ready; no browser started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, results: [], screenshots: [], errors: [], warnings: [], preview_server_started: false }
let browser, page
const bind = async (context, fixture) => {
  const page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.addInitScript(({ data, origin, key }) => { if (location.origin === origin && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ type: 'object', data })) }, { data: fixture.data, origin, key })
  await page.goto(`${origin}/index.html#${fixture.route}`)
  await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  return page
}
const shot = async name => { await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name) }
const run = async options => { const result = await page.evaluate(group_chat_report_regression, options); report.results.push(result); return result }
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const baseline_styles = {}
  for (const [name, fixture] of Object.entries(fixtures)) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
    try {
      page = await bind(context, fixture)
      if (name === 'baseline') {
        for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }, { width: 440, height: 956 }]) {
          await page.setViewportSize(viewport)
          baseline_styles[viewport.width] = (await run(fixture.options)).style
          await shot(`event-report-baseline-${viewport.width}x${viewport.height}.png`)
        }
      } else if (name === 'group') {
        await run({ ...fixture.options, baseline_style: baseline_styles[393] })
        for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }, { width: 440, height: 956 }]) {
          await page.setViewportSize(viewport)
          await run({ ...fixture.options, mode: 'inspect', baseline_style: baseline_styles[viewport.width] })
          await shot(`group-report-before-submit-${viewport.width}x${viewport.height}.png`)
        }
        await page.setViewportSize({ width: 393, height: 852 })
        await run({ ...fixture.options, mode: 'submit' }); await shot('group-report-submitted.png')
        await page.reload(); await run({ ...fixture.options, mode: 'restored' })
      } else await run(fixture.options)
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true; console.log('PASS group report: direct entry, shared style at three sizes, Back, branded Loading, zero-write repeatable submit, refresh and denied access')
} catch (error) { report.failure = String(error.stack || error); report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2600) })).catch(() => null); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
