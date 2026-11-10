import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { organizer_block_fixture } from './lib/organizer-block-fixture.mjs'
import { serve_h5, context_for, set_safe_area } from './lib/pixel-acceptance.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(a => a.startsWith('--phase='))?.slice(8) || 'detail', folder = path.resolve('docs/evidence/organizer-block')
// More no longer offers a new organizer block; retain coverage of existing blocks.
const fixture = organizer_block_fixture(true), report = { result: 'failed', phase, checks: [], errors: [], visual_acceptance: 'pending' }
let server, browser
try {
  fs.mkdirSync(folder, { recursive: true }); server = await serve_h5(); report.server_pid = server.pid; console.log(`Temporary organizer preview PID ${server.pid}: ${server.origin}`)
    fs.writeFileSync(path.join(folder, 'native-fixture.json'), JSON.stringify(organizer_block_fixture(true), null, 2) + '\n')
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  const context = await context_for(browser, 'cimoa_app_state_v2', fixture.data), page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => report.errors.push(e.message))
  await page.clock.setFixedTime(fixture.now)
  let version = 0
  const go = route => page.goto(server.origin + '/?organizer=' + phase + '&document=' + ++version + '#' + route), click = id => page.locator(`[data-interaction="${id}"]:visible`).first().click()
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data), raw = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const idle = () => page.locator('.event-loading:visible,.loading:visible').waitFor({ state: 'hidden' })
  const check = text => { report.checks.push(text); console.log('PASS ' + text) }
  const shot = async name => { await set_safe_area(page, 54, 0); await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }); await page.screenshot({ path: path.join(folder, name + '.png') }) }
  if (phase === 'detail') {
    await go('/pages/events/detail?event_id=event_picnic'); await page.locator('.event-detail-host-name').waitFor(); const before = await raw()
    await click('evDetail.openEventMore.click.1'); await page.locator('.event-report-page').waitFor(); assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(await raw(), before)
    await click('evReport.goBack.click.1'); await page.locator('.event-detail-page:visible').waitFor(); assert.equal(await raw(), before)
    const blocked = await state(); assert.deepEqual(blocked.event_preferences[0].blocked_organizer_ids, ['organizer_hkust'])
    const prior = JSON.parse(before).data; for (const key of ['memberships', 'messages', 'conversations', 'relationships', 'coin_transactions', 'blocked_users', 'reports']) assert.deepEqual(blocked[key], prior[key])
    check('More directly opens Report event; cancelling preserves the existing organizer block, joined entities and personal blocks')
    await go('/pages/events/index'); await page.locator('.events-header').waitFor(); assert.equal(await page.locator('.event-card[data-event-id="event_picnic"]').count(), 0); await page.locator('.event-card[data-event-id="event_other"]').waitFor()
    await click('events.openMyEvents.click.1'); await page.getByText('Sunset Picnic', { exact: true }).waitFor()
    await go('/pages/events/detail?event_id=event_picnic'); await click('evDetail.openGroup.click.1'); await page.locator('.event-group-composer').waitFor(); await idle(); assert.match(await page.locator('.event-group-messages').innerText(), /I’ll bring fruit!/)
    await page.reload(); await page.locator('.event-group-composer').waitFor(); await idle(); assert.deepEqual((await state()).memberships, prior.memberships)
    await shot('joined-group-browser'); check('Fresh recommendation feed hides the institution while My Events, exact group navigation and refreshed group content remain available')
  } else if (phase === 'settings') {
    await go('/pages/settings/blocked'); await page.getByRole('button', { name: 'Unblock HKUST Student Union', exact: true }).waitFor(); const before = await raw()
    assert.equal(await page.getByRole('button', { name: `Unblock ${fixture.data.users.find(u => u.user_id === 'user_jordan').user_name}`, exact: true }).count(), 1)
    await shot('blocked-organizers-browser'); await page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(page, 62, 34); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.setViewportSize({ width: 393, height: 852 }); await set_safe_area(page, 54, 0)
    await click('blockedList.organizer.unblock.click.1'); await page.getByRole('dialog', { name: 'Unblock HKUST Student Union?' }).waitFor(); await click('unblockOpen.closeUnblock.click.2'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(await raw(), before)
    check('Settings separates institutional and personal blocks; cancellation leaves both untouched')
    await click('blockedList.organizer.unblock.click.1')
    await page.evaluate(() => { window.__saveStorage = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'cimoa_app_state_v2') throw new DOMException('Full', 'QuotaExceededError'); return window.__saveStorage.call(this, key, value) } })
    await click('unblockOpen.confirmUnblock.click.1'); await page.getByRole('dialog').getByRole('alert').waitFor(); await idle(); assert.equal(await raw(), before)
    await page.evaluate(() => { Storage.prototype.setItem = window.__saveStorage; delete window.__saveStorage })
    check('Failed organizer Unblock remains selected and retryable, with the persisted block and joined data unchanged')
    await click('unblockOpen.confirmUnblock.click.1'); await page.locator('.loading:visible').waitFor(); assert.equal(await raw(), before); await idle()
    await page.getByRole('button', { name: 'Unblock HKUST Student Union', exact: true }).waitFor({ state: 'hidden' }); await page.reload(); await page.locator('.settings-blocked-page').waitFor(); assert.equal(await page.locator('.blocked-organizer-card').count(), 0)
    const saved = await state(), prior = JSON.parse(before).data; assert.deepEqual(saved.event_preferences[0].blocked_organizer_ids, [])
    for (const key of ['memberships', 'messages', 'conversations', 'relationships', 'coin_transactions', 'blocked_users', 'reports']) assert.deepEqual(saved[key], prior[key])
    await go('/pages/events/index'); await page.locator('.event-card[data-event-id="event_picnic"]').waitFor(); await page.locator('.event-card[data-event-id="event_other"]').waitFor()
    check('Confirmed Unblock persists after Loading and refresh, restores recommendations and does not alter membership, chat or personal blocks')
  } else throw Error('Unknown organizer test phase')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(folder, phase + '-browser.json'), JSON.stringify(report, null, 2) + '\n') }
