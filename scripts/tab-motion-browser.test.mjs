import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/tab-motion-2026-10-26')
const origin = 'http://127.0.0.1:47926', key = 'cimoa_app_state_v2'
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], traces: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false }
fs.mkdirSync(output, { recursive: true })
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
  const page = await context.newPage(); page.setDefaultTimeout(7000)
  page.on('pageerror', cause => report.errors.push(cause.message))
  page.on('console', entry => { if (entry.type() === 'warning') report.warnings.push(entry.text()) })
  await page.route('**/*', request => {
    const url = new URL(request.request().url())
    if (url.origin !== origin) return request.abort()
    if (url.pathname === '/fixture-shell') return request.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated Tab motion acceptance</title>' })
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return request.fulfill({ status: 404, body: '' })
    return request.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  const check = label => { report.checks.push(label); console.log('PASS ' + label) }
  const data = create_scenario('default', Date.now()); data.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: Date.now() }
  await page.goto(`${origin}/fixture-shell`)
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data })
  await page.goto(`${origin}/index.html#/pages/home/index`)
  await page.locator('.home-header').waitFor()
  await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  await page.locator('[data-skeleton]').waitFor({ state: 'hidden' })
  const before = await page.evaluate(key => localStorage.getItem(key), key)
  const begin_trace = () => page.evaluate(() => {
    const generation = window.__tab_trace_generation = (window.__tab_trace_generation || 0) + 1
    window.__tab_trace = []; window.__tab_trace_gaps = []; window.__tab_long_tasks = []; window.__tab_tracing = true
    window.__tab_performance_observer?.disconnect()
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      window.__tab_performance_observer = new PerformanceObserver(entries => {
        window.__tab_long_tasks.push(...entries.getEntries().map(entry => ({ at: entry.startTime, duration: entry.duration })))
      })
      window.__tab_performance_observer.observe({ entryTypes: ['longtask'] })
    }
    const sample = () => {
      if (!window.__tab_tracing || window.__tab_trace_generation !== generation) return
      const bar = [...document.querySelectorAll('.tabbar')].find(node => node.getBoundingClientRect().width > 0)
      const track = bar?.querySelector('.tab__light-track')
      if (track) {
        const bounds = track.getBoundingClientRect(), parent = bar.getBoundingClientRect()
        const position = (bounds.left - parent.left) / bounds.width
        window.__tab_trace.push({ at: performance.now(), route: location.hash, position, revision: track.dataset.motionRevision, selected: bar.querySelector('[aria-current="page"]')?.getAttribute('aria-label'), depth: bar.closest('.main-tab-frame')?.dataset.pageDepth, skeleton: !!document.querySelector('[data-skeleton]'), icons: [...bar.querySelectorAll('.tab__circle')].map(node => getComputedStyle(node).color) })
      } else window.__tab_trace_gaps.push({ at: performance.now(), route: location.hash })
      requestAnimationFrame(sample)
    }
    sample()
  })
  const end_trace = async (name, from, to) => {
    const diagnostics = await page.evaluate(() => {
      window.__tab_tracing = false; window.__tab_performance_observer?.disconnect()
      return { frames: window.__tab_trace, missing_bar: window.__tab_trace_gaps, long_tasks: window.__tab_long_tasks }
    })
    const trace = diagnostics.frames
    // Retain a failed group's evidence too: assertions must never hide the
    // exact route/timing frames needed to distinguish a regression from load.
    report.traces.push({ name, from, to, ...diagnostics })
    assert.ok(trace.length > 2, `${name}: sampled animation frames`)
    const between = trace.filter(row => row.position > Math.min(from, to) + 0.01 && row.position < Math.max(from, to) - 0.01)
    assert.ok(between.length >= 2, `${name}: light visibly traversed between slots`)
    assert.ok(new Set(between.map(row => row.position.toFixed(4))).size >= 2, `${name}: at least two distinct in-flight positions`)
    for (let i = 1; i < between.length; i++) assert.ok((between[i].position - between[i - 1].position) * Math.sign(to - from) >= -0.015, `${name}: replacement cannot restart the timeline`)
    assert.equal(new Set(between.map(row => row.revision)).size, 1, `${name}: one shared timeline revision`)
    assert.ok(trace.every(row => row.depth === '1'), `${name}: route stack remains one`)
    const expected = { home: 'Home', discover: 'Discover', events: 'Events' }
    for (const row of trace) {
      const route = row.route.match(/pages\/(home|discover|events)\/index/)?.[1]
      if (route) assert.equal(row.selected, expected[route], `${name}: selection semantics follow actual route`)
    }
    return trace
  }
  const wait_slot = index => page.waitForFunction(index => {
    const bar = [...document.querySelectorAll('.tabbar')].find(node => node.getBoundingClientRect().width > 0), track = bar?.querySelector('.tab__light-track')
    if (!track) return false
    const bounds = track.getBoundingClientRect()
    return Math.abs((bounds.left - bar.getBoundingClientRect().left) / bounds.width - index) < 0.001 && !bar.querySelector('[aria-disabled="true"]')
  }, index)
  for (const [name, from, to] of [['Discover', 0, 1], ['Events', 1, 2], ['Home', 2, 0]]) {
    await begin_trace()
    await page.getByRole('button', { name, exact: true }).tap()
    await wait_slot(to)
    await page.locator('[data-skeleton]').waitFor({ state: 'hidden' })
    const trace = await end_trace(`Touch ${name}`, from, to)
    if (name === 'Home') assert.ok(trace.every(row => !row.skeleton), 'warm Home does not consume a second skeleton')
    else assert.ok(trace.some(row => row.skeleton), `${name}: eligible first skeleton remains active independently`)
    check(`${name}: continuous shared light, actual-route selection, depth one, unchanged skeleton consumption`)
  }
  const revision = await page.locator('.tab__light-track').getAttribute('data-motion-revision')
  await page.getByRole('button', { name: 'Home', exact: true }).tap()
  assert.equal(await page.locator('.tab__light-track').getAttribute('data-motion-revision'), revision)
  check('Same-tab touch does not restart motion or navigate')
  await page.evaluate(() => {
    const discover = document.querySelector('.tabbar [aria-label="Discover"]'), events = document.querySelector('.tabbar [aria-label="Events"]')
    discover.click(); discover.click(); events.click()
  })
  await wait_slot(1)
  assert.match(page.url(), /pages\/discover\/index$/)
  assert.equal(await page.locator('.brand-toast--error').count(), 0)
  check('Rapid touch-compatible repeated clicks resolve once without a competing navigation or error Toast')
  await page.screenshot({ path: path.join(output, 'discover-light-settled.png') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await begin_trace()
  await page.getByRole('button', { name: 'Events', exact: true }).tap()
  await wait_slot(2)
  const reduced = await page.evaluate(() => { window.__tab_tracing = false; window.__tab_performance_observer?.disconnect(); return window.__tab_trace })
  assert.ok(reduced.every(row => Math.abs(row.position - Math.round(row.position)) < 0.001), 'reduced motion uses actual static slot, without travel')
  report.traces.push({ name: 'Reduced motion', frames: reduced })
  check('Reduced motion has no spatial light travel or icon pulse')
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
  check('Tab motion does not write business state, coins, relations, messages or Discover cursor')
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (cause) {
  report.failure = cause.stack || String(cause)
  throw cause
} finally {
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
