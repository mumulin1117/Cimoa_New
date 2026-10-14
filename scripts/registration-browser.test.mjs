// One-shot built-H5 regression; closes only its ephemeral server and isolated browser.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'age'
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/evidence/registration')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res)
})
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
let browser, page
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary registration preview PID ${process.pid}, ${origin}`)
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2'))?.data)
  const click = id => page.locator(`[data-interaction="${id}"]`).click()
  const field = label => page.locator(`uni-input[aria-label="${label}"] input, uni-textarea[aria-label="${label}"] textarea`)
  const fill = async (label, value) => { await field(label).fill(value); await page.waitForTimeout(60) }
  const settle = async () => { await page.locator('.page-transition').last().evaluate(el => Promise.all(el.getAnimations().map(a => a.finished))); await page.waitForTimeout(60) }
  const shot = async name => { await settle(); await page.screenshot({ path: path.join(output, `${name}.png`) }) }
  fs.mkdirSync(output, { recursive: true })
  await page.goto(`${origin}/`); await page.locator('.welcome-page').waitFor()
  assert.equal(await snapshot(), undefined)
  await click('welcome.goAge.click.1'); await page.locator('.age-page').waitFor(); await settle()
  await click('age.goAgree.click.1'); assert.match(await page.getByRole('alert').innerText(), /valid date/)
  await fill('Date of birth', '2020-01-01'); await click('age.goAgree.click.1')
  assert.match(await page.locator('.age-under').innerText(), /18 or older/); assert.equal(await snapshot(), undefined)
  await fill('Date of birth', '2000-01-01'); await shot('age')
  await click('age.goAgree.click.1'); await page.locator('.loading').waitFor()
  assert.equal(await snapshot(), undefined); await page.locator('.loading').waitFor({ state: 'detached' })
  assert.equal((await snapshot()).auth_flow.profile_draft.date_of_birth, '2000-01-01')
  check('Splash → Welcome → Age; invalid/underage zero writes; custom Loading before adult draft save')
  if (phase === 'age') {
    await page.reload(); await page.locator('.age-page').waitFor()
    assert.equal(await field('Date of birth').inputValue(), '2000-01-01')
    await page.setViewportSize({ width: 320, height: 568 }); await page.waitForTimeout(150); await shot('age-small')
    const cta = await page.locator('.auth-primary').boundingBox(); assert.ok(cta.y + cta.height <= 568)
    await page.locator('.auth-back').click(); await page.locator('.welcome-page').waitFor()
    check('Age refresh preserves DOB; 320px fixed CTA fits; direct-refresh Back returns Welcome')
  }
  if (phase !== 'age') {
    await page.locator('.community-page').waitFor(); await settle()
    await page.locator('[data-interaction="agree.goSignup.click.1"]').dispatchEvent('click'); assert.match(await page.getByRole('alert').innerText(), /three community/)
    await page.getByRole('button', { name: 'Read Privacy Policy', exact: true }).click()
    await page.getByRole('dialog').waitFor(); assert.match(await page.getByRole('dialog').innerText(), /stored locally/)
    await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' })
    for (const key of ['terms', 'privacy', 'community']) await page.locator(`[data-agreement="${key}"]`).click()
    await shot('community'); const before = await snapshot()
    await click('agree.goSignup.click.1'); await page.locator('.loading').waitFor(); assert.deepEqual(await snapshot(), before)
    await page.locator('.loading').waitFor({ state: 'detached' }); assert.equal((await snapshot()).auth_flow.agreements.community, true)
    check('Community exact six rules; Read sheet closes without accepting; all three explicit agreements persist after Loading')
    if (phase === 'community') { await page.reload(); await page.locator('.community-page').waitFor(); assert.equal(await page.locator('[aria-checked="true"]').count(), 3); check('Community refresh restores three consent flags') }
  }
  if (!['age', 'community'].includes(phase)) {
    await page.locator('.signup-page').waitFor(); await settle()
    await fill('University email', 'new.member@campus.edu'); await fill('Password', 'localpass123'); await fill('Confirm password', 'different')
    assert.match(await page.locator('.signup-mismatch').innerText(), /don’t match/)
    await fill('Confirm password', 'localpass123'); await click('signup.togglePw.click.1'); assert.equal(await field('Password').getAttribute('type'), 'text')
    await click('signup.togglePw.click.1'); await shot('signup')
    const before = await snapshot(); await click('signup.createAccount.click.1'); await page.locator('.loading').waitFor(); assert.deepEqual(await snapshot(), before)
    await page.locator('.loading').waitFor({ state: 'detached' }); const after = await snapshot()
    const account = after.accounts.find(row => row.email === 'new.member@campus.edu')
    assert.ok(account); assert.equal(account.auth_provider, 'local'); assert.equal(JSON.stringify(after).includes('localpass123'), false)
    assert.equal(after.users.find(row => row.user_id === account.user_id).verification_status, 'pending'); assert.equal(after.session.current_user_id, null)
    check('Signup source fields, mismatch and Show/Hide; real salted local credential; no plaintext/session/student certification')
  }
  if (!['age', 'community', 'signup'].includes(phase)) {
    await page.locator('.verification-email-page').waitFor(); await settle()
    await fill('University email', 'cimoa@gmail.com'); await click('verEmail.goVerCode.click.1')
    await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /already has/)
    await fill('University email', 'corrected.member@campus.edu'); await click('verEmail.goVerCode.click.1')
    await page.locator('.verification-page').waitFor(); await settle()
    assert.ok((await snapshot()).accounts.some(row => row.email === 'corrected.member@campus.edu'))
    await page.getByRole('button', { name: 'Change email' }).click(); await page.locator('.verification-email-page').waitFor(); await shot('verification-email')
    await click('verEmail.goVerCode.click.1'); await page.locator('.verification-page').waitFor()
    await page.locator('.verification-input input').fill('009789'); await page.waitForTimeout(80)
    await click('verCode.goVerSuccess.click.1'); await page.locator('.verification-success-page').waitFor()
    check('Email conflict rolls back; correction persists; Change email opens actual form; fixed code → Success')
  }
  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.failure = error.stack; if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, `${phase}-browser.json`), JSON.stringify(report, null, 2) + '\n'); console.log(`Closed registration preview PID ${process.pid}`) }
