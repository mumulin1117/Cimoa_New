import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { discover_entrance_regression } from './lib/discover-entrance-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/discover-entrance'), origin = 'http://127.0.0.1:47873', key = 'cimoa_app_state_v2', now = Date.now()
let disk = create_scenario('default', now)
for (const message of disk.messages) message.read_by = [...new Set([...message.read_by, disk.session.current_user_id])]
const store = use_app_store(createPinia())
configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now })
assert.equal(store.hydrate().success, true); assert.equal(store.set_app_consent(true).success, true)
const data = clone_data(store.data), people = store.discover_people
validate_data(data)
const base = { front_id: people[0].user_id, next_id: people[1].user_id, first_photo: people[0].photo.media_url }
const fixtures = Object.fromEntries(['first', 'interrupt', 'reduced', 'slow', 'failure'].map(mode => [mode, { data, route: '/pages/discover/index', options: { ...base, mode } }]))
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Discover entrance fixtures ready; no browser started'); process.exit(0) }
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, results: [], screenshots: [], errors: [], warnings: [], preview_server_started: false, actual_microphone_requested: false, limitations: ['Slow and failed image responses are diagnostic network injections; tests do not replace production image decode, Store actions or business outcomes.', 'Browser viewport emulation does not replace final physical safe-area and gesture validation in WKWebView.'] }
let browser, page
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const cases = [{ mode: 'first', width: 320, height: 568 }, { mode: 'first', width: 393, height: 852 }, { mode: 'first', width: 440, height: 956 }, ...['interrupt', 'reduced', 'slow', 'failure'].map(mode => ({ mode, width: 393, height: 852 }))]
  for (const item of cases) {
    const selected = fixtures[item.mode], context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: true, hasTouch: true, reducedMotion: item.mode === 'reduced' ? 'reduce' : 'no-preference' })
    let photo_requests = 0
    try {
      page = await context.newPage(); page.setDefaultTimeout(12000)
      page.on('pageerror', error => report.errors.push(error.message))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
      await page.route(`${origin}/**`, async route => {
        const requested = new URL(route.request().url()).pathname
        if (requested === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated Discover setup</title>' })
        const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        if (requested === new URL(base.first_photo, origin).pathname) {
          photo_requests++
          if (item.mode === 'slow' && photo_requests === 1) await new Promise(resolve => setTimeout(resolve, 1800))
          if (item.mode === 'failure' && photo_requests === 1) return route.fulfill({ status: 404, body: '' })
        }
        return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.goto(`${origin}/fixture-shell`)
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: selected.data })
      await page.addInitScript(() => {
        const trace = window.__discover_entrance_trace = { decodes: [], skeleton_starts: [], skeleton_ends: [], phases: [], running: 0, sweeps: 0 }
        const decode = HTMLImageElement.prototype.decode
        HTMLImageElement.prototype.decode = function (...args) {
          const item = { url: this.src, started: performance.now() }; trace.decodes.push(item)
          return decode.apply(this, args).then(value => { item.ended = performance.now(); return value }, error => { item.failed = performance.now(); throw error })
        }
        const states = new WeakMap()
        const collect = () => {
          for (const deck of document.querySelectorAll('.discover-deck')) {
            const previous = states.get(deck) || {}, skeleton = deck.dataset.skeleton === 'discover', phase = deck.dataset.entrancePhase
            if (skeleton && !previous.skeleton) trace.skeleton_starts.push(performance.now())
            if (!skeleton && previous.skeleton) trace.skeleton_ends.push(performance.now())
            if (phase && phase !== previous.phase) { trace.phases.push({ phase, at: performance.now() }); if (phase === 'running') trace.running++ }
            states.set(deck, { skeleton, phase })
          }
        }
        new MutationObserver(collect).observe(document, { childList: true, attributes: true, subtree: true })
        document.addEventListener('animationstart', event => { if (event.target?.closest?.('.discover-edge-sweep')) trace.sweeps++ }, true)
        document.addEventListener('DOMContentLoaded', () => {
          const safe = () => { if (window.CommonTemplateSafeAreaBridge) { window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); return } requestAnimationFrame(safe) }; safe()
        }, { once: true })
      })
      await page.goto(`${origin}/index.html#${selected.route}`, { waitUntil: 'domcontentloaded' })
      const pending = page.evaluate(discover_entrance_regression, { ...selected.options, require_trace: true }), observed = pending.then(value => ({ value }), error => ({ error }))
      await page.locator('.discover-deck[data-skeleton="discover"]').waitFor()
      const prefix = `${item.mode}-${item.width}x${item.height}`
      await page.screenshot({ path: path.join(output, `${prefix}-skeleton.png`) }); report.screenshots.push(`${prefix}-skeleton.png`)
      if (item.mode === 'first') {
        await page.locator('.discover-deck[data-entrance-phase="running"]').waitFor()
        await page.screenshot({ path: path.join(output, `${prefix}-entrance.png`) }); report.screenshots.push(`${prefix}-entrance.png`)
      }
      const result = await observed; if (result.error) throw result.error
      report.results.push({ ...item, photo_requests, ...result.value })
    } catch (error) {
      report.failed_case = item
      report.visible_failure = await page?.evaluate(() => ({ route: location.hash, deck: { ...document.querySelector('.discover-deck')?.dataset }, trace: window.__discover_entrance_trace, text: document.body.innerText.slice(-2800) })).catch(() => null)
      await page?.screenshot({ path: path.join(output, `${item.mode}-failure.png`) }).catch(() => {})
      throw error
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
  console.log(`PASS Discover entrance: ${report.results.length} isolated cases; exact deck geometry, parallel image decode, touch takeover, one-third browsing and warm-return restoration`)
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
