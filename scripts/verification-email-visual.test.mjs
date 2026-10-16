// One-shot Email Verification pixel evidence and behavior acceptance.
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
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/ui-restoration/verification-email')
const contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json'), 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase: 'verification-email-pixel-restoration', result: 'failed', server_pid: process.pid, reference: {}, geometry: {}, comparison: {}, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const close = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance
const key = 'cimoa_app_state_v2'

const store = use_app_store(createPinia())
configure_store_runtime(store, { persistence: { read: () => null, write: () => {} }, clock: () => Date.now() })
assert.equal(store.hydrate().success, true)
const registration = await store.register_local_account({ email: 'verify.pixel@campus.edu', password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
assert.equal(registration.success, true)
const pending = clone_data(store.data)
const account_id = registration.data.account_id

function verify_source_lock() {
  const source = read_circa_source()
  const lines = source.template.split('\n')
  const visual = lines.slice(2707, 2732).join('\n')
  const behavior = contract.source.behavior_lines.map(line => lines[line - 1]).join('\n')
  assert.equal(source.source_hash, contract.source.file_sha256)
  assert.equal(hash(visual), contract.source.visual_fragment_sha256)
  assert.equal(hash(behavior), contract.source.behavior_fragment_sha256)
  report.reference = { kind: 'source-derived locked reference with approved local-code, entity-guard, safe-area and keyboard deltas', source_file_sha256: source.source_hash, visual_fragment_sha256: hash(visual), behavior_fragment_sha256: hash(behavior), entry_animation: 'finished' }
}

function source_reference_markup() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);color:#0b1b3a}.screen{position:absolute;inset:0}.header{position:absolute;top:58px;left:20px;right:20px;height:48px;display:flex;align-items:center;z-index:20}.back{width:46px;height:46px;border-radius:23px;background:#fff;box-shadow:0 6px 18px rgba(16,36,74,.1);display:flex;align-items:center;justify-content:center}.title{position:absolute;left:58px;right:58px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.15}.scroll{position:absolute;top:122px;left:0;right:0;bottom:0;overflow:hidden;padding:0 20px 190px}.heading{font-size:33px;font-weight:800;letter-spacing:-.035em;line-height:1.1}.description{display:block;margin-top:10px;font-size:17px;color:#5b6b85;line-height:1.45}.field{margin-top:14px}.label{display:block;font-size:14.5px;font-weight:600;color:#5b6b85;margin-bottom:7px}.input{height:56px;padding:0 18px;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(16,36,74,.06);display:flex;align-items:center;color:#0b1b3a;font-size:17px}.info{margin-top:16px;padding:18px;border-radius:22px;background:rgba(255,255,255,.7);color:#44536b;font-size:15.5px;line-height:1.5}.example{display:block;margin-top:14px;font-size:14.5px;color:#8b95a6}.footer{position:absolute;left:20px;right:20px;bottom:34px;z-index:20}.primary{height:60px;border-radius:30px;background:linear-gradient(95deg,#1ec8f5 0%,#4a7bf7 34%,#a855f7 64%,#f81ce5 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(168,85,247,.24);font-size:19px;font-weight:700;color:#fff}
</style></head><body><div class="screen"><div class="header"><div class="back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0b1b3a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg></div><div class="title">Local verification</div></div><div class="scroll"><div class="heading">Confirm your email</div><span class="description">This local account uses the fixed code 009789. No email is sent. This does not verify your university or student identity.</span><div class="field"><span class="label">University email</span><div class="input">verify.pixel@campus.edu</div></div><div class="info">Your address identifies your account on this device. It stays private and is never shown on your profile.</div><span class="example">Example · a.chan@connect.hkust.edu</span></div><div class="footer"><div class="primary">Continue to Local Code</div></div></div></body></html>`
}

