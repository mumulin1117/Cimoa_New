import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { create_scenario } from '../../src/stores/scenarios.js'

export async function test_home({ page, origin, evidence, check, context }) {
  const load = async (name, transform) => {
    const data = create_scenario(name); transform?.(data)
    await page.evaluate((data) => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), data)
    await page.goto(origin + '/#/pages/home/index', { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.home-title').waitFor()
    return data
  }
  const storage = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const rect = (selector) => page.locator(selector).first().evaluate((element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom } })
  const goal = (user) => page.locator(`#connection-${user} .goals-tag`)
  const panel = page.getByRole('dialog', { name: 'Connection goals' })
  const open = async (user) => { await goal(user).click(); await panel.waitFor({ state: 'visible' }); await page.waitForFunction(() => document.querySelector('.goals-panel--open') && getComputedStyle(document.querySelector('.goals-panel')).opacity === '1') }
  const close = async () => { await page.locator('.goals-mask').click({ position: { x: 2, y: 2 } }); await panel.waitFor({ state: 'hidden' }) }
  await load('default')
  assert.equal(await page.locator('.connection').count(), 3)
  assert.deepEqual(await page.locator('.connection-name').allTextContents(), ['Chloe Lin, 21', 'Liam Park, 22', 'Lina, 21'])
  assert.deepEqual(await page.locator('.university-tag').allTextContents(), ['HKUST', 'Stanford', 'HKU'])
  const avatar = await rect('.connection-avatar'), card = await rect('.connection'), header = await rect('.home-header'), bar = await rect('.tabbar')
  assert.ok(Math.abs(avatar.width - 78) < 1); assert.ok(Math.abs(card.width - 353) < 1)
  assert.ok(Math.abs(Number.parseFloat(await page.locator('.home-title').evaluate(el => getComputedStyle(el).fontSize)) - 38) < 1)
  assert.equal(await page.locator('.hero-card, .quote-card, .people-list, .event-card').count(), 0)
  assert.equal(await page.locator('.quota-badge').textContent(), '3')
  await page.screenshot({ path: path.join(evidence, 'home-default.png') })
  check('Home canonical cards, original structure, 78 avatar, 353 card, 38 title and quota badge', { header, card, avatar, bar })
  const before = await storage()
  for (const [user, expected] of [['user_chloe','New friends'], ['user_liam','Activity Buddies'], ['user_lina','New friends']]) {
    await open(user); assert.ok((await panel.textContent()).includes(expected)); assert.equal(await page.locator('.home-error').count(), 0)
    await panel.locator('.goal-label').first().click(); assert.equal(await panel.isVisible(), true)
    if (user === 'user_chloe') { assert.equal(await panel.locator('.goal-row').count(), 5); await page.screenshot({ path: path.join(evidence, 'home-goals.png') }) }
    const p = await rect('.goals-panel'); assert.ok(p.x >= 0 && p.x + p.width <= 393 && p.bottom <= bar.y)
    await close(); await open(user); await close()
  }
  assert.equal(await storage(), before)
  check('all goals are Store-backed; first/repeated popovers, no bubbling, outside close, bounds and no writes')
  const destinations = {
    'home.openMe.click.1': '/pages/profile/index', 'home.startAutoMatch.click.1': '/pages/auto-match/index',
    'home.openMaya.click.1': '/pages/messages/chat?conversation_id=conversation_chloe', 'home.openLiam.click.1': '/pages/auto-match/found?match_id=match_liam', 'home.openJordan.click.1': '/pages/connections/received?request_id=request_lina',
  }
  for (const [id, url] of Object.entries(destinations)) {
    const entry = page.locator(`[data-interaction="${id}"]`)
    assert.equal(await entry.getAttribute('data-target'), url)
    await entry.click(); assert.match(await page.locator('.home-error').textContent(), /not been restored/)
    assert.equal(await page.locator('.main-tab-frame').getAttribute('data-page-depth'), '1')
    assert.equal(await storage(), before)
  }
  check('five deferred dependencies validate exact entity destinations and fail explicitly; no fake navigation or writes')
  await load('home_empty')
  assert.match(await page.locator('.home-empty').textContent(), /Your new connections will appear here/)
  await page.getByRole('button', { name: 'Explore People', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.tab[aria-current="page"]')?.getAttribute('aria-label') === 'Discover')
  assert.equal(await page.locator('.main-tab-frame').getAttribute('data-page-depth'), '1')
  await page.getByRole('button', { name: 'Home', exact: true }).click(); await page.locator('.home-empty').waitFor()
  await page.locator('.page-transition').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
  assert.equal(await page.locator('.main-skeleton').count(), 0)
  await page.screenshot({ path: path.join(evidence, 'home-empty.png') })
  check('empty CTA really replaces Discover; returning preserves empty data and consumes no skeleton')
  await load('home_long'); assert.equal(await page.locator('.connection').count(), 15)
  await open('user_chloe'); assert.match(await panel.textContent(), /longer, scenic route/)
  const p = await rect('.goals-panel'); assert.ok(p.bottom <= (await rect('.tabbar')).y)
  await page.locator('.main-tab-scroll .uni-scroll-view-scrollbar-hidden').first().evaluate(el => { el.scrollTop = el.scrollHeight })
  await panel.waitFor({ state: 'hidden' })
  const last = await rect('.connection:last-child'); assert.ok(last.bottom <= (await rect('.tabbar')).y)
  assert.deepEqual(await rect('.home-header'), header); assert.deepEqual(await rect('.tabbar'), bar)
  await page.screenshot({ path: path.join(evidence, 'home-long.png') })
  check('long names and goals wrap; long list scrolls, closes popover and keeps fixed header and tabbar')
  await load('missing_avatar'); assert.equal(await page.locator('#connection-user_chloe .avatar-fallback').count(), 1)
  check('missing avatar uses neutral source icon, not another person')
  const media_url = 'data:text/javascript;base64,' + Buffer.from(fs.readFileSync('src/utils/mediaRepository.js', 'utf8')).toString('base64')
  const photo = await page.evaluate(async url => { const { media_repository } = await import(url); const blob = await (await fetch('/static/assets/head/maya-av.png')).blob(); await media_repository.put('home_avatar', blob); return { size: blob.size, mime: blob.type } }, media_url)
  await load('default', data => {
    data.users[1].avatar_url = 'indexeddb://home_avatar'
    data.media_files.push({ media_id: 'home_avatar', owner_user_id: data.users[1].user_id, kind: 'image', media_url: 'indexeddb://home_avatar', byte_size: photo.size, mime: photo.mime, created_at: Date.now() })
  })
  await page.waitForFunction(() => document.querySelector('#connection-user_chloe img')?.src.startsWith('blob:'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => { const img = document.querySelector('#connection-user_chloe img'); return img?.src.startsWith('blob:') && img.naturalWidth > 0 })
  check('real saved avatar Blob resolves to a decoded object URL again after refresh')
  await load('quota_used'); assert.equal(await page.locator('.coin-badge').count(), 1); assert.equal(await page.locator('.quota-badge').count(), 0)
  const quota_data = await storage(); await page.reload({ waitUntil: 'networkidle' }); assert.equal(await storage(), quota_data); assert.equal(await page.locator('.coin-badge').count(), 1)
  check('exhausted quota uses local coin image and survives refresh')
  for (const status of ['searching','paused','found','waiting']) {
    const data = await load(`match_${status}`)
    assert.equal(await page.locator('.match-status').getAttribute('data-target'), `/pages/auto-match/${status}?match_id=match_liam`)
    if (status === 'waiting') assert.match(await page.locator('.match-status-title').textContent(), /Liam Park/)
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(JSON.parse(await storage()).data.match_sessions[0].expires_at, data.match_sessions[0].expires_at)
  }
  check('four real matching states use the same match ID and preserve persisted deadlines on refresh')
  await load('request_accepted'); assert.match(await page.locator('#connection-user_lina .connection-status').textContent(), /Connected/)
  await load('blocked'); assert.equal(await page.locator('#connection-user_chloe').count(), 0)
  check('accepted request and blocked-user fixtures synchronize Home through shared selectors')
  await page.evaluate(() => localStorage.setItem('cimoa_app_state_v2', '{corrupt'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.home-read-error').waitFor(); assert.equal(await page.locator('.connection').count(), 0)
  assert.equal(await page.locator('.coin-badge, .quota-badge').count(), 0)
  await page.getByRole('button', { name: 'Retry', exact: true }).click(); assert.equal(await storage(), '{corrupt')
  await page.screenshot({ path: path.join(evidence, 'home-error.png') })
  check('corrupt storage shows retryable error, never empty success or overwrite')
  await load('home_long')
  await page.setViewportSize({ width: 320, height: 568 })
  // uni-h5 debounces its resize lifecycle by 50ms; finish that lifecycle before opening.
  await page.waitForTimeout(100)
  await open('user_chloe')
  const narrow_panel = await rect('.goals-panel'), narrow_bar = await rect('.tabbar')
  assert.ok(narrow_panel.x >= 0 && narrow_panel.x + narrow_panel.width <= 320 && narrow_panel.bottom <= narrow_bar.y)
  await page.screenshot({ path: path.join(evidence, 'home-narrow.png') })
  await page.setViewportSize({ width: 393, height: 852 }); await panel.waitFor({ state: 'hidden' })
  check('320 x 568 long-goal panel stays in viewport and closes on viewport change')
  const clock_page = await context.newPage()
  const midnight = Date.UTC(2026, 9, 14), quota = create_scenario('quota_used', midnight - 1000)
  await clock_page.clock.install({ time: new Date(midnight - 1000) })
  await clock_page.addInitScript(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), quota)
  await clock_page.goto(origin + '/#/pages/home/index', { waitUntil: 'domcontentloaded' })
  await clock_page.locator('.coin-badge').waitFor()
  await clock_page.clock.fastForward(2000)
  await clock_page.getByLabel('3 free matches remaining', { exact: true }).waitFor()
  assert.equal(await clock_page.locator('.quota-badge').textContent(), '3')
  const unchanged = await clock_page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.match_quota)
  assert.deepEqual(unchanged, quota.match_quota)
  await clock_page.close()
  check('Home badge resets across UTC midnight without navigation, balance changes or quota-history writes')
  await load('default')
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
  await page.screenshot({ path: path.join(evidence, 'home-safe-area.png') })
  // No native host claims: this is a browser viewport/bridge inspection only.
  check('safe area browser injection screenshot recorded; native WKWebView remains deferred')
}
