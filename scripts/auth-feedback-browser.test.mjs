import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { auth_feedback_regression } from './lib/auth-feedback-regression.mjs'
import { choose_date_of_birth } from './lib/date-picker-driver.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/auth-feedback'), origin = 'http://127.0.0.1:47846'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false }
const check = message => { report.checks.push(message); console.log('PASS ' + message) }
let browser, page
try {
  fs.mkdirSync(output, { recursive: true })
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(9000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(`${origin}/#/pages/auth/welcome`)
  await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  report.shared = await page.evaluate(auth_feedback_regression)
  await page.screenshot({ path: path.join(output, 'eula-error-393x852.png') })
  const toast = () => page.locator('.brand-toast:not(.brand-toast-leave-active)')
  await toast().waitFor({ state: 'hidden', timeout: 6000 })
  assert.ok(await page.locator('.event-dialog-error:visible').count())
  check('EULA brand request/error, safe area, write ordering, duplicate guard, retry, close and 5-second auto-dismiss')
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).first().click()
  const field = label => page.locator(`uni-input[aria-label="${label}"] input`)
  const fill = async (label, value) => { await field(label).fill(value); await page.waitForTimeout(50) }
  const busy = async text => {
    await page.waitForFunction(expected => document.querySelector('.brand-toast:not(.brand-toast-leave-active) .brand-toast-message')?.textContent === expected, text)
    assert.equal(await toast().getAttribute('data-toast-tone'), 'progress')
    assert.equal(await page.locator('.loading-mask,.loading-card').count(), 0)
  }
  await click('welcome.eula.accept.click.1'); await busy('Confirming your agreement…')
  await page.waitForFunction(() => +getComputedStyle(document.querySelector('.brand-toast')).opacity > .99)
  await page.screenshot({ path: path.join(output, 'eula-progress-393x852.png'), animations: 'disabled' })
  await page.locator('.eula-dialog.event-dialog--open').waitFor({ state: 'hidden' })
  await click('welcome.goLogin.click.1'); await page.locator('.login-page:visible').waitFor()
  await click('login.loginNow.click.1'); assert.match(await page.locator('.login-page .auth-error-box').innerText(), /valid email and password/)
  await fill('Email', 'cimoa@connect.edu'); await fill('Password', 'wrongpassword')
  await click('login.loginNow.click.1'); await busy('Signing in…')
  await toast().waitFor({ state: 'hidden' }); assert.match(await page.locator('.login-page .auth-error-box').innerText(), /password|match|incorrect/i)
  assert.equal(await page.locator('.auth-test-states:visible').count(), 0)
  check('Login uses the same brand request card; invalid fields/wrong password retain useful form errors without debug controls')
  await click('login.goFpEmail.click.1'); await page.locator('.reset-email-page:visible').waitFor()
  await fill('Reset email', 'cimoa@connect.edu'); await click('fpEmail.goFpCode.click.1'); await busy('Checking account…')
  await page.locator('.reset-code-page:visible').waitFor()
  const assert_private_code_ui = async selector => {
    const content = await page.locator(`${selector}:visible`).innerText()
    assert.doesNotMatch(content, /009789|show code again|your reset code is|code shown on the next screen|code\s*:\s*\d{6}/i)
    assert.equal(await page.locator(`${selector} .verification-code-hint,${selector} .verification-info,${selector} .reset-resend,${selector} [data-interaction="fpCode.resend.click.1"]`).count(), 0)
    const attributes = await page.locator(`${selector} input`).evaluateAll(elements => elements.map(element => [element.value, element.getAttribute('aria-label'), element.getAttribute('placeholder'), element.getAttribute('title')]))
    assert.doesNotMatch(JSON.stringify(attributes), /009789/)
  }
  for (const viewport of [{ width: 320, height: 568 }, { width: 440, height: 956 }, { width: 393, height: 852 }]) {
    await page.setViewportSize(viewport)
    await assert_private_code_ui('.reset-code-page')
    await page.evaluate(() => {
      const input = document.querySelector('.reset-code-page .auth-input-box').getBoundingClientRect()
      if (input.x < 0 || input.right > innerWidth + 1) throw Error('Reset code field does not fit the viewport')
    })
  }
  const reset_before = await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  await fill('Reset code', '111111'); await click('fpCode.goFpNew.click.1')
  assert.match(await page.locator('.reset-code-page .auth-error-box').innerText(), /incorrect/)
  assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), reset_before)
  await assert_private_code_ui('.reset-code-page')
  await fill('Reset code', '009789'); await click('fpCode.goFpNew.click.1'); await busy('Checking code…')
  await page.locator('.reset-new-page:visible').waitFor()
  check('Password reset never reveals its built-in code or a reveal/help entry; manual incorrect input is inert and correct input uses brand progress')
  await page.goto(`${origin}/?return=welcome#/pages/auth/welcome`); await page.locator('.welcome-page:visible').waitFor()
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  await click('welcome.goAge.click.1'); await page.locator('.age-page:visible').waitFor()
  await choose_date_of_birth(page, '2000-01-01'); await click('age.goAgree.click.1'); await busy('Checking your age…')
  await page.locator('.community-page:visible').waitFor()
  for (const key of ['terms', 'privacy', 'community']) await page.locator(`[data-agreement="${key}"]:visible`).click()
  await click('agree.goSignup.click.1'); await busy('Confirming your agreements…')
  await page.locator('.signup-page:visible').waitFor()
  await fill('University email', 'feedback.member@campus.edu'); await fill('Password', 'Member1234'); await fill('Confirm password', 'Member1234')
  await click('signup.createAccount.click.1'); await busy('Creating your account…')
  await page.locator('.verification-email-page:visible').waitFor()
  await fill('University email', 'feedback.member@connect.hkust.edu')
  await click('verEmail.goVerCode.click.1'); await busy('Updating email…')
  await page.locator('.verification-page:visible').waitFor()
  await assert_private_code_ui('.verification-page')
  const verification_before = await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  await page.locator('.verification-input input').fill('111111'); await click('verCode.goVerSuccess.click.1'); await busy('Checking code…')
  await toast().waitFor({ state: 'hidden' }); assert.match(await page.locator('.verification-page .auth-error-box').innerText(), /incorrect/)
  assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), verification_before)
  await assert_private_code_ui('.verification-page')
  await page.locator('.verification-input input').fill('009789'); await page.waitForTimeout(50)
  await click('verCode.goVerSuccess.click.1'); await busy('Checking code…')
  await page.locator('.verification-success-page:visible').waitFor()
  await click('verSuccess.goObBasic.click.1'); await page.locator('.onboarding-basic-page:visible').waitFor()
  await fill('Display name', 'Alex'); await page.locator('[data-interaction="obBasic.o.pick.click.1"]:visible').first().click()
  await click('obBasic.goObUni.click.1'); await busy('Updating your profile…')
  await page.locator('.onboarding-uni-page:visible').waitFor()
  check('Real registration path Age → Community → Signup → fixed-code confirmation → profile setup uses one brand card and formal operation copy')
  const text = await page.locator('body').innerText(); assert.doesNotMatch(text, /Saving your agreement|Nothing has been saved|\b(?:local demo|local data)\b/i)
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} catch (error) { report.failure = String(error.stack || error); report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2400) })).catch(() => null); throw error }
finally { await browser?.close(); fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
