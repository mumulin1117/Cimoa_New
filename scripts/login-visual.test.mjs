// One-shot Login pixel evidence and browser behavior test. The source HTML is
// hash-verified evidence only; the application never embeds or loads it.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { read_circa_source } from './lib/circa-source.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/ui-restoration/login')
const contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json'), 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase: 'login-pixel-restoration', result: 'failed', server_pid: process.pid, reference: {}, geometry: {}, comparison: {}, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const close = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

function verify_source_lock() {
  const source = read_circa_source()
  const lines = source.template.split('\n')
  const visual = lines.slice(2658, 2705).join('\n')
  const behavior = contract.source.behavior_lines.map(line => lines[line - 1]).join('\n')
  assert.equal(source.source_hash, contract.source.file_sha256)
  assert.equal(hash(visual), contract.source.visual_fragment_sha256)
  assert.equal(hash(behavior), contract.source.behavior_fragment_sha256)
  report.reference = {
    kind: 'source-derived locked reference with approved safe-area and local-mode deltas',
    source_file_sha256: source.source_hash,
    visual_fragment_sha256: hash(visual),
    behavior_fragment_sha256: hash(behavior),
    entry_animation: 'finished',
  }
}

function source_reference_markup() {
  const applePath = contract.content.apple.icon_path
  const markup = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;background:${contract.structure.background};color:#0b1b3a}.screen{position:absolute;inset:0}.header{position:absolute;top:58px;left:20px;right:20px;height:48px;display:flex;align-items:center;z-index:20}.back{width:46px;height:46px;border-radius:23px;background:#fff;box-shadow:0 6px 18px rgba(16,36,74,.1);display:flex;align-items:center;justify-content:center}.title{position:absolute;left:58px;right:58px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.15}.scroll{position:absolute;top:122px;left:0;right:0;bottom:0;overflow:hidden;padding:0 20px 210px}.heading{font-size:33px;font-weight:800;letter-spacing:-.035em;line-height:1.1}.apple{display:flex;align-items:center;justify-content:center;gap:10px;height:56px;border-radius:28px;background:#0b1b3a;margin-top:18px;color:#fff;font-size:18px;font-weight:600}.apple svg{width:26px;height:26px;flex:none;margin-top:-3px}.divider{display:flex;align-items:center;gap:12px;margin-top:18px;color:#8b95a6;font-size:14.5px}.divider i{flex:1;height:1px;background:#dbe3ee}.field{margin-top:14px}.label{font-size:14.5px;font-weight:600;color:#5b6b85;margin-bottom:7px}.input{display:flex;align-items:center;gap:10px;height:56px;padding:0 18px;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(16,36,74,.06);font-size:17px;color:#8b95a6}.input span{margin-left:auto;color:#4a7bf7;font-size:15px;font-weight:600}.forgot{font-size:16px;font-weight:600;color:#4a7bf7;margin-top:16px}.tests{display:flex;flex-direction:column;gap:8px;margin-top:22px}.tests-title{font-size:13px;font-weight:700;letter-spacing:.08em;color:#8b95a6}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{height:40px;padding:0 14px;border-radius:20px;background:#fff;box-shadow:0 6px 16px rgba(16,36,74,.06);display:flex;align-items:center;font-size:14.5px;font-weight:600}.local-note{display:block;margin-top:22px;color:#6b7a93;font-size:14.5px;line-height:1.4}.footer{position:absolute;left:20px;right:20px;bottom:30px;display:flex;flex-direction:column;gap:6px;z-index:20}.login{height:60px;border-radius:30px;background:linear-gradient(95deg,#1ec8f5 0%,#4a7bf7 34%,#a855f7 64%,#f81ce5 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(168,85,247,.24);font-size:19px;font-weight:700;color:#fff}.create{height:46px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#6b7a93}
</style></head><body><div class="screen"><div class="header"><div class="back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0b1b3a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg></div><div class="title">Log in</div></div><div class="scroll"><div class="heading">Welcome back</div><div class="apple"><svg viewBox="0 0 24 24" fill="#fff"><path d="${applePath}"></path></svg>Continue with Apple</div><div class="divider"><i></i><div>or</div><i></i></div><div class="field"><div class="label">Email</div><div class="input">you@university.edu</div></div><div class="field"><div class="label">Password</div><div class="input">Your password<span>Show</span></div></div><div class="forgot">Forgot password?</div><div class="tests"><div class="tests-title">TEST STATES</div><div class="chips"><div class="chip">Wrong password</div><div class="chip">Unverified account</div></div></div><div class="local-note">Keep your account details private. Manage your profile and privacy in Settings.</div></div><div class="footer"><div class="login">Log In</div><div class="create">New here? Create an account</div></div></div></body></html>`
  return markup.replace(/<div class="apple">[\s\S]*?<div class="field">/, '<div class="field">')
}

