import assert from 'node:assert/strict'
import path from 'node:path'
import { create_scenario } from '../../src/stores/scenarios.js'
import { DISCOVER_PROFILE_IDS } from '../../src/stores/seed.js'

export async function test_discover({ page, origin, evidence, check }) {
  const load = async (name = 'default', transform) => {
    const data = create_scenario(name)
    transform?.(data)
    await page.evaluate((snapshot) => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data: snapshot })), data)
    await page.goto(origin + '/#/pages/discover/index', { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.discover-header').waitFor()
    return data
  }
  const front = () => page.locator('.discover-photo-card--front')
  const front_photo = () => front().locator('.profile-photo[data-media-status="ready"]')
  const rect = (selector) => page.locator(selector).first().evaluate((element) => {
    const value = element.getBoundingClientRect()
    return { x: value.x, y: value.y, width: value.width, height: value.height, bottom: value.bottom }
  })
  const shot = (name) => page.screenshot({ path: path.join(evidence, `discover-${name}.png`) })
  const fit = async () => page.evaluate(() => {
    const box = (selector) => { const value = document.querySelector(selector).getBoundingClientRect(); return { top: value.top, bottom: value.bottom, height: value.height } }
    const scroll = document.querySelector('.main-tab-scroll .uni-scroll-view-scrollbar-hidden')
    if (scroll) scroll.scrollTop = 500
    return { card: box('.discover-photo-card--front'), info: box('.discover-info'), viewport: box('.main-tab-scroll'), send: box('.discover-send'), tabbar: box('.tabbar'), scroll_top: scroll?.scrollTop || 0 }
  })
  const swipe = async (direction, ratio = 0.42, hold = false) => {
    const box = await front().boundingBox()
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + direction * box.width * ratio, start.y + box.height * 0.025, { steps: 8 })
    const transform = await front().evaluate((element) => getComputedStyle(element).transform)
    assert.notEqual(transform, 'none')
    if (hold) await shot('dragging')
    if (ratio < 0.24) await page.waitForTimeout(220)
    await page.mouse.up()
    await page.waitForTimeout(340)
  }

  await page.setViewportSize({ width: 393, height: 852 })
  await load()
  await front_photo().waitFor()
  assert.equal(await front().getAttribute('data-user-id'), 'user_zane')
  assert.equal(await page.locator('.discover-name').last().textContent(), 'Zane, 22')
  assert.deepEqual(await front().locator('.discover-tag').allTextContents(), ['HKUST', 'Engineering', 'ESTP'])
  assert.equal(await page.locator('.discover-photo-card').count(), 2)
  assert.equal(await page.locator('body').textContent().then((text) => /本地数据|模拟数据/.test(text)), false)
  const stored_ids = await page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.users.filter((row) => Number.isInteger(row.discover_order)).sort((a, b) => a.discover_order - b.discover_order).map((row) => row.user_id))
  assert.deepEqual(stored_ids.slice(0, 6), DISCOVER_PROFILE_IDS)
  assert.equal(stored_ids.length, 29)
  const source = await fit()
  assert.ok(Math.abs(source.card.height - 542) < 1, `393x852 source geometry: ${JSON.stringify(source)}`)
  assert.ok(source.card.bottom <= source.viewport.bottom + 1)
  assert.ok(source.info.bottom <= source.card.bottom + 1)
  assert.equal(source.scroll_top, 0)
  await shot('default')
  check('Discover renders the six Store profiles as a two-layer card deck with the source card geometry', source)

  const iphone_sizes = [[320, 568], [375, 667], [375, 812], [390, 844], [393, 852], [402, 874], [414, 896], [430, 932]]
  for (const [width, height] of iphone_sizes) {
    await page.setViewportSize({ width, height })
    const state = await fit()
    assert.ok(state.card.height > 0, `${width}x${height} card height`)
    assert.ok(state.card.top >= state.viewport.top - 1, `${width}x${height} card top`)
    assert.ok(state.card.bottom <= state.viewport.bottom + 1, `${width}x${height} card bottom`)
    assert.ok(state.info.bottom <= state.card.bottom + 1, `${width}x${height} card info`)
    assert.ok(state.send.bottom < state.tabbar.top, `${width}x${height} fixed CTA`)
    assert.equal(state.scroll_top, 0, `${width}x${height} vertical lock`)
  }
  await shot('iphone-430x932')
  await page.setViewportSize({ width: 320, height: 568 })
  await shot('iphone-320x568')
  const short_screen_ids = []
  for (let index = 0; index < DISCOVER_PROFILE_IDS.length; index++) {
    const state = await fit()
    short_screen_ids.push(await front().getAttribute('data-user-id'))
    assert.ok(state.info.bottom <= state.card.bottom + 1, `short-screen card ${index + 1} info`)
    assert.equal(state.scroll_top, 0, `short-screen card ${index + 1} vertical lock`)
    await swipe(-1)
  }
  assert.deepEqual(short_screen_ids, DISCOVER_PROFILE_IDS)
  check('one viewport contains the complete card on eight iPhone viewport sizes; the card shrinks without vertical browsing')

  await load()
  await page.setViewportSize({ width: 393, height: 852 })
  const initial_id = await front().getAttribute('data-user-id')
  await swipe(-1, 0.08, true)
  assert.equal(await front().getAttribute('data-user-id'), initial_id)
  await swipe(-1, 0.42)
  const after_left = await page.evaluate(() => {
    const element = document.querySelector('.discover-photo-card--front')
    return { user_id: element.dataset.userId, inline: element.getAttribute('style'), computed: getComputedStyle(element).transform, deck: { ...document.querySelector('.discover-deck').dataset } }
  })
  assert.equal(after_left.user_id, 'user_linden', `left dismissal state: ${JSON.stringify(after_left)}`)
  await swipe(1, 0.42)
  assert.equal(await front().getAttribute('data-user-id'), 'user_evan')
  assert.equal(await page.locator('.discover-photo-card--back').getAttribute('data-user-id'), 'user_coco')
  check('short drags spring back; left and right dismissals rotate the front card and lift the next card without writing business state')

  await load()
  const before = await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  assert.equal(await front().getAttribute('data-target'), '/pages/discover/profile?user_id=user_zane')
  await front().click()
  await page.locator('.expanded-profile-page').waitFor()
  assert.match(await page.locator('.expanded-heading').textContent(), /Zane, 22/)
  assert.equal(await page.locator('.expanded-dots > uni-view, .expanded-dots > div').count(), 3)
  assert.equal(await page.locator('.profile-voice-transcript').textContent(), "Hey, I'm Zane. I'm usually on the basketball court or out for a run, and I love a good weekend hike. The best part after a workout? Finding a cozy little place for a great meal. Got any hidden gems? Come tell me about them.")
  const audio_response = await page.request.get(origin + '/static/assets/discover/zane/voice-intro.mp3')
  assert.equal(audio_response.status(), 200)
  assert.match(audio_response.headers()['content-type'], /audio\/mpeg/)
  assert.ok((await audio_response.body()).length > 100000)
  const play = page.locator('[data-interaction="expanded.voiceIntroPlay.click.1"]')
  await play.click()
  await page.getByRole('button', { name: 'Pause voice message' }).waitFor()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Pause voice message' }).click()
  await page.locator('.expanded-photo-hit--next').click()
  await page.locator('.expanded-photo .profile-photo[data-media-status="ready"]').waitFor()
  assert.match(await page.locator('.expanded-photo .profile-photo img').getAttribute('src'), /discover\/zane\/photo-2\.jpg/)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.locator('.discover-header:visible').waitFor()
  await page.locator('.page-transition').evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
  assert.equal(await front().getAttribute('data-user-id'), 'user_zane')
  assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), before)
  await shot('returned-from-profile')
  check('card tap opens the same profile entity with three photos, exact voice copy and playable supplied audio; back restores the deck position')

  await swipe(-1)
  const after_return_swipe = await page.evaluate(() => ({ user_id: document.querySelector('.discover-photo-card--front').dataset.userId, deck: { ...document.querySelector('.discover-deck').dataset } }))
  assert.equal(after_return_swipe.user_id, 'user_linden', `post-return dismissal state: ${JSON.stringify(after_return_swipe)}`)
  assert.equal(await page.locator('.discover-send').getAttribute('data-target'), '/pages/discover/icebreaker/select?user_id=user_linden')
  await page.locator('.discover-send').click()
  await page.getByText('Say Hi to Linden', { exact: true }).waitFor()
  assert.deepEqual(await page.locator('[data-interaction="ibSelect.q.pick.click.1"]').allTextContents(), ['What song have you had on repeat lately?', 'Where is your favorite place to watch sunset?', 'What would you photograph on a free afternoon?'])
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.locator('.discover-header:visible').waitFor()
  await page.locator('.page-transition').evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
  assert.equal(await front().getAttribute('data-user-id'), 'user_linden')
  check('Send shot uses the currently visible user and their three Store-backed icebreakers, then returns to the same card')

  await load('discover_empty')
  assert.equal(await page.locator('.discover-photo-card').count(), 0)
  assert.equal(await page.locator('.discover-send').getAttribute('aria-disabled'), 'true')
  await shot('empty')
  await load('default', (data) => data.blocked_users.push({ block_id: 'block_zane_test', owner_user_id: 'user_cimoa', user_id: 'user_zane', created_at: Date.now() }))
  assert.equal(await front().getAttribute('data-user-id'), 'user_linden')
  check('empty state is truthful and blocking removes the same profile from the deck after refresh')

  await page.evaluate(() => localStorage.setItem('cimoa_app_state_v2', '{corrupt'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.discover-read-error').waitFor()
  assert.equal(await page.locator('.discover-photo-card').count(), 0)
  await load('session_expired')
  await page.locator('.discover-session-error').waitFor()
  assert.equal(await page.locator('.discover-photo-card').count(), 0)
  check('corrupt persistence and expired sessions never leak a profile card')

  await load()
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
  const safe = await fit()
  assert.ok(safe.card.bottom <= safe.viewport.bottom + 1)
  assert.ok(safe.send.bottom < safe.tabbar.top)
  assert.equal(safe.scroll_top, 0)
  await shot('safe-area')
  check('native safe-area injection keeps the card, CTA and Tabbar in separate fixed regions without enabling vertical browsing', safe)
}
