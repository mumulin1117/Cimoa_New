import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { serve_h5, context_for, set_safe_area } from './lib/pixel-acceptance.mjs'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/introduction-composer-2026-10-20'), baseline = create_seed()
fs.mkdirSync(folder, { recursive: true })
const report = { result: 'failed', checks: [], errors: [] }, check = value => { report.checks.push(value); console.log('PASS ' + value) }
const reauthenticate = async (data, email) => {
  const store = use_app_store(createPinia()); configure_store_runtime(store, { persistence: { read: () => data, write() {} } }); store.hydrate(); store.logout()
  assert.ok((await store.login(email, '12341234')).success); return clone_data(store.data)
}
let server, browser, page
try {
  server = await serve_h5(); console.log(`Temporary composer test PID ${server.pid}: ${server.origin}`); report.server_pid = server.pid
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  const context = await context_for(browser, STATE_KEY, baseline); page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => report.errors.push(error.message))
  const open = route => page.goto(`${server.origin}/?composer=${Date.now()}#${route}`)
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).click()
  const bytes = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const install = data => page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), data)
  const shot = async name => { await set_safe_area(page, 62, 34); await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) if (a.effect.getComputedTiming().iterations !== Infinity) a.finish() }); await page.screenshot({ path: path.join(folder, `${name}-browser.png`) }) }
  await open('/pages/discover/index'); await click('photo.sayHi.click.1')
  await page.locator('.ice-select-page').waitFor(); const initial = await bytes()
  await page.evaluate(() => {
    window.__introWrites = 0; window.__introLoading = false
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') window.__introWrites++; return original.call(this, key, value) }
    new MutationObserver(() => { if ([...document.querySelectorAll('.event-loading')].some(e => e.getBoundingClientRect().height > 0)) window.__introLoading = true }).observe(document.body, { childList: true, attributes: true, subtree: true })
  })
  await page.locator('[data-interaction="ibSelect.q.pick.click.1"]').first().click(); await click('ibSelect.answerGo.click.1'); await page.locator('.ice-text-page').waitFor()
  await page.locator('textarea:visible').fill('Keep this answer only while I am editing.'); await page.waitForTimeout(1700)
  assert.equal(await bytes(), initial); assert.deepEqual(await page.evaluate(() => [window.__introWrites, window.__introLoading]), [0, false])
  await shot('your-answer'); check('Answer This Question → Your answer and idle typing produce zero storage writes, no Saving/Loading and no autosave timer')
  await click('ibText.switchToVoice.click.1'); await page.locator('.ice-voice-page').waitFor(); await click('ibVoice.switchToTextReply.click.1'); await page.locator('.ice-text-page').waitFor()
  assert.equal(await page.locator('textarea:visible').inputValue(), 'Keep this answer only while I am editing.')
  await click('ibText.goBack.click.1'); await page.locator('.ice-select-page').waitFor(); assert.ok(await page.locator('.ice-choice--selected').count())
  await click('ibSelect.answerGo.click.1'); await page.locator('.ice-text-page').waitFor(); assert.equal(await page.locator('textarea:visible').inputValue(), 'Keep this answer only while I am editing.')
  assert.equal(await bytes(), initial); assert.deepEqual(await page.evaluate(() => [window.__introWrites, window.__introLoading]), [0, false])
  check('Back and text/voice mode switches preserve the temporary answer without Saving or persistence')
  await page.reload(); await page.locator('textarea:visible').waitFor(); assert.equal(await page.locator('textarea:visible').inputValue(), ''); assert.equal(await bytes(), initial)
  check('Refresh restores the selected question from its ID but does not restore unpublished input or silently save it')
  await page.locator('textarea:visible').fill('Coffee after class?'); await click('ibText.continueText.click.1'); await page.getByRole('dialog', { name: 'Send text introduction?', exact: true }).waitFor()
  assert.equal(await bytes(), initial); await click('sheetTextCoin.spendText.click.1'); await page.locator('.connection-sent-page').waitFor()
  assert.equal(await page.locator('.connection-heading').innerText(), 'Introduction sent')
  assert.equal(await page.locator('[data-interaction="reqSent.doneSent.click.1"]').innerText(), 'Done')
  await shot('introduction-sent')
  const sent = JSON.parse(await bytes()).data, request = sent.requests.find(r => r.sender_id === 'user_cimoa' && r.recipient_id === 'user_zane')
  assert.equal(request.text, 'Coffee after class?'); assert.equal(sent.coin_transactions.filter(t => t.related_id === request.request_id && t.amount === -10).length, 1)
  check('Only explicit fee confirmation persists/sends; result title stays Introduction sent with a Done return button')
  await click('reqSent.doneSent.click.1'); await page.getByRole('button', { name: 'Waiting for reply', exact: true }).waitFor()
  assert.equal(await page.locator('.discover-send').getAttribute('aria-disabled'), 'true'); await page.locator('.discover-send').evaluate(e => e.click())
  await click('photo.expand.click.1'); await page.locator('.expanded-send').waitFor(); assert.equal(await page.locator('.expanded-send').innerText(), 'Waiting for reply'); assert.equal(await page.locator('.expanded-send').getAttribute('aria-disabled'), 'true')
  await page.reload(); await page.getByRole('button', { name: 'Waiting for reply', exact: true }).waitFor(); await shot('waiting-profile')
  check('Pending outgoing introduction is grey/inert on both deck and profile, including refresh')
  const recipient = clone_data(sent)
  recipient.accounts.push({ ...clone_data(recipient.accounts[0]), account_id: 'account_zane_test', user_id: 'user_zane', email: 'zane@campus.test' })
  await install(await reauthenticate(recipient, 'zane@campus.test')); await open(`/pages/connections/received?request_id=${request.request_id}`)
  await page.locator('.connection-received-page').waitFor(); await click('reqReceived.accept.click.1'); await page.locator('.dialog__confirm:visible').click(); await page.locator('.connection-accepted-page').waitFor()
  const accepted = JSON.parse(await bytes()).data, sender = await reauthenticate(accepted, 'cimoa@connect.edu')
  const connection = sender.conversations.find(c => c.kind === 'direct' && c.participant_ids.includes('user_zane') && c.participant_ids.includes('user_cimoa'))
  assert.ok(connection); assert.equal(sender.requests.find(r => r.request_id === request.request_id).status, 'accepted')
  await install(sender); await open('/pages/discover/index'); await page.getByRole('button', { name: 'Chat', exact: true }).waitFor(); await click('photo.sayHi.click.1')
  await page.locator('.direct-chat-page').waitFor(); assert.match(page.url(), new RegExp(connection.conversation_id))
  await open('/pages/discover/profile?user_id=user_zane'); await page.getByRole('button', { name: 'Chat', exact: true }).waitFor(); await shot('chat-profile'); await click('expanded.sayHi.click.1'); await page.locator('.direct-chat-page').waitFor(); assert.match(page.url(), new RegExp(connection.conversation_id))
  check('Recipient explicitly accepts through UI; sender deck/profile both become Chat and open the same real conversation')
  fs.writeFileSync(path.join(folder, 'native-fixtures.json'), JSON.stringify({ baseline, sender, conversation_id: connection.conversation_id, request_id: request.request_id }, null, 2) + '\n')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) {
  report.failure = String(error.stack || error)
  if (page && !page.isClosed()) { report.failure_state = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 2000) })); await page.screenshot({ path: path.join(folder, 'failure-browser.png') }) }
  throw error
} finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
