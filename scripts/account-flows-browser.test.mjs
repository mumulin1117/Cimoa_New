import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { serve_h5, context_for, set_safe_area } from './lib/pixel-acceptance.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(a => a.startsWith('--phase='))?.slice(8) || 'voice'
const output = path.resolve('docs/evidence/account-flows'), report = { phase, result: 'failed', checks: [], errors: [], physical_microphone: 'not tested: controlled browser media device' }
const check = x => { report.checks.push(x); console.log('PASS ' + x) }
let browser, server
try {
  fs.mkdirSync(output, { recursive: true }); server = await serve_h5(); report.server_pid = server.pid; console.log('Temporary account flow preview PID ' + server.pid + ': ' + server.origin)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  const context = await context_for(browser, 'cimoa_app_state_v2', create_seed()), page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => report.errors.push(e.message))
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).click()
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const go = route => page.goto(server.origin + '/#' + route)
  if (phase === 'voice') {
    await go('/pages/profile/edit'); await page.locator('.score-card').waitFor(); await set_safe_area(page, 54, 0)
    const before = await state(); await click('editAll.eaOpenBio.click.1'); await click('editAll.eaBioVoice.click.1'); await click('editAll.evStart.click.1'); await page.getByRole('dialog', { name: 'Allow microphone access' }).waitFor(); await click('sheetMic.allowMic.click.1')
    await page.getByRole('button', { name: 'Stop recording voice bio' }).waitFor(); await page.waitForTimeout(1600); await click('editAll.evStop.click.1'); await page.locator('.bio-voice .event-audio-button').waitFor(); assert.deepEqual(await state(), before)
    await page.getByRole('dialog', { name: 'Edit bio' }).getByRole('button', { name: 'Play voice message', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit bio' }).getByRole('button', { name: 'Pause voice message', exact: true }).waitFor(); await page.getByRole('dialog', { name: 'Edit bio' }).getByRole('button', { name: 'Pause voice message', exact: true }).click()
    await page.screenshot({ path: path.join(output, 'voice-draft.png') }); await click('editAll.eaBioDone.click.1'); assert.deepEqual(await state(), before)
    await click('editAll.eaSave.click.1'); await page.locator('.loading:visible').waitFor(); assert.deepEqual(await state(), before); await page.locator('.profile-title').waitFor()
    const saved = await state(), id = saved.users[0].bio_audio_id, meta = saved.media_files.find(m => m.media_id === id); assert.ok(meta.duration_ms > 0 && meta.duration_ms <= 30000); assert.equal(saved.coin_transactions.length, before.coin_transactions.length)
    check('Controlled real MediaRecorder/decoder/player path stages without writes; final 500ms Save atomically publishes owned audio, without charging coins')
    await page.reload(); await click('profile.openEditBasic.click.1'); await page.locator('[data-interaction="editAll.evTogglePlay.click.1"]').waitFor(); assert.equal((await state()).users[0].bio_audio_id, id)
    await click('editAll.eaOpenBio.click.1'); await click('editAll.eaBioVoice.click.1'); await page.locator('.bio-voice .event-audio-button').waitFor(); await page.getByRole('dialog', { name: 'Edit bio' }).getByRole('button', { name: 'Play voice message', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit bio' }).getByRole('button', { name: 'Pause voice message', exact: true }).waitFor(); await page.getByRole('dialog', { name: 'Edit bio' }).getByRole('button', { name: 'Pause voice message', exact: true }).click()
    check('Voice bio restores from IndexedDB after a real document reload and remains playable')
    await click('editAll.evDelete.click.1'); await page.getByRole('button', { name: 'Close bio editor' }).click(); await page.getByRole('button', { name: 'Back', exact: true }).click(); assert.equal((await state()).users[0].bio_audio_id, id)
    await click('profile.openEditBasic.click.1'); await click('editAll.eaOpenBio.click.1'); await click('editAll.eaBioVoice.click.1'); await click('editAll.evDelete.click.1'); await click('editAll.eaBioDone.click.1'); await click('editAll.eaSave.click.1'); await page.locator('.profile-title').waitFor(); assert.equal((await state()).users[0].bio_audio_id, null)
    check('Cancel keeps existing audio; confirmed draft deletion only takes effect at final Save')
    await click('profile.openEditBasic.click.1'); await click('editAll.eaOpenBio.click.1'); await click('editAll.eaBioVoice.click.1')
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError') } })
    const denied_before = await state(); await click('editAll.evStart.click.1'); await click('sheetMic.allowMic.click.1'); await page.locator('.bio-error').waitFor(); assert.match(await page.locator('.bio-error').innerText(), /permission was denied/); assert.deepEqual(await state(), denied_before)
    check('Microphone denial reports the real failure with no media metadata or profile writes')
  } else if (phase === 'preferences') {
    await go('/pages/profile/prefs'); await page.locator('.preferences-groups').waitFor(); await set_safe_area(page, 54, 0)
    assert.equal(await page.getByRole('radiogroup').count(), 12); assert.equal(await page.locator('uni-slider').count(), 0)
    const before = await state(); await page.getByRole('radio', { name: '21 – 27', exact: true }).click(); await page.getByRole('radio', { name: 'Within 5 km', exact: true }).click(); await page.getByRole('radio', { name: 'Travel buddies', exact: true }).click(); assert.deepEqual(await state(), before)
    await page.screenshot({ path: path.join(output, 'preferences.png') }); await click('editPrefs.savePrefs.click.1'); await page.locator('.loading:visible').waitFor(); assert.deepEqual(await state(), before); await page.locator('.profile-edit-page').waitFor()
    const p = (await state()).match_preferences[0]; assert.deepEqual([p.age_min,p.age_max,p.distance_max,p.goal_id], [21,27,5,'travel'])
    await go('/pages/profile/prefs'); await page.reload(); await page.getByRole('radio', { name: 'Within 5 km', exact: true }).waitFor(); assert.equal(await page.getByRole('radio', { name: 'Within 5 km', exact: true }).getAttribute('aria-checked'), 'true')
    await page.getByRole('radio', { name: 'On campus', exact: true }).click(); await page.getByRole('button', { name: 'Back', exact: true }).click(); assert.equal((await state()).match_preferences[0].distance_max, 5)
    check('Twelve source chip groups: draft selection, 500ms Save, shared Auto Match numeric fields, refresh and cancel without implicit range resets')
  } else throw Error('Unknown phase: ' + phase)
  assert.deepEqual(report.errors, []); await context.close(); report.result = 'passed'
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, phase + '.json'), JSON.stringify(report, null, 2) + '\n') }
