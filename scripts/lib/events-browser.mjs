import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { create_scenario } from '../../src/stores/scenarios.js'

export async function test_events({ page, origin, evidence, check }) {
  const now = Date.UTC(2026, 9, 13, 1)
  await page.clock.setFixedTime(new Date(now))
  const load = async transform => {
    const data = create_scenario('default', now); transform?.(data)
    await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), data)
    await page.goto(origin + '/#/pages/events/index', { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('.events-header').waitFor()
  }
  const storage = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const data = async () => JSON.parse(await storage()).data
  const rect = selector => page.locator(selector).first().evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom } })
  const shot = name => page.screenshot({ path: path.join(evidence, `events-${name}.png`) })
  const entry = id => page.locator(`[data-interaction="${id}"]`).first()
  const picnic = () => page.locator('[data-event-id="event_picnic"]')
  const settle = () => page.locator('.event-loading').waitFor({ state: 'hidden' })
  const open_settled = async () => {
    await page.locator('.event-dialog--open').waitFor()
    await page.locator('.event-dialog:visible .event-dialog-panel').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)))
  }
  const close = async () => { await page.getByRole('button', { name: 'Not now', exact: true }).click(); await page.locator('.event-dialog:visible').waitFor({ state: 'hidden' }) }
  await load(); await picnic().locator('.profile-photo[data-media-status="ready"]').waitFor()
  assert.equal(await page.locator('.event-title').first().textContent(), 'Sunset Picnic')
  assert.equal(await picnic().locator('.event-info').first().textContent(), 'Today · 5:30 PM')
  const card = await rect('.event-card'), cover = await rect('.event-cover'), chip = await rect('.events-chip'), bar = await rect('.tabbar')
  assert.ok(Math.abs(card.width - 309) < 1, JSON.stringify(card)); assert.ok(Math.abs(cover.height - 214) < 1)
  assert.ok(Math.abs(chip.height - 52) < 1); assert.equal(await page.locator('.page-transition').evaluate(el => getComputedStyle(el).animationDuration), '0.26s')
  assert.equal(await picnic().locator('.event-avatar').count(), 3); assert.match(await picnic().locator('.event-count').textContent(), /3 going · 17 spaces left of 20/)
  await shot('default'); check('Events source carousel geometry, 260ms transition, actual participants and local covers', { card, cover, chip, bar })

  const before = await storage()
  for (const [id, target] of [['events.openMe.click.1', '/pages/profile/index'], ['events.openMyEvents.click.1', '/pages/events/upcoming'], ['events.openParticipants.click.1', '/pages/events/participants?event_id=event_picnic']]) {
    assert.equal(await entry(id).getAttribute('data-target'), target); await entry(id).click(); assert.match(await page.locator('.events-feedback').textContent(), /not been restored/)
  }
  await entry('events.openEvent.click.1').click(); assert.match(await page.locator('.events-feedback').textContent(), /not been restored/)
  await entry('events.openEvent.click.2').click(); assert.equal(await storage(), before)
  check('profile/My Events/detail/participants gates preserve entity IDs and do not autojoin')

  await entry('events.evJoinTap.click.1').click(); await open_settled()
  const panel = await rect('.event-dialog:visible .event-dialog-panel')
  await shot('join-confirm'); assert.ok(panel.bottom <= bar.y, JSON.stringify({ panel, bar })); assert.ok(panel.height > 350, JSON.stringify(panel))
  assert.equal(await storage(), before); await shot('join-confirm'); await close()
  await entry('events.evJoinTap.click.1').click(); await page.locator('.event-dialog--open').waitFor()
  await page.getByRole('button', { name: 'Confirm join', exact: true }).click()
  await page.locator('.event-loading').waitFor({ state: 'visible' }); assert.equal(await storage(), before)
  await settle(); await page.locator('.event-dialog:visible').waitFor({ state: 'hidden' })
  assert.equal(await picnic().locator('.event-join').textContent(), 'Joined'); assert.match(await picnic().locator('.event-count').textContent(), /4 going · 16 spaces/)
  assert.match(await page.locator('.events-feedback').textContent(), /place is saved.*not been restored/)
  assert.equal((await data()).memberships.filter(m => m.event_id === 'event_picnic' && m.user_id === 'user_cimoa').length, 1)
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await picnic().locator('.event-join').textContent(), 'Joined')
  await entry('events.openGroup.click.1').click(); assert.match(await page.locator('.events-feedback').textContent(), /not been restored/)
  assert.equal(await entry('events.openGroup.click.1').getAttribute('data-target'), '/pages/events/group?event_id=event_picnic&conversation_id=group_picnic')
  await shot('joined'); check('join confirmation repeats, 500ms pre-write Loading, unique membership, refresh and honest deferred success page', { panel })

  await entry('events.manageAttendance.click.1').click(); await open_settled(); await shot('cancel-confirm')
  const joined_disk = await storage()
  await page.getByRole('button', { name: 'Keep my spot', exact: true }).click(); await page.locator('.event-dialog:visible').waitFor({ state: 'hidden' }); assert.equal(await storage(), joined_disk)
  await entry('events.manageAttendance.click.1').click(); await page.locator('.event-dialog--open').waitFor()
  await page.getByRole('button', { name: 'Cancel attendance', exact: true }).click(); await page.locator('.event-loading').waitFor({ state: 'visible' }); assert.equal(await storage(), joined_disk)
  await settle(); await page.locator('.event-dialog:visible').waitFor({ state: 'hidden' })
  assert.equal(await picnic().locator('.event-join').textContent(), 'Join event'); assert.equal(await picnic().locator('.event-manage').count(), 0)
  await page.reload({ waitUntil: 'networkidle' }); assert.match(await picnic().locator('.event-count').textContent(), /3 going · 17 spaces/)
  check('keep spot is read-only; cancel restores capacity and group access state through refresh')

  for (const [label, expected] of [['This week','Rooftop Film Night'], ['My campus','HKUST Night Market'], ['Today','Sunset Picnic']]) {
    const before_filter = await storage(); await page.getByRole('button', { name: label, exact: true }).click(); await page.locator('.event-loading').waitFor({ state: 'visible' }); assert.equal(await storage(), before_filter)
    await settle(); assert.equal(await page.locator('.event-title').first().textContent(), expected)
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('.events-chip--active').textContent(), label)
  }
  const horizontal = await page.locator('.events-carousel .uni-scroll-view-scrollbar-hidden').evaluate(el => { el.scrollLeft = 321; return el.scrollLeft })
  assert.ok(horizontal > 0); assert.deepEqual(await rect('.tabbar'), bar)
  await page.locator('[data-event-id="event_mic"] .event-join').click(); await page.locator('.event-dialog--open').waitFor()
  assert.equal(await page.locator('.event-dialog:visible .event-dialog-title').textContent(), 'Open Mic Night'); await close()
  check('three persisted real filters, horizontal snap/fixed navigation and exact second-card join intent')

  await load(); await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'cimoa_app_state_v2') throw Error('Fixture storage full'); return original.call(this, key, value) } })
  const failed_before = await storage(); await entry('events.evJoinTap.click.1').click(); await page.locator('.event-dialog--open').waitFor(); await page.getByRole('button', { name: 'Confirm join', exact: true }).click(); await settle()
  await page.locator('.event-dialog:visible .event-dialog-error').waitFor(); assert.equal(await storage(), failed_before); assert.equal(await picnic().locator('.event-join').textContent(), 'Join event'); await shot('write-error'); await close()
  await page.getByRole('button', { name: 'This week', exact: true }).click(); await settle(); assert.equal(await page.locator('.events-chip--active').textContent(), 'Today'); assert.equal(await storage(), failed_before)
  await page.reload({ waitUntil: 'networkidle' }); check('storage failures preserve membership, filter and retryable dialog without false success')

  await load(d => { d.events.forEach(e => { e.starts_at = now - 7200000; e.ends_at = now - 1 }) }); await page.locator('.events-empty').waitFor(); await shot('empty')
  await load(d => { d.events[0].capacity = 3 }); await entry('events.evJoinTap.click.1').click(); assert.match(await page.locator('.events-feedback').textContent(), /full/)
  await load(d => { d.users[0].verification_status = 'pending' }); await entry('events.evJoinTap.click.1').click(); assert.match(await page.locator('.events-feedback').textContent(), /verification/)
  await load(d => { d.session.expires_at = now - 1 }); assert.match(await page.locator('.events-state').textContent(), /session/)
  check('real empty/ended, capacity and unverified/session errors never open a false success flow')

  await load(d => { d.events[0].image_url = '/static/assets/img/test-unavailable.png' })
  await picnic().locator('.profile-photo[data-media-status="error"]').waitFor()
  const photo_before = await storage(); await shot('photo-error')
  await page.route('**/test-unavailable.png', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync('static/assets/img/event-picnic.png') }))
  await picnic().getByRole('button', { name: 'Retry photo', exact: true }).click(); await picnic().locator('.profile-photo[data-media-status="ready"]').waitFor()
  assert.equal(await storage(), photo_before); await page.unroute('**/test-unavailable.png')
  await load(d => { d.events[0].image_url = '' }); await picnic().locator('.profile-photo[data-media-status="empty"]').waitFor()
  check('missing/failed cover is honest; retry loads the same entity photo without navigation or storage writes')
  await page.evaluate(() => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data: { schema_version: 999 } })))
  await page.reload({ waitUntil: 'networkidle' }); const corrupt = await storage(); await shot('read-error')
  await page.getByRole('button', { name: 'Retry', exact: true }).click(); assert.equal(await storage(), corrupt)
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', now))
  await page.getByRole('button', { name: 'Retry', exact: true }).click(); await picnic().waitFor()
  check('corrupt storage is not overwritten; Retry rehydrates a repaired snapshot')

  await load(d => { d.events[0].title = 'A very long campus event title '.repeat(5); d.events[0].location = 'Long campus address '.repeat(8) })
  await page.setViewportSize({ width: 320, height: 640 })
  await page.waitForFunction(() => Math.abs(document.querySelector('.events-chip').getBoundingClientRect().height - 52 * innerWidth / 393) < 1)
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
  const header = await rect('.events-header'), safe_bar = await rect('.tabbar')
  const vertical = await page.locator('.main-tab-scroll .uni-scroll-view-scrollbar-hidden').first().evaluate(el => { el.scrollTop = el.scrollHeight; return { offset: el.scrollTop, width: el.clientWidth, full: el.scrollWidth } })
  assert.ok(vertical.offset > 0); assert.ok(vertical.full <= vertical.width + 1); assert.deepEqual(await rect('.events-header'), header); assert.deepEqual(await rect('.tabbar'), safe_bar)
  await shot('long-safe-area'); await picnic().locator('.event-join').click(); await page.locator('.event-dialog--open').waitFor()
  await open_settled(); const long_panel = await rect('.event-dialog:visible .event-dialog-panel'); assert.ok(long_panel.y >= 59); assert.ok(long_panel.bottom <= safe_bar.y)
  const inner_scroll = await page.locator('.event-dialog:visible .uni-scroll-view-scrollbar-hidden').evaluate(el => { el.scrollTop = el.scrollHeight; return { offset: el.scrollTop, height: el.clientHeight, full: el.scrollHeight } })
  assert.ok(inner_scroll.offset > 0, JSON.stringify(inner_scroll))
  const cancel_button = await rect('.event-dialog:visible .event-dialog-secondary')
  assert.ok(cancel_button.y >= long_panel.y && cancel_button.bottom <= long_panel.bottom, JSON.stringify({ cancel_button, long_panel }))
  await shot('long-confirm'); await close(); await page.setViewportSize({ width: 393, height: 852 })
  check('long content/narrow viewport scrolls once; fixed header/tabbar and Sheet respect safe-area injection (not native evidence)', { vertical, long_panel, inner_scroll, cancel_button })

  await load(); const clean_before = await storage()
  await entry('events.evJoinTap.click.1').click(); await page.locator('.event-dialog--open').waitFor(); await page.getByRole('button', { name: 'Confirm join', exact: true }).click()
  await page.evaluate(() => { location.hash = '#/pages/home/index' }); await page.locator('.home-header').waitFor()
  await page.waitForTimeout(600); assert.equal(await storage(), clean_before)
  check('navigation/unmount cancels delayed writes and removes Loading before mutation')
  await load(); await shot('final')
}
