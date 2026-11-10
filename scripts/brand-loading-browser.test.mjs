import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { brand_loading_regression } from './lib/brand-loading-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/brand-loading'), origin = 'http://127.0.0.1:47868'
const key = 'cimoa_app_state_v2', now = Date.now(), event_id = 'event_picnic', conversation_id = 'group_picnic', match_id = 'match_liam'
const fixture = (scenario = 'default', welcome = false) => {
  let disk = create_scenario(scenario, now), owner = disk.session.current_user_id
  // Mark received fixture messages read so this suite measures only the chosen action.
  for (const row of disk.messages) row.read_by = [...new Set([...row.read_by, owner])]
  validate_data(disk)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, value) => { disk = clone_data(value) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  if (welcome) { assert.equal(store.logout().success, true); assert.equal(store.set_app_consent(false).success, true) }
  else assert.equal(store.set_app_consent(true).success, true)
  validate_data(store.data); return clone_data(store.data)
}
const group = fixture('event_joined'), profile = fixture(), private_data = fixture()
const group_route = `/pages/events/group?event_id=${event_id}&conversation_id=${conversation_id}`
const fixtures = {
  group: { data: group, route: group_route, options: { mode: 'group', event_id, conversation_id } },
  group_failure: { data: clone_data(group), route: group_route, options: { mode: 'group_failure', event_id, conversation_id } },
  profile: { data: profile, route: '/pages/profile/basic', options: { mode: 'profile', profile_name: 'Cimoa Member' } },
  profile_failure: { data: clone_data(profile), route: '/pages/profile/basic', options: { mode: 'profile_failure', profile_name: 'Cimoa Member' } },
  match_pause: { data: fixture('match_searching'), route: `/pages/auto-match/searching?match_id=${match_id}`, options: { mode: 'match_pause', match_id } },
  match_resume: { data: fixture('match_paused'), route: `/pages/auto-match/paused?match_id=${match_id}`, options: { mode: 'match_resume', match_id } },
  welcome: { data: fixture('default', true), route: '/pages/auth/welcome', options: { mode: 'welcome' } },
  private_chat: { data: private_data, route: '/pages/messages/chat?conversation_id=conversation_chloe', options: { mode: 'private_chat', conversation_id: 'conversation_chloe' } },
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Store-hydrated brand-loading fixtures ready; no browser started'); process.exit(0) }
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, results: [], screenshots: [], errors: [], warnings: [], preview_server_started: false, actual_microphone_requested: false, untested_paths: ['Physical microphone, system photo picker and native media permission behavior require device acceptance; browser media tests use a file upload and a synthesized audio stream.'] }
let browser, page
const bind = async (context, item) => {
  const page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.stack || error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.addInitScript(({ data, key, origin }) => { if (location.origin === origin && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ type: 'object', data })) }, { data: item.data, key, origin })
  await page.goto(`${origin}/index.html#${item.route}`)
  await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  return page
}
const stage_media = async (page, name) => {
  const tap = id => page.locator(`[data-interaction="${id}"]:visible`).first().click()
  if (name === 'group_photo') {
    const selected = page.waitForEvent('filechooser')
    await tap('evGroup.sendPhoto.click.1')
    await (await selected).setFiles({ name: 'campus-picnic.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(root, 'static/assets/events/picnic.jpg')) })
  } else {
    await page.evaluate(() => {
      const context = new AudioContext(), destination = context.createMediaStreamDestination(), oscillator = context.createOscillator()
      oscillator.frequency.value = 440; oscillator.connect(destination); oscillator.start()
      const state = { context, oscillator, stream: destination.stream, requests: 0 }
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => { state.requests++; await context.resume(); return destination.stream } })
      window.__brand_loading_synthetic_audio = state
    })
    await tap('evGroup.recordGroupVoice.click.1'); await tap('eventGroup.media.record.click.1')
    await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor()
    await page.waitForTimeout(800)
    await tap('eventGroup.media.record.click.1')
  }
  await page.locator('[data-interaction="eventGroup.media.send.click.1"]:visible').waitFor()
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const cases = [
    ...Object.keys(fixtures).map(name => ({ name, width: 393, height: 852 })),
    { name: 'group', width: 320, height: 568 }, { name: 'group', width: 440, height: 956 },
    { name: 'group', width: 393, height: 852, reduced: true },
    { name: 'group_photo', width: 393, height: 852 }, { name: 'group_voice', width: 393, height: 852 },
  ]
  for (const item of (process.argv.includes('--media-only') ? cases.filter(item => item.name === 'group_photo' || item.name === 'group_voice') : cases)) {
    const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: true, hasTouch: true, reducedMotion: item.reduced ? 'reduce' : 'no-preference' })
    try {
      const media_case = ['group_photo', 'group_voice'].includes(item.name), item_fixture = media_case ? fixtures.group : fixtures[item.name]
      page = await bind(context, item_fixture)
      if (media_case) await stage_media(page, item.name)
      const pending = page.evaluate(brand_loading_regression, { ...item_fixture.options, ...(media_case ? { mode: item.name } : {}) })
      // Handle a driver failure immediately while also capturing its visible busy state.
      const observed = pending.then(value => ({ value }), error => ({ error }))
      if (!['private_chat', 'group_voice'].includes(item.name)) {
        await page.locator('#cimoa-toast-root .brand-action-loading').waitFor({ state: 'visible' })
        await page.waitForFunction(() => +getComputedStyle(document.querySelector('#cimoa-toast-root .brand-action-loading')).opacity > .99)
        const name = `${item.name}-${item.width}x${item.height}${item.reduced ? '-reduced' : ''}.png`
        await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name)
      }
      const result = await observed; if (result.error) throw result.error
      if (item.name.endsWith('_failure')) {
        await page.waitForFunction(() => { const error = document.querySelector('#cimoa-toast-root .brand-toast--error:not(.brand-toast-leave-active)'); return error && +getComputedStyle(error).opacity > .99 })
        const name = `${item.name}-error-${item.width}x${item.height}.png`
        await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name)
      }
      if (item.name === 'group_photo') {
        await page.reload()
        await page.locator('.event-message-image .profile-photo[data-media-status="ready"]').waitFor()
        result.value.checks.push('Reload resolves the actual persisted IndexedDB group photo')
      }
      if (item.name === 'group_voice') {
        const state = await page.evaluate(async () => {
          const value = window.__brand_loading_synthetic_audio, result = { requests: value.requests, tracks: value.stream.getTracks().map(track => track.readyState) }
          value.oscillator.stop(); await value.context.close(); delete window.__brand_loading_synthetic_audio
          return result
        })
        assert.equal(state.requests, 1); assert.ok(state.tracks.length > 0 && state.tracks.every(track => track === 'ended'))
        result.value.synthetic_media_recording = true
        result.value.checks.push('Synthesized MediaRecorder stream is requested once and all tracks stop after review')
      }
      report.results.push({ ...item, ...result.value })
    } catch (error) {
      report.failed_case = item
      report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2800) })).catch(() => null)
      await page?.screenshot({ path: path.join(output, `${item.name}-failure.png`) }).catch(() => {})
      throw error
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
  console.log('PASS brand loading: global card, safe areas, SVG/reduced motion, delayed single writes, rollback, profile/match/auth, inline private chat and real file/synthetic voice group sends')
} catch (error) { report.failure = String(error.stack || error); if (!report.visible_failure) report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2800) })).catch(() => null); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
