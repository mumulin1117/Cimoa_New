import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { home_feed } from '../src/stores/homeFeed.js'
import { home_tail_match_regression } from './lib/home-tail-match-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/home-tail-match'), origin = 'http://127.0.0.1:47859'
const key = 'cimoa_app_state_v2', now = Date.now(), fixtures = {}
for (const kind of ['default', 'three_chats', 'home_single', 'home_long', 'home_empty', 'requests_only', 'match_searching', 'match_paused', 'match_found', 'match_waiting']) {
  const data = create_scenario(kind === 'requests_only' ? 'default' : kind, now)
  if (kind === 'requests_only') { data.relationships = []; data.match_sessions = [] }
  // These fixture deadlines keep controlled inspection stable across browser and native runs.
  for (const match of data.match_sessions) match.expires_at = now + 86400000
  const feed = home_feed(data, now)
  fixtures[kind] = { data, route: '/pages/home/index', options: { kind, expected_cards: feed.cards.map(card => card.user_id), expected_match_status: feed.match_card?.destination || null } }
}
fixtures.session_expired = { data: create_scenario('session_expired', now), route: '/pages/home/index', options: { kind: 'session_expired', mode: 'suppressed' } }
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Home tail match fixtures ready; no browser or preview server started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], scenarios: [], screenshots: [], errors: [], warnings: [], preview_server_started: false }
let browser, page
try {
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  const viewports = [{ width: 393, height: 852 }, { width: 320, height: 568 }, { width: 440, height: 956 }]
  const signatures = {}
  const context_for = async data => {
    const context = await browser.newContext({ viewport: viewports[0], isMobile: true, hasTouch: true })
    const current = await context.newPage(); current.setDefaultTimeout(10000)
    current.on('pageerror', error => report.errors.push(error.message))
    current.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
    await current.route(`${origin}/**`, async route => {
      const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
      await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await current.addInitScript(({ data, origin, key }) => {
      if (location.origin !== origin || localStorage.getItem(key)) return
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify({ type: 'object', data }))
    }, { data, origin, key })
    return { context, current }
  }
  const ready = async () => {
    await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  }
  // Empty-state signatures are the actual rendered reference for each viewport.
  for (const kind of ['home_empty', ...Object.keys(fixtures).filter(name => !['home_empty', 'session_expired'].includes(name))]) {
    const fixture = fixtures[kind], { context, current } = await context_for(fixture.data)
    page = current
    try {
      await page.goto(`${origin}/index.html?home-tail=${kind}#${fixture.route}`); await ready()
      const skeleton = await page.evaluate(home_tail_match_regression, { kind: 'skeleton', mode: 'suppressed' })
      const scenario = { kind, skeleton, layouts: [], navigation: [] }
      for (const viewport of viewports) {
        await page.setViewportSize(viewport); await ready()
        const options = { ...fixture.options, style_reference: kind === 'home_empty' ? undefined : signatures[viewport.width] }
        const inspect = await page.evaluate(home_tail_match_regression, options)
        if (kind === 'home_empty') signatures[viewport.width] = inspect.metrics.style
        scenario.layouts.push(inspect)
        const name = `${kind}-${viewport.width}x${viewport.height}-end.png`
        await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name)
      }
      await page.setViewportSize(viewports[0]); await ready()
      scenario.navigation.push(await page.evaluate(home_tail_match_regression, { ...fixture.options, mode: 'navigation', style_reference: signatures[393] }))
      if (kind === 'three_chats') scenario.navigation.push(await page.evaluate(home_tail_match_regression, { ...fixture.options, mode: 'navigation', activation: 'enter', style_reference: signatures[393] }))
      report.scenarios.push(scenario)
      const check = `${kind}: three viewports, real scroll-end visibility, source primary styling and read-only entry/Back navigation`
      report.checks.push(check); console.log('PASS ' + check)
    } finally { await context.close() }
  }
  for (const kind of ['error', 'session_expired']) {
    const fixture = kind === 'error' ? '{corrupt' : fixtures.session_expired.data
    const { context, current } = await context_for(fixture); page = current
    try {
      await page.goto(`${origin}/index.html?home-tail=${kind}#/pages/home/index`); await ready()
      const before = await page.evaluate(key => localStorage.getItem(key), key)
      report.scenarios.push(await page.evaluate(home_tail_match_regression, { kind, mode: 'suppressed' }))
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
      const name = `${kind}-393x852.png`; await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name)
      report.checks.push(`${kind}: CTA absent and no persistent rewrite`); console.log('PASS ' + report.checks.at(-1))
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} catch (error) {
  report.failure = String(error.stack || error)
  report.diagnostic = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2000), html: document.querySelector('.main-tab-scroll')?.outerHTML.slice(0, 3000) })).catch(() => null)
  throw error
} finally {
  await browser?.close(); report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
