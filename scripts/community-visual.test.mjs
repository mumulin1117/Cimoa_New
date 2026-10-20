// One-shot Community Agreement pixel evidence and behavior test. The locked
// prototype is read only for hashes; the built app never embeds or loads it.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { read_circa_source } from './lib/circa-source.mjs'
import { choose_date_of_birth } from './lib/date-picker-driver.mjs'
import { privacy_document } from '../src/utils/legalDocuments.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5')
const output = path.resolve(process.env.CIMOA_COMMUNITY_EVIDENCE_DIR || 'docs/ui-restoration/community')
const contract = JSON.parse(fs.readFileSync('docs/ui-restoration/community/source-contract.json', 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase: 'community-pixel-restoration', result: 'failed', server_pid: process.pid, reference: {}, geometry: {}, comparison: {}, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const close = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

function verify_source_lock() {
  const source = read_circa_source()
  const lines = source.template.split('\n')
  const visual = lines.slice(2561, 2604).join('\n')
  const behavior = contract.source.behavior_lines.map(line => lines[line - 1]).join('\n')
  assert.equal(source.source_hash, contract.source.file_sha256)
  assert.equal(hash(visual), contract.source.visual_fragment_sha256)
  assert.equal(hash(behavior), contract.source.behavior_fragment_sha256)
  report.reference = {
    kind: 'source-derived locked reference with approved brand, safe-area, readable-agreement and local-persistence deltas',
    source_file_sha256: source.source_hash,
    visual_fragment_sha256: hash(visual),
    behavior_fragment_sha256: hash(behavior),
    entry_animation: 'finished',
  }
}

function source_reference_markup() {
  const rows = contract.content.agreement_rows.rows.map(row => `<div class="row"><div class="box"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg></div><div class="label">${row.copy}</div><div class="read">Read</div></div>`).join('')
  const rules = contract.content.rules_card.copy.map(rule => `<div>${rule}</div>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;background:${contract.structure.background};color:#0b1b3a}.screen{position:absolute;inset:0}.header{position:absolute;top:58px;left:20px;right:20px;height:48px;display:flex;align-items:center;z-index:20}.back{width:46px;height:46px;border-radius:23px;background:#fff;box-shadow:0 6px 18px rgba(16,36,74,.1);display:flex;align-items:center;justify-content:center}.title{position:absolute;left:58px;right:58px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.15}.scroll{position:absolute;top:122px;left:0;right:0;bottom:0;overflow:hidden;padding:0 20px 190px}.heading{font-size:33px;font-weight:800;letter-spacing:-.035em;line-height:1.1}.rules{display:flex;flex-direction:column;gap:9px;margin-top:16px;padding:18px;background:#fff;border-radius:24px;box-shadow:0 8px 24px rgba(16,36,74,.07);font-size:16.5px;color:#26364f}.row{display:flex;align-items:center;gap:14px;padding:16px 18px;background:#fff;border-radius:24px;box-shadow:0 8px 24px rgba(16,36,74,.07);margin-top:10px}.box{width:28px;height:28px;border-radius:9px;background:#fff;border:2px solid #d6deea;display:flex;align-items:center;justify-content:center;flex:none}.box svg{width:16px;height:16px}.label{flex:1;font-size:16.5px;font-weight:600;text-wrap:pretty}.read{font-size:15px;font-weight:600;color:#4a7bf7;flex:none}.footer{position:absolute;left:20px;right:20px;bottom:34px;z-index:20}.continue{height:60px;border-radius:30px;background:#dfe5ee;color:#96a1b4;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(168,85,247,.24);font-size:19px;font-weight:700}
</style></head><body><div class="screen"><div class="header"><div class="back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0b1b3a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg></div><div class="title">Community</div></div><div class="scroll"><div class="heading">How Cimoa works</div><div class="rules">${rules}</div>${rows}</div><div class="footer"><div class="continue">Continue</div></div></div></body></html>`
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
    const box = elementOrSelector => {
      const element = typeof elementOrSelector === 'string' ? document.querySelector(elementOrSelector) : elementOrSelector
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
    }
    const rows = [...document.querySelectorAll('.community-row')]
    const checks = [...document.querySelectorAll('.community-box')]
    const reads = [...document.querySelectorAll('.community-read')]
    const ruleStyle = getComputedStyle(document.querySelector('.community-rules'))
    return {
      viewport: { width: innerWidth, height: innerHeight }, root: box('.community-page'), header: box('.auth-header'), back: box('.auth-back'), title: box('.auth-header-title'), content: box('.auth-content'), heading: box('.auth-heading'), rules: box('.community-rules'), rows: rows.map(box), checks: checks.map(box), reads: reads.map(box), footer: box('.auth-footer'), continue: box('.auth-primary'),
      safe: [...document.querySelectorAll('.community-page > .safe-area')].map(element => element.getBoundingClientRect().height),
      rule_style: { gap: ruleStyle.gap, padding: ruleStyle.padding, radius: ruleStyle.borderRadius, font_size: ruleStyle.fontSize, line_height: ruleStyle.lineHeight },
      text: { header: document.querySelector('.auth-header-title').textContent, heading: document.querySelector('.auth-heading').textContent, rules: [...document.querySelectorAll('.community-rules > uni-text')].map(element => element.textContent), rows: rows.map(element => element.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()), continue: document.querySelector('.auth-primary').textContent.trim() },
      interactions: { back: document.querySelector('.auth-back').dataset.interaction, toggles: [...document.querySelectorAll('.community-check-area')].map(element => element.dataset.interaction), reads: reads.map(element => element.dataset.interaction), continue: document.querySelector('.auth-primary').dataset.interaction },
      selected: [...document.querySelectorAll('.community-check-area')].map(element => element.getAttribute('aria-checked')),
      continue_disabled: document.querySelector('.auth-primary').getAttribute('aria-disabled'),
      alert_visible: !!document.querySelector('.community-page [role=alert]'), note_visible: !!document.querySelector('.community-page .auth-local-note'),
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
  await context.addInitScript(() => { if (!new URL(location.href).searchParams.has('communityPreserve')) { localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state') } })
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
  await page.goto(`${origin}/?communityPixel=default#/pages/auth/community`); await page.locator('.community-page').waitFor(); await set_safe_area(page, 54, 0)
  report.geometry = await freeze(page)
  assert.deepEqual(report.geometry.viewport, { width: 393, height: 852 }); assert.deepEqual(report.geometry.safe, [54, 0])
  assert.ok(close(report.geometry.header.x, 20)); assert.ok(close(report.geometry.header.y, 58)); assert.ok(close(report.geometry.header.height, 48)); assert.ok(close(report.geometry.back.width, 46)); assert.ok(close(report.geometry.back.height, 46))
  assert.ok(close(report.geometry.heading.y, 122)); assert.ok(close(report.geometry.rules.y, report.geometry.heading.bottom + 16)); assert.ok(close(parseFloat(report.geometry.rule_style.gap), 9, .1)); assert.ok(close(parseFloat(report.geometry.rule_style.padding), 18, .1)); assert.ok(close(parseFloat(report.geometry.rule_style.radius), 24, .1)); assert.ok(close(parseFloat(report.geometry.rule_style.font_size), 16.5, .1))
  for (let index = 0; index < report.geometry.rows.length; index++) { const previous = index ? report.geometry.rows[index - 1] : report.geometry.rules; assert.ok(close(report.geometry.rows[index].y, previous.bottom + 10, 1.5)); assert.ok(close(report.geometry.checks[index].width, 28, .1)); assert.ok(close(report.geometry.checks[index].height, 28, .1)) }
  assert.ok(close(report.geometry.continue.x, 20)); assert.ok(close(report.geometry.continue.height, 60)); assert.ok(close(report.geometry.continue.bottom, 818, 2))
  assert.deepEqual(report.geometry.text, { header: 'Community', heading: 'How Cimoa works', rules: contract.content.rules_card.copy, rows: contract.content.agreement_rows.rows.map(row => `${row.copy} Read`), continue: 'Continue' })
  assert.deepEqual(report.geometry.interactions, { back: 'agree.goBack.click.1', toggles: ['agree.tTerms.click.1', 'agree.tPrivacy.click.1', 'agree.tGuides.click.1'], reads: ['agree.readTerms.click.1', 'agree.readPrivacy.click.1', 'agree.readGuides.click.1'], continue: 'agree.goSignup.click.1' })
  assert.deepEqual(report.geometry.selected, ['false', 'false', 'false']); assert.equal(report.geometry.continue_disabled, 'true'); assert.equal(report.geometry.alert_visible, false); assert.equal(report.geometry.note_visible, false)
  await page.screenshot({ path: path.join(output, 'actual-browser.png') })
  check('393x852 default restores locked source geometry, exact copy, disabled state, interaction IDs and finished cRise frame')

  report.comparison = await write_comparison(browser, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  assert.equal(report.comparison.width, 393); assert.equal(report.comparison.height, 852); assert.ok(report.comparison.mean_absolute_channel_delta < 1.25); assert.ok(report.comparison.pixels_above_channel_delta_8 < 16000)
  check('reference, actual, overlay and absolute diff were generated and stayed within the deterministic pixel threshold')

  await page.locator('[data-interaction="agree.tTerms.click.1"]').click(); let state = await freeze(page)
  assert.deepEqual(state.selected, ['true', 'false', 'false']); assert.equal(state.continue_disabled, 'true'); await page.screenshot({ path: path.join(output, 'actual-browser-partial.png') })
  await page.locator('[data-interaction="agree.tPrivacy.click.1"]').click(); await page.locator('[data-interaction="agree.tGuides.click.1"]').click(); state = await freeze(page)
  assert.deepEqual(state.selected, ['true', 'true', 'true']); assert.equal(state.continue_disabled, 'false'); await page.screenshot({ path: path.join(output, 'actual-browser-ready.png') })
  check('partial and ready states preserve source checkboxes and enable Continue only after all three choices')
  await visual.close()

  const sheet_context = await empty_context(browser)
  const sheet_page = await sheet_context.newPage(); sheet_page.on('pageerror', error => report.errors.push(error.message))
  await sheet_page.goto(`${origin}/?communityPixel=sheet#/pages/auth/community`); await sheet_page.locator('.community-page').waitFor(); await set_safe_area(sheet_page, 54, 0)
  const saved = () => sheet_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  await sheet_page.locator('[data-interaction="agree.readPrivacy.click.1"]').click(); const dialog = sheet_page.getByRole('dialog', { name: 'Privacy Policy' }); await dialog.waitFor(); await sheet_page.waitForTimeout(320)
  assert.ok((await dialog.innerText()).includes(privacy_document.intro)); assert.match(await dialog.innerText(), /app storage/); assert.deepEqual(await sheet_page.locator('.community-check-area').evaluateAll(rows => rows.map(row => row.getAttribute('aria-checked'))), ['false', 'false', 'false']); assert.equal(await saved(), null)
  await sheet_page.screenshot({ path: path.join(output, 'actual-browser-sheet.png') }); await sheet_page.locator('[data-interaction="sheetAgreement.closeSheet.click.2"]').click(); await dialog.waitFor({ state: 'hidden' })
  await sheet_page.locator('[data-interaction="agree.readPrivacy.click.1"]').click(); await dialog.waitFor(); await sheet_page.waitForTimeout(320); assert.ok((await dialog.innerText()).includes(privacy_document.footer))
  await sheet_page.locator('[data-interaction="sheetAgreement.closeSheet.click.1"]').click({ position: { x: 5, y: 5 } }); await dialog.waitFor({ state: 'hidden' }); assert.equal(await saved(), null)
  check('Read opens the correct controlled Sheet on first and repeated use; Close/mask do not accept or persist an agreement')
  await sheet_context.close()

  const small = await empty_context(browser, { width: 320, height: 568 })
  const small_page = await small.newPage(); small_page.on('pageerror', error => report.errors.push(error.message))
  await small_page.goto(`${origin}/?communityPixel=small#/pages/auth/community`); await small_page.locator('.community-page').waitFor(); await set_safe_area(small_page, 62, 34); await freeze(small_page)
  const footer_before = await small_page.locator('.auth-footer').boundingBox(); const scroller = small_page.locator('.secondary-page-scroll .uni-scroll-view').last(); assert.ok(await scroller.evaluate(element => element.scrollHeight > element.clientHeight))
  await small_page.screenshot({ path: path.join(output, 'actual-browser-small.png') }); await scroller.evaluate(element => { element.scrollTop = element.scrollHeight }); await freeze(small_page)
  const footer_after = await small_page.locator('.auth-footer').boundingBox(); assert.deepEqual(footer_after, footer_before); assert.ok(footer_after.y + footer_after.height <= 534); assert.ok(await small_page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await small_page.screenshot({ path: path.join(output, 'actual-browser-small-scrolled.png') }); await small.close()
  check('320x568 long content scrolls in one region while the 62/34 safe-area footer stays fixed and unobscured')

  const flow = await empty_context(browser)
  const flow_page = await flow.newPage(); flow_page.on('pageerror', error => report.errors.push(error.message))
  await flow_page.goto(`${origin}/?communityPixel=flow#/pages/auth/age`); await flow_page.locator('.age-page').waitFor(); await choose_date_of_birth(flow_page, '2000-01-01'); await flow_page.locator('[data-interaction="age.goAgree.click.1"]').click(); await flow_page.locator('.loading').waitFor(); await flow_page.locator('.community-page').waitFor()
  const flow_saved = () => flow_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const before = await flow_saved(); await flow_page.locator('[data-interaction="agree.goSignup.click.1"]').dispatchEvent('click'); assert.match(await flow_page.getByRole('alert').innerText(), /three community/); assert.equal(await flow_saved(), before)
  await flow_page.locator('[data-interaction="agree.readTerms.click.1"]').click(); await flow_page.getByRole('dialog', { name: 'Terms of Use' }).waitFor(); assert.equal(await flow_saved(), before); await flow_page.locator('[data-interaction="sheetAgreement.closeSheet.click.2"]').click(); await flow_page.getByRole('dialog', { name: 'Terms of Use' }).waitFor({ state: 'hidden' })
  for (const id of ['agree.tTerms.click.1', 'agree.tPrivacy.click.1', 'agree.tGuides.click.1']) await flow_page.locator(`[data-interaction="${id}"]`).click()
  assert.equal(await flow_saved(), before); const action = flow_page.locator('[data-interaction="agree.goSignup.click.1"]'); await action.dispatchEvent('click'); await action.dispatchEvent('click'); await flow_page.locator('.loading').waitFor(); assert.equal(await flow_saved(), before); await flow_page.locator('.signup-page').waitFor()
  const committed = JSON.parse(await flow_saved()).data; assert.equal(committed.auth_flow.step, 'signup'); assert.deepEqual(committed.auth_flow.agreements, { age: true, student: false, terms: true, privacy: true, community: true }); assert.equal(await flow_page.locator('.signup-page').count(), 1)
  await flow_page.goto(`${origin}/?communityPreserve=1#/pages/auth/community`); await flow_page.locator('.community-page').waitFor(); assert.equal(await flow_page.locator('[aria-checked="true"]').count(), 3)
  check('validation is zero-write; choices stay in memory; one Loading atomically persists all consents, navigates once and refresh restores them')
  await flow.close()

  const failure = await empty_context(browser)
  const failure_page = await failure.newPage(); failure_page.on('pageerror', error => report.errors.push(error.message))
  await failure_page.goto(`${origin}/?communityPixel=failure#/pages/auth/age`); await failure_page.locator('.age-page').waitFor(); await choose_date_of_birth(failure_page, '2000-01-01'); await failure_page.locator('[data-interaction="age.goAgree.click.1"]').click(); await failure_page.locator('.community-page').waitFor()
  for (const key of ['terms', 'privacy', 'community']) await failure_page.locator(`[data-agreement="${key}"]`).click()
  const failure_before = await failure_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  await failure_page.evaluate(() => { const original = Storage.prototype.setItem; window.__restoreCommunitySetItem = () => { Storage.prototype.setItem = original }; Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') throw new DOMException('Injected agreement storage failure', 'QuotaExceededError'); return original.call(this, key, value) } })
  await failure_page.locator('[data-interaction="agree.goSignup.click.1"]').click(); await failure_page.locator('.loading').waitFor(); await failure_page.locator('.community-page [role=alert]').waitFor(); assert.match(await failure_page.getByRole('alert').innerText(), /Injected agreement storage failure/); assert.equal(await failure_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), failure_before); assert.equal(await failure_page.locator('[aria-checked="true"]').count(), 3); assert.equal(await failure_page.locator('.signup-page').count(), 0)
  await failure.close(); check('injected persistence failure rolls Store back, preserves all retryable choices and never opens Signup')

  const back = await empty_context(browser)
  const back_page = await back.newPage(); await back_page.goto(`${origin}/?communityPixel=back#/pages/auth/community`); await back_page.locator('.community-page').waitFor(); await back_page.locator('[data-interaction="agree.goBack.click.1"]').click(); await back_page.locator('.age-page').waitFor(); assert.equal(await back_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null); await back.close()
  check('direct-entry Back falls back to Age without writing guest state')

  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message); throw error
} finally {
  await browser?.close().catch(() => {})
  await new Promise(resolve => server.close(resolve)); report.cleaned_up = true
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
}
