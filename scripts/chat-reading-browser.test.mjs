import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { chat_reading_regression } from './lib/chat-reading-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/chat-reading'), origin = 'http://127.0.0.1:47853'
const key = 'cimoa_app_state_v2', now = Date.now(), image = fs.readFileSync('static/assets/head/maya-card.png')
const fixture_data = create_scenario('event_joined', now)
fixture_data.media_files.push({ media_id: 'reading_photo', owner_user_id: 'user_chloe', kind: 'image', media_url: 'indexeddb://reading_photo', mime: 'image/png', byte_size: image.byteLength, duration_ms: 0 })
for (const conversation_id of ['conversation_chloe', 'group_picnic']) {
  fixture_data.messages.push(...Array.from({ length: 60 }, (_, index) => ({ message_id: `reading_${conversation_id}_${index}`, conversation_id, sender_id: index % 2 ? 'user_cimoa' : 'user_chloe', kind: 'text', body: `History message ${index + 1}. ` + 'A campus conversation that remains readable while browsing older messages. '.repeat(3 + index % 3), media_id: null, sent_at: now - (61 - index) * 60000, read_by: ['user_cimoa', 'user_chloe'] })))
  fixture_data.messages.push({ message_id: `reading_${conversation_id}_photo`, conversation_id, sender_id: 'user_chloe', kind: 'image', body: '', media_id: 'reading_photo', sent_at: now - 1000, read_by: ['user_cimoa', 'user_chloe'] })
}
for (const message of fixture_data.messages) if (!message.read_by.includes('user_cimoa')) message.read_by.push('user_cimoa')
let disk = clone_data(fixture_data)
const fixture_store = use_app_store(createPinia())
configure_store_runtime(fixture_store, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now })
assert.equal(fixture_store.hydrate().success, true)
assert.equal(fixture_store.set_app_consent(true).success, true)
const data = clone_data(fixture_store.data)
const fixtures = {
  direct: { route: '/pages/messages/chat?conversation_id=conversation_chloe', data },
  group: { route: '/pages/events/group?event_id=event_picnic&conversation_id=group_picnic', data },
  media: [{ media_id: 'reading_photo', mime: 'image/png', base64: image.toString('base64') }],
  driver: chat_reading_regression.toString(),
  driver_modes: ['initial', 'history', 'photo-ready', 'append-history', 'layout', 'remember-history', 'return', 'near-bottom', 'send-long'],
  safe_area_scenarios: ['Values supplied before initial render', 'Values supplied after initial tail positioning', 'Values changed and restored while reading history'],
  scope: 'Controlled Store message injection and image decoding; viewport resize approximates keyboard layout and is not a physical keyboard/background test.',
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Store/scenario chat reading fixtures ready; no browser or server started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], scenarios: [], errors: [], warnings: [], preview_server_started: false, scope: fixtures.scope }
let browser, page
try {
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  for (const scenario_kind of ['direct', 'group', 'direct-late', 'group-late']) {
    const late_safe_area = scenario_kind.endsWith('-late'), kind = scenario_kind.split('-')[0]
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } })
    try {
      page = await context.newPage(); page.setDefaultTimeout(10000)
      page.on('pageerror', error => report.errors.push(`${scenario_kind}: ${error.message}`))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push(`${scenario_kind}: ${event.text()}`) })
      await page.route(`${origin}/**`, async route => {
        const pathname = new URL(route.request().url()).pathname
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.addInitScript(({ key, data, origin, late_safe_area }) => {
        if (location.origin !== origin) return
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ type: 'object', data }))
        if (late_safe_area) return
        const apply_safe_area = () => {
          if (!document.documentElement) return false
          document.documentElement.style.setProperty('--native-safe-area-top', '62px')
          document.documentElement.style.setProperty('--native-safe-area-bottom', '34px')
          return true
        }
        if (!apply_safe_area()) { const observer = new MutationObserver(() => { if (apply_safe_area()) observer.disconnect() }); observer.observe(document, { childList: true }) }
      }, { key, data, origin, late_safe_area })
      await page.goto(origin + '/index.html?reading=setup#/pages/profile/index')
      await page.locator('.profile-name').waitFor()
      await page.evaluate(async media => {
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('cimoa_media_v2', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
        const blob = new Blob([Uint8Array.from(atob(media.base64), char => char.charCodeAt(0))], { type: media.mime })
        await new Promise((resolve, reject) => { const transaction = db.transaction('blobs', 'readwrite'); transaction.objectStore('blobs').put(blob, media.media_id); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error) })
        db.close()
      }, fixtures.media[0])
      await page.goto(origin + '/index.html?reading=' + scenario_kind + '#' + fixtures[kind].route)
      await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
      if (!late_safe_area) await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
      const scenario = { kind: scenario_kind, stages: [] }
      const run = async mode => {
        const result = await page.evaluate(chat_reading_regression, { kind, mode })
        scenario.stages.push(result); report.checks.push(...result.checks)
        return result
      }
      if (late_safe_area) {
        await run('initial')
        await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
        await run('initial')
        await run('remember-history')
        await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 44, bottom: 20 }))
        await run('layout')
        await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
        await run('layout')
        await page.screenshot({ path: path.join(output, `${scenario_kind}-safe-area.png`) })
        report.scenarios.push(scenario)
        continue
      }
      await run('history'); await run('photo-ready'); await run('append-history')
      await page.setViewportSize({ width: 393, height: 520 })
      await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains(selector.slice(1) + '--keyboard'), kind === 'direct' ? '.direct-chat-page' : '.event-group-page')
      await run('layout')
      await page.setViewportSize({ width: 393, height: 852 }); await run('layout')
      await run('remember-history')
      if (kind === 'direct') {
        await page.locator('[data-interaction="chat.viewProfile.click.1"]:visible').click()
        await page.locator('.expanded-profile-page:visible').waitFor()
        await page.getByRole('button', { name: 'Back', exact: true }).click()
      } else {
        await page.locator('[data-interaction="evGroup.openGroupMenu.click.1"]:visible').click()
        await page.locator('.event-group-report-page:visible').waitFor()
        await page.locator('[data-interaction="evReport.goBack.click.1"]:visible').click()
      }
      await run('return'); await run('near-bottom'); await run('send-long')
      await page.screenshot({ path: path.join(output, `${kind}-long-tail.png`) })
      report.scenarios.push(scenario)
    } catch (error) {
      report.visible_failure = await page.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-1500), scrolls: [...document.querySelectorAll('.secondary-page-scroll,.uni-scroll-view')].map(element => ({ tag: element.tagName, class: element.className, height: element.clientHeight, top: element.scrollTop, scrollHeight: element.scrollHeight })), messages: document.querySelectorAll('.chat-message,.event-message').length })).catch(() => null)
      throw error
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true
  for (const check of report.checks) console.log('PASS ' + check)
} catch (error) {
  report.failure = String(error.stack || error)
  report.visible_failure ||= await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-1500) })).catch(() => null)
  throw error
} finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