async function set_safe_area(page, top, bottom) {
  await page.evaluate(({ top, bottom }) => {
    document.documentElement.style.setProperty('--native-safe-area-top', `${top}px`)
    document.documentElement.style.setProperty('--native-safe-area-bottom', `${bottom}px`)
  }, { top, bottom })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function freeze_login(page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    for (const animation of document.getAnimations()) animation.finish()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom, center_x: rect.x + rect.width / 2 }
    }
    const fields = [...document.querySelectorAll('.auth-field')].map(element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom } })
    const chips = [...document.querySelectorAll('.auth-test-chip')].map(element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, text: element.textContent.trim() } })
    const inputs = [...document.querySelectorAll('.login-page .auth-input')]
    return {
      viewport: { width: innerWidth, height: innerHeight }, root: box('.login-page'), header: box('.auth-header'), back: box('.auth-back'), title: box('.auth-header-title'),
      content: box('.auth-content'), heading: box('.auth-heading'), fields,
      forgot: box('.auth-forgot'), tests: box('.auth-test-states'), tests_title: box('.auth-test-title'), chips, note: box('.auth-local-note'),
      footer: box('.auth-footer'), login: box('.auth-primary'), create: box('.auth-secondary'),
      safe: [...document.querySelectorAll('.login-page > .safe-area')].map(element => element.getBoundingClientRect().height),
      text: {
        header: document.querySelector('.auth-header-title').textContent, heading: document.querySelector('.auth-heading').textContent,
        labels: [...document.querySelectorAll('.auth-label')].map(element => element.textContent), forgot: document.querySelector('.auth-forgot').textContent,
        tests: document.querySelector('.auth-test-title').textContent, note: document.querySelector('.auth-local-note').textContent,
        login: document.querySelector('.auth-primary').textContent.trim(), create: document.querySelector('.auth-secondary').textContent.trim(),
      },
      inputs: inputs.map(input => ({ interaction: input.dataset.interaction, placeholder: input.querySelector('.uni-input-placeholder')?.textContent || input.getAttribute('placeholder'), type: input.querySelector('input')?.type || input.type })),
      back_interaction: document.querySelector('.auth-back').dataset.interaction,
      alert_visible: !!document.querySelector('.login-page [role=alert]'),
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

let browser
try {
  verify_source_lock(); fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })

  const reference = await browser.newContext({ viewport: { width: 393, height: 852 } })
  const reference_page = await reference.newPage(); await reference_page.setContent(source_reference_markup()); await reference_page.screenshot({ path: path.join(output, 'reference.png') }); await reference.close()

  const visual = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await visual.addInitScript(() => { localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state') })
  const page = await visual.newPage(); page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(`${origin}/?loginPixel=default#/pages/auth/login`); await page.locator('.login-page').waitFor(); await set_safe_area(page, 54, 0)
  report.geometry = await freeze_login(page)
  const password_box = await page.locator('.login-page .auth-input-box').nth(1).boundingBox()
  const toggle_box = await page.locator('.login-page .auth-show').boundingBox()
  assert.ok(close(toggle_box.y + toggle_box.height / 2, password_box.y + password_box.height / 2, .5)); assert.ok(toggle_box.height >= 44)
  assert.deepEqual(report.geometry.viewport, { width: 393, height: 852 }); assert.deepEqual(report.geometry.safe, [54, 0])
  assert.ok(close(report.geometry.header.x, 20)); assert.ok(close(report.geometry.header.y, 58)); assert.ok(close(report.geometry.header.height, 48))
  assert.ok(close(report.geometry.back.width, 46)); assert.ok(close(report.geometry.back.height, 46)); assert.ok(close(report.geometry.heading.y, 122))
  assert.ok(close(report.geometry.fields[0].y, report.geometry.heading.bottom + 14, 2)); assert.ok(close(report.geometry.fields[1].y, report.geometry.fields[0].bottom + 14, 2))
  assert.ok(close(report.geometry.login.x, 20)); assert.ok(close(report.geometry.login.height, 60)); assert.ok(close(report.geometry.create.height, 46)); assert.ok(close(report.geometry.create.bottom, 822, 2))
  assert.deepEqual(report.geometry.chips.map(row => row.text), ['Wrong password', 'Unverified account']); assert.ok(report.geometry.chips.every(row => close(row.height, 40)))
  assert.deepEqual(report.geometry.text, {
    header: 'Log in', heading: 'Welcome back', labels: ['Email', 'Password'], forgot: 'Forgot password?',
    tests: 'TEST STATES', note: 'Keep your account details private. Manage your profile and privacy in Settings.', login: 'Log In', create: 'New here? Create an account',
  })
  assert.deepEqual(report.geometry.inputs, [
    { interaction: 'login.onEmail.change.1', placeholder: 'you@university.edu', type: 'text' },
    { interaction: 'login.onPw.change.1', placeholder: 'Your password', type: 'password' },
  ])
  assert.equal(report.geometry.back_interaction, 'login.goBack.click.1'); assert.equal(report.geometry.alert_visible, false)
  await page.screenshot({ path: path.join(output, 'actual-browser.png') }); await visual.close()
  check('393x852 actual restores locked source geometry, exact copy, inputs, source test states and finished cRise frame')

  report.comparison = await write_comparison(browser, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  assert.equal(report.comparison.width, 393); assert.equal(report.comparison.height, 852)
  check('reference, actual, overlay and absolute diff were generated from one hash-locked source state')

  const flow = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await flow.addInitScript(() => { localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state') })
  const flow_page = await flow.newPage(); flow_page.on('pageerror', error => report.errors.push(error.message))
  await flow_page.goto(`${origin}/?loginPixel=flows#/pages/auth/login`); await flow_page.locator('.login-page').waitFor(); await set_safe_area(flow_page, 54, 0); await freeze_login(flow_page)
  const saved = () => flow_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  await flow_page.locator('[data-interaction="login.loginWrong.click.1"]').click(); assert.equal(await flow_page.getByRole('alert').innerText(), 'Incorrect password. Try again or reset it.')
  assert.equal(await saved(), null)
  await flow_page.reload(); await flow_page.locator('.login-page').waitFor(); await flow_page.locator('[data-interaction="login.loginUnverified.click.1"]').click()
  assert.equal(await flow_page.getByRole('alert').innerText(), 'No account awaiting confirmation is available. No changes were made.'); assert.equal(await saved(), null)
  check('source test controls inspect real fixture or pending state without creating an account, session or false verification')

  assert.equal(await flow_page.getByRole('button', { name: 'Continue with Apple', exact: true }).count(), 0)
  await flow_page.getByRole('button', { name: 'Show password' }).click(); assert.equal(await flow_page.locator('.login-page input').last().getAttribute('type'), 'text')
  await flow_page.getByRole('button', { name: 'Hide password' }).click(); assert.equal(await flow_page.locator('.login-page input').last().getAttribute('type'), 'password')
  await flow_page.locator('[data-interaction="login.goFpEmail.click.1"]').click(); await flow_page.locator('.reset-email-page').waitFor(); await flow_page.getByRole('button', { name: 'Back', exact: true }).click(); await flow_page.locator('.login-page:visible').waitFor(); await flow_page.waitForTimeout(260)
  assert.equal(await saved(), null)
  check('Apple entry is absent, password privacy is real, and Forgot password returns to Login without a guest-state write')

  await flow_page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(flow_page, 62, 34); await freeze_login(flow_page)
  const small_footer_before = await flow_page.locator('.auth-footer').boundingBox(); const scroller = flow_page.locator('.secondary-page-scroll .uni-scroll-view').last()
  assert.ok((await scroller.evaluate(element => element.scrollHeight)) > (await scroller.evaluate(element => element.clientHeight)))
  await flow_page.screenshot({ path: path.join(output, 'actual-browser-small.png') }); await scroller.evaluate(element => { element.scrollTop = element.scrollHeight }); await freeze_login(flow_page)
  const small_footer_after = await flow_page.locator('.auth-footer').boundingBox(); assert.deepEqual(small_footer_after, small_footer_before); assert.ok(small_footer_after.y + small_footer_after.height <= 534)
  await flow_page.screenshot({ path: path.join(output, 'actual-browser-small-scrolled.png') })
  await flow_page.locator('.login-page input').last().focus(); await flow_page.setViewportSize({ width: 320, height: 360 }); await set_safe_area(flow_page, 62, 0)
  await flow_page.waitForFunction(() => document.querySelector('.login-page')?.classList.contains('login-page--keyboard'))
  assert.equal(await flow_page.locator('.auth-footer').evaluate(element => getComputedStyle(element).display), 'none')
  const focused_password = await flow_page.locator('.login-page input').last().boundingBox(); assert.ok(focused_password.y >= 0 && focused_password.y + focused_password.height <= 360)
  assert.ok(await flow_page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.equal(await saved(), null)
  check('320x568 safe-area scrolling and keyboard-height reduction keep the focused password visible while temporarily folding the source footer')
  await flow.close()

  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message); throw error
} finally {
  await browser?.close().catch(() => {})
  await new Promise(resolve => server.close(resolve)); report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
}
