// Destructive draft/media and mode-switch regression in an isolated browser only.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { serve_h5, context_for } from './lib/pixel-acceptance.mjs'
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const data = create_seed(), question = data.icebreakers.find(q => q.user_id === 'user_zane')
data.drafts.push({ draft_id: 'extra_draft', owner_user_id: 'user_cimoa', kind: 'introduction', target_id: 'user_zane', payload: { user_id: 'user_zane', question_id: question.question_id, mode: 'voice', text: '', operation_id: 'extra-draft-regression' }, updated_at: Date.now() })
const report = { result: 'failed', checks: [], errors: [], capture: 'Chrome isolated test device, not production audio' }
let server, browser
try {
  server = await serve_h5(); report.server_pid = server.pid; console.log(`Temporary extra Discover test PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  const context = await context_for(browser, STATE_KEY, data), page = await context.newPage()
  page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message))
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).click(), state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const audioId = async () => (await state()).drafts.find(d => d.draft_id === 'extra_draft').payload.audio_id
  const idle = () => page.getByRole('button', { name: 'Start recording', exact: true }).waitFor()
  const record = async () => { await idle(); await click('ibVoice.record.click.1'); await click('sheetMic.allowMic.click.1'); await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor(); await page.waitForTimeout(1200); await click('ibVoice.record.click.1'); await page.getByRole('button', { name: 'Play voice message', exact: true }).waitFor() }
  const check = message => { report.checks.push(message); console.log('PASS ' + message) }
  await page.goto(`${server.origin}/#/pages/discover/icebreaker/voice?user_id=user_zane&draft_id=extra_draft`)
  await record(); await click('ibVoice.sendVoiceRequest.click.1'); await page.locator('.ice-preview-page').waitFor(); const savedId = await audioId()
  await click('ibPreview.reRecord.click.1'); await page.locator('.dialog__confirm').click(); await page.locator('.ice-voice-page').waitFor(); await idle()
  assert.equal(await audioId(), undefined); assert.equal((await state()).media_files.some(m => m.media_id === savedId), false)
  assert.equal(await page.evaluate(async id => { const db = await new Promise((resolve,reject) => { const r=indexedDB.open('cimoa_media_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error) }); const missing=await new Promise((resolve,reject)=>{const r=db.transaction('blobs','readonly').objectStore('blobs').get(id);r.onsuccess=()=>resolve(r.result===undefined);r.onerror=()=>reject(r.error)});db.close();return missing }, savedId), true)
  check('Confirmed preview re-record removes only the unsent draft Blob/reference and returns to one actual Voice page')
  await record(); await click('ibVoice.openVoiceMenu.click.1'); await click('introduction.rerecord.click.1'); await click('sheetMic.denyMic.click.1'); await page.getByRole('dialog', { name: 'Allow microphone access' }).waitFor({ state: 'hidden' }); await idle()
  await record(); await click('ibVoice.openVoiceMenu.click.1'); await click('introduction.delete.click.1'); await idle(); assert.equal(await audioId(), undefined)
  check('Voice menu Re-record and Delete act on the real unsaved recording without sending, charging or fabricated media')
  await record(); await click('ibVoice.switchToTextReply.click.1'); await page.locator('.ice-text-page').waitFor(); const preservedId = await audioId()
  assert.ok(preservedId); await page.locator('textarea:visible').fill('A coffee after your next hike?')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.drafts.find(d => d.draft_id === 'extra_draft').payload.text === 'A coffee after your next hike?')
  await click('ibText.switchToVoice.click.1'); await page.locator('.ice-voice-page').waitFor(); assert.equal(await audioId(), preservedId)
  await click('ibVoice.openVoiceMenu.click.1'); await click('introduction.delete.click.1'); await page.waitForFunction(() => !JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.drafts.find(d => d.draft_id === 'extra_draft').payload.audio_id)
  assert.equal((await state()).drafts.find(d => d.draft_id === 'extra_draft').payload.text, 'A coffee after your next hike?')
  check('Voice/Text switching persists and restores both payloads; deleting saved audio retains the text and clears the same media reference')
  await record(); await click('ibVoice.goBack.click.1'); await click('sheetVoiceDiscard.closeSheet.click.2'); await page.getByRole('dialog', { name: 'Discard this recording?' }).waitFor({ state: 'hidden' }); await page.getByRole('button', { name: 'Play voice message', exact: true }).waitFor()
  await click('ibVoice.goBack.click.1'); await click('sheetVoiceDiscard.cancelRec.click.1'); await page.locator('.ice-select-page').waitFor()
  const after = await state(); assert.deepEqual(after.requests, data.requests); assert.deepEqual(after.coin_transactions, data.coin_transactions)
  check('Keep Recording preserves real media; confirmed unsaved discard returns to Select with no request or debit')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) { report.errors.push(error.stack || String(error)); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync('docs/ui-restoration/discover-request-preview/extra-browser-acceptance.json', JSON.stringify(report, null, 2) + '\n') }