async function set_safe_area(page, top, bottom) {
  await page.evaluate(({ top, bottom }) => { document.documentElement.style.setProperty('--native-safe-area-top', `${top}px`); document.documentElement.style.setProperty('--native-safe-area-bottom', `${bottom}px`) }, { top, bottom })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function freeze(page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    for (const animation of document.getAnimations()) animation.finish()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } }
    const input = document.querySelector('.verification-email-page .auth-input')
    return {
      viewport: { width: innerWidth, height: innerHeight }, header: box('.auth-header'), back: box('.auth-back'), heading: box('.auth-heading'), description: box('.auth-description'), field: box('.auth-field'), input_box: box('.auth-input-box'), info: box('.email-info'), example: box('.email-example'), footer: box('.auth-footer'), primary: box('.auth-primary'),
      safe: [...document.querySelectorAll('.verification-email-page > .safe-area')].map(element => element.getBoundingClientRect().height),
      text: { header: document.querySelector('.auth-header-title').textContent, heading: document.querySelector('.auth-heading').textContent, description: document.querySelector('.auth-description').textContent, label: document.querySelector('.auth-label').textContent, input: input.querySelector('input')?.value || '', info: document.querySelector('.email-info').textContent, example: document.querySelector('.email-example').textContent, primary: document.querySelector('.auth-primary').textContent.trim() },
      back_interaction: document.querySelector('.auth-back').dataset.interaction, input_interaction: input.dataset.interaction,
    }
  })
}

async function write_comparison(browser, reference_path, actual_path) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  const encoded = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
  const result = await page.evaluate(async ({ reference, actual }) => {
    const load = source => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source })
    const [firstImage, secondImage] = await Promise.all([load(reference), load(actual)])
    const canvas = document.createElement('canvas'); canvas.width = firstImage.width; canvas.height = firstImage.height
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(firstImage, 0, 0); const first = context.getImageData(0, 0, canvas.width, canvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(secondImage, 0, 0); const second = context.getImageData(0, 0, canvas.width, canvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(firstImage, 0, 0); context.globalAlpha = .5; context.drawImage(secondImage, 0, 0); context.globalAlpha = 1
    const overlay = canvas.toDataURL('image/png'); const diff = context.createImageData(canvas.width, canvas.height); let exact = 0, above8 = 0, sum = 0, max = 0
    for (let index = 0; index < first.data.length; index += 4) { const channels = [0, 1, 2, 3].map(offset => Math.abs(first.data[index + offset] - second.data[index + offset])); const delta = Math.max(...channels); if (delta > 0) exact++; if (delta > 8) above8++; sum += channels.reduce((total, value) => total + value, 0); max = Math.max(max, delta); diff.data[index] = Math.min(255, channels[0] * 4); diff.data[index + 1] = Math.min(255, channels[1] * 4); diff.data[index + 2] = Math.min(255, channels[2] * 4); diff.data[index + 3] = 255 }
    context.putImageData(diff, 0, 0)
    return { overlay, diff: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, pixels_different: exact, pixels_above_channel_delta_8: above8, mean_absolute_channel_delta: sum / first.data.length, max_channel_delta: max }
  }, { reference: encoded(reference_path), actual: encoded(actual_path) })
  const decode = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64')
  fs.writeFileSync(path.join(output, 'overlay.png'), decode(result.overlay)); fs.writeFileSync(path.join(output, 'diff.png'), decode(result.diff)); await page.close(); delete result.overlay; delete result.diff
  return result
}

async function app_context(browser, data, viewport = { width: 393, height: 852 }, patch_storage = false) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(({ key, data, patch_storage }) => {
    localStorage.setItem(key, JSON.stringify({ type: 'object', data }))
    if (patch_storage) { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Injected email storage failure', 'QuotaExceededError'); return original.call(this, name, value) } }
  }, { key, data, patch_storage })
  return context
}

async function open_email(context, origin, suffix) {
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message)); await page.goto(`${origin}/?verificationEmail=${suffix}#/pages/auth/verification/email`); await page.locator('.verification-email-page').waitFor(); return page
}

