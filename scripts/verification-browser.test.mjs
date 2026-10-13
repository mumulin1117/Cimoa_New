// One-shot local verification regression; only the independent built H5 is served.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { clone_data } from '../src/stores/seed.js'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/evidence/auth')
const phase = process.argv.includes('--success') ? 'verification-success' : 'verification-code'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res)
})
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
const store = use_app_store(createPinia())
configure_store_runtime(store, { persistence: { read: () => null, write: () => {} }, clock: () => Date.now() })
assert.equal(store.hydrate().success, true)
const registration = await store.register_local_account({ email: 'local@campus.edu', password: 'localpass123', confirmation: 'localpass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
assert.equal(registration.success, true)
const registered = clone_data(store.data), account_id = registration.data.account_id
const key = 'cimoa_app_state_v2'
let browser
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary verification preview PID ${process.pid}, ${origin}`)
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } }), page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  const saved = () => page.evaluate(key => localStorage.getItem(key), key)
  const visit = async (data, route = 'code') => {
    await page.goto(`${origin}/`)
    await page.evaluate(({ key, data }) => data ? localStorage.setItem(key, JSON.stringify({ type: 'object', data })) : localStorage.removeItem(key), { key, data })
    await page.goto(`${origin}/?probe=${Date.now()}#/pages/auth/verification/${route}`)
    await page.locator(route === 'code' ? '.verification-page' : '.verification-success-page').waitFor()
  }
  const field = () => page.locator('.verification-input input')
  const submit = () => page.locator('[data-interaction="verCode.goVerSuccess.click.1"]')
  const finish = async () => {
    if (phase === 'verification-success') await page.locator('.verification-success-page').waitFor()
    else { await page.locator('.verification-saved').waitFor(); assert.match(await page.getByRole('alert').innerText(), /not been restored/) }
  }
  fs.mkdirSync(output, { recursive: true })
  await visit(null)
  assert.match(await page.getByRole('alert').innerText(), /Log in or create/)
  assert.equal(await field().count(), 0); assert.equal(await saved(), null)
  await page.getByRole('button', { name: 'Log In', exact: true }).click(); await page.locator('.login-page').waitFor()
  check('direct guest Code exposes no account data and opens the real Login')
  await visit(registered)
  const before = await saved()
  assert.match(await page.locator('.verification-code-hint').innerText(), /009789.*No email/)
  assert.equal(await page.evaluate(() => !!window.webkit?.messageHandlers?.CimoaHost), false)
  await page.locator('.page-transition').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  assert.ok(Math.abs((await page.locator('.verification-cell').first().boundingBox()).width - 44) < 1)
  assert.ok(Math.abs((await page.locator('.verification-cell').first().boundingBox()).height - 60) < 1)
  await page.screenshot({ path: path.join(output, 'verification-code.png') })
  check('source six 44x60 cells and local-only copy render without a native host')
  for (const value of ['', '9789', '0097890', '００９７８９']) {
    await field().fill(value); await submit().click()
    assert.match(await page.getByRole('alert').innerText(), /exactly six/)
    assert.equal(await saved(), before); assert.equal(await page.locator('.loading').count(), 0)
  }
  await field().fill('000000'); await submit().click(); await page.locator('.loading').waitFor()
  assert.equal(await saved(), before); await page.locator('.loading').waitFor({ state: 'detached' })
  assert.match(await page.getByRole('alert').innerText(), /incorrect/i); assert.equal(await field().inputValue(), '000000'); assert.equal(await saved(), before)
  check('empty, short, long, non-ASCII and wrong six-digit values fail with zero writes')
  await page.getByRole('button', { name: 'Change email' }).click()
  assert.match(await page.getByRole('alert').innerText(), /not been restored/); assert.equal(await saved(), before)
  await field().fill('009789')
  await page.evaluate(() => { window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'cimoa_app_state_v2') throw Error('Quota exceeded'); return window.__set.call(this, key, value) } })
  await submit().click(); await page.locator('.loading').waitFor(); await page.locator('.loading').waitFor({ state: 'detached' })
  assert.match(await page.getByRole('alert').innerText(), /saved|storage|save|quota/i); assert.equal(await saved(), before); assert.equal(await field().inputValue(), '009789')
  await page.evaluate(() => { Storage.prototype.setItem = window.__set; delete window.__set })
  check('deferred Change email and failed persistence never mutate the account or lose the input')
  await page.evaluate(() => { window.__writes = 0; window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'cimoa_app_state_v2') window.__writes++; return window.__set.call(this, key, value) } })
  await submit().dblclick(); await page.locator('.loading').waitFor(); await page.waitForTimeout(300)
  assert.equal(await saved(), before)
  await finish()
  const verified = await saved(), data = JSON.parse(verified).data
  assert.equal(data.accounts.find(row => row.account_id === account_id).local_verification.status, 'verified')
  assert.deepEqual(data.users, registered.users); assert.deepEqual(data.session, registered.session)
  assert.deepEqual(data.coin_transactions, registered.coin_transactions); assert.deepEqual(data.relationships, registered.relationships)
  assert.equal(await page.evaluate(() => window.__writes), 1)
  check('009789 writes once after 500ms despite double tap; session, student identity, coins and relationships are untouched')
  await page.reload(); await page.locator(phase === 'verification-success' ? '.verification-success-page' : '.verification-saved').waitFor()
  assert.equal(await saved(), verified)
  check('refresh restores the same account result without another write or skeleton')
  if (phase === 'verification-success') {
    await page.locator('.page-transition').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    assert.match(await page.locator('.verification-success-heading').innerText(), /Local verification complete/)
    assert.ok(Math.abs((await page.locator('.verification-success-icon').boundingBox()).width - 96) < 1)
    await page.screenshot({ path: path.join(output, 'verification-success.png') })
    await page.getByRole('button', { name: 'Continue Profile Setup' }).click()
    assert.match(await page.getByRole('alert').innerText(), /not been restored/); assert.equal(await saved(), verified)
    check('Success uses persisted local result and 96px source circle; unavailable profile setup fails truthfully')
    await visit(registered, 'success')
    assert.equal(await page.locator('.verification-success-icon').count(), 0)
    assert.match(await page.getByRole('alert').innerText(), /not been completed/)
    await page.getByRole('button', { name: 'Enter Code' }).click(); await page.locator('.verification-page').waitFor()
    check('opening Success URL directly cannot invent a verified account')
  }
  await visit(registered); await field().fill('009789'); await submit().click(); await page.locator('.loading').waitFor()
  const cancelled = await saved(); await page.goto(`${origin}/#/pages/auth/login`)
  await page.locator('.login-page').waitFor(); await page.waitForTimeout(650); assert.equal(await saved(), cancelled)
  check('leaving Code during Loading cancels verification instead of committing on a hidden page')
  await page.locator('.login-page input').first().fill('local@campus.edu'); await page.locator('.login-page input').last().fill('localpass123')
  await page.locator('[data-interaction="login.loginNow.click.1"]').click(); await page.locator('.verification-page').waitFor()
  assert.equal(JSON.parse(await saved()).data.session.account_id, account_id)
  assert.equal(await page.locator('.main-skeleton').count(), 0)
  check('local unverified login routes to Code, not a false student-verified Home')
  await page.setViewportSize({ width: 320, height: 568 })
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  await field().fill('000000'); await submit().click(); await page.locator('.loading').waitFor(); await page.locator('.loading').waitFor({ state: 'detached' })
  const footer = await page.locator('.auth-footer').boundingBox()
  assert.ok(footer.y + footer.height <= 535)
  await page.locator('.verification-page .uni-scroll-view').last().evaluate(el => { el.scrollTop = el.scrollHeight })
  assert.deepEqual(await page.locator('.auth-footer').boundingBox(), footer)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: path.join(output, 'verification-code-small.png') })
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.locator('.login-page').waitFor()
  check('small-screen error content scrolls; fixed CTA respects 62/34 safe areas and direct Back returns Login')
  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve))
  report.cleaned_up = true
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, `${phase}-browser.json`), JSON.stringify(report, null, 2) + '\n')
  console.log('Verification preview and browser closed.')
}
