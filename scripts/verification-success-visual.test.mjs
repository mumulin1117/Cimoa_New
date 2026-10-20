// One-shot Verification Success source, pixel and behavior acceptance.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { read_circa_source } from './lib/circa-source.mjs'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { clone_data } from '../src/stores/seed.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/ui-restoration/verification-success'), key = 'cimoa_app_state_v2'
const contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json'), 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((request, response) => { const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html')); if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return } response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(response) })
const report = { phase: 'verification-success-pixel-restoration', result: 'failed', server_pid: process.pid, reference: {}, geometry: {}, comparison: {}, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
const hash = value => crypto.createHash('sha256').update(value).digest('hex'), close = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

const store = use_app_store(createPinia())
configure_store_runtime(store, { persistence: { read: () => null, write: () => {} }, clock: () => Date.now() })
assert.equal(store.hydrate().success, true)
const registration = await store.register_local_account({ email: 'success.pixel@campus.edu', password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
assert.equal(registration.success, true)
const unverified = clone_data(store.data), account_id = registration.data.account_id
assert.equal(store.apply_verification('009789', account_id).success, true)
const verified = clone_data(store.data)

function verify_source_lock() {
  const source = read_circa_source(), lines = source.template.split('\n'), visual = lines.slice(2777, 2791).join('\n'), behavior = contract.source.behavior_lines.map(line => lines[line - 1]).join('\n')
  assert.equal(source.source_hash, contract.source.file_sha256); assert.equal(hash(visual), contract.source.visual_fragment_sha256); assert.equal(hash(behavior), contract.source.behavior_fragment_sha256)
  report.reference = { kind: 'source-derived locked reference with approved truthful-local-copy, entity-guard and safe-area deltas', source_file_sha256: source.source_hash, visual_fragment_sha256: hash(visual), behavior_fragment_sha256: hash(behavior), entry_animation: 'finished' }
}

function source_reference_markup() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);color:#0b1b3a}.screen{position:absolute;inset:0}.content{position:absolute;top:196px;left:20px;right:20px;display:flex;flex-direction:column;align-items:center;gap:16px}.icon{width:96px;height:96px;border-radius:48px;background:linear-gradient(95deg,#1ec8f5 0%,#4a7bf7 34%,#a855f7 64%,#f81ce5 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 14px 30px rgba(168,85,247,.28)}.heading{font-size:30px;font-weight:800;letter-spacing:-.035em;text-align:center}.pill{display:flex;align-items:center;gap:8px;height:42px;padding:0 16px;border-radius:21px;background:#e8f1fd}.pill span{font-size:16px;font-weight:700;color:#1e4b8f}.footer{position:absolute;left:20px;right:20px;bottom:34px;z-index:20}.primary{height:60px;border-radius:30px;background:linear-gradient(95deg,#1ec8f5 0%,#4a7bf7 34%,#a855f7 64%,#f81ce5 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(168,85,247,.24);font-size:19px;font-weight:700;color:#fff}
</style></head><body><div class="screen"><div class="content"><div class="icon"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg></div><div class="heading">Account code confirmed</div><div class="pill"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#1d9bf0"></circle><path d="m7.5 12.4 3 3 6-6.4" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><span>Account confirmation complete</span></div></div><div class="footer"><div class="primary">Continue Profile Setup</div></div></div></body></html>`
}

async function set_safe_area(page, top, bottom) {
  await page.evaluate(({ top, bottom }) => { document.documentElement.style.setProperty('--native-safe-area-top', `${top}px`); document.documentElement.style.setProperty('--native-safe-area-bottom', `${bottom}px`) }, { top, bottom })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}
async function freeze(page) {
  return page.evaluate(async () => {
    await document.fonts.ready; for (const animation of document.getAnimations()) animation.finish(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } }
    return { viewport: { width: innerWidth, height: innerHeight }, root: box('.verification-success-page'), content: box('.verification-success-content'), icon: box('.verification-success-icon'), check: box('.verification-success-icon svg'), heading: box('.verification-success-heading'), pill: box('.verification-success-pill'), badge: box('.verification-success-pill svg'), footer: box('.verification-success-footer'), primary: box('[data-interaction="verSuccess.goObBasic.click.1"]'), safe: [...document.querySelectorAll('.verification-success-page > .safe-area')].map(element => element.getBoundingClientRect().height), text: { heading: document.querySelector('.verification-success-heading').textContent, pill: document.querySelector('.verification-success-pill').textContent, primary: document.querySelector('[data-interaction="verSuccess.goObBasic.click.1"]').textContent }, interaction: document.querySelector('[data-interaction="verSuccess.goObBasic.click.1"]').dataset.interaction }
  })
}
async function write_comparison(browser, reference_path, actual_path) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), encoded = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
  const result = await page.evaluate(async ({ reference, actual }) => {
    const load = source => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source }), [a, b] = await Promise.all([load(reference), load(actual)])
    const canvas = document.createElement('canvas'); canvas.width = a.width; canvas.height = a.height; const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(a, 0, 0); const first = context.getImageData(0, 0, canvas.width, canvas.height); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(b, 0, 0); const second = context.getImageData(0, 0, canvas.width, canvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(a, 0, 0); context.globalAlpha = .5; context.drawImage(b, 0, 0); context.globalAlpha = 1; const overlay = canvas.toDataURL('image/png')
    const diff = context.createImageData(canvas.width, canvas.height); let exact = 0, above8 = 0, sum = 0, max = 0
    for (let index = 0; index < first.data.length; index += 4) { const channels = [0, 1, 2, 3].map(offset => Math.abs(first.data[index + offset] - second.data[index + offset])); const delta = Math.max(...channels); if (delta > 0) exact++; if (delta > 8) above8++; sum += channels.reduce((total, value) => total + value, 0); max = Math.max(max, delta); diff.data[index] = Math.min(255, channels[0] * 4); diff.data[index + 1] = Math.min(255, channels[1] * 4); diff.data[index + 2] = Math.min(255, channels[2] * 4); diff.data[index + 3] = 255 }
    context.putImageData(diff, 0, 0); return { overlay, diff: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, pixels_different: exact, pixels_above_channel_delta_8: above8, mean_absolute_channel_delta: sum / first.data.length, max_channel_delta: max }
  }, { reference: encoded(reference_path), actual: encoded(actual_path) })
  const decode = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64'); fs.writeFileSync(path.join(output, 'overlay.png'), decode(result.overlay)); fs.writeFileSync(path.join(output, 'diff.png'), decode(result.diff)); await page.close(); delete result.overlay; delete result.diff; return result
}
async function context_for(browser, data, viewport = { width: 393, height: 852 }) { const context = await browser.newContext({ viewport }); await context.addInitScript(({ key, data }) => { if (data) localStorage.setItem(key, JSON.stringify({ type: 'object', data })); else localStorage.removeItem(key) }, { key, data }); return context }
async function open_success(context, origin, suffix) { const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message)); await page.goto(`${origin}/?successPixel=${suffix}#/pages/auth/verification/success`); await page.locator('.verification-success-page').waitFor(); return page }
const saved = page => page.evaluate(key => localStorage.getItem(key), key)

