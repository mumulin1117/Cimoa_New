import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { create_scenario } from '../../src/stores/scenarios.js'
import { PROFILE_DEFERRED_ROUTES } from '../../src/utils/profileNavigation.js'

export async function test_profile({ page, origin, evidence, check }) {
  const now = Date.UTC(2026, 9, 13, 1)
  await page.clock.setFixedTime(new Date(now))
  const profile = page.locator('.secondary-page-frame:visible')
  const storage = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const entry = id => profile.locator(`[data-interaction="${id}"]`)
  const rect = selector => page.locator(selector).first().evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom } })
  const shot = name => page.screenshot({ path: path.join(evidence, `profile-${name}.png`) })
  const load = async (transform, route = 'profile', scenario = 'default') => {
    const data = create_scenario(scenario, now); transform?.(data)
    await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), data)
    await page.goto(`${origin}/#/pages/${route}/index`, { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator(`.${route}-header`).waitFor()
    return data
  }
  const ready = () => profile.locator('.profile-photo[data-media-status="ready"]').waitFor()
  const scroll_bottom = () => profile.locator('.secondary-page-scroll .uni-scroll-view-scrollbar-hidden').evaluate(el => { el.scrollTop = el.scrollHeight; return { top: el.scrollTop, width: el.clientWidth, fullWidth: el.scrollWidth, height: el.clientHeight } })
  await load(); await ready(); await page.evaluate(() => document.fonts.ready)
  assert.equal(await profile.locator('.profile-name').textContent(), 'Ethan, 22')
  assert.deepEqual(await profile.locator('.profile-tag').allTextContents(), ['HKUST', 'Interaction Design', 'INFP'])
  assert.deepEqual(await profile.locator('.interest-label').allTextContents(), ['Photography', 'Coffee', 'Live Music'])
  assert.equal(await profile.locator('.profile-balance').textContent(), '260 coins')
  assert.match(await profile.locator('.profile-avatar img').getAttribute('src'), /head\/me\.png/)
  assert.equal(await profile.locator('.profile-verified').count(), 1)
  const avatar = await rect('.profile-avatar'), toolbar = await rect('.profile-toolbar'), edit = await rect('.profile-edit'), card = await rect('.profile-card')
  for (const [actual, expected] of [[avatar.width, 120], [avatar.height, 120], [toolbar.height,48], [toolbar.y,4], [edit.height,48], [card.width,353]]) assert.ok(Math.abs(actual - expected) < 1, `${actual} != ${expected}`)
  assert.equal(await profile.locator('.page-transition').evaluate(el => getComputedStyle(el).animationDuration), '0.24s')
  assert.equal(await profile.locator('.profile-bio').evaluate(el => getComputedStyle(el).fontFamily), 'Caveat, cursive')
  assert.equal(await page.locator('.tabbar:visible, .main-skeleton:visible, .stats-row, .menu-list').count(), 0)
  await shot('default'); check('Profile source structure, canonical data, local images/Caveat, 120 avatar/48 toolbar/48 edit and no Tabbar', { avatar, toolbar, edit, card })

  const before = await storage()
  for (const [id, target] of [['profile.openAppSettings.click.1','/pages/settings/index'], ['profile.openEditBasic.click.1','/pages/profile/edit'], ['profile.openStore.click.1','/pages/coins/index'], ['profile.openProfilePreview.click.1','/pages/profile/preview']]) {
    assert.equal(await entry(id).getAttribute('data-target'), target); await entry(id).click()
    if (PROFILE_DEFERRED_ROUTES.includes(target)) assert.match(await page.locator('.brand-toast--error').textContent(), /not been restored/)
    else { await page.locator(target === '/pages/profile/preview' ? '.preview-name:visible' : target === '/pages/coins/index' ? '.coin-title:visible' : '.editor-title:visible').waitFor(); await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.locator('.profile-title:visible').waitFor() }
    assert.equal(await profile.getAttribute('data-page-depth'), '1'); assert.equal(await storage(), before)
    assert.equal(await page.locator('uni-toast, uni-modal, .app-loading:visible').count(), 0)
  }
  await shot('dependency-error'); check('all four exact child routes use current readiness; restored pages return, deferred routes fail honestly without writes')
  await entry('profile.goBack.click.1').click(); await page.locator('.home-header:visible').waitFor()
  assert.equal(await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth'), '1')
  check('direct Profile has no fake history and replaces Home on Back')

  for (const [route, id] of [['home','home.openMe.click.1'], ['discover','photo.openMe.click.1'], ['events','events.openMe.click.1']]) {
    await load(null, route, route === 'home' ? 'home_long' : 'default')
    if (route === 'events') { await page.getByRole('button', { name: 'This week', exact: true }).click(); await page.locator('.event-loading').waitFor({ state: 'hidden' }); await page.locator('.events-chip--active').filter({ hasText: 'This week' }).waitFor() }
    const scroller = page.locator('.main-tab-frame:visible .main-tab-scroll .uni-scroll-view-scrollbar-hidden').first()
    const offset = await scroller.evaluate(el => { el.scrollTop = 160; return el.scrollTop })
    const snapshot = await storage()
    for (let round = 0; round < 2; round++) {
      await page.locator(`[data-interaction="${id}"]`).dblclick(); await profile.waitFor()
      assert.equal(await profile.getAttribute('data-page-depth'), '2')
      assert.equal(await page.locator('.tabbar:visible, .main-skeleton:visible').count(), 0)
      await entry('profile.goBack.click.1').dblclick(); await page.locator(`.${route}-header:visible`).waitFor()
      assert.equal(await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth'), '1')
      assert.equal(await scroller.evaluate(el => el.scrollTop), offset)
      assert.equal(await page.locator('.main-skeleton:visible').count(), 0)
      assert.equal(await storage(), snapshot)
      if (route === 'events') assert.equal(await page.locator('.events-chip--active').textContent(), 'This week')
    }
  }
  check('Home/Discover/Events push+pop twice, double clicks stay stack2→1 and preserve scroll/filter/storage/skeleton consumption')

  await load(null, 'discover'); await page.locator('[data-interaction="photo.openMe.click.1"]').click(); await profile.waitFor()
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await profile.getAttribute('data-page-depth'), '1'); await ready()
  await entry('profile.goBack.click.1').click(); await page.locator('.home-header:visible').waitFor()
  check('refresh on pushed Profile restores data; absent in-memory origin safely falls back to Home')

  await load(d => { Object.assign(d.users[0], { age: null, university: '', major: '', mbti: '', bio: '', interest_ids: [], avatar_url: '', verification_status: 'pending' }); d.coin_transactions = [] })
  assert.equal(await profile.locator('.profile-name').textContent(), 'Ethan'); assert.equal(await profile.locator('.profile-verified').count(), 0)
  assert.equal(await profile.locator('.profile-photo[data-media-status="empty"]').count(), 1)
  assert.deepEqual(await profile.locator('.profile-tag').allTextContents(), ['University not shared', 'Major not shared', 'MBTI not shared'])
  assert.deepEqual(await profile.locator('.profile-empty').allTextContents(), ['No introduction yet.', 'No interests selected yet.'])
  assert.equal(await profile.locator('.profile-balance').textContent(), '0 coins'); await shot('empty')
  const empty = await storage(); await page.reload({ waitUntil: 'networkidle' }); assert.equal(await storage(), empty)
  check('empty fields, unverified and zero balance stay honest across refresh with no seed reset')

  await load(d => {
    Object.assign(d.users[0], { user_name: 'A very long current student name '.repeat(3), university: 'Hong Kong University of Science and Technology', major: 'Interdisciplinary Design and Environmental Studies', bio: 'Saved personal introduction. '.repeat(10), interest_ids: d.interests.map(i => i.item_id) })
  })
  await page.setViewportSize({ width: 320, height: 568 })
  await page.waitForFunction(() => Math.abs(document.querySelector('.profile-avatar').getBoundingClientRect().width - 120 * innerWidth / 393) < 1)
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
  const header = await rect('.profile-header'), scroll = await scroll_bottom()
  assert.ok(scroll.top > 0); assert.ok(scroll.fullWidth <= scroll.width + 1)
  assert.deepEqual(await rect('.profile-header'), header)
  assert.equal(await profile.locator('.safe-area').first().evaluate(el => el.getBoundingClientRect().height), 59)
  assert.equal(await profile.locator('.safe-area').last().evaluate(el => el.getBoundingClientRect().height), 34)
  const last = await rect('[data-interaction="profile.openProfilePreview.click.1"]'), viewport = await rect('.secondary-page-scroll')
  assert.ok(last.bottom <= viewport.bottom && last.y >= viewport.y)
  assert.ok(viewport.bottom <= 568 - 34 - 40 * 320 / 393 + 1)
  await shot('long-safe-area'); check('long data/17 interests and 320×568 scroll to last entry; header and both safe-area owners remain fixed', { header, scroll, last, viewport })
  await page.setViewportSize({ width: 393, height: 852 })

  await load(d => { d.users[0].avatar_url = '/static/assets/head/profile-unavailable.png' }); await profile.locator('[data-media-status="error"]').waitFor()
  const failed = await storage(); await shot('photo-error')
  await page.route('**/profile-unavailable.png', route => route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync('static/assets/head/me.png') }))
  await entry('profile.retryPhoto.click.1').click(); await ready(); assert.equal(await storage(), failed); await page.unroute('**/profile-unavailable.png')
  check('avatar request error is readable and retries the same entity without writing or opening another page')

  await page.clock.install({ time: new Date(now) })
  let held
  await page.route('**/static/assets/head/me.png', route => { held = route })
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', now))
  await page.reload({ waitUntil: 'domcontentloaded' }); await profile.locator('[data-media-status="loading"]').waitFor()
  await shot('photo-loading'); const loading_snapshot = await storage()
  await page.clock.fastForward(11000); await profile.locator('[data-media-status="error"]').waitFor()
  assert.equal(await storage(), loading_snapshot)
  await held?.abort(); await page.unroute('**/static/assets/head/me.png')
  await entry('profile.goBack.click.1').click(); await page.locator('.home-header:visible').waitFor()
  await page.clock.fastForward(11000); assert.equal(await page.locator('.secondary-page-frame').count(), 0)
  await page.clock.resume(); check('real pending image shows content-only Loading, times out at10s and leaving removes media UI/timer')

  await load()
  const media_url = 'data:text/javascript;base64,' + Buffer.from(fs.readFileSync('src/utils/mediaRepository.js', 'utf8')).toString('base64')
  const media = await page.evaluate(async url => { const { media_repository } = await import(url); const blob = await (await fetch('/static/assets/head/me.png')).blob(); await media_repository.put('profile_avatar_fixture', blob); return { size: blob.size, mime: blob.type } }, media_url)
  await load(d => { d.users[0].avatar_url = 'indexeddb://profile_avatar_fixture'; d.media_files.push({ media_id: 'profile_avatar_fixture', owner_user_id: d.users[0].user_id, kind: 'image', media_url: 'indexeddb://profile_avatar_fixture', byte_size: media.size, mime: media.mime, created_at: now }) })
  await ready(); await page.reload({ waitUntil: 'networkidle' }); await ready()
  assert.match(await profile.locator('.profile-avatar img').getAttribute('src'), /^blob:/)
  await page.evaluate(async url => { const { media_repository } = await import(url); await media_repository.delete('profile_avatar_fixture') }, media_url)
  await page.reload({ waitUntil: 'networkidle' }); await profile.locator('[data-media-status="error"]').waitFor()
  check('real IndexedDB portrait decodes after refresh; missing Blob is a truthful error not a replacement image')

  await load(d => { d.session.expires_at = now - 1 }); assert.match(await profile.locator('.profile-state').textContent(), /session has expired/)
  assert.equal(await profile.locator('.profile-avatar, .profile-interests, .profile-balance').count(), 0)
  await entry('profile.openAppSettings.click.1').click(); assert.match(await page.locator('.brand-toast--error').textContent(), /session/)
  check('expired session hides current-user business data and blocks child navigation')
  await page.evaluate(() => localStorage.setItem('cimoa_app_state_v2', '{corrupt'))
  await page.reload({ waitUntil: 'networkidle' }); await entry('profile.retry.click.1').click(); assert.equal(await storage(), '{corrupt')
  await shot('read-error')
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', now))
  await entry('profile.retry.click.1').click(); await ready(); assert.equal(await profile.locator('.profile-name').textContent(), 'Ethan, 22')
  check('corrupt snapshot is preserved, Retry rehydrates repaired data without fake empty success')
  await load(); await ready(); await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 })); await shot('safe-area')
}
