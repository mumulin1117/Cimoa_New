// One-shot deterministic Signup source, pixel and behavior acceptance.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { read_circa_source } from './lib/circa-source.mjs'
import { choose_date_of_birth } from './lib/date-picker-driver.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/ui-restoration/signup')
const contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json'), 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase: 'signup-pixel-restoration', result: 'failed', server_pid: process.pid, reference: {}, geometry: {}, comparison: {}, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const close = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

function verify_source_lock() {
  const source = read_circa_source()
  const lines = source.template.split('\n')
  const visual = lines.slice(2605, 2656).join('\n')
  const behavior = contract.source.behavior_lines.map(line => lines[line - 1]).join('\n')
  assert.equal(source.source_hash, contract.source.file_sha256)
  assert.equal(hash(visual), contract.source.visual_fragment_sha256)
  assert.equal(hash(behavior), contract.source.behavior_fragment_sha256)
  report.reference = {
    kind: 'source-derived locked reference with approved safe-area, truthful-local-registration and password-security deltas',
    source_file_sha256: source.source_hash,
    visual_fragment_sha256: hash(visual),
    behavior_fragment_sha256: hash(behavior),
    entry_animation: 'finished',
  }
}

function source_reference_markup() {
  const markup = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);color:#0b1b3a}.screen{position:absolute;inset:0}.header{position:absolute;top:58px;left:20px;right:20px;height:48px;display:flex;align-items:center;z-index:20}.back{width:46px;height:46px;border-radius:23px;background:#fff;box-shadow:0 6px 18px rgba(16,36,74,.1);display:flex;align-items:center;justify-content:center}.title{position:absolute;left:58px;right:58px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.15}.scroll{position:absolute;top:122px;left:0;right:0;bottom:0;overflow:hidden;padding:0 20px 200px}.heading{font-size:33px;font-weight:800;letter-spacing:-.035em;line-height:1.1}.apple{display:flex;align-items:center;justify-content:center;gap:10px;height:56px;border-radius:28px;background:#0b1b3a;margin-top:18px;color:#fff;font-size:18px;font-weight:600}.apple svg{width:26px;height:26px;flex:none;margin-top:-3px}.divider{display:flex;align-items:center;gap:12px;margin-top:18px;color:#8b95a6;font-size:14.5px}.divider i{flex:1;height:1px;background:#dbe3ee}.field{margin-top:14px}.label{font-size:14.5px;font-weight:600;color:#5b6b85;margin-bottom:7px}.input{display:flex;align-items:center;gap:10px;height:56px;padding:0 18px;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(16,36,74,.06);font-size:17px;color:#8b95a6}.input span{margin-left:auto;color:#4a7bf7;font-size:15px;font-weight:600}.hint{font-size:14px;color:#8b95a6;margin-top:6px;font-weight:600}.note{font-size:15px;color:#5b6b85;margin-top:16px;text-wrap:pretty}.footer{position:absolute;left:20px;right:20px;bottom:30px;display:flex;flex-direction:column;gap:6px;z-index:20}.primary{height:60px;border-radius:30px;background:#dfe5ee;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(168,85,247,.24);font-size:19px;font-weight:700;color:#96a1b4}.secondary{height:46px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#6b7a93}
</style></head><body><div class="screen"><div class="header"><div class="back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0b1b3a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg></div><div class="title">Sign up</div></div><div class="scroll"><div class="heading">Create your account</div><div class="apple"><svg viewBox="0 0 24 24" fill="#fff"><path d="M16.2 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.5-.1-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 3 2.3 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.7-3.6zM14.3 5.6c.6-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z"></path></svg>Continue with Apple</div><div class="divider"><i></i><div>or</div><i></i></div><div class="field"><div class="label">University email</div><div class="input">you@university.edu</div></div><div class="field"><div class="label">Password</div><div class="input">At least 8 characters<span>Show</span></div><div class="hint">At least 8 characters with a number</div></div><div class="field"><div class="label">Confirm password</div><div class="input">Repeat your password</div></div><div class="note">Your university email is used for account access and is never shown on your profile.</div></div><div class="footer"><div class="primary">Create Account</div><div class="secondary">Already have an account? Log in</div></div></div></body></html>`
  return markup.replace(/<div class="apple">[\s\S]*?<div class="field">/, '<div class="field">')
}

