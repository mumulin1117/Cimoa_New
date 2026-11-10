import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { auto_match_scenario } from './lib/auto-match-scenario.mjs'
import { configure_store_runtime, use_app_store } from '../src/stores/store.js'
import { clone_data } from '../src/stores/seed.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'

// The browser owns isolated storage. No physical-device account is seeded or reset.
const origin = 'http://127.0.0.1:47879', root = path.resolve('dist/build/h5')
const output = path.resolve('artifacts/match-waiting-return'), key = 'cimoa_app_state_v2'
const now = Date.now()
let clock = now - 9001, disk = auto_match_scenario(clock)
disk.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: clock }
const store = use_app_store(createPinia())
configure_store_runtime(store, { clock: () => clock, persistence: { read: () => clone_data(disk), write: (_, value) => { disk = clone_data(value) } } })
assert.equal(store.hydrate().success, true)
assert.equal(store.begin_auto_match_guide(store.auth_context).success, true)
assert.equal(store.finish_auto_match_guide('skipped', store.auth_context).success, true)
const admission = store.start_match('waiting-return'); assert.equal(admission.success, true)
clock = now; store.tick()
const found = clone_data(store.data), match_id = admission.data
found.match_sessions.find(row => row.match_id === match_id).expires_at = now + 3600000
assert.equal(store.transition_match(match_id, 'waiting').success, true)
const waiting = clone_data(store.data)
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, cases: [], preview_server_started: false, actual_user_storage_accessed: false }
fs.mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const kind of ['direct-home', 'direct-back', 'flow-home', 'flow-back']) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
    const page = await context.newPage(), trace = [], errors = []
    page.setDefaultTimeout(8000)
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.route(`${origin}/**`, route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Waiting return regression</title>' })
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
        return file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()
          ? route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
          : route.fulfill({ status: 404, body: '' })
      })
      await page.goto(`${origin}/fixture`)
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: kind.startsWith('flow') ? found : waiting })
      await page.goto(`${origin}/index.html?build=waiting-return&launch=regression#/pages/auto-match/${kind.startsWith('flow') ? 'found' : 'waiting'}?match_id=${match_id}`)
      await page.waitForFunction(() => document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('app')?.hydration_status === 'ready')
      await page.evaluate(() => {
        window.__waitingReturnTrace = []
        const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router
        router.afterEach((to, from, failure) => window.__waitingReturnTrace.push({ to: to.fullPath, from: from.fullPath, failure: String(failure || '') }))
        window.CommonTemplateSafeAreaBridge?.update({ top: 62, bottom: 34 })
      })
      const tap = async id => {
        const node = page.locator(`[data-interaction="${id}"]`).last()
        await node.waitFor({ state: 'visible' })
        await page.waitForFunction(() => [...document.querySelectorAll('.send-surface-host')].every(n => [...n.attributes].filter(a => /-phase$/.test(a.name)).every(a => ['idle', 'settled', 'complete'].includes(a.value))))
        await node.evaluate(async element => {
          const root = element.closest('.page-transition') || element
          await Promise.allSettled(root.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished))
        })
        await node.tap()
      }
      if (kind.startsWith('flow')) {
        await tap('amFound.connectAsk.click.1')
        await tap('sheetAccepting.confirmConnect.click.1')
        await page.locator('.auto-match-waiting').waitFor({ state: 'visible' })
      }
      const before = await page.evaluate(key => localStorage.getItem(key), key)
      await tap(kind.endsWith('back') ? 'amWaiting.goBack.click.1' : 'amWaiting.returnHome.click.1')
      await page.waitForFunction(() => location.hash === '#/pages/home/index' && !!document.querySelector('.home-header'), null, { timeout: 4000 })
      // Home's normal one-second clock must not reactivate any unloaded match watcher.
      await page.waitForTimeout(1300)
      assert.equal(await page.evaluate(() => location.hash), '#/pages/home/index')
      assert.equal(await page.locator('.main-tab-frame').last().getAttribute('data-page-depth'), '1')
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
      await tap('home.amCardGo.click.1')
      await page.locator('.auto-match-waiting').waitFor({ state: 'visible', timeout: 4000 })
      await tap(kind.endsWith('back') ? 'amWaiting.goBack.click.1' : 'amWaiting.returnHome.click.1')
      await page.waitForFunction(() => location.hash === '#/pages/home/index', null, { timeout: 4000 })
      await page.waitForTimeout(1300)
      assert.equal(await page.evaluate(() => location.hash), '#/pages/home/index')
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
      assert.deepEqual(errors, [])
      trace.push(...await page.evaluate(() => window.__waitingReturnTrace))
      report.cases.push({ kind, passed: true, trace })
      console.log(`PASS waiting ${kind}: touch return, stable Home, unchanged request and repeated round trip`)
    } catch (error) {
      trace.push(...await page.evaluate(() => window.__waitingReturnTrace || []))
      const diagnostic = await page.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-1500), pages: [...document.querySelectorAll('uni-page')].map(n => n.dataset.page) }))
      report.cases.push({ kind, passed: false, error: error.message, errors, trace, diagnostic })
      console.log(`FAIL waiting ${kind}: ${error.message}`)
      await page.screenshot({ path: path.join(output, `${kind}.png`) })
    } finally { await context.close() }
  }
  report.passed = report.cases.every(row => row.passed)
  if (!report.passed) process.exitCode = 1
} finally {
  await browser.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
