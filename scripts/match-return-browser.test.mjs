import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { auto_match_scenario } from './lib/auto-match-scenario.mjs'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { match_return_regression } from './lib/match-return-regression.mjs'

const now = Date.now(), output = path.resolve('artifacts/match-return'), root = path.resolve('dist/build/h5'), origin = 'http://127.0.0.1:47878', key = 'cimoa_app_state_v2'
let clock = now - 9001, disk = auto_match_scenario(clock)
disk.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: clock }
for (const message of disk.messages) message.read_by = [...new Set([...message.read_by, 'user_cimoa'])]
const fresh = clone_data(disk), setup = use_app_store(createPinia())
configure_store_runtime(setup, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => clock })
assert.equal(setup.hydrate().success, true)
assert.equal(setup.begin_auto_match_guide(setup.auth_context).success, true)
assert.equal(setup.finish_auto_match_guide('skipped', setup.auth_context).success, true)
const prepared = clone_data(setup.data)
Object.assign(fresh, prepared)
const admission = setup.start_match('match-return-admission'); assert.equal(admission.success, true)
clock = now; setup.tick()
const found = clone_data(setup.data), id = admission.data
assert.equal(setup.transition_match(id, 'passed').success, true)
const passed = clone_data(setup.data)
// Stable QA deadlines permit browser and native execution without ever changing production timers.
found.match_sessions[0].expires_at = now + 3600000
for (const data of [fresh, found, passed]) validate_data(data)
const fixtures = {}
for (const kind of ['found-home', 'found-back', 'found-confirm-home', 'stale-back', 'passed-home', 'passed-back', 'refresh-home', 'history-home', 'history-back', 'auto-home', 'retry', 'lost-home', 'lost-back']) {
  const data = clone_data(kind.startsWith('auto') ? fresh : kind.startsWith('found') || kind.startsWith('stale') || kind.startsWith('lost') ? found : passed)
  const route = kind.startsWith('auto') || kind.startsWith('history') ? '/pages/home/index' : `/pages/auto-match/${kind.startsWith('stale') || kind.startsWith('lost') ? 'searching' : kind.startsWith('found') ? 'found' : 'passed'}?match_id=${encodeURIComponent(id)}`
  fixtures[kind] = { data, route, options: { kind, match_id: kind.startsWith('auto') ? '' : id, repeat: true } }
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS isolated Match return fixtures prepared; no service started'); process.exit(0) }
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, cases: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false, diagnostic_instrumentation: 'Normal cases use untouched compiled assets. lost-home/lost-back call the real router.replace but deliberately leave its returned Promise unsettled after actual target arrival. These controlled diagnostic cases are not evidence of the exact user-device cause; the driver restores all wrappers.' }
const requested = process.argv.find(arg => arg.startsWith('--case='))?.slice(7).split(',')
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const [kind, fixture] of Object.entries(fixtures).filter(([name]) => !requested || requested.includes(name))) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
    let page
    try {
      page = await context.newPage()
      page.on('pageerror', error => report.errors.push({ kind, error: error.message }))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push({ kind, warning: event.text() }) })
      await page.route(`${origin}/**`, route => {
        const requested = new URL(route.request().url()).pathname
        if (requested === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated match return QA</title>' })
        const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.goto(`${origin}/fixture-shell`)
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: fixture.data })
      await page.goto(`${origin}/index.html#${fixture.route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('app')?.hydration_status === 'ready')
      if (kind.startsWith('refresh')) {
        await page.locator('.auto-match-passed').waitFor(); const before = await page.evaluate(key => localStorage.getItem(key), key)
        await page.reload(); await page.locator('.auto-match-passed').waitFor(); assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
      }
      await page.evaluate(() => window.CommonTemplateSafeAreaBridge?.update({ top: 62, bottom: 34 }))
      const result = await page.evaluate(async options => {
        try { return { value: await (0, eval)(options.driver)(options.fixture) } }
        catch (cause) { return { error: String(cause.stack || cause), diagnostic: cause.match_return_diagnostic } }
      }, { driver: `(${match_return_regression.toString()})`, fixture: fixture.options })
      await page.screenshot({ path: path.join(output, `${kind}-browser.png`) })
      report.cases.push({ kind, ...result })
      console.log(`${result.error ? 'FAIL' : 'PASS'} Match return ${kind}${result.value ? `: ${result.value.checks.length} assertions` : ': ' + result.error.split('\n')[0]}`)
    } catch (cause) { report.cases.push({ kind, error: String(cause.stack || cause) }); console.log(`FAIL Match return ${kind}: ${cause.message}`) }
    finally { await context.close() }
  }
  report.passed = report.cases.every(row => row.value?.passed) && report.errors.length === 0 && report.warnings.length === 0
  if (!report.passed) process.exitCode = 1
} finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, process.argv.includes('--baseline') ? 'baseline-browser-report.json' : 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
