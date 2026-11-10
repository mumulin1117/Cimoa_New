import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { serve_h5, set_safe_area, write_comparison, close_to } from './lib/pixel-acceptance.mjs'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/discover-request-profile/voice-overlay-2026-10-20'), key = 'cimoa_app_state_v2'
const report = { result: 'failed', checks: [], errors: [] }, check = text => { report.checks.push(text); console.log('PASS ' + text) }
let server, browser
try {
  fs.mkdirSync(folder, { recursive: true }); server = await serve_h5(); report.server_pid = server.pid
  console.log(`Temporary Expanded preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } }), page = await context.newPage(); page.setDefaultTimeout(10000)
  await context.addInitScript(() => { const OriginalAudio = window.Audio; window.testAudio = []; window.Audio = function (...args) { const a = new OriginalAudio(...args); window.testAudio.push(a); return a } })
  page.on('pageerror', e => report.errors.push(e.message))
  await page.goto(server.origin)
  // Install before the profile module captures its timer dependency.
  await page.clock.install()
  const seed = create_scenario('default', Date.now()); fs.writeFileSync(path.join(folder, 'native-fixture.json'), JSON.stringify({ type: 'object', data: seed }, null, 2) + '\n')
  const load = async (data = seed, user = 'user_zane', media_status = 'ready') => {
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data })
    await page.goto(`${server.origin}/?overlay=${Date.now()}#/pages/discover/profile?user_id=${user}`)
    await page.locator(`.expanded-photo .profile-photo[data-media-status="${media_status}"]`).waitFor(); await set_safe_area(page, 54, 0)
    await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish() }); await page.waitForTimeout(100)
  }
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).click()
  const index = () => page.locator('.expanded-dots').evaluate(e => [...e.children].findIndex(c => c.classList.contains('active')))
  const source = () => page.locator('.expanded-photo img').getAttribute('src')
  const saved = () => page.evaluate(key => localStorage.getItem(key), key)
  await load(); const before = await saved()
  assert.equal(await page.locator('.profile-voice-intro').count(), 1); assert.equal(await page.locator('.expanded-photo-card > .profile-voice-intro').count(), 1); assert.equal(await page.locator('.expanded-song').count(), 0)
  report.geometry = await page.evaluate(() => { const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right } }; return { photo: box('.expanded-photo-card'), voice: box('.profile-voice-intro'), cover: box('.profile-voice-cover'), play: box('.profile-voice-play') } })
  const { photo, voice, cover, play } = report.geometry
  assert.ok(close_to(photo.y, 126) && close_to(photo.width, 353)); assert.ok(close_to(voice.x - photo.x, 14) && close_to(photo.right - voice.right, 14) && close_to(photo.bottom - voice.bottom, 12)); assert.ok(close_to(voice.height, 60) && close_to(cover.width, 44) && close_to(play.width, 44))
  await page.screenshot({ path: path.join(folder, 'actual-browser.png') })
  const reference_source = process.env.CIMOA_EXPANDED_REFERENCE || '/Users/linqian/Downloads/Discover ／ Profile ／ Expanded.png'
  if (fs.existsSync(reference_source)) {
    const sharp = require('/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')
    await sharp(reference_source).extract({ left: 0, top: 0, width: 786, height: 1704 }).resize(393, 852).toFile(path.join(folder, 'reference.png'))
    report.comparison = await write_comparison(browser, folder, path.join(folder, 'reference.png'), path.join(folder, 'actual-browser.png'))
    report.comparison_note = 'Supplied Chloe/song design versus approved actual-person voice variant; image/text/safe-area differences are intentional, not a whole-page zero-diff claim.'
  } else {
    report.comparison_note = `Visual comparison skipped because the optional reference is unavailable: ${reference_source}`
  }
  check('One voice strip overlays the photo with source 14/12px insets, 60px height and 44px thumbnail/play; no duplicate lower voice card')
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 200)))
  const clock_click = id => page.locator(`[data-interaction="${id}"]`).evaluate(e => e.click())
  await clock_click('expanded.nextPhoto.click.1'); const first = await index(); await page.clock.runFor(2999); assert.equal(await index(), first); await page.clock.runFor(1); assert.equal(await index(), (first + 1) % 3); await page.clock.runFor(6000); assert.equal(await index(), first)
  await clock_click('expanded.prevPhoto.click.1'); const manual = await index(); await page.clock.runFor(2900); await clock_click('expanded.prevPhoto.click.1'); const reset = await index(); assert.notEqual(manual, reset); await page.clock.runFor(2999); assert.equal(await index(), reset); await page.clock.runFor(1); assert.equal(await index(), (reset + 1) % 3)
  check('Exactly 3s advances/wraps; manual previous/next cancels the old deadline and grants a full 3s')
  await page.clock.resume()
  const audio_photo = await source()
  await click('expanded.voiceIntroPlay.click.1'); await page.waitForFunction(() => window.testAudio.some(a => !a.paused && a.currentTime > 0)); assert.equal(await page.getByRole('dialog').count(), 0)
  await page.waitForTimeout(3300); assert.notEqual(await source(), audio_photo); assert.equal(await page.evaluate(() => window.testAudio.some(a => !a.paused && a.currentTime > 2)), true); assert.equal(await page.locator('.profile-voice-play').getAttribute('aria-label'), 'Pause voice message'); await click('expanded.voiceIntroPlay.click.1'); await page.waitForFunction(() => document.querySelector('.profile-voice-play').getAttribute('aria-label') === 'Play voice message')
  check('Actual bundled voice continues across automatic photo changes and pauses from the overlay without opening gallery or changing entity')
  await click('expanded.openSafetyMini.click.1'); const paused = await source(); await page.waitForTimeout(3150); assert.equal(await source(), paused); await click('sheetSafetyMini.closeSheet.click.1')
  await page.locator('.expanded-photo').click({ position: { x: photo.width / 2, y: 80 } }); await page.getByRole('dialog', { name: 'Zane photo gallery' }).waitFor(); const gallery = await source(); await page.waitForTimeout(3100); assert.equal(await source(), gallery); await page.getByRole('dialog', { name: 'Zane photo gallery' }).getByRole('button', { name: 'Close', exact: true }).click()
  check('Safety sheet and gallery pause automatic switching; explicit photo controls remain usable')
  await click('expanded.voiceIntroPlay.click.1'); await page.waitForFunction(() => window.testAudio.some(a => !a.paused))
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) }); const hidden = await source(); await page.waitForTimeout(3100); assert.equal(await source(), hidden); assert.equal(await page.evaluate(() => window.testAudio.every(a => a.paused && !a.getAttribute('src'))), true)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')) }); await page.waitForTimeout(3100); assert.notEqual(await source(), hidden)
  check('Document visibility lifecycle cancels photo timer and destroys audio; resume starts a fresh cadence (synthetic lifecycle event, not OS background measurement)')
  await click('expanded.sayHi.click.1'); await page.locator('.ice-select-page').waitFor(); assert.equal(await page.evaluate(() => window.testAudio.every(a => a.paused && !a.getAttribute('src'))), true); await page.goBack(); await page.locator('.expanded-profile-page:visible').waitFor(); assert.equal(await saved(), before)
  await page.reload(); await page.locator('.expanded-profile-page').waitFor(); assert.equal(await index(), 0); assert.equal(await saved(), before)
  check('Send shot/Back and refresh preserve canonical identity/requests/storage; hidden detail releases audio and refresh resets only transient photo position')
  for (const width of [320, 375, 393, 402, 430]) { await page.setViewportSize({ width, height: width === 320 ? 568 : 852 }); await set_safe_area(page, 62, 34); assert.equal(await page.evaluate(() => { const p = document.querySelector('.profile-voice-play').getBoundingClientRect(), v = document.querySelector('.profile-voice-intro').getBoundingClientRect(); return document.documentElement.scrollWidth <= innerWidth && p.right <= v.right && p.left >= v.left }), true) }
  check('Narrow and large iPhone layouts keep voice controls within the photo with real safe-area budgets')
  await page.setViewportSize({ width: 393, height: 852 })
  const one = structuredClone(seed); const u = one.users.find(u => u.user_id === 'user_zane'); u.photo_ids = u.photo_ids.slice(0, 1); one.profile_photos = one.profile_photos.filter(p => p.user_id !== u.user_id || u.photo_ids.includes(p.photo_id)); await load(one); const single = await source(); await page.waitForTimeout(3100); assert.equal(await source(), single); assert.equal(await page.locator('.expanded-dots').count(), 0)
  const empty = structuredClone(seed); empty.users.find(u => u.user_id === 'user_zane').photo_ids = []; empty.profile_photos = empty.profile_photos.filter(p => p.user_id !== 'user_zane'); await load(empty, 'user_zane', 'empty'); await page.waitForTimeout(3100); assert.equal(await page.locator('.expanded-dots').count(), 0); assert.equal(await page.locator('.expanded-photo .profile-photo').getAttribute('data-media-status'), 'empty'); assert.equal(await page.locator('.profile-voice-play').count(), 1)
  const missing = structuredClone(seed); missing.users.find(u => u.user_id === 'user_zane').voice_intro.audio_url = '/static/assets/missing-intro.mp3'; await load(missing); await click('expanded.voiceIntroPlay.click.1'); await page.locator('.profile-voice-status[role="alert"]').waitFor(); assert.equal(await page.locator('.profile-voice-play').getAttribute('aria-label'), 'Play voice message'); await page.screenshot({ path: path.join(folder, 'audio-error-browser.png') })
  await load(seed, 'user_chloe'); assert.equal(await page.locator('.profile-voice-intro').count(), 0); assert.equal(await page.locator('.expanded-song').count(), 0)
  check('Zero/one photo does not rotate; missing real audio shows a retryable error; profiles without voice audio render no media strip')
  const preview = structuredClone(seed), audio_bytes = fs.readFileSync('static/assets/discover/zane/voice-intro.mp3'), id = 'media_overlay_default_regression', duration = seed.users.find(u => u.user_id === 'user_zane').voice_intro.duration_ms
  preview.users.find(u => u.user_id === 'user_cimoa').bio_audio_id = id
  preview.media_files.push({ media_id: id, owner_user_id: 'user_cimoa', kind: 'audio', media_url: `indexeddb://${id}`, mime: 'audio/mpeg', duration_ms: duration, byte_size: audio_bytes.length })
  await page.evaluate(async ({ key, data, id, bytes }) => {
    localStorage.setItem(key, JSON.stringify({ type: 'object', data }))
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('cimoa_media_v2', 1); r.onupgradeneeded = () => r.result.createObjectStore('blobs'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    await new Promise((resolve, reject) => { const t = db.transaction('blobs', 'readwrite'); t.objectStore('blobs').put(new Blob([Uint8Array.from(atob(bytes), c => c.charCodeAt(0))], { type: 'audio/mpeg' }), id); t.oncomplete = resolve; t.onerror = () => reject(t.error) }); db.close()
  }, { key, data: preview, id, bytes: audio_bytes.toString('base64') })
  await page.goto(`${server.origin}/?defaultAudio=1#/pages/profile/preview`); const default_play = page.locator('[data-interaction="profilePreview.evTogglePlay.click.1"]'); await default_play.waitFor(); assert.match(await default_play.innerText(), /s voice message/); await default_play.click(); await page.getByRole('button', { name: 'Pause voice message' }).waitFor(); await default_play.click(); await page.getByRole('button', { name: 'Play voice message' }).waitFor()
  check('Shared EventAudio default slot retains the original voice-message text/button and actual play/pause in Profile preview')
  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error) }
finally { if (browser) await browser.close(); if (server) await server.close(); report.cleaned = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