async function set_safe_area(page, top, bottom) {
  await page.evaluate(({ top, bottom }) => {
    document.documentElement.style.setProperty('--native-safe-area-top', `${top}px`)
    document.documentElement.style.setProperty('--native-safe-area-bottom', `${bottom}px`)
  }, { top, bottom })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function freeze_signup(page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    for (const animation of document.getAnimations()) animation.finish()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
    }
    const inputs = [...document.querySelectorAll('.signup-page .auth-input')]
    const inputData = inputs.map(element => ({ interaction: element.dataset.interaction, placeholder: element.querySelector('.uni-input-placeholder')?.textContent || element.getAttribute('placeholder'), type: element.querySelector('input')?.type || element.type, value: element.querySelector('input')?.value || '' }))
    const hint = document.querySelector('.signup-hint')
    const noteStyle = getComputedStyle(document.querySelector('.signup-note'))
    return {
      viewport: { width: innerWidth, height: innerHeight }, root: box('.signup-page'), header: box('.auth-header'), back: box('.auth-back'), heading: box('.auth-heading'),
      fields: [...document.querySelectorAll('.auth-field')].map(element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom } }),
      note: box('.signup-note'), footer: box('.auth-footer'), primary: box('.auth-primary'), secondary: box('.auth-secondary'),
      safe: [...document.querySelectorAll('.signup-page > .safe-area')].map(element => element.getBoundingClientRect().height),
      text: { header: document.querySelector('.auth-header-title').textContent, heading: document.querySelector('.auth-heading').textContent, labels: [...document.querySelectorAll('.auth-label')].map(element => element.textContent), hint: hint.textContent, note: document.querySelector('.signup-note').textContent, primary: document.querySelector('.auth-primary').textContent.trim(), secondary: document.querySelector('.auth-secondary').textContent.trim() },
      inputs: inputData, backInteraction: document.querySelector('.auth-back').dataset.interaction, toggleInteraction: document.querySelector('.auth-show').dataset.interaction, primaryInteraction: document.querySelector('.auth-primary').dataset.interaction, secondaryInteraction: document.querySelector('.auth-secondary').dataset.interaction,
      primaryDisabled: document.querySelector('.auth-primary').getAttribute('aria-disabled'), alertVisible: !!document.querySelector('.signup-page [role=alert]'), mismatchVisible: !!document.querySelector('.signup-mismatch'), noteStyle: { fontSize: noteStyle.fontSize, lineHeight: noteStyle.lineHeight, marginTop: noteStyle.marginTop },
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
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(firstImage, 0, 0); const first = context.getImageData(0, 0, canvas.width, canvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(secondImage, 0, 0); const second = context.getImageData(0, 0, canvas.width, canvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(firstImage, 0, 0); context.globalAlpha = .5; context.drawImage(secondImage, 0, 0); context.globalAlpha = 1
    const overlay = canvas.toDataURL('image/png')
    const diff = context.createImageData(canvas.width, canvas.height); let exact = 0, above8 = 0, sum = 0, max = 0
    for (let index = 0; index < first.data.length; index += 4) {
      const channels = [0, 1, 2, 3].map(offset => Math.abs(first.data[index + offset] - second.data[index + offset]))
      const delta = Math.max(...channels); if (delta > 0) exact += 1; if (delta > 8) above8 += 1; sum += channels.reduce((total, value) => total + value, 0); max = Math.max(max, delta)
      diff.data[index] = Math.min(255, channels[0] * 4); diff.data[index + 1] = Math.min(255, channels[1] * 4); diff.data[index + 2] = Math.min(255, channels[2] * 4); diff.data[index + 3] = 255
    }
    context.putImageData(diff, 0, 0)
    return { overlay, diff: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, pixels_different: exact, pixels_above_channel_delta_8: above8, mean_absolute_channel_delta: sum / first.data.length, max_channel_delta: max }
  }, { reference: encoded(reference_path), actual: encoded(actual_path) })
  const decode = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64')
  fs.writeFileSync(path.join(output, 'overlay.png'), decode(result.overlay)); fs.writeFileSync(path.join(output, 'diff.png'), decode(result.diff))
  await page.close(); delete result.overlay; delete result.diff
  return result
}

