// One-shot Age Confirmation pixel evidence and behavior test. The locked
// prototype is read only for hashes; the built app never embeds or loads it.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { read_circa_source } from './lib/circa-source.mjs'
import { choose_date_of_birth } from './lib/date-picker-driver.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/ui-restoration/age/date-picker-2026-10-19/page-regression')
const contract = JSON.parse(fs.readFileSync('docs/ui-restoration/age/source-contract.json', 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase: 'age-pixel-restoration', result: 'failed', server_pid: process.pid, reference: {}, geometry: {}, underage_geometry: {}, comparison: {}, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const close = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

function verify_source_lock() {
  const source = read_circa_source()
  const lines = source.template.split('\n')
  const visual = lines.slice(2528, 2559).join('\n')
  const behavior = contract.source.behavior_lines.map(line => lines[line - 1]).join('\n')
  assert.equal(source.source_hash, contract.source.file_sha256)
  assert.equal(hash(visual), contract.source.visual_fragment_sha256)
  assert.equal(hash(behavior), contract.source.behavior_fragment_sha256)
  report.reference = {
    kind: 'source-derived locked reference with approved brand, safe-area, validation and local-persistence deltas',
    source_file_sha256: source.source_hash,
    visual_fragment_sha256: hash(visual),
    behavior_fragment_sha256: hash(behavior),
    entry_animation: 'finished',
  }
}

function source_reference_markup() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;background:${contract.structure.background};color:#0b1b3a}.screen{position:absolute;inset:0}.header{position:absolute;top:58px;left:20px;right:20px;height:48px;display:flex;align-items:center;z-index:20}.back{width:46px;height:46px;border-radius:23px;background:#fff;box-shadow:0 6px 18px rgba(16,36,74,.1);display:flex;align-items:center;justify-content:center}.title{position:absolute;left:58px;right:58px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.15}.scroll{position:absolute;top:122px;left:0;right:0;bottom:0;overflow:hidden;padding:0 20px 200px}.heading{font-size:33px;font-weight:800;letter-spacing:-.035em;line-height:1.1}.description{display:block;margin-top:10px;font-size:17px;color:#5b6b85;line-height:1.45}.field{margin-top:14px}.label{display:block;font-size:14.5px;font-weight:600;color:#5b6b85;margin-bottom:7px}.input{height:56px;padding:0 18px;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(16,36,74,.06);display:flex;align-items:center;color:#8b95a6;font-size:17px}.footer{position:absolute;left:20px;right:20px;bottom:30px;display:flex;flex-direction:column;gap:6px;z-index:20}.continue{height:60px;border-radius:30px;background:linear-gradient(95deg,#1ec8f5 0%,#4a7bf7 34%,#a855f7 64%,#f81ce5 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(168,85,247,.24);font-size:19px;font-weight:700;color:#fff}.under{height:46px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#6b7a93}
</style></head><body><div class="screen"><div class="header"><div class="back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0b1b3a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg></div><div class="title">Age check</div></div><div class="scroll"><div class="heading">Are you 18 or older?</div><span class="description">Cimoa is available only to university students aged 18 or older. Your date of birth stays private — other students only see your age.</span><div class="field"><span class="label">Date of birth</span><div class="input">YYYY-MM-DD</div></div></div><div class="footer"><div class="continue">Continue</div><div class="under">I’m under 18</div></div></div></body></html>`
}

async function set_safe_area(page, top, bottom) {
  await page.evaluate(({ top, bottom }) => {
    document.documentElement.style.setProperty('--native-safe-area-top', `${top}px`)
    document.documentElement.style.setProperty('--native-safe-area-bottom', `${bottom}px`)
  }, { top, bottom })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function freeze(page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    for (const animation of document.getAnimations()) animation.finish()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom, center_x: rect.x + rect.width / 2 } }
    const input = document.querySelector('.age-page .auth-input')
    return {
      viewport: { width: innerWidth, height: innerHeight }, root: box('.age-page'), header: box('.auth-header'), back: box('.auth-back'), title: box('.auth-header-title'),
      content: box('.auth-content'), heading: box('.auth-heading'), description: box('.auth-description'), field: box('.auth-field'), input_box: box('.auth-input-box'),
      footer: box('.auth-footer'), continue: box('.auth-primary'), under: box('.auth-secondary'), safe: [...document.querySelectorAll('.age-page > .safe-area')].map(element => element.getBoundingClientRect().height),
      text: { header: document.querySelector('.auth-header-title').textContent, heading: document.querySelector('.auth-heading').textContent, description: document.querySelector('.auth-description').textContent, label: document.querySelector('.auth-label').textContent, continue: document.querySelector('.auth-primary').textContent.trim(), under: document.querySelector('.auth-secondary').textContent.trim() },
      back_interaction: document.querySelector('.auth-back').dataset.interaction, input_interaction: document.querySelector('.auth-input-box').dataset.interaction,
      placeholder: input.dataset.placeholder, value: input.dataset.dateValue, alert_visible: !!document.querySelector('.age-page [role=alert]'),
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

async function empty_context(browser, viewport = { width: 393, height: 852 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(() => { Date.now = () => Date.UTC(2026, 9, 15, 12) })
  await context.addInitScript(() => { if (!new URL(location.href).searchParams.has('agePreserve')) { localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state') } })
  return context
}

let browser
try {
  verify_source_lock(); fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })

  const reference = await browser.newContext({ viewport: { width: 393, height: 852 } })
  const reference_page = await reference.newPage(); await reference_page.setContent(source_reference_markup()); await reference_page.screenshot({ path: path.join(output, 'reference.png') }); await reference.close()

  const visual = await empty_context(browser)
  const page = await visual.newPage(); page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(`${origin}/?agePixel=default#/pages/auth/age`); await page.locator('.age-page').waitFor(); await set_safe_area(page, 54, 0)
  report.geometry = await freeze(page)
  assert.deepEqual(report.geometry.viewport, { width: 393, height: 852 }); assert.deepEqual(report.geometry.safe, [54, 0])
  assert.ok(close(report.geometry.header.x, 20)); assert.ok(close(report.geometry.header.y, 58)); assert.ok(close(report.geometry.header.height, 48)); assert.ok(close(report.geometry.back.width, 46)); assert.ok(close(report.geometry.back.height, 46))
  assert.ok(close(report.geometry.heading.y, 122)); assert.ok(close(report.geometry.description.y, report.geometry.heading.bottom + 10)); assert.ok(close(report.geometry.field.y, report.geometry.description.bottom + 14)); assert.ok(close(report.geometry.input_box.height, 56))
  assert.ok(close(report.geometry.continue.x, 20)); assert.ok(close(report.geometry.continue.height, 60)); assert.ok(close(report.geometry.under.height, 46)); assert.ok(close(report.geometry.under.bottom, 822, 2))
  assert.deepEqual(report.geometry.text, { header: 'Age check', heading: 'Are you 18 or older?', description: 'Cimoa is available only to university students aged 18 or older. Your date of birth stays private — other students only see your age.', label: 'Date of birth', continue: 'Continue', under: 'I’m under 18' })
  assert.equal(report.geometry.back_interaction, 'age.goBack.click.1'); assert.equal(report.geometry.input_interaction, 'age.openDatePicker.click.1'); assert.equal(report.geometry.placeholder, 'YYYY-MM-DD'); assert.equal(report.geometry.value, ''); assert.equal(report.geometry.alert_visible, false)
  await page.screenshot({ path: path.join(output, 'actual-browser.png') }); await visual.close()
  check('393x852 empty default restores locked source geometry, exact copy, interaction IDs and finished cRise frame')

  report.comparison = await write_comparison(browser, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  assert.equal(report.comparison.width, 393); assert.equal(report.comparison.height, 852)
  check('reference, actual, overlay and absolute diff were generated from one hash-locked default state')

  const under_context = await empty_context(browser)
  const under_page = await under_context.newPage(); under_page.on('pageerror', error => report.errors.push(error.message))
  await under_page.goto(`${origin}/?agePixel=underage#/pages/auth/age`); await under_page.locator('.age-page').waitFor(); await set_safe_area(under_page, 54, 0); await under_page.locator('[data-interaction="age.underage.click.1"]').click(); await under_page.locator('.age-under').waitFor()
  report.underage_geometry = await under_page.evaluate(() => {
    const box = selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom } }
    const style = selector => getComputedStyle(document.querySelector(selector))
    return { card: box('.age-under'), title: box('.age-title'), copy: box('.age-under-copy'), close: box('.age-close'), padding: style('.age-under').padding, radius: style('.age-under').borderRadius, title_size: style('.age-title').fontSize, title_spacing: style('.age-title').letterSpacing, copy_size: style('.age-under-copy').fontSize, copy_line_height: style('.age-under-copy').lineHeight, text: document.querySelector('.age-under').innerText }
  })
  assert.ok(close(parseFloat(report.underage_geometry.padding), 20, .1)); assert.ok(close(parseFloat(report.underage_geometry.radius), 24, .1)); assert.ok(close(report.underage_geometry.card.y, report.geometry.input_box.bottom + 18, 2)); assert.ok(close(parseFloat(report.underage_geometry.title_size), 20, .1)); assert.ok(close(parseFloat(report.underage_geometry.title_spacing), -.5, .1)); assert.ok(close(parseFloat(report.underage_geometry.copy_size), 16, .1)); assert.ok(close(report.underage_geometry.copy.y, report.underage_geometry.title.bottom + 8)); assert.ok(close(report.underage_geometry.close.y, report.underage_geometry.copy.bottom + 14)); assert.ok(close(report.underage_geometry.close.height, 50)); assert.match(report.underage_geometry.text, /^Cimoa isn’t available yet\nYou need to be 18 or older to create an account\. Nothing has been saved\.\nClose$/)
  assert.equal(await under_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null)
  await under_page.screenshot({ path: path.join(output, 'actual-browser-underage.png') }); await under_page.locator('[data-interaction="age.closeUnder.click.1"]').click(); await under_page.locator('.welcome-page').waitFor(); assert.equal(await under_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null)
  await under_context.close(); check('Underage source card has exact padding, typography, spacing and zero-write Close return ownership')

  const flow = await empty_context(browser)
  const flow_page = await flow.newPage(); flow_page.on('pageerror', error => report.errors.push(error.message))
  await flow_page.goto(`${origin}/?agePixel=flow#/pages/auth/age`); await flow_page.locator('.age-page').waitFor(); await set_safe_area(flow_page, 54, 0)
  const input = { fill: value => choose_date_of_birth(flow_page, value) }
  const saved = () => flow_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  await flow_page.locator('[data-interaction="age.goAgree.click.1"]').click(); assert.match(await flow_page.getByRole('alert').innerText(), /valid date/); assert.equal(await saved(), null)
  await input.fill('2008-10-16'); await flow_page.waitForTimeout(60); await flow_page.locator('[data-interaction="age.goAgree.click.1"]').click(); await flow_page.locator('.age-under').waitFor(); assert.match(await flow_page.locator('.age-under').innerText(), /18 or older/); assert.equal(await saved(), null)
  await input.fill('2008-10-15'); await flow_page.waitForTimeout(60); await flow_page.locator('[data-interaction="age.goAgree.click.1"]').click(); await flow_page.locator('.loading').waitFor(); assert.equal(await saved(), null); await flow_page.locator('.community-page').waitFor()
  const committed = JSON.parse(await saved()); assert.equal(committed.data.auth_flow.profile_draft.date_of_birth, '2008-10-15'); assert.equal(committed.data.auth_flow.step, 'community')
  await flow_page.goto(`${origin}/?agePreserve=1#/pages/auth/age`); await flow_page.locator('.age-page').waitFor(); assert.equal(await flow_page.locator('.age-date-value').getAttribute('data-date-value'), '2008-10-15')
  await flow.close(); check('empty and 17-year dates never write; exact 18th birthday waits for Loading, persists and restores (fixed UTC test clock)')

  const failure_context = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await failure_context.addInitScript(() => {
    localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state')
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') throw new DOMException('Injected storage failure', 'QuotaExceededError'); return original.call(this, key, value) }
  })
  const failure_page = await failure_context.newPage(); failure_page.on('pageerror', error => report.errors.push(error.message))
  await failure_page.goto(`${origin}/?agePixel=storageFailure#/pages/auth/age`); await failure_page.locator('.age-page').waitFor(); await choose_date_of_birth(failure_page, '2000-01-01'); await failure_page.locator('[data-interaction="age.goAgree.click.1"]').click(); await failure_page.locator('.loading').waitFor(); await failure_page.locator('.age-page [role=alert]').waitFor()
  assert.match(await failure_page.locator('.age-page [role=alert]').innerText(), /Injected storage failure/); assert.equal(await failure_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null); assert.equal(await failure_page.locator('.age-date-value').getAttribute('data-date-value'), '2000-01-01')
  await failure_context.close(); check('storage failure follows custom Loading, preserves the retryable DOB and creates no partial draft')

  const small = await empty_context(browser, { width: 320, height: 568 })
  const small_page = await small.newPage(); small_page.on('pageerror', error => report.errors.push(error.message))
  await small_page.goto(`${origin}/?agePixel=small#/pages/auth/age`); await small_page.locator('.age-page').waitFor(); await set_safe_area(small_page, 62, 34); await freeze(small_page)
  const footer_before = await small_page.locator('.auth-footer').boundingBox(); const scroller = small_page.locator('.secondary-page-scroll .uni-scroll-view').last()
  await small_page.screenshot({ path: path.join(output, 'actual-browser-small.png') }); await scroller.evaluate(element => { element.scrollTop = element.scrollHeight }); await freeze(small_page)
  const footer_after = await small_page.locator('.auth-footer').boundingBox(); assert.deepEqual(footer_after, footer_before); assert.ok(footer_after.y + footer_after.height <= 534); assert.ok(await small_page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await small_page.screenshot({ path: path.join(output, 'actual-browser-small-scrolled.png') })
  await small_page.locator('[data-interaction="age.openDatePicker.click.1"]').click(); await small_page.locator('.dob-picker.event-dialog--open').waitFor(); await small_page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await freeze(small_page)
  assert.equal(await small_page.locator('.age-page input').count(), 0); await small_page.screenshot({ path: path.join(output, 'actual-browser-picker.png') }); assert.equal(await small_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null)
  await small.close(); check('320x568 safe areas keep the fixed footer stable; DOB opens a controlled picker rather than a text keyboard')

  const back_context = await empty_context(browser)
  const back_page = await back_context.newPage(); await back_page.goto(`${origin}/?agePixel=back#/pages/auth/age`); await back_page.locator('.age-page').waitFor(); await back_page.locator('[data-interaction="age.goBack.click.1"]').click(); await back_page.locator('.welcome-page').waitFor(); assert.equal(await back_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null); await back_context.close()
  check('direct-entry Back falls back to Welcome with no guest-state write')

  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message); throw error
} finally {
  await browser?.close().catch(() => {})
  await new Promise(resolve => server.close(resolve)); report.cleaned_up = true
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
}
