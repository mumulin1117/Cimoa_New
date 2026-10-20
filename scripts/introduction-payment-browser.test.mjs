import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { serve_h5, context_for, set_safe_area } from './lib/pixel-acceptance.mjs'
import { discover_test_audio } from './lib/discover-test-audio.mjs'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve(process.env.CIMOA_INTRODUCTION_EVIDENCE_DIR || 'docs/ui-restoration/introduction-payment-2026-10-20')
fs.mkdirSync(folder, { recursive: true })
const store = use_app_store(createPinia())
configure_store_runtime(store, { persistence: { read: () => create_seed(), write() {} } }); store.hydrate()
const text_id = store.prepare_introduction('user_zane', store.questions_for_user('user_zane')[0].question_id, 'text').data
store.update_introduction_draft(text_id, { text: 'Coffee and a campus walk after class?' })
const text = clone_data(store.data), low = clone_data(text)
low.coin_transactions = low.coin_transactions.filter(t => t.owner_user_id !== 'user_cimoa')
const sample = discover_test_audio(), media_id = 'media_introduction_payment_test', voice = clone_data(text)
Object.assign(voice.drafts.find(d => d.draft_id === text_id).payload, { mode: 'voice', audio_id: media_id })
voice.media_files.push({ media_id, owner_user_id: 'user_cimoa', kind: 'audio', media_url: `indexeddb://${media_id}`, mime: sample.mime, duration_ms: sample.duration_ms, byte_size: sample.byte_size })
const text_route = `/pages/discover/icebreaker/text?user_id=user_zane&draft_id=${text_id}`
const voice_route = `/pages/discover/icebreaker/voice?user_id=user_zane&draft_id=${text_id}`
fs.writeFileSync(path.join(folder, 'native-fixtures.json'), JSON.stringify({ text, low, voice, text_id, text_route, voice_route, media_id, sample }, null, 2) + '\n')
const report = { result: 'failed', checks: [], errors: [] }, check = label => { report.checks.push(label); console.log('PASS ' + label) }
let server, browser, active_page
try {
  server = await serve_h5(); console.log(`Temporary introduction test PID ${server.pid}: ${server.origin}`); report.server_pid = server.pid
  browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'], ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  const context = await context_for(browser, STATE_KEY, create_seed()), page = active_page = await context.newPage()
  page.setDefaultTimeout(12000); page.on('pageerror', e => report.errors.push(e.message))
  let seq = 0
  const open = async route => { await page.goto(`${server.origin}/?introPayment=${seq++}#${route}`); await page.locator('uni-page-body').waitFor() }
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).click()
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const install = async data => { await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), data) }
  const shot = async name => { await set_safe_area(page, 62, 34); await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) if (a.effect.getComputedTiming().iterations !== Infinity) a.finish() }); await page.screenshot({ path: path.join(folder, `${name}-browser.png`) }) }
  await open('/pages/discover/index'); await click('photo.sayHi.click.1')
  await page.locator('[data-interaction="ibSelect.q.pick.click.1"]').first().click(); await click('ibSelect.answerGo.click.1')
  await page.locator('.ice-text-page').waitFor(); await page.locator('textarea:visible').fill('Coffee and a campus walk after class?')
  await click('ibText.continueText.click.1'); await page.getByRole('dialog', { name: 'Send text introduction?', exact: true }).waitFor()
  const before = await saved(); assert.equal(before.coin_transactions.reduce((s, t) => s + t.amount, 0), 260)
  assert.match(await page.locator('.intro-sheet-summary:visible').innerText(), /Text Introduction\s+10 coins.*260 coins.*250 coins/s)
  await shot('text-confirmation'); await click('sheetTextCoin.editAnswer.click.1')
  await page.getByRole('dialog', { name: 'Send text introduction?', exact: true }).waitFor({ state: 'hidden' })
  assert.deepEqual(await saved(), before); check('Deck → question → text → 10-coin confirmation; Edit Answer cancels without request or debit')
  // Fail only the atomic request+debit write, not the preceding context save.
  await page.evaluate(() => { window.__originalIntroWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'cimoa_app_state_v2' && JSON.parse(v).data.requests.some(r => r.sender_id === 'user_cimoa' && r.recipient_id === 'user_zane')) throw Error('Storage full'); return window.__originalIntroWrite.call(this, k, v) } })
  await click('ibText.continueText.click.1'); await click('sheetTextCoin.spendText.click.1')
  await page.locator('.coin-spend-failed-page').waitFor()
  let failed = await saved(); assert.deepEqual(failed.requests, before.requests); assert.deepEqual(failed.coin_transactions, before.coin_transactions)
  const spend_id = failed.drafts.find(d => d.kind === 'coin_spend').draft_id
  await page.reload(); await page.locator('.coin-spend-failed-page').waitFor(); await click('coinSpendFailed.goBack.click.1')
  await page.locator('.ice-text-page').waitFor(); assert.equal(await page.locator('textarea:visible').inputValue(), 'Coffee and a campus walk after class?')
  check('Atomic storage failure opens spend-failed; refresh/Return preserves answer, user, question and unchanged balance')
  await click('ibText.continueText.click.1'); await page.locator('[data-interaction="sheetTextCoin.spendText.click.1"]:visible').evaluate(e => { e.click(); e.click() })
  await page.locator('.connection-sent-page').waitFor()
  let sent = await saved(), request = sent.requests.find(r => r.recipient_id === 'user_zane' && r.sender_id === 'user_cimoa')
  assert.equal(request.kind, 'text'); assert.equal(request.status, 'pending'); assert.equal(sent.coin_transactions.filter(t => t.related_id === request.request_id && t.amount === -10).length, 1)
  await open(`/pages/coins/processing?return_context_id=${spend_id}`); await page.locator('.connection-sent-page').waitFor(); assert.deepEqual((await saved()).coin_transactions, sent.coin_transactions)
  check('Retry, double confirm and processing-page refresh produce exactly one pending text request and one 10-coin debit')
  await click('reqSent.doneSent.click.1'); await page.locator('.discover-send').waitFor()
  const waiting = page.locator('.discover-send'); assert.equal(await waiting.innerText(), 'Waiting for reply'); assert.equal(await waiting.getAttribute('aria-disabled'), 'true')
  const bytes = await saved(), url = page.url(); await waiting.evaluate(e => { e.click(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) }); await page.waitForTimeout(300)
  assert.equal(page.url(), url); assert.deepEqual(await saved(), bytes); await shot('waiting-card')
  await page.reload(); await page.getByRole('button', { name: 'Waiting for reply', exact: true }).waitFor(); await click('photo.expand.click.1')
  await page.locator('.expanded-send').waitFor(); assert.equal(await page.locator('.expanded-send').getAttribute('aria-disabled'), 'true'); assert.equal(await page.locator('.expanded-send').innerText(), 'Waiting for reply')
  await shot('waiting-profile'); check('Deck and profile show grey/inert Waiting for reply after Back and refresh; mouse and keyboard cannot repeat send')
  await install(low); await open(text_route); await click('ibText.continueText.click.1'); await page.getByRole('dialog', { name: 'Not enough coins', exact: true }).waitFor()
  assert.match(await page.locator('.intro-sheet-copy:visible').innerText(), /Text Introduction.*10 coins missing/); await shot('text-insufficient')
  await click('sheetInsufficient.getCoins2.click.1'); await page.locator('.coin-center-page').waitFor(); await page.reload(); await page.locator('.coin-center-page').waitFor(); await click('coinStore.goBack.click.1')
  await page.locator('.ice-text-page').waitFor(); assert.equal(await page.locator('textarea:visible').inputValue(), 'Coffee and a campus walk after class?')
  assert.deepEqual((await saved()).coin_transactions, low.coin_transactions); check('Zero balance blocks text, and Coin Center refresh/Back restores the exact text draft without adding or spending coins')
  for (const [width, height] of [[320, 568], [375, 667], [393, 852], [402, 874], [430, 932]]) {
    await page.setViewportSize({ width, height }); await set_safe_area(page, 62, 34)
    const cta = await page.locator('.ice-text-send').boundingBox()
    assert.ok(cta.y + cta.height <= height - 34 + 1); assert.equal(await page.locator('.ice-text-send').evaluate(e => e.scrollWidth <= e.clientWidth), true)
    if (width === 320) await shot('text-small')
  }
  check('Five iPhone viewports preserve readable text/fee CTA, fixed footer and single safe-area budget')
  await page.setViewportSize({ width: 393, height: 852 }); const fresh_voice = clone_data(text); fresh_voice.drafts[0].payload.mode = 'voice'
  await install(fresh_voice); await open(voice_route); const voice_before = await saved()
  await click('ibVoice.record.click.1'); await click('sheetMic.allowMic.click.1'); await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor()
  await page.waitForTimeout(1600); await click('ibVoice.record.click.1'); await page.getByRole('button', { name: 'Play voice message', exact: true }).waitFor()
  assert.equal(await page.locator('[data-interaction="ibVoice.sendVoiceRequest.click.1"]').innerText(), 'Review voice introduction')
  await click('ibVoice.sendVoiceRequest.click.1'); await page.locator('.ice-preview-page').waitFor(); await shot('voice-preview')
  const voiced = await saved(); assert.deepEqual(voiced.coin_transactions, voice_before.coin_transactions); assert.deepEqual(voiced.requests, voice_before.requests)
  const voice_preview_route = page.url().split('#')[1]; await page.reload(); await page.locator('.ice-preview-page').waitFor(); await click('ibPreview.togglePlay.click.1'); await page.waitForFunction(() => document.querySelector('.ice-audio')?.dataset.playing === 'true')
  await click('ibPreview.continueVoice.click.1'); await page.getByRole('dialog', { name: 'Send voice introduction?', exact: true }).waitFor(); await click('sheetVoiceCoin.editRecording.click.1')
  assert.deepEqual((await saved()).coin_transactions, voice_before.coin_transactions); check('Actual browser MediaRecorder → explicit Voice preview → decoded playback after refresh → fee confirmation; no charge before confirmation')
  await click('ibPreview.continueVoice.click.1'); await click('sheetVoiceCoin.spendVoice.click.1'); await page.locator('.connection-sent-page').waitFor()
  sent = await saved(); request = sent.requests.find(r => r.recipient_id === 'user_zane' && r.sender_id === 'user_cimoa')
  assert.equal(request.kind, 'voice'); assert.ok(request.audio_id); assert.equal(sent.coin_transactions.filter(t => t.related_id === request.request_id && t.amount === -10).length, 1)
  await open(voice_preview_route); await page.locator('.connection-sent-page').waitFor(); assert.deepEqual((await saved()).coin_transactions, sent.coin_transactions)
  await click('reqSent.doneSent.click.1'); await page.getByRole('button', { name: 'Waiting for reply', exact: true }).waitFor()
  check('Voice confirmation sends one actual audio request/debit; revisiting completed preview cannot resend; deck waits for reply')
  await context.close(); assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) {
  report.failure = String(error.stack || error)
  if (active_page && !active_page.isClosed()) { report.failure_state = await active_page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 1800) })); await active_page.screenshot({ path: path.join(folder, 'failure-browser.png') }) }
  throw error
} finally {
  await browser?.close(); await server?.close(); report.cleaned_up = true
  fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
}
