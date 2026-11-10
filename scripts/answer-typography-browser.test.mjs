import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { answer_typography_regression } from './lib/answer-typography-regression.mjs'

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/answer-typography'), origin = 'http://127.0.0.1:47849'
const now = Date.now(), fixture = create_scenario('default', now)
fixture.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], shared: [], screenshots: [], errors: [], warnings: [], preview_server_started: false }
const check = message => { report.checks.push(message); console.log('PASS ' + message) }
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixture.json'), JSON.stringify(fixture, null, 2) + '\n')
let browser, page
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname
    const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.addInitScript(({ data, origin }) => {
    if (location.origin === origin && !localStorage.getItem('cimoa_app_state_v2')) localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data }))
  }, { data: fixture, origin })
  await page.goto(`${origin}/#/pages/home/index`); await page.locator('.home-header').waitFor()
  await page.goto(`${origin}/index.html?answer=select#/pages/discover/icebreaker/select?user_id=user_zane`)
  await page.locator('.ice-select-page').waitFor()
  const bytes = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const before = await bytes(), click = id => page.locator(`[data-interaction="${id}"]:visible`).first().click()
  assert.equal(await page.locator('.ice-choice').nth(1).innerText().then(value => value.trim()), 'What is your ideal weekend hike?')
  await page.locator('.ice-choice').nth(1).click(); await click('ibSelect.answerGo.click.1'); await page.locator('.ice-text-page').waitFor()
  assert.equal(await bytes(), before)
  check('Zane second-question selection opens Your answer without persisting a draft or changing entities')
  const safeArea = () => page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  const screenshot = async name => { await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name) }
  for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }, { width: 440, height: 956 }]) {
    await page.setViewportSize(viewport); await safeArea()
    await page.waitForFunction(width => Math.abs(document.querySelector('.ice-header-title').getBoundingClientRect().width) > 0 && innerWidth === width, viewport.width)
    report.shared.push(await page.evaluate(answer_typography_regression))
    await screenshot(`answer-blank-${viewport.width}x${viewport.height}.png`)
  }
  check('393×852, 320×568 and 440×956 share the intended typography, natural wrapping, safe areas and blank-answer layout')
  await page.setViewportSize({ width: 393, height: 852 }); await safeArea()
  await page.evaluate(() => {
    window.__answerWrites = 0
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) { if (key === 'cimoa_app_state_v2') window.__answerWrites++; return original.call(this, key, value) }
  })
  const field = () => page.locator('.ice-text-page textarea:visible')
  const answer = ('An easy weekend hike with sea views, a picnic, and coffee after the trail. ' + 'Averylongtrailnamewithoutspaces').repeat(4).slice(0, 300)
  await field().fill(answer); await page.waitForTimeout(1100)
  assert.equal(await field().inputValue(), answer)
  assert.equal(await page.locator('.ice-counter:visible').innerText(), '300 / 300')
  report.long_answer = await field().evaluate(element => {
    const root = element.closest('.ice-text-page'), style = getComputedStyle(element)
    return { length: element.value.length, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, rootWidth: root.clientWidth, rootScrollWidth: root.scrollWidth, wordBreak: style.wordBreak, overflowWrap: style.overflowWrap }
  })
  assert.ok(report.long_answer.scrollHeight > report.long_answer.clientHeight)
  assert.ok(report.long_answer.scrollWidth <= report.long_answer.clientWidth + 1)
  assert.ok(report.long_answer.rootScrollWidth <= report.long_answer.rootWidth + 1)
  assert.equal(report.long_answer.wordBreak, 'normal')
  assert.equal(await bytes(), before); assert.equal(await page.evaluate(() => window.__answerWrites), 0)
  await field().blur(); await screenshot('answer-long-393x852.png')
  check('A 300-character answer wraps within the editor and scrolls vertically without horizontal overflow or idle autosave')
  try {
    await page.evaluate(() => {
      window.__answerViewportHeightDescriptor = Object.getOwnPropertyDescriptor(window.visualViewport, 'height')
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => 500 })
      window.visualViewport.dispatchEvent(new Event('resize'))
    })
    await page.waitForFunction(() => document.querySelector('.ice-text-page--keyboard') && Math.abs(document.querySelector('.ice-text-page').getBoundingClientRect().height - 500) < 1)
    report.keyboard = await page.evaluate(async () => {
      const root = document.querySelector('.ice-text-page'), field = root.querySelector('textarea')
      const scroller = [...root.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].find(element => element.scrollHeight > element.clientHeight + 1)
      if (!scroller) throw Error('Keyboard-sized content does not expose its real scroll container')
      scroller.scrollTop = scroller.scrollHeight
      field.scrollTop = field.scrollHeight; field.setSelectionRange(field.value.length, field.value.length)
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const box = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom } }
      return { emulated_keyboard: true, system_keyboard_tested: false, viewport_height: visualViewport.height, root: box(root), footer: box(root.querySelector('.ice-footer')), back: box(root.querySelector('.ice-back')), scroll: box(scroller), card: box(root.querySelector('.ice-reply-card')), counter: box(root.querySelector('.ice-counter')), scroll_top: scroller.scrollTop, editor_scroll_top: field.scrollTop, editor_max_scroll: field.scrollHeight - field.clientHeight, selection_end: field.selectionEnd }
    })
    assert.ok(report.keyboard.footer.bottom <= 501)
    assert.ok(report.keyboard.back.y >= 61 && report.keyboard.back.bottom < 500)
    assert.ok(report.keyboard.scroll_top > 0)
    assert.ok(report.keyboard.card.bottom <= report.keyboard.scroll.bottom + 1)
    assert.ok(report.keyboard.counter.bottom <= report.keyboard.scroll.bottom + 1)
    assert.ok(Math.abs(report.keyboard.editor_scroll_top - report.keyboard.editor_max_scroll) <= 1)
    assert.equal(report.keyboard.selection_end, 300)
    assert.equal(await bytes(), before); assert.equal(await page.evaluate(() => window.__answerWrites), 0)
    await screenshot('answer-emulated-keyboard-393x500.png')
  } finally {
    await page.evaluate(() => {
      if (window.__answerViewportHeightDescriptor) Object.defineProperty(window.visualViewport, 'height', window.__answerViewportHeightDescriptor)
      else delete window.visualViewport.height
      delete window.__answerViewportHeightDescriptor
      window.visualViewport.dispatchEvent(new Event('resize'))
    })
  }
  await page.waitForFunction(() => !document.querySelector('.ice-text-page--keyboard') && Math.abs(document.querySelector('.ice-text-page').getBoundingClientRect().height - 852) < 1)
  check('Emulated 500px visual viewport keeps Back/CTA usable and lets the page reach its counter and the editor reach character 300; no system keyboard claim')
  await click('ibText.switchToVoice.click.1'); await page.locator('.ice-voice-page').waitFor()
  await click('ibVoice.switchToTextReply.click.1'); await page.locator('.ice-text-page').waitFor()
  await safeArea(); assert.equal(await field().inputValue(), answer)
  assert.equal(await bytes(), before); assert.equal(await page.evaluate(() => window.__answerWrites), 0)
  check('Text → voice → text preserves the temporary answer without recording, saving or storage writes')
  await click('ibText.continueText.click.1')
  const dialog = () => page.getByRole('dialog', { name: 'Send text introduction?', exact: true })
  await dialog().waitFor()
  assert.match(await dialog().innerText(), /Text Introduction\s*10 coins/)
  assert.match(await dialog().innerText(), /Balance after sending\s*250 coins/)
  assert.equal(await bytes(), before); await screenshot('answer-fee-confirmation.png')
  await click('sheetTextCoin.editAnswer.click.1'); await dialog().waitFor({ state: 'hidden' })
  assert.equal(await field().inputValue(), answer); assert.equal(await bytes(), before); assert.equal(await page.evaluate(() => window.__answerWrites), 0)
  check('The 10-Coin fee confirmation shows the correct before/after balance; Edit Answer cancels without debit or persistence')
  await click('ibText.continueText.click.1'); await dialog().waitFor(); await click('sheetTextCoin.spendText.click.1')
  await page.locator('.event-loading:visible').waitFor(); assert.equal(await bytes(), before)
  await page.locator('.connection-sent-page').waitFor()
  const sent = JSON.parse(await bytes()).data, original = JSON.parse(before).data
  const request = sent.requests.find(row => row.sender_id === 'user_cimoa' && row.recipient_id === 'user_zane')
  assert.ok(request); assert.equal(request.question_id, 'user_zane_q_1'); assert.equal(request.text, answer); assert.equal(request.status, 'pending')
  assert.equal(sent.coin_transactions.filter(row => row.related_id === request.request_id && row.amount === -10).length, 1)
  for (const key of ['relationships', 'messages', 'memberships']) assert.deepEqual(sent[key], original[key])
  assert.equal(await page.locator('.connection-heading').innerText(), 'Introduction sent')
  assert.equal(await page.locator('[data-interaction="reqSent.doneSent.click.1"]').innerText(), 'Done')
  await screenshot('answer-introduction-sent.png')
  report.sent = { request_id: request.request_id, question_id: request.question_id, status: request.status, text_length: request.text.length, debit_count: 1 }
  check('Explicit confirmation follows pre-write Loading, sends the selected 300-character answer and charges exactly 10 Coins once')
  const longContext = await browser.newContext({ viewport: { width: 320, height: 568 } })
  try {
    const longPage = await longContext.newPage(); longPage.setDefaultTimeout(10000)
    longPage.on('pageerror', error => report.errors.push(error.message))
    longPage.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
    const longFixture = structuredClone(fixture)
    const longName = 'Zane Alexander with a long campus profile name '.repeat(3).trim()
    const longQuestion = 'What would your ideal weekend hike look like if we explored a scenic coastal trail, found a quiet picnic spot and stopped for coffee with friends afterwards? '.repeat(2).slice(0, 200)
    longFixture.users.find(row => row.user_id === 'user_zane').user_name = longName
    longFixture.icebreakers.find(row => row.question_id === 'user_zane_q_1').text = longQuestion
    await longPage.route(`${origin}/**`, async route => {
      const requested = new URL(route.request().url()).pathname
      const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
      await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await longPage.addInitScript(({ data, origin }) => {
      if (location.origin === origin && !localStorage.getItem('cimoa_app_state_v2')) localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data }))
    }, { data: longFixture, origin })
    await longPage.goto(`${origin}/index.html?answer=long#/pages/discover/icebreaker/select?user_id=user_zane`)
    await longPage.locator('.ice-select-page').waitFor()
    const longBefore = await longPage.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
    await longPage.locator('.ice-choice').nth(1).click()
    await longPage.locator('[data-interaction="ibSelect.answerGo.click.1"]:visible').click(); await longPage.locator('.ice-text-page').waitFor()
    await longPage.evaluate(async () => {
      window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 })
      await document.fonts.ready
      await Promise.all([...document.querySelectorAll('.ice-text-page .page-transition')].flatMap(element => element.getAnimations().map(animation => animation.finished)))
    })
    assert.equal(await longPage.locator('.ice-person-question').innerText(), longQuestion)
    assert.ok((await longPage.locator('.ice-person-name').innerText()).startsWith(longName))
    await longPage.screenshot({ path: path.join(output, 'answer-long-profile-320x568.png') }); report.screenshots.push('answer-long-profile-320x568.png')
    report.long_profile = await longPage.evaluate(async () => {
      const root = document.querySelector('.ice-text-page'), question = root.querySelector('.ice-person-question'), name = root.querySelector('.ice-person-name')
      const scroller = [...root.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].find(element => element.scrollHeight > element.clientHeight + 1)
      if (!scroller) throw Error('Long profile content cannot scroll')
      const untruncated = element => element.scrollHeight <= element.clientHeight + 1 && getComputedStyle(element).textOverflow !== 'ellipsis'
      const wraps = question.getBoundingClientRect().height > parseFloat(getComputedStyle(question).lineHeight) * 2
      scroller.scrollTop = scroller.scrollHeight
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return { name_untruncated: untruncated(name), question_untruncated: untruncated(question), question_wraps: wraps, question_length: question.textContent.length, scroll_top: scroller.scrollTop, counter_bottom: root.querySelector('.ice-counter').getBoundingClientRect().bottom, scroll_bottom: scroller.getBoundingClientRect().bottom, root_width: root.clientWidth, root_scroll_width: root.scrollWidth }
    })
    assert.equal(report.long_profile.name_untruncated, true); assert.equal(report.long_profile.question_untruncated, true)
    assert.equal(report.long_profile.question_wraps, true); assert.equal(report.long_profile.question_length, 200)
    assert.ok(report.long_profile.scroll_top > 0); assert.ok(report.long_profile.counter_bottom <= report.long_profile.scroll_bottom + 1)
    assert.ok(report.long_profile.root_scroll_width <= report.long_profile.root_width + 1)
    assert.equal(await longPage.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), longBefore)
    await longPage.screenshot({ path: path.join(output, 'answer-long-profile-scroll-end-320x568.png') }); report.screenshots.push('answer-long-profile-scroll-end-320x568.png')
  } finally { await longContext.close() }
  check('A separate 320px fixture shows complete long identity/200-character question text without horizontal overflow and scrolls to the counter; native fixture is untouched')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} catch (error) {
  report.failure = String(error.stack || error)
  if (page && !page.isClosed()) {
    report.visible_failure = await page.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2600) })).catch(() => null)
    await page.screenshot({ path: path.join(output, 'failure-browser.png') }).catch(() => {})
  }
  throw error
} finally {
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