let browser
try {
  verify_source_lock(); fs.mkdirSync(output, { recursive: true }); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) }); const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  const reference = await browser.newContext({ viewport: { width: 393, height: 852 } }), reference_page = await reference.newPage(); await reference_page.setContent(source_reference_markup()); await reference_page.screenshot({ path: path.join(output, 'reference.png') }); await reference.close()

  const visual = await context_for(browser, verified), page = await open_success(visual, origin, 'default'); await set_safe_area(page, 54, 0); report.geometry = await freeze(page)
  assert.deepEqual(report.geometry.viewport, { width: 393, height: 852 }); assert.deepEqual(report.geometry.safe, [54, 0]); assert.ok(close(report.geometry.icon.x, 148.5)); assert.ok(close(report.geometry.icon.y, 196)); assert.ok(close(report.geometry.icon.width, 96)); assert.ok(close(report.geometry.icon.height, 96)); assert.ok(close(report.geometry.check.width, 44)); assert.ok(close(report.geometry.check.height, 44)); assert.ok(close(report.geometry.heading.y, 308)); assert.ok(close(report.geometry.pill.height, 42)); assert.ok(close(report.geometry.badge.width, 18)); assert.ok(close(report.geometry.primary.x, 20)); assert.ok(close(report.geometry.primary.width, 353)); assert.ok(close(report.geometry.primary.height, 60)); assert.ok(close(report.geometry.primary.bottom, 818)); assert.deepEqual(report.geometry.text, { heading: 'Account code confirmed', pill: 'Account confirmation complete', primary: 'Continue Profile Setup' }); assert.equal(report.geometry.interaction, 'verSuccess.goObBasic.click.1')
  await page.screenshot({ path: path.join(output, 'actual-browser.png') }); check('393x852 verified state restores source geometry, approved truthful copy, exact SVG and interaction ID at the finished cRise frame')
  report.comparison = await write_comparison(browser, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png')); assert.equal(report.comparison.width, 393); assert.equal(report.comparison.height, 852); check('reference, actual, overlay and absolute diff were generated from one hash-locked state')
  const persisted = await saved(page); await page.reload(); await page.locator('.verification-success-icon').waitFor(); await freeze(page); assert.equal(await saved(page), persisted); check('refresh restores the exact verified account without another write or skeleton')
  await page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(page, 62, 34); await freeze(page); const footer = await page.locator('.verification-success-footer').boundingBox(); assert.ok(footer.y + footer.height <= 534); const scroller = page.locator('.secondary-page-scroll .uni-scroll-view').last(); await scroller.evaluate(element => { element.scrollTop = element.scrollHeight }); await freeze(page); assert.deepEqual(await page.locator('.verification-success-footer').boundingBox(), footer); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(output, 'actual-browser-small.png') }); check('320x568 and 62/34 safe areas keep the source CTA fixed and the only middle region scrollable')
  await visual.close()

  const commit_context = await context_for(browser, verified), commit_page = await open_success(commit_context, origin, 'atomic'), before = await saved(commit_page)
  await commit_page.evaluate(key => { window.__successWrites = 0; const original = Storage.prototype.setItem; Storage.prototype.setItem = function (name, value) { if (name === key) window.__successWrites++; return original.call(this, name, value) } }, key)
  await commit_page.locator('[data-interaction="verSuccess.goObBasic.click.1"]').dblclick(); await commit_page.locator('.loading').waitFor(); assert.equal(await saved(commit_page), before); await commit_page.locator('.onboarding-basic-page').waitFor(); const started = JSON.parse(await saved(commit_page)).data; assert.equal(started.session.account_id, account_id); assert.equal(started.accounts.find(row => row.account_id === account_id).onboarding.step, 'basic'); assert.equal(started.users.find(row => row.user_id === started.session.current_user_id).verification_status, 'pending'); assert.equal(await commit_page.evaluate(() => window.__successWrites), 1); check('double tap shows Loading before one atomic onboarding/session write and opens Basic without promoting student identity')
  const resumed_state = clone_data(started); await commit_context.close(); const resume = await context_for(browser, resumed_state), resume_page = await open_success(resume, origin, 'resume'), resume_before = await saved(resume_page); await resume_page.locator('[data-interaction="verSuccess.goObBasic.click.1"]').click(); await resume_page.locator('.onboarding-basic-page').waitFor(); assert.equal(await saved(resume_page), resume_before); assert.equal(await resume_page.locator('.loading').count(), 0); await resume.close(); check('authenticated incomplete onboarding resumes its persisted Basic instance with zero repeated write')

  const failure = await context_for(browser, verified), failure_page = await open_success(failure, origin, 'failure'), failure_before = await saved(failure_page); await failure_page.evaluate(key => { const original = Storage.prototype.setItem; window.__restoreSuccessStorage = () => { Storage.prototype.setItem = original }; Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Injected success storage failure', 'QuotaExceededError'); return original.call(this, name, value) } }, key); await failure_page.locator('[data-interaction="verSuccess.goObBasic.click.1"]').click(); await failure_page.locator('.loading').waitFor(); await failure_page.getByRole('alert').waitFor(); assert.equal(await saved(failure_page), failure_before); assert.equal(await failure_page.locator('.onboarding-basic-page').count(), 0); assert.match(await failure_page.getByRole('alert').innerText(), /failure|saved|storage/i); await failure_page.screenshot({ path: path.join(output, 'actual-browser-error.png') }); await failure_page.evaluate(() => window.__restoreSuccessStorage()); await failure.close(); check('injected persistence failure rolls back onboarding and keeps a retryable explicit error on Success')

  const cancelled = await context_for(browser, verified), cancelled_page = await open_success(cancelled, origin, 'cancelled'), cancelled_before = await saved(cancelled_page); await cancelled_page.locator('[data-interaction="verSuccess.goObBasic.click.1"]').click(); await cancelled_page.locator('.loading').waitFor(); await cancelled_page.goto(`${origin}/?successPixel=left#/pages/auth/login`); await cancelled_page.locator('.login-page').waitFor(); await cancelled_page.waitForTimeout(650); assert.equal(await saved(cancelled_page), cancelled_before); assert.equal(await cancelled_page.locator('.onboarding-basic-page').count(), 0); await cancelled.close(); check('leaving during Loading cancels the pending write and hidden-page navigation')

  const missing = await context_for(browser, unverified), missing_page = await open_success(missing, origin, 'unverified'), unverified_before = await saved(missing_page); assert.equal(await missing_page.locator('.verification-success-icon').count(), 0); assert.match(await missing_page.getByRole('alert').innerText(), /not been completed/); await missing_page.getByRole('button', { name: 'Enter Code' }).click(); await missing_page.locator('.verification-page').waitFor(); assert.equal(await saved(missing_page), unverified_before); await missing.close(); const guest = await context_for(browser, null), guest_page = await open_success(guest, origin, 'guest'); assert.equal(await guest_page.locator('.verification-success-icon').count(), 0); await guest_page.getByRole('button', { name: 'Log In' }).click(); await guest_page.locator('.login-page').waitFor(); assert.equal(await saved(guest_page), null); await guest.close(); check('unverified and guest direct entry show explicit recovery, write nothing and never invent a success entity')
  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.errors.push(error.stack || error.message); throw error } finally { await browser?.close().catch(() => {}); await new Promise(resolve => server.close(resolve)); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