const input = (page, label) => page.locator(`.signup-page:visible uni-input[aria-label="${label}"] input`)
const fill = async (page, label, value) => { await input(page, label).fill(value); await page.waitForTimeout(40) }
const saved = page => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
const reset_storage_once = context => context.addInitScript(() => {
  if (!/^https?:$/.test(location.protocol) || sessionStorage.getItem('cimoa_signup_test_reset') === 'done') return
  localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state'); sessionStorage.setItem('cimoa_signup_test_reset', 'done')
})
async function reach_signup(page, origin, suffix) {
  await page.goto(`${origin}/?signupPixel=${suffix}#/pages/auth/age`); await page.locator('.age-page').waitFor()
  await choose_date_of_birth(page, '2000-01-01'); await page.locator('[data-interaction="age.goAgree.click.1"]').click(); await page.locator('.community-page').waitFor()
  for (const id of ['agree.tTerms.click.1', 'agree.tPrivacy.click.1', 'agree.tGuides.click.1']) await page.locator(`[data-interaction="${id}"]`).click()
  await page.locator('[data-interaction="agree.goSignup.click.1"]').click(); await page.locator('.signup-page:visible').waitFor(); await page.waitForTimeout(300)
}

let browser
try {
  verify_source_lock(); fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })

  const reference = await browser.newContext({ viewport: { width: 393, height: 852 } })
  const reference_page = await reference.newPage(); await reference_page.setContent(source_reference_markup()); await reference_page.screenshot({ path: path.join(output, 'reference.png') }); await reference.close()

  const visual = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await reset_storage_once(visual)
  const page = await visual.newPage(); page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(`${origin}/?signupPixel=default#/pages/auth/signup`); await page.locator('.signup-page').waitFor(); await set_safe_area(page, 54, 0)
  report.geometry = await freeze_signup(page)
  assert.deepEqual(report.geometry.viewport, { width: 393, height: 852 }); assert.deepEqual(report.geometry.safe, [54, 0])
  assert.ok(close(report.geometry.header.x, 20)); assert.ok(close(report.geometry.header.y, 58)); assert.ok(close(report.geometry.header.height, 48)); assert.ok(close(report.geometry.back.width, 46)); assert.ok(close(report.geometry.back.height, 46))
  assert.ok(close(report.geometry.heading.y, 122)); assert.ok(close(report.geometry.fields[0].y, report.geometry.heading.bottom + 14, 1.5)); assert.ok(close(report.geometry.fields[1].y, report.geometry.fields[0].bottom + 14, 1.5)); assert.ok(close(report.geometry.fields[2].y, report.geometry.fields[1].bottom + 14, 1.5))
  assert.ok(close(report.geometry.primary.x, 20)); assert.ok(close(report.geometry.primary.height, 60)); assert.ok(close(report.geometry.secondary.height, 46)); assert.ok(close(report.geometry.secondary.bottom, 822, 2))
  assert.deepEqual(report.geometry.text, { header: 'Sign up', heading: 'Create your account', labels: ['University email', 'Password', 'Confirm password'], hint: 'At least 8 characters with a number', note: 'Your university email is used for account access and is never shown on your profile.', primary: 'Create Account', secondary: 'Already have an account? Log in' })
  assert.deepEqual(report.geometry.inputs, [
    { interaction: 'signup.onEmail.change.1', placeholder: 'you@university.edu', type: 'text', value: '' },
    { interaction: 'signup.onPw.change.1', placeholder: 'At least 8 characters', type: 'password', value: '' },
    { interaction: 'signup.onPw2.change.1', placeholder: 'Repeat your password', type: 'password', value: '' },
  ])
  assert.equal(report.geometry.backInteraction, 'signup.goBack.click.1'); assert.equal(report.geometry.toggleInteraction, 'signup.togglePw.click.1'); assert.equal(report.geometry.primaryInteraction, 'signup.createAccount.click.1'); assert.equal(report.geometry.secondaryInteraction, 'signup.goLogin.click.1')
  assert.equal(report.geometry.primaryDisabled, 'true'); assert.equal(report.geometry.alertVisible, false); assert.equal(report.geometry.mismatchVisible, false); assert.equal(report.geometry.noteStyle.lineHeight, 'normal')
  await page.screenshot({ path: path.join(output, 'actual-browser.png') })
  check('393x852 empty default restores locked source geometry, exact controls, approved truthful note, disabled CTA and finished cRise frame')
  report.comparison = await write_comparison(browser, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  assert.equal(report.comparison.width, 393); assert.equal(report.comparison.height, 852)
  check('reference, actual, overlay and absolute diff were generated from one hash-locked default state')

  await fill(page, 'Password', 'short'); assert.equal((await page.locator('.signup-hint').first().innerText()), 'Too short — 8 characters minimum'); await page.screenshot({ path: path.join(output, 'actual-browser-short.png') })
  await fill(page, 'Password', 'longpassword'); assert.equal((await page.locator('.signup-hint').first().innerText()), 'Include at least one number')
  await fill(page, 'Confirm password', 'different'); assert.equal(await page.locator('.signup-mismatch').innerText(), 'Passwords don’t match yet'); await page.screenshot({ path: path.join(output, 'actual-browser-mismatch.png') })
  await page.locator('[data-interaction="signup.togglePw.click.1"]').press('Space'); assert.equal(await input(page, 'Password').getAttribute('type'), 'text'); assert.equal(await input(page, 'Confirm password').getAttribute('type'), 'text')
  await page.locator('[data-interaction="signup.togglePw.click.1"]').press('Enter'); assert.equal(await input(page, 'Password').getAttribute('type'), 'password')
  check('short, missing-number and mismatch hints are truthful; keyboard Show/Hide controls both real password fields')

  assert.equal(await page.getByRole('button', { name: 'Continue with Apple', exact: true }).count(), 0)
  await fill(page, 'University email', 'edited@campus.edu'); assert.equal(await page.locator('.signup-page [role=alert]').count(), 0)
  await page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(page, 62, 34); await freeze_signup(page)
  const footer_before = await page.locator('.auth-footer').boundingBox(); const scroller = page.locator('.secondary-page-scroll .uni-scroll-view').last(); assert.ok((await scroller.evaluate(element => element.scrollHeight)) > (await scroller.evaluate(element => element.clientHeight)))
  await page.screenshot({ path: path.join(output, 'actual-browser-small.png') }); await scroller.evaluate(element => { element.scrollTop = element.scrollHeight }); await freeze_signup(page)
  assert.deepEqual(await page.locator('.auth-footer').boundingBox(), footer_before); assert.ok(footer_before.y + footer_before.height <= 534)
  await page.screenshot({ path: path.join(output, 'actual-browser-small-scrolled.png') })
  await input(page, 'Confirm password').focus(); await page.setViewportSize({ width: 320, height: 360 }); await set_safe_area(page, 62, 0)
  await page.waitForFunction(() => document.querySelector('.signup-page')?.classList.contains('signup-page--keyboard'))
  assert.equal(await page.locator('.auth-footer').evaluate(element => getComputedStyle(element).display), 'none')
  const focused = await input(page, 'Confirm password').boundingBox(); assert.ok(focused.y >= 0 && focused.y + focused.height <= 360); assert.equal(await saved(page), null)
  check('Apple entry is absent; editing keeps the form usable; 320x568 scrolling and keyboard-height reduction keep the focused field visible')
  await visual.close()

  const duplicate = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await reset_storage_once(duplicate)
  const duplicate_page = await duplicate.newPage(); duplicate_page.on('pageerror', error => report.errors.push(error.message)); await reach_signup(duplicate_page, origin, 'duplicate')
  await fill(duplicate_page, 'University email', 'cimoa@connect.edu'); await fill(duplicate_page, 'Password', 'localpass123'); await fill(duplicate_page, 'Confirm password', 'localpass123')
  const before_duplicate = await saved(duplicate_page); await duplicate_page.locator('.signup-page:visible [data-interaction="signup.createAccount.click.1"]').click(); await duplicate_page.locator('.loading').waitFor(); assert.equal(await saved(duplicate_page), before_duplicate)
  await duplicate_page.getByRole('alert').waitFor(); assert.equal(await duplicate_page.getByRole('alert').innerText(), 'This email is already registered. Log in instead.'); assert.equal(await saved(duplicate_page), before_duplicate)
  await duplicate_page.screenshot({ path: path.join(output, 'actual-browser-error.png') }); await fill(duplicate_page, 'University email', 'signup.pixel@campus.edu'); assert.equal(await duplicate_page.getByRole('alert').count(), 0)
  const primary = duplicate_page.locator('.signup-page:visible [data-interaction="signup.createAccount.click.1"]'); await primary.evaluate(element => { element.click(); element.click() }); await duplicate_page.locator('.loading').waitFor(); assert.equal(await saved(duplicate_page), before_duplicate)
  await duplicate_page.locator('.verification-email-page').waitFor(); const committed = await duplicate_page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const account = committed.accounts.find(row => row.email === 'signup.pixel@campus.edu'); assert.ok(account); assert.equal(account.auth_provider, 'local'); assert.equal(account.verification_status, undefined); assert.equal(JSON.stringify(committed).includes('localpass123'), false); assert.equal(committed.session.current_user_id, null); assert.equal(committed.users.find(row => row.user_id === account.user_id).verification_status, 'pending')
  assert.equal(committed.accounts.filter(row => row.email === 'signup.pixel@campus.edu').length, 1)
  await duplicate_page.goto(`${origin}/?signupPixel=recovery#/pages/auth/signup`); await duplicate_page.locator('.signup-page').waitFor(); assert.equal(await input(duplicate_page, 'Password').inputValue(), ''); assert.equal(await input(duplicate_page, 'Confirm password').inputValue(), ''); assert.equal(await primary.count(), 1)
  await duplicate_page.locator('.signup-page:visible [data-interaction="signup.createAccount.click.1"]').filter({ hasText: 'Continue verification' }).waitFor(); await duplicate_page.locator('.signup-page:visible [data-interaction="signup.createAccount.click.1"]').click(); await duplicate_page.locator('.verification-email-page').waitFor()
  check('duplicate email rolls back; one Loading creates one salted account; no plaintext/session/student certification; refresh recovers verification with blank passwords')
  await duplicate.close()

  const failure = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await reset_storage_once(failure)
  const failure_page = await failure.newPage(); failure_page.on('pageerror', error => report.errors.push(error.message)); await reach_signup(failure_page, origin, 'failure')
  await fill(failure_page, 'University email', 'failure@campus.edu'); await fill(failure_page, 'Password', 'localpass123'); await fill(failure_page, 'Confirm password', 'localpass123')
  const before_failure = await saved(failure_page)
  await failure_page.evaluate(() => { const original = Storage.prototype.setItem; window.__restoreSignupStorage = () => { Storage.prototype.setItem = original }; Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') throw new DOMException('Injected signup storage failure', 'QuotaExceededError'); return original.call(this, key, value) } })
  await failure_page.locator('.signup-page:visible [data-interaction="signup.createAccount.click.1"]').click(); await failure_page.locator('.loading').waitFor(); await failure_page.getByRole('alert').waitFor()
  assert.equal(await saved(failure_page), before_failure); assert.equal(await failure_page.locator('.verification-email-page').count(), 0); assert.equal(await input(failure_page, 'Password').inputValue(), 'localpass123'); assert.equal(await failure_page.getByRole('alert').innerText(), 'Your changes couldn’t be completed. Please try again.')
  await failure_page.evaluate(() => window.__restoreSignupStorage()); check('injected persistence failure leaves the Store unchanged, preserves retryable credentials and never opens verification')
  await failure.close()

  const navigation = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await reset_storage_once(navigation)
  const navigation_page = await navigation.newPage(); await navigation_page.goto(`${origin}/?signupPixel=back#/pages/auth/signup`); await navigation_page.locator('.signup-page').waitFor(); await navigation_page.locator('[data-interaction="signup.goLogin.click.1"]').click(); await navigation_page.locator('.login-page').waitFor(); await navigation_page.locator('[data-interaction="login.goBack.click.1"]').click(); await navigation_page.locator('.signup-page').waitFor()
  await navigation_page.locator('[data-interaction="signup.goBack.click.1"]').click(); await navigation_page.locator('.community-page').waitFor(); assert.equal(await saved(navigation_page), null)
  check('Login round-trip restores Signup and direct-entry Back falls back to Community without a guest-state write')
  await navigation.close()

  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message); throw error
} finally {
  await browser?.close().catch(() => {})
  await new Promise(resolve => server.close(resolve)); report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
}
