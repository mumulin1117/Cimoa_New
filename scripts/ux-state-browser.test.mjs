import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { ux_state_regression } from './lib/ux-state-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/ux-state'), origin = 'http://127.0.0.1:47851'
const key = 'cimoa_app_state_v2', now = Date.now(), fixtures = {}
for (const status of ['searching', 'paused', 'no_match']) {
  let disk = create_seed(now)
  // Controlled service events keep the search open while the browser/WKWebView inspects it.
  const store = use_app_store(createPinia())
  configure_store_runtime(store, {
    persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } },
    clock: () => now,
    services: { matching_available: true, verify_match_event: async () => true },
  })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  const start = store.start_match(`ux-state-${status}`)
  assert.equal(start.success, true)
  const id = start.data
  if (status === 'paused') assert.equal(store.transition_match(id, 'paused').success, true)
  if (status === 'no_match') assert.equal((await store.apply_match_event({ event_id: 'ux-state-no-result', match_id: id, type: 'no_match' })).success, true)
  fixtures[status] = { data: clone_data(store.data), match_id: id, route: `/pages/auto-match/no-match?match_id=${encodeURIComponent(id)}&view=options`, source_route: store.matching_context(id).route }
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Three Store-created search options fixtures ready; no browser or preview server started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], scenarios: [], screenshots: [], errors: [], warnings: [], preview_server_started: false }
let browser, page
try {
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  for (const status of Object.keys(fixtures)) {
    const fixture = fixtures[status], context = await browser.newContext({ viewport: { width: 393, height: 852 } })
    try {
      page = await context.newPage(); page.setDefaultTimeout(10000)
      page.on('pageerror', error => report.errors.push(`${status}: ${error.message}`))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push(`${status}: ${event.text()}`) })
      await page.route(`${origin}/**`, async route => {
        const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.addInitScript(({ data, origin, key }) => { if (location.origin === origin && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ type: 'object', data })) }, { data: fixture.data, origin, key })
      const url = route => `${origin}/index.html?ux-state=${status}#${route}`
      const ready = async () => {
        await page.locator('.auto-match-no-match:visible').waitFor()
        await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
        await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
      }
      const bytes = () => page.evaluate(key => localStorage.getItem(key), key)
      const run = mode => page.evaluate(ux_state_regression, { status, mode, match_id: fixture.match_id })
      const scenario = { status, inspect: [] }
      // Exercise the real "See options" entry for searching, plus direct recovery routes for the other states.
      await page.goto(url(status === 'searching' ? fixture.source_route : fixture.route))
      if (status === 'searching') await page.locator('[data-interaction="amSearching.showNoMatch.click.1"]:visible').click()
      await ready()
      for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }]) {
        await page.setViewportSize(viewport); await ready()
        scenario.inspect.push(await run('inspect'))
        const name = `${status}-options-${viewport.width}x${viewport.height}.png`
        await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name)
      }
      await page.setViewportSize({ width: 393, height: 852 }); await ready()
      const before = await bytes()
      await page.reload(); await ready()
      assert.equal(await bytes(), before)
      scenario.refresh = await run('inspect')
      scenario.return = await run('return')
      const check = `${status}: truthful options survive reload; return/retry preserves the admission and never repeats quota or coin charges`
      report.checks.push(check); console.log('PASS ' + check)
      report.scenarios.push(scenario)
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true
} catch (error) {
  report.failure = String(error.stack || error)
  report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2000) })).catch(() => null)
  throw error
} finally {
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
