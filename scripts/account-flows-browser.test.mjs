import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { create_scenario } from '../src/stores/scenarios.js'
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
  } else if (phase === 'purchase-recovery') {
    const posted = []; await page.exposeFunction('__recordPurchaseDispatch', payload => { posted.push(payload) })
    await context.addInitScript(() => { window.webkit = { messageHandlers: { CimoaPurchase: { postMessage(payload) { window.__recordPurchaseDispatch(payload) } } } } })
    await go('/pages/coins/index'); await page.locator('.coin-buy').waitFor(); const ledger_before = (await state()).coin_transactions; await click('coinStore.continuePurchase.click.1'); await page.locator('.loading:visible').waitFor()
    await page.locator('[data-package-id="pkg_60"]').evaluate(e => e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    await page.locator('.coin-purchasing-page').waitFor(); const request = (await state()).purchase_requests[0]; assert.equal(request.package_id, 'pkg_300'); assert.equal(posted.length, 1)
    await page.waitForTimeout(3500); await page.reload(); await page.locator('.coin-purchasing-page').waitFor(); assert.equal(posted.length, 1)
    await page.locator('.coin-failed-page').waitFor(); assert.ok(Date.now() - request.created_at < 10500); assert.equal((await state()).purchase_requests[0].status, 'timeout'); assert.deepEqual((await state()).coin_transactions, ledger_before)
    check('Loading locks the selected package; reload keeps the original 8000ms deadline, one native dispatch, one request and unchanged ledger')
    await click('coinFailed.tryAgainPurchase.click.1'); await page.locator('.coin-purchasing-page').waitFor(); assert.equal(posted.length, 2)
    const pending = (await state()).purchase_requests.find(p => p.status === 'pending')
    await page.evaluate(() => { location.hash = '#/pages/settings/index' }); await page.locator('.settings-page:visible').waitFor()
    assert.equal(await page.evaluate(p => window.CimoaPurchaseBridge.resolve(p.request_id, { ...p, status: 'failure' }), posted[1]), true)
    await page.waitForTimeout(650); assert.equal((await state()).purchase_requests.find(p => p.request_id === pending.request_id).status, 'pending'); assert.equal(await page.locator('.settings-page:visible').count(), 1)
    await page.goBack(); await page.locator('.coin-failed-page:visible').waitFor()
    assert.equal((await state()).purchase_requests.find(p => p.request_id === pending.request_id).status, 'failure'); assert.equal(posted.length, 2)
    check('A controlled native callback while the page is hidden cannot write or navigate; returning consumes the same callback once after custom Loading')
  } else if (phase === 'coin-return') {
    await go('/pages/home/index'); await page.locator('.home-header').waitFor()
    await page.evaluate(() => { const e = JSON.parse(localStorage.getItem('cimoa_app_state_v2')); e.data.drafts.push({ draft_id: 'coin_return_test', owner_user_id: e.data.session.current_user_id, kind: 'match_return', target_id: 'entry', payload: { kind: 'match_entry', match_id: null }, updated_at: Date.now() }); localStorage.setItem('cimoa_app_state_v2', JSON.stringify(e)) })
    await page.goto(server.origin + '/?flow=coin-return#/pages/coins/index?return_context_id=coin_return_test'); await click('coinStore.openHistory2.click.1'); await page.locator('.coin-history-page').waitFor()
    assert.match(page.url(), /return_context_id=coin_return_test/); const before = await state(); await page.reload(); await click('coinHistory.goBack.click.1'); await page.locator('.coin-center-page').waitFor(); assert.match(page.url(), /return_context_id=coin_return_test/)
    await click('coinStore.goBack.click.1'); await page.locator('.auto-match-index').waitFor(); assert.deepEqual(await state(), before)
    check('Coin Center → History → reload → fallback Back preserves the owned Auto Match return context and never writes navigation state')
    for (const [label, selector] of [['Terms of Use', '.legal-terms-page'], ['Privacy Policy', '.legal-privacy-page']]) {
      await page.goto(server.origin + '/?flow=legal-return#/pages/coins/help?return_context_id=coin_return_test')
      await page.getByRole('button', { name: label, exact: true }).click(); await page.locator(selector).waitFor(); assert.match(page.url(), /origin=coins/)
      await page.reload(); await click('isLegalDoc.goBack.click.1'); await page.locator('.coin-help-page').waitFor(); assert.match(page.url(), /return_context_id=coin_return_test/)
      await page.reload(); await click('coinHelp.goBack.click.1'); await page.locator('.coin-center-page').waitFor(); await click('coinStore.goBack.click.1'); await page.locator('.auto-match-index').waitFor()
    }
    assert.deepEqual(await state(), before)
    check('Both legal documents restore Coin Help after refresh; Help restores Coin Center and the original Auto Match entry without writes')
  } else if (phase === 'coin-spend-failed') {
    await go('/pages/home/index'); await page.locator('.home-header').waitFor()
    const fixture = create_scenario('match_searching', Date.now()); fixture.coin_transactions = []
    fixture.drafts.push({ draft_id: 'spend_failed', owner_user_id: fixture.session.current_user_id, kind: 'coin_spend', target_id: 'match_liam', payload: { kind: 'priority_match', match_id: 'match_liam', operation_id: 'account_failed_priority' }, updated_at: Date.now() })
    await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), fixture)
    await page.goto(server.origin + '/?flow=spend-failure#/pages/coins/processing?return_context_id=spend_failed'); await page.locator('.coin-spend-failed-page').waitFor(); await set_safe_area(page, 54, 0)
    assert.match(await page.locator('.spend-failed-copy').innerText(), /balance is 0/); assert.equal(await page.locator('.spend-failed-icon svg path').getAttribute('d'), 'M12 7v7M12 17.5v.5')
    await page.screenshot({ path: path.join(output, 'spend-failed.png') }); assert.deepEqual((await state()).coin_transactions, [])
    await click('coinSpendFailed.retrySpend.click.1'); await page.locator('.coin-spend-failed-page').waitFor(); assert.deepEqual((await state()).coin_transactions, [])
    check('Insufficient balance reaches the source failure layout and retry never leaves a debit or invents a success')
    await click('coinSpendFailed.openCoinHelp.click.1'); await page.locator('.coin-help-page').waitFor(); await click('coinHelp.goBack.click.1'); await page.locator('.coin-spend-failed-page').waitFor()
    await page.reload(); await click('coinSpendFailed.goBack.click.1'); await page.locator('.auto-match-searching').waitFor(); assert.deepEqual((await state()).coin_transactions, [])
    check('Help Back and refreshed Return restore the owned matching session and draft without spending')
    await page.goto(server.origin + '/?flow=bad-failure#/pages/coins/spend-failed?return_context_id=foreign'); await page.getByRole('alert').waitFor(); assert.equal(await page.locator('[data-interaction="coinSpendFailed.retrySpend.click.1"]').count(), 0)
    check('Invalid context exposes no Retry or Support mutation path')
  } else if (phase === 'coin-processing') {
    await go('/pages/home/index'); await page.locator('.home-header').waitFor()
    const fixture = create_scenario('match_searching', Date.now())
    fixture.drafts.push({ draft_id: 'spend_restore', owner_user_id: fixture.session.current_user_id, kind: 'coin_spend', target_id: 'match_liam', payload: { kind: 'priority_match', match_id: 'match_liam', operation_id: 'account_priority_restore' }, updated_at: Date.now() })
    await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), fixture)
    await page.goto(server.origin + '/?flow=spend-resume#/pages/coins/processing?return_context_id=spend_restore')
    await page.locator('.loading:visible').waitFor(); assert.equal((await state()).coin_transactions.length, fixture.coin_transactions.length)
    await page.evaluate(() => { location.hash = '#/pages/settings/index' }); await page.locator('.settings-page:visible').waitFor(); await page.waitForTimeout(650)
    assert.equal((await state()).coin_transactions.length, fixture.coin_transactions.length)
    await page.goBack(); await page.locator('.auto-match-searching:visible').waitFor()
    const completed = await state(); assert.equal(completed.coin_transactions.length, fixture.coin_transactions.length + 1); assert.equal(completed.coin_transactions.at(-1).amount, -20)
    check('Hiding during the pre-write Loading cancels the debit; returning resumes the same operation once and opens its owned match')
    await page.goto(server.origin + '/?flow=spend-replay#/pages/coins/processing?return_context_id=spend_restore'); await page.locator('.auto-match-searching:visible').waitFor()
    assert.deepEqual((await state()).coin_transactions, completed.coin_transactions)
    check('A fresh document replays the persisted operation receipt without another debit')
    await page.goto(server.origin + '/?flow=spend-invalid#/pages/coins/processing?return_context_id=foreign'); await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /unavailable/)
    assert.deepEqual((await state()).coin_transactions, completed.coin_transactions)
    check('Missing or foreign spend context fails closed, without fabricating a draft or transaction')
  } else if (phase === 'coin-refund') {
    await go('/pages/home/index'); await page.locator('.home-header').waitFor()
    await page.evaluate(() => { const e = JSON.parse(localStorage.getItem('cimoa_app_state_v2')); e.data.coin_transactions.push({ transaction_id: 'refund_test', owner_user_id: e.data.session.current_user_id, amount: 20, business_key: 'refund:txn_seed_1', kind: 'refund', status: 'completed', related_id: 'txn_seed_1', created_at: Date.now() }); localStorage.setItem('cimoa_app_state_v2', JSON.stringify(e)) })
    await page.goto(server.origin + '/?flow=refund-read-model#/pages/coins/spend-detail?transaction_id=refund_test'); await page.locator('.spend-hero').waitFor()
    assert.match(await page.locator('.spend-header').innerText(), /Coin refund/); assert.match(await page.locator('.spend-hero').innerText(), /\+20 Coins/); assert.match(await page.locator('.spend-card').innerText(), /Coins returned/)
    assert.match(await page.locator('.spend-note').innerText(), /not a new App Store purchase/); const before = await state(); await page.reload(); await page.locator('.spend-hero').waitFor(); assert.deepEqual(await state(), before)
    check('Controlled canonical refund ledger row renders returned coins, not a new purchase or an invalid negative spend; refresh is read-only (not a real refund-service test)')
  } else throw Error('Unknown phase: ' + phase)
  assert.deepEqual(report.errors, []); await context.close(); report.result = 'passed'
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, phase + '.json'), JSON.stringify(report, null, 2) + '\n') }
