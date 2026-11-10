import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { display_copy_fixtures } from './lib/display-copy-cases.mjs'
import { terms_document, privacy_document, community_document } from '../src/utils/legalDocuments.js'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/formal-copy-2026-10-26'), origin = 'http://127.0.0.1:47888'
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const key = 'cimoa_app_state_v2', mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const environment_copy = /\b(?:local (?:account|data|demo|social|build|mode|code|verification|draft|profile|session)|local-only|saved locally|stored locally|demo mode|test account|test data|this build|TEST STATES|browser storage|app storage)\b/i
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false, physical_microphone_or_payment_requested: false }
fs.mkdirSync(output, { recursive: true })
let browser
try {
  const fixture = await display_copy_fixtures()
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
  const page = await context.newPage(); page.setDefaultTimeout(7000)
  page.on('pageerror', cause => report.errors.push({ message: cause.message, route: page.url() }))
  page.on('console', item => { if (item.type() === 'warning') report.warnings.push(item.text()) })
  await page.route('**/*', request => {
    const url = new URL(request.request().url())
    if (url.origin !== origin) return request.abort()
    if (url.pathname === '/fixture-shell') return request.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated copy acceptance</title>' })
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return request.fulfill({ status: 404, body: '' })
    return request.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  const check = label => { report.checks.push(label); console.log('PASS ' + label) }
  const visit = async item => {
    await page.goto(`${origin}/fixture-shell`)
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: fixture.fixtures[item.fixture] })
    await page.goto(`${origin}/index.html?copy=${encodeURIComponent(item.name)}#${item.route}`)
    await page.locator(item.selector).waitFor()
    await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
    await page.evaluate(async () => {
      await document.fonts.ready
      for (const animation of document.getAnimations()) if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish()
    })
  }
  for (const item of fixture.cases) {
    await visit(item)
    const text = await page.locator(item.selector).innerText()
    assert.ok(text.includes(item.text), `${item.name}: missing expected copy ${item.text}`)
    assert.doesNotMatch(text, environment_copy, item.name)
    const accessible_text = await page.locator(item.selector).evaluate(node => [...node.querySelectorAll('[aria-label],input,textarea')].map(element => [element.getAttribute('aria-label'), element.getAttribute('placeholder')].filter(Boolean).join(' ')).join('\n'))
    assert.doesNotMatch(accessible_text, environment_copy, `${item.name} accessible copy`)
    if (['login', 'verification-code', 'support', 'privacy', 'delete-success'].includes(item.name)) await page.screenshot({ path: path.join(output, `${item.name}.png`) })
    if (item.name === 'login') assert.equal(await page.locator('.auth-test-states').count(), 0)
    check(item.name)
  }
  await visit(fixture.cases.find(item => item.name === 'community'))
  const consent_before = await page.evaluate(key => localStorage.getItem(key), key)
  for (const document of [terms_document, privacy_document, community_document]) {
    await page.getByRole('button', { name: `Read ${document.title}`, exact: true }).tap()
    const dialog = page.getByRole('dialog', { name: document.title, exact: true })
    await dialog.waitFor()
    const text = await dialog.innerText()
    for (const [title, copy] of document.sections) { assert.ok(text.includes(title)); assert.ok(text.includes(copy)) }
    assert.doesNotMatch(text, environment_copy)
    await dialog.getByRole('button', { name: `Close ${document.title}`, exact: true }).tap()
    await dialog.waitFor({ state: 'hidden' })
  }
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), consent_before)
  check('Community sheets share canonical formal documents; closing never grants consent')
  await visit(fixture.cases.find(item => item.name === 'support'))
  await page.locator('[data-interaction="setSupport.openSupportForm.click.1"]').tap()
  await page.getByRole('radio', { name: 'Technical issue', exact: true }).tap()
  await page.locator('textarea').fill('I need help with a purchase question.')
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data.support_requests.length, key)
  await page.getByRole('button', { name: 'Send message', exact: true }).tap()
  await page.waitForFunction(() => document.querySelector('.support-delivery')?.textContent.includes('Your message has not been sent.'))
  await page.locator('.brand-toast--progress').waitFor({ state: 'hidden' })
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data.support_requests.length, key), before)
  assert.equal(await page.locator('textarea').inputValue(), 'I need help with a purchase question.')
  const text = await page.locator('.settings-support-page').innerText()
  assert.doesNotMatch(text, environment_copy)
  assert.doesNotMatch(text, /sent successfully|ticket created|received by our team/i)
  await page.screenshot({ path: path.join(output, 'support-send-unavailable.png') })
  await page.reload()
  await page.locator('.support-delivery').waitFor()
  assert.match(await page.locator('.support-delivery').innerText(), /has not been sent/)
  assert.equal(await page.locator('textarea').inputValue(), 'I need help with a purchase question.')
  check('Support uses Send message; unavailable delivery never creates a ticket, keeps editable text and restores truthful feedback after refresh')
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (cause) {
  report.failure = cause.stack || String(cause)
  throw cause
} finally {
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
