import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'email'
const root = path.resolve('dist/build/h5')
const output = path.resolve(process.env.CIMOA_AUTH_RESET_EVIDENCE_DIR || 'docs/evidence/auth-reset')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, `.${new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html')}`)
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(response)
})
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = message => { report.checks.push(message); console.log(`PASS ${message}`) }
let browser
try {
  fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary reset preview PID ${process.pid}: ${origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(origin)
  const guest = create_scenario('default', Date.now()); guest.session = { account_id: null, current_user_id: null, expires_at: null }
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), guest)
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const field = label => page.locator(`uni-input[aria-label="${label}"] input`)
  const replace = async (locator, value) => { await locator.fill(''); await locator.pressSequentially(value) }

  if (phase === 'email') {
    await page.goto(`${origin}/?phase=reset-email#/pages/auth/login`)
    const before = await state()
    await page.locator('[data-interaction="login.appleAuth.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /Apple sign-in is currently unavailable/)
    assert.deepEqual(await state(), before)
    check('Apple login is explicitly unavailable and performs no account write')

    await page.locator('[data-interaction="login.goFpEmail.click.1"]').click()
    await page.locator('.reset-email-page').waitFor()
    await field('Reset email').fill('not-an-email')
    await page.locator('[data-interaction="fpEmail.goFpCode.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /valid email/)
    assert.deepEqual(await state(), before)
    await field('Reset email').fill('cimoa@gmail.com')
    await page.locator('[data-interaction="fpEmail.goFpCode.click.1"]').click()
    await page.locator('.loading[aria-label="Loading"]').waitFor()
    assert.equal((await state()).auth_flow.password_reset, null)
    await page.locator('.reset-code-page').waitFor()
    const created = await state()
    assert.equal(created.auth_flow.password_reset.email, 'cimoa@gmail.com')
    assert.equal(created.auth_flow.password_reset.verified_at, null)
    check('Reset Email creates an owned password reset only after custom Loading and opens Code')

    await page.waitForTimeout(400)
    await page.locator('.auth-back').click(); await page.locator('.reset-email-page').waitFor()
    await page.screenshot({ path: path.join(output, 'email.png') })
    const persisted = await state()
    await page.reload(); await page.locator('.reset-email-page').waitFor()
    assert.equal(await field('Reset email').inputValue(), '')
    assert.deepEqual(await state(), persisted)
    await page.locator('.auth-back').click(); await page.locator('.login-page').waitFor()
    check('Reset Email refresh leaks no unsaved address, preserves only the reset record, and Back restores Login')
  }

  if (phase === 'code') {
    await page.goto(`${origin}/?phase=reset-code#/pages/auth/login`)
    await page.locator('[data-interaction="login.goFpEmail.click.1"]').click()
    await page.locator('.reset-email-page').waitFor()
    await field('Reset email').fill('cimoa@gmail.com')
    await page.locator('[data-interaction="fpEmail.goFpCode.click.1"]').click()
    await page.locator('.loading[aria-label="Loading"]').waitFor()
    assert.equal((await state()).auth_flow.password_reset, null)
    await page.locator('.reset-code-page').waitFor()
    const reset = (await state()).auth_flow.password_reset
    assert.equal(reset.email, 'cimoa@gmail.com')
    assert.equal(reset.verified_at, null)
    assert.match(await page.locator('.auth-description').innerText(), /009789/)
    check('Code shows the fixed local-only value and keeps reset verification pending on arrival')

    await field('Reset code').fill('111111')
    await page.locator('[data-interaction="fpCode.goFpNew.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /incorrect/)
    assert.equal((await state()).auth_flow.password_reset.verified_at, null)
    check('Wrong reset code is rejected without a persisted write')

    const before_resend = await state()
    await page.locator('[data-interaction="fpCode.resend.click.1"]').click()
    assert.match(await page.getByRole('status').innerText(), /Your reset code is 009789/)
    assert.deepEqual(await state(), before_resend)
    check('Resend explicitly reports no email delivery and performs no write')

    await field('Reset code').fill('')
    await field('Reset code').pressSequentially('009789')
    assert.equal(await field('Reset code').inputValue(), '009789')
    await page.screenshot({ path: path.join(output, 'code.png') })
    const code_url = page.url(), persisted = await state()
    await page.reload(); await page.locator('.reset-code-page').waitFor()
    assert.equal(page.url(), code_url)
    assert.equal(await field('Reset code').inputValue(), '')
    assert.deepEqual(await state(), persisted)
    check('Code refresh clears the secret field while preserving the owned reset')

    await field('Reset code').pressSequentially('009789')
    await page.locator('[data-interaction="fpCode.goFpNew.click.1"]').click()
    await page.locator('.loading[aria-label="Loading"]').waitFor()
    assert.equal((await state()).auth_flow.password_reset.verified_at, null)
    await page.locator('.reset-new-page').waitFor()
    assert.equal(typeof (await state()).auth_flow.password_reset.verified_at, 'number')
    await page.locator('[data-interaction="fpNew.goBack.click.1"]').click(); await page.locator('.reset-code-page').waitFor()
    assert.equal(await field('Reset code').inputValue(), '')
    await page.locator('[data-interaction="fpCode.goBack.click.1"]').click(); await page.locator('.reset-email-page').waitFor()
    check('Correct code verifies only after custom Loading, opens New Password, and both Back owners restore correctly')
  }

  if (phase === 'new') {
    await page.goto(`${origin}/?phase=reset-new#/pages/auth/reset/new?reset_id=missing`)
    const initial = await state()
    assert.match(await page.getByRole('alert').innerText(), /Confirm your reset code/)
    assert.deepEqual(await state(), initial)
    check('New Password rejects direct access without a verified owned reset')

    await page.goto(`${origin}/?phase=reset-new#/pages/auth/login`)
    await page.locator('[data-interaction="login.goFpEmail.click.1"]').click()
    await field('Reset email').fill('cimoa@gmail.com')
    await page.locator('[data-interaction="fpEmail.goFpCode.click.1"]').click()
    await page.locator('.reset-code-page').waitFor()
    await field('Reset code').pressSequentially('009789')
    await page.locator('[data-interaction="fpCode.goFpNew.click.1"]').click()
    await page.locator('.reset-new-page').waitFor()
    const verified = await state(), account_before = verified.accounts.find(row => row.email === 'cimoa@gmail.com')
    assert.equal(typeof verified.auth_flow.password_reset.verified_at, 'number')
    check('Fixed code reaches New Password with the verified reset owned by the account')

    await field('New password').fill('short1')
    await field('Confirm new password').fill('short1')
    await page.locator('[data-interaction="fpNew.finishReset.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /8–128 characters/)
    assert.deepEqual((await state()).accounts.find(row => row.email === 'cimoa@gmail.com'), account_before)

    await replace(field('New password'), 'newlocal123')
    await replace(field('Confirm new password'), 'different123')
    assert.equal(await field('New password').inputValue(), 'newlocal123')
    assert.equal(await field('Confirm new password').inputValue(), 'different123')
    await field('Confirm new password').blur()
    await page.waitForTimeout(100)
    await page.locator('[data-interaction="fpNew.finishReset.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /do not match/)
    assert.deepEqual((await state()).accounts.find(row => row.email === 'cimoa@gmail.com'), account_before)
    check('Weak and mismatched passwords are rejected without changing the account credential')

    assert.equal(await field('New password').getAttribute('type'), 'password')
    await page.locator('[data-interaction="fpNew.togglePw.click.1"]').click()
    assert.equal(await field('New password').getAttribute('type'), 'text')
    await page.screenshot({ path: path.join(output, 'new.png') })
    const reset_before_reload = (await state()).auth_flow.password_reset
    await page.reload(); await page.locator('.reset-new-page').waitFor()
    assert.equal(await field('New password').inputValue(), '')
    assert.equal(await field('Confirm new password').inputValue(), '')
    assert.deepEqual((await state()).auth_flow.password_reset, reset_before_reload)
    check('Password visibility works, while refresh clears both secrets and preserves verified reset state')

    await replace(field('New password'), 'newlocal123')
    await replace(field('Confirm new password'), 'newlocal123')
    await field('Confirm new password').blur()
    await page.waitForTimeout(100)
    await page.locator('[data-interaction="fpNew.finishReset.click.1"]').click()
    await page.locator('.loading[aria-label="Loading"]').waitFor()
    assert.deepEqual((await state()).accounts.find(row => row.email === 'cimoa@gmail.com'), account_before)
    await page.locator('.login-page').waitFor()
    const updated = await state(), account_after = updated.accounts.find(row => row.email === 'cimoa@gmail.com')
    assert.equal(account_after.auth_provider, 'local')
    assert.match(account_after.credential_hash, /^[0-9a-f]{64}$/)
    assert.notEqual(account_after.credential_hash, account_before.credential_hash)
    assert.equal(updated.auth_flow.password_reset, null)
    assert.equal(updated.session.account_id, null)
    assert.equal(await field('Email').inputValue(), 'cimoa@gmail.com')
    check('Password changes only after custom Loading, clears reset state, stays signed out, and prefills Login')

    await replace(field('Password'), '12341234')
    assert.equal(await field('Password').inputValue(), '12341234')
    await field('Password').blur()
    await page.waitForTimeout(100)
    await page.locator('[data-interaction="login.loginNow.click.1"]').click()
    await page.locator('.loading[aria-label="Loading"]').waitFor()
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').innerText(), /email or password is incorrect/i)
    assert.equal((await state()).session.account_id, null)
    await replace(field('Password'), 'newlocal123')
    assert.equal(await field('Password').inputValue(), 'newlocal123')
    await field('Password').blur()
    await page.waitForTimeout(100)
    await page.locator('[data-interaction="login.loginNow.click.1"]').click()
    await page.locator('.loading[aria-label="Loading"]').waitFor()
    await page.waitForTimeout(1500)
    if (!await page.locator('.home-header').isVisible()) {
      throw new Error(`New-password login did not reach Home: ${JSON.stringify({ url: page.url(), alert: await page.getByRole('alert').allInnerTexts(), session: (await state()).session })}`)
    }
    assert.equal((await state()).session.account_id, account_after.account_id)
    check('Old fixture password is invalidated and the new local password signs back into Home')
  }

  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message)
  throw error
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  fs.writeFileSync(path.join(output, `${phase}-acceptance.json`), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Temporary reset preview PID ${process.pid} stopped`)
}
