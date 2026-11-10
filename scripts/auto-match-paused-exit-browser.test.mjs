import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'

const root = path.resolve('dist/build/h5')
const output = path.resolve('artifacts/auto-match-paused-exit-2026-10-26')
const origin = 'http://127.0.0.1:47907', key = 'cimoa_app_state_v2', now = Date.now()
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false, viewport: { width: 393, height: 852 }, has_touch: true, boundary: 'Production H5 in isolated Chrome touch contexts, served entirely by request fulfillment. Browser results do not replace WKWebView acceptance.' }
const check = label => { report.checks.push(label); console.log('PASS ' + label) }
fs.mkdirSync(output, { recursive: true })

// Use real production Store actions to reproduce the state that caused the failure:
// a selected candidate is retained while paused preference changes clear its expiry.
const store = use_app_store(createPinia())
let instant = now
configure_store_runtime(store, { clock: () => instant, persistence: { read: () => create_seed(now), write: () => {} } })
assert.equal(store.hydrate().success, true)
const started = store.start_match('paused-exit-browser-admission')
assert.equal(started.success, true, started.message)
const id = started.data
instant += 3210
store.tick()
assert.equal(store.transition_match(id, 'paused').success, true)
assert.equal(store.update_match_preferences({ interest_ids: [], university: 'HKUST' }).success, true)
const fixture = clone_data(store.data), paused = fixture.match_sessions.find(row => row.match_id === id)
fixture.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
assert.equal(paused.engine, 'device')
assert.equal(paused.status, 'paused')
assert.ok(paused.candidate_id)
assert.equal(paused.expires_at, null)
assert.equal(paused.search_remaining_ms, 5790)
report.fixture = { match_id: id, candidate_id: paused.candidate_id, search_remaining_ms: paused.search_remaining_ms, expires_at: paused.expires_at }

let browser
const contexts = []
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const open = async () => {
    const context = await browser.newContext({ viewport: report.viewport, isMobile: true, hasTouch: true })
    contexts.push(context)
    const page = await context.newPage()
    page.setDefaultTimeout(9000)
    page.on('pageerror', error => report.errors.push({ message: error.message, stack: error.stack, route: page.url() }))
    page.on('console', item => { if (item.type() === 'warning') report.warnings.push(item.text()) })
    await page.clock.setFixedTime(now + 120000)
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated paused matching acceptance</title>' })
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await page.addInitScript(storage_key => {
      window.__matchWrites = 0
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function (name, value) {
        if (this === window.localStorage && name === storage_key) window.__matchWrites++
        return set.call(this, name, value)
      }
    }, key)
    await page.goto(origin + '/fixture-shell')
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: fixture })
    await page.goto(`${origin}/index.html#/pages/auto-match/paused?match_id=${encodeURIComponent(id)}`)
    await page.locator('.auto-match-paused:visible').waitFor()
    await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
    return page
  }
  const control = (page, interaction) => page.locator(`[data-interaction="${interaction}"]:visible`).first()
  const read = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)).data, key)
  const writes = page => page.evaluate(() => window.__matchWrites)
  const same_finances = data => {
    assert.deepEqual(data.match_quota, fixture.match_quota)
    assert.deepEqual(data.coin_transactions, fixture.coin_transactions)
  }
  const visible_dialog = async page => {
    await page.getByRole('dialog', { name: 'Auto Match / Queue / Leaving', exact: true }).waitFor()
    await page.waitForFunction(() => {
      const panel = document.querySelector('.event-dialog--open .event-dialog-panel')
      return panel && getComputedStyle(panel).opacity === '1'
    })
  }
  const assert_home = async page => {
    await page.locator('.home-header:visible').waitFor()
    assert.equal(await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth'), '1')
    const data = await read(page), row = data.match_sessions.find(row => row.match_id === id)
    assert.equal(row.status, 'left')
    assert.equal(row.pool_closed_at, now + 120000)
    assert.equal(row.resolved_at, now + 120000)
    assert.equal(row.expires_at, null)
    same_finances(data)
    assert.equal(await page.locator('.brand-toast--error:visible').count(), 0)
    return data
  }

  const back = await open()
  const original = await read(back)
  assert.equal(await writes(back), 0)
  await control(back, 'amPaused.goBack.click.1').tap()
  await visible_dialog(back)
  await back.screenshot({ path: path.join(output, 'back-leave-confirmation.png') })
  assert.deepEqual(await read(back), original)
  await control(back, 'sheetLeaving.stayInPool.click.1').tap()
  await back.getByRole('dialog', { name: 'Auto Match / Queue / Leaving', exact: true }).waitFor({ state: 'hidden' })
  assert.deepEqual(await read(back), original)
  assert.equal(await writes(back), 0)
  check('Back opens the leave confirmation; Stay in Pool keeps the paused session and performs zero writes')
  await control(back, 'amPaused.goBack.click.1').tap()
  await visible_dialog(back)
  await control(back, 'sheetLeaving.confirmLeave.click.1').evaluate(node => { node.click(); node.click() })
  await assert_home(back)
  assert.equal(await writes(back), 1)
  await back.screenshot({ path: path.join(output, 'back-confirmed-home.png') })
  check('Double confirmation exits once, closes the pool, clears the stack to Home and never replays quota or coins')
  await back.reload()
  await assert_home(back)
  assert.equal(await writes(back), 0)
  check('Home refresh retains the left session without another write or revived match')

  const leave = await open()
  await leave.reload()
  await leave.locator('.auto-match-paused:visible').waitFor()
  assert.equal((await read(leave)).match_sessions.find(row => row.match_id === id).search_remaining_ms, 5790)
  await control(leave, 'amPaused.askLeave.click.1').tap()
  await visible_dialog(leave)
  await control(leave, 'sheetLeaving.confirmLeave.click.1').tap()
  await assert_home(leave)
  assert.equal(await writes(leave), 1)
  await leave.screenshot({ path: path.join(output, 'leave-pool-confirmed-home.png') })
  check('Direct Leave Pool after refresh uses the same successful confirmation and Home exit')

  const resume = await open()
  await control(resume, 'amPaused.resumeQueue.click.1').evaluate(node => { node.click(); node.click() })
  await resume.locator('.auto-match-searching:visible').waitFor()
  const resumed_data = await read(resume), resumed = resumed_data.match_sessions.find(row => row.match_id === id)
  assert.equal(resumed.status, 'searching')
  assert.equal(resumed.search_ready_at, now + 120000 + 5790)
  assert.equal(resumed.expires_at, resumed.search_ready_at + 45000)
  same_finances(resumed_data)
  assert.equal(await writes(resume), 1)
  await resume.reload()
  await resume.locator('.auto-match-searching:visible').waitFor()
  assert.equal((await read(resume)).match_sessions.find(row => row.match_id === id).search_ready_at, resumed.search_ready_at)
  assert.equal(await writes(resume), 0)
  await resume.screenshot({ path: path.join(output, 'resumed-searching.png') })
  check('Double Resume preserves the same session and 5790ms remaining time; refreshed searching retains its restored expiry without charging')
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }
  throw error
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