let browser
try {
  verify_source_lock(); fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  const reference = await browser.newContext({ viewport: { width: 393, height: 852 } }); const reference_page = await reference.newPage(); await reference_page.setContent(source_reference_markup()); await reference_page.screenshot({ path: path.join(output, 'reference.png') }); await reference.close()

  const visual = await app_context(browser, pending); const page = await open_email(visual, origin, 'default'); await set_safe_area(page, 54, 0); report.geometry = await freeze(page)
  assert.deepEqual(report.geometry.viewport, { width: 393, height: 852 }); assert.deepEqual(report.geometry.safe, [54, 0]); assert.ok(close(report.geometry.header.y, 58)); assert.ok(close(report.geometry.back.width, 46)); assert.ok(close(report.geometry.heading.y, 122)); assert.ok(close(report.geometry.description.y, report.geometry.heading.bottom + 10)); assert.ok(close(report.geometry.field.y, report.geometry.description.bottom + 14)); assert.ok(close(report.geometry.input_box.height, 56)); assert.ok(close(report.geometry.info.y, report.geometry.input_box.bottom + 16)); assert.ok(close(report.geometry.example.y, report.geometry.info.bottom + 14)); assert.ok(close(report.geometry.primary.height, 60)); assert.ok(close(report.geometry.primary.bottom, 818, 2))
  assert.deepEqual(report.geometry.text, { header: 'Local verification', heading: 'Confirm your email', description: 'This local account uses the fixed code 009789. No email is sent. This does not verify your university or student identity.', label: 'University email', input: 'verify.pixel@campus.edu', info: 'Your address identifies your account on this device. It stays private and is never shown on your profile.', example: 'Example · a.chan@connect.hkust.edu', primary: 'Continue to Local Code' })
  assert.equal(report.geometry.back_interaction, 'verEmail.goBack.click.1'); assert.equal(report.geometry.input_interaction, 'verEmail.onEmail.change.1')
  await page.screenshot({ path: path.join(output, 'actual-browser.png') }); await visual.close(); check('393x852 pending account restores locked source geometry, exact approved copy and interaction IDs')
  report.comparison = await write_comparison(browser, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png')); assert.deepEqual([report.comparison.width, report.comparison.height], [393, 852]); check('reference, actual, overlay and absolute diff were generated from one hash-locked state')

  const behavior = await app_context(browser, pending); const behavior_page = await open_email(behavior, origin, 'behavior'); const input = behavior_page.locator('uni-input[aria-label="University email"] input'); const button = behavior_page.locator('[data-interaction="verEmail.goVerCode.click.1"]'); const saved = () => behavior_page.evaluate(key => localStorage.getItem(key), key); const before = await saved()
  await input.fill('bad'); await button.click(); assert.match(await behavior_page.getByRole('alert').innerText(), /valid email/); assert.equal(await saved(), before); await input.fill('verify.pixel@campus.edu'); assert.equal(await behavior_page.getByRole('alert').count(), 0)
  await behavior_page.evaluate(key => { window.__emailWrites = 0; const original = Storage.prototype.setItem; window.__restoreEmailStorage = () => { Storage.prototype.setItem = original }; Storage.prototype.setItem = function (name, value) { if (name === key) window.__emailWrites++; return original.call(this, name, value) } }, key)
  await button.dblclick(); await behavior_page.locator('.verification-page').waitFor(); assert.equal(await behavior_page.evaluate(() => window.__emailWrites), 0); assert.equal(await saved(), before)
  await behavior_page.getByRole('button', { name: 'Change email' }).click(); await behavior_page.locator('.verification-email-page').waitFor(); await input.fill('verify.changed@campus.edu'); const changed_before = await saved(); await button.dblclick(); await behavior_page.locator('.loading').waitFor(); assert.equal(await saved(), changed_before); await behavior_page.locator('.verification-page').waitFor(); const changed = JSON.parse(await saved()).data; assert.equal(changed.accounts.find(row => row.account_id === account_id).email, 'verify.changed@campus.edu'); assert.equal(await behavior_page.evaluate(() => window.__emailWrites), 1); await behavior.close(); check('invalid input is zero-write and clears on edit; unchanged navigation writes nothing; changed email commits once after Loading despite double tap')

  const duplicate = await app_context(browser, pending); const duplicate_page = await open_email(duplicate, origin, 'duplicate'); const duplicate_before = await duplicate_page.evaluate(key => localStorage.getItem(key), key); await duplicate_page.locator('uni-input[aria-label="University email"] input').fill('cimoa@gmail.com'); await duplicate_page.locator('[data-interaction="verEmail.goVerCode.click.1"]').click(); await duplicate_page.locator('.loading').waitFor(); await duplicate_page.locator('.loading').waitFor({ state: 'detached' }); assert.match(await duplicate_page.getByRole('alert').innerText(), /already (exists|has a local account)/i); assert.equal(await duplicate_page.evaluate(key => localStorage.getItem(key), key), duplicate_before); await duplicate_page.screenshot({ path: path.join(output, 'actual-browser-conflict.png') }); await duplicate.close(); check('duplicate email retains the retryable form and rolls back the whole write')

  const failure = await app_context(browser, pending, { width: 393, height: 852 }, true); const failure_page = await open_email(failure, origin, 'failure'); const failure_before = await failure_page.evaluate(key => localStorage.getItem(key), key); await failure_page.locator('uni-input[aria-label="University email"] input').fill('verify.failure@campus.edu'); await failure_page.locator('[data-interaction="verEmail.goVerCode.click.1"]').click(); await failure_page.locator('.loading').waitFor(); await failure_page.locator('.loading').waitFor({ state: 'detached' }); assert.match(await failure_page.getByRole('alert').innerText(), /storage|failure/i); assert.equal(await failure_page.evaluate(key => localStorage.getItem(key), key), failure_before); assert.equal(await failure_page.locator('uni-input[aria-label="University email"] input').inputValue(), 'verify.failure@campus.edu'); await failure_page.screenshot({ path: path.join(output, 'actual-browser-error.png') }); await failure.close(); check('persistence failure preserves input and produces no partial account mutation')

  const missing = await browser.newContext({ viewport: { width: 393, height: 852 } }); const missing_page = await open_email(missing, origin, 'missing'); assert.match(await missing_page.getByRole('alert').first().innerText(), /Log in or create/); assert.equal(await missing_page.locator('.auth-input').count(), 0); await missing_page.screenshot({ path: path.join(output, 'actual-browser-missing-context.png') }); await missing_page.locator('[data-interaction="verEmail.goVerCode.click.1"]').click(); await missing_page.locator('.login-page').waitFor(); assert.equal(await missing_page.evaluate(key => localStorage.getItem(key), key), null); await missing.close(); check('missing context exposes no account field, writes nothing and opens real Login')

  const verified = clone_data(pending); verified.accounts.find(row => row.account_id === account_id).local_verification = { method: 'fixed_code', status: 'verified', verified_at: Date.now() }; const verified_context = await app_context(browser, verified); const verified_page = await open_email(verified_context, origin, 'verified'); assert.equal(await verified_page.locator('uni-input[aria-label="University email"] input').isDisabled(), true); await verified_page.locator('[data-interaction="verEmail.goVerCode.click.1"]').click(); await verified_page.locator('.verification-success-page').waitFor(); await verified_context.close(); check('verified recovery disables correction and continues without a second verification write')

  const small = await app_context(browser, pending, { width: 320, height: 568 }); const small_page = await open_email(small, origin, 'small'); await set_safe_area(small_page, 62, 34); await freeze(small_page); const footer_before = await small_page.locator('.auth-footer').boundingBox(); const scroller = small_page.locator('.secondary-page-scroll .uni-scroll-view').last(); await small_page.screenshot({ path: path.join(output, 'actual-browser-small.png') }); await scroller.evaluate(element => { element.scrollTop = element.scrollHeight }); await freeze(small_page); assert.deepEqual(await small_page.locator('.auth-footer').boundingBox(), footer_before); assert.ok(footer_before.y + footer_before.height <= 534); assert.ok(await small_page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await small_page.screenshot({ path: path.join(output, 'actual-browser-small-scrolled.png') }); await small_page.locator('uni-input[aria-label="University email"] input').focus(); await small_page.setViewportSize({ width: 320, height: 360 }); await set_safe_area(small_page, 62, 0); await small_page.waitForFunction(() => document.querySelector('.verification-email-page')?.classList.contains('verification-email-page--keyboard')); assert.equal(await small_page.locator('.auth-footer').evaluate(element => getComputedStyle(element).display), 'none'); const focused = await small_page.locator('uni-input[aria-label="University email"] input').boundingBox(); assert.ok(focused.y >= 0 && focused.y + focused.height <= 360); await small_page.screenshot({ path: path.join(output, 'actual-browser-keyboard.png') }); await small.close(); check('320x568 safe areas preserve the fixed footer; keyboard reduction folds it and keeps the email field visible')

  const back = await app_context(browser, pending); const back_page = await open_email(back, origin, 'back'); await back_page.locator('[data-interaction="verEmail.goBack.click.1"]').click(); await back_page.locator('.signup-page').waitFor(); assert.equal(await back_page.evaluate(key => localStorage.getItem(key), key), JSON.stringify({ type: 'object', data: pending })); await back.close(); check('direct-entry Back falls back to Signup without mutating the pending account')
  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message); throw error
} finally {
  await browser?.close().catch(() => {}); await new Promise(resolve => server.close(resolve)); report.cleaned_up = true; fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
}
