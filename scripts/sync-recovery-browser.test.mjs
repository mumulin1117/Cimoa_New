import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { sync_recovery_fixture } from './lib/sync-recovery-fixture.mjs'
import { serve_h5, context_for, set_safe_area, write_comparison } from './lib/pixel-acceptance.mjs'
import { discover_reference } from './lib/discover-request-reference.mjs'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(a => a.startsWith('--phase='))?.slice(8) || 'profile', output = path.resolve('docs/evidence/sync-recovery')
const fixture = sync_recovery_fixture(), report = { phase, result: 'failed', checks: [], errors: [], visual_acceptance: 'pending', media_scope: fixture.scope }
const check = text => { report.checks.push(text); console.log('PASS ' + text) }
let server, browser
try {
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'native-fixture.json'), JSON.stringify(fixture, null, 2) + '\n')
  server = await serve_h5(); report.server_pid = server.pid; console.log(`Temporary sync preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const context = await context_for(browser, 'cimoa_app_state_v2', fixture.data), page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => report.errors.push(e.message))
  let document_id = 0
  const go = route => page.goto(server.origin + '/?sync=' + phase + '&document=' + ++document_id + '#'+ route), click = id => page.locator(`[data-interaction="${id}"]:visible`).first().click()
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const idle = () => page.waitForFunction(() => ![...document.querySelectorAll('.event-loading,.loading,.chat-action-loading')].some(element => element.getBoundingClientRect().height > 0))
  const shot = async name => { await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }); await page.screenshot({ path: path.join(output, name + '.png') }) }
  const block = async id => { await go('/pages/discover/profile?user_id=' + id); await click('expanded.openSafetyMini.click.1'); await click('sheetSafetyMini.openBlock.click.1'); await click('sheetBlock.confirmBlock.click.1'); await page.locator('.discover-header:visible').waitFor() }
  await go('/pages/profile/index'); await page.locator('.profile-name').waitFor()
  await page.evaluate(async items => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('cimoa_media_v2', 1); r.onupgradeneeded = () => r.result.createObjectStore('blobs'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const files = await Promise.all(items.map(async row => [row.media_id, row.base64 ? new Blob([Uint8Array.from(atob(row.base64), c => c.charCodeAt(0))], { type: row.mime }) : await (await fetch(row.source)).blob()]))
    await new Promise((resolve, reject) => { const t = db.transaction('blobs', 'readwrite'); for (const [id, blob] of files) t.objectStore('blobs').put(blob, id); t.oncomplete = resolve; t.onerror = () => reject(t.error) }); db.close()
  }, fixture.media)
  if (phase === 'profile') {
    await go('/pages/discover/profile?user_id=user_zane'); await page.locator('.expanded-photo .profile-photo[data-media-status="ready"]').waitFor(); await set_safe_area(page, 54, 0); const before = await state()
    await shot('profile-actual'); const ref = await context.newPage(); await ref.goto(server.origin)
    const contract = JSON.parse(fs.readFileSync('docs/ui-restoration/discover-request-profile/source-contract.json'))
    await ref.setContent(discover_reference('profile', contract, server.origin, fixture.data)); await ref.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())) }); await ref.screenshot({ path: path.join(output, 'profile-reference.png') }); await ref.close()
    const comparison = path.join(output, 'profile-comparison'); fs.mkdirSync(comparison, { recursive: true }); report.comparison = await write_comparison(browser, comparison, path.join(output, 'profile-reference.png'), path.join(output, 'profile-actual.png'))
    await click('expanded.nextPhoto.click.1'); await click('expanded.openGallery.click.2'); await page.getByRole('dialog').filter({ hasText: 'Photo 2 of 3' }).waitFor(); await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click(); assert.deepEqual(await state(), before)
    check('Original profile layout and three-photo gallery remain read-only, with independent HTML reference/actual/overlay/diff')
    await block('user_zane'); assert.ok((await state()).blocked_users.some(b => b.user_id === 'user_zane')); assert.equal(await page.locator('.discover-photo-card--front[data-user-id="user_zane"]').count(), 0)
    await go('/pages/discover/profile?user_id=user_zane'); await page.getByRole('alert').waitFor(); assert.equal(await page.locator('.expanded-heading').count(), 0)
    check('Blocking a deck profile changes the canonical deck and a refreshed old profile URL fails closed')
    await block('user_chloe'); const blocked = await state(); assert.equal(blocked.conversations.some(c => c.conversation_id === 'conversation_chloe'), false)
    await go('/pages/home/index'); await page.locator('.home-header').waitFor(); assert.equal(await page.locator('[data-user-id="user_chloe"]').count(), 0)
    await go('/pages/messages/chat?conversation_id=conversation_chloe'); await page.getByRole('alert').waitFor(); assert.equal(await page.locator('.chat-composer').count(), 0)
    check('Connected profile block removes shared Home/private conversation; a refreshed private URL exposes no composer')
    await go('/pages/settings/blocked'); await page.getByRole('button', { name: 'Unblock Chloe Lin', exact: true }).click(); await click('unblockOpen.confirmUnblock.click.1'); await idle()
    await go('/pages/discover/profile?user_id=user_chloe'); await page.locator('.expanded-heading').waitFor(); assert.equal(await page.locator('[data-interaction="expanded.sayHi.click.1"]').innerText(), 'Send shot')
    assert.equal((await state()).conversations.some(c => c.conversation_id === 'conversation_chloe'), false)
    check('Unblock survives refresh and restores allowed visibility only, never the old connection or Chat CTA')
  } else if (phase === 'chat') {
    await go('/pages/messages/chat?conversation_id=conversation_chloe'); await page.locator('.chat-composer').waitFor(); await idle(); await page.getByRole('button', { name: 'Play voice message', exact: true }).click(); await page.getByRole('button', { name: 'Pause voice message', exact: true }).waitFor(); await page.getByRole('button', { name: 'Pause voice message', exact: true }).click()
    await click('chat.image.open.click.1'); await page.locator('.chat-full-photo .profile-photo[data-media-status="ready"]').waitFor(); await click('chat.image.close.click.1')
    const before = await state(); await page.reload(); await page.locator('.chat-composer').waitFor(); await idle(); assert.deepEqual(await state(), before)
    await page.getByRole('button', { name: 'Play voice message', exact: true }).click(); await page.getByRole('button', { name: 'Pause voice message', exact: true }).waitFor(); await page.getByRole('button', { name: 'Pause voice message', exact: true }).click()
    check('Persisted direct image and real encoded audio resolve after a fresh document; reads do not duplicate messages or read receipts')
    await page.locator('uni-input[aria-label="Message"] input').fill('One message, shared everywhere.'); await click('chat.send.click.1'); await page.locator('.chat-send .chat-action-loading:visible').waitFor(); assert.equal((await state()).messages.some(m => m.body === 'One message, shared everywhere.'), false); await idle()
    const sent = await state(); assert.equal(sent.messages.filter(m => m.body === 'One message, shared everywhere.').length, 1)
    await click('chat.viewProfile.click.1'); await page.locator('.expanded-heading').waitFor(); assert.equal(await page.locator('[data-interaction="expanded.sayHi.click.1"]').innerText(), 'Chat'); await click('expanded.sayHi.click.1'); await page.locator('.chat-composer').waitFor(); assert.match(page.url(), /conversation_chloe/)
    await go('/pages/home/index'); await page.locator('.home-header').waitFor(); const home_card = page.locator('#connection-user_chloe'); assert.equal(await home_card.getAttribute('data-target'), '/pages/messages/chat?conversation_id=conversation_chloe'); await home_card.click(); await page.locator('.chat-composer:visible').waitFor(); await idle(); assert.equal(await page.getByText('One message, shared everywhere.', { exact: true }).count(), 1)
    await go('/pages/messages/chat?conversation_id=conversation_chloe'); await page.locator('.chat-composer').waitFor(); await idle(); await shot('chat-restored')
    check('One Loading/write synchronizes the message and same-conversation Chat CTA; the unchanged source Home card opens that exact conversation, return and refresh retain its ID')
  } else if (phase === 'group') {
    await go('/pages/events/detail?event_id=event_picnic'); await page.locator('[data-event-count]').waitFor(); assert.match(await page.locator('[data-event-count]').innerText(), /^3 of 20 going$/)
    await click('evDetail.openParticipantsList.click.1'); await page.locator('.event-person').first().waitFor(); assert.equal(await page.locator('.event-person').count(), 3); assert.equal(await page.getByText(fixture.data.users.find(u => u.user_id === 'user_zoe').user_name, { exact: true }).count(), 0)
    await go('/pages/events/group?event_id=event_picnic&conversation_id=group_picnic'); await page.locator('.event-group-composer').waitFor(); await idle(); assert.match(await page.locator('.event-group-heading').innerText(), /3 participants/)
    await click('eventGroup.media.preview.click.1'); await page.locator('.event-media-preview .profile-photo[data-media-status="ready"]').waitFor(); await click('eventGroup.media.close.click.2')
    await page.getByRole('button', { name: 'Play voice message', exact: true }).click(); await page.getByRole('button', { name: 'Pause voice message', exact: true }).waitFor(); await page.getByRole('button', { name: 'Pause voice message', exact: true }).click()
    const before = await state(); await page.reload(); await page.locator('.event-group-composer').waitFor(); await idle(); assert.deepEqual(await state(), before)
    check('Card/detail/participants/group agree on privacy-filtered attendance; image/audio metadata and read state survive reload')
    await block('user_chloe'); await go('/pages/events/group?event_id=event_picnic&conversation_id=group_picnic'); await page.locator('.event-group-composer').waitFor(); await idle()
    assert.match(await page.locator('.event-group-heading').innerText(), /2 participants/); assert.equal(await page.locator('[data-message-id="sync_group_audio"],[data-message-id="sync_group_image"],[data-message-id="group_message_0"]').count(), 0); assert.equal(await page.getByRole('button', { name: 'Play voice message', exact: true }).count(), 0)
    await page.reload(); await page.locator('.event-group-composer').waitFor(); await idle(); await shot('group-blocked-restored')
    check('Block hides both text and media from the group, updates its header and remains filtered after refresh without leaving the event')
    assert.ok((await state()).memberships.some(m => m.user_id === 'user_cimoa' && m.event_id === 'event_picnic' && m.status === 'joined'))
  } else throw Error('Unknown phase ' + phase)
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (cause) { report.failure = String(cause.stack || cause); throw cause }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, phase + '-browser.json'), JSON.stringify(report, null, 2) + '\n') }
