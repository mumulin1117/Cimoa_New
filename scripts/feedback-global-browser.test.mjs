import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { feedback_global_regression } from './lib/feedback-global-regression.mjs'
import { brand_loading_regression } from './lib/brand-loading-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/feedback-global'), origin = 'http://127.0.0.1:47872'
const entry = fs.readFileSync(path.join(root, fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/src="([^\"]*\/assets\/index-[^\"]+\.js)"/)[1].replace(/^\//, '')), 'utf8')
const show_local = [...entry.matchAll(/([\w$]+)=\(([\w$]+),([\w$]+)\)=>([\w$]+)\.show\(\2,\3\)/g)].map(match => match[1]).find(name => new RegExp(`\\b${name} as [\\w$]+`).test(entry))
assert.ok(show_local, 'The exact H5 build exports the official show_toast function')
const toast_export = entry.match(new RegExp(`\\b${show_local} as ([\\w$]+)`))[1]
const key = 'cimoa_app_state_v2', now = Date.now(), audio_file = 'static/assets/discover/zane/voice-intro.mp3', bytes = fs.readFileSync(audio_file)
const fixture = (scenario = 'default') => {
  let disk = create_scenario(scenario, now)
  for (const row of disk.messages) row.read_by = [...new Set([...row.read_by, disk.session.current_user_id])]
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, value) => { disk = clone_data(value) } }, clock: () => now })
  assert.equal(store.hydrate().success, true); assert.equal(store.set_app_consent(true).success, true)
  return store
}
const media = (id, owner) => ({ media_id: id, owner_user_id: owner, kind: 'audio', media_url: `indexeddb://${id}`, mime: 'audio/mpeg', duration_ms: 16728, byte_size: bytes.length })
const plain = clone_data(fixture().data), request = clone_data(plain), preview_store = fixture(), group = clone_data(fixture('event_joined').data)
request.media_files.push(media('media_feedback_received', 'user_grace'))
Object.assign(request.requests.find(row => row.request_id === 'request_lina'), { audio_id: 'media_feedback_received', fixture_media_unavailable: false })
const draft_id = preview_store.prepare_introduction('user_zane', preview_store.questions_for_user('user_zane')[0].question_id, 'voice').data
const preview = clone_data(preview_store.data); preview.media_files.push(media('media_feedback_preview', 'user_cimoa'))
preview.drafts.find(row => row.draft_id === draft_id).payload.audio_id = 'media_feedback_preview'
group.media_files.push(media('media_feedback_group', 'user_cimoa'))
group.messages.push({ message_id: 'message_feedback_group', conversation_id: 'group_picnic', sender_id: 'user_cimoa', kind: 'audio', body: '', media_id: 'media_feedback_group', sent_at: now, read_by: ['user_cimoa'] })
const fixtures = {
  profile_photo: { data: plain, route: '/pages/discover/profile?user_id=user_zane', slow: 'image', options: { mode: 'media', selector: '.expanded-photo .profile-photo-loading', ready_selector: '.expanded-photo .profile-photo[data-media-status="ready"]' } },
  portrait: { data: plain, route: '/pages/discover/profile?user_id=user_zane', slow: 'image', options: { mode: 'media', selector: '.profile-voice-cover .profile-photo-loading', ready_selector: '.profile-voice-cover .profile-photo[data-media-status="ready"]', portrait: true } },
  profile_voice: { data: plain, route: '/pages/discover/profile?user_id=user_zane', slow: 'audio', options: { mode: 'media', selector: '.profile-voice-play[aria-busy="true"]', ready_selector: '.profile-voice-play[aria-busy="false"]' } },
  event_audio: { data: group, route: '/pages/events/group?event_id=event_picnic&conversation_id=group_picnic', blob_id: 'media_feedback_group', options: { mode: 'media', selector: '.event-audio-button[aria-busy="true"]', ready_selector: '.event-audio-button[aria-busy="false"]' } },
  request_audio: { data: request, route: '/pages/connections/received?request_id=request_lina', blob_id: 'media_feedback_received', options: { mode: 'media', selector: '.request-audio-play[aria-busy="true"]', ready_selector: '.request-audio-play[aria-busy="false"]' } },
  icebreaker_audio: { data: preview, route: `/pages/discover/icebreaker/preview?user_id=user_zane&draft_id=${draft_id}&media_id=media_feedback_preview`, blob_id: 'media_feedback_preview', options: { mode: 'media', selector: '.ice-audio-play[aria-busy="true"]', ready_selector: '.ice-audio-play[aria-busy="false"]' } },
  system: { data: plain, route: '/pages/system/loading', options: { mode: 'system' } },
  toast: { data: plain, route: '/pages/settings/lang', options: { mode: 'toast', toast_export } },
  skeleton: { data: plain, route: '/pages/home/index', options: { mode: 'skeleton' } },
  business: { data: plain, route: '/pages/profile/basic', options: { mode: 'profile', profile_name: 'Cimoa Member' } },
}
for (const item of Object.values(fixtures)) validate_data(item.data)
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, audio_base64: bytes.toString('base64'), fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS feedback-global fixtures ready; no browser started'); process.exit(0) }
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, results: [], screenshots: [], errors: [], warnings: [], preview_server_started: false, actual_microphone_requested: false, limitations: ['Tone variants exercise the existing exported presentation controller, not fictitious business successes.', 'Delayed network responses and IndexedDB opening are diagnostic injections; no physical media permissions or microphone are requested.'] }
let browser, page
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const cases = [...Object.keys(fixtures).map(name => ({ name, width: 393, height: 852 })), { name: 'profile_voice', width: 320, height: 568 }, { name: 'profile_voice', width: 440, height: 956 }, { name: 'profile_voice', width: 393, height: 852, reduced: true }, { name: 'toast', width: 320, height: 568 }, { name: 'toast', width: 440, height: 956 }]
  for (const item of cases) {
    const selected = fixtures[item.name], context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: true, hasTouch: true, reducedMotion: item.reduced ? 'reduce' : 'no-preference' })
    try {
      page = await context.newPage(); page.setDefaultTimeout(12000)
      page.on('pageerror', error => report.errors.push(error.message))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
      await page.route(`${origin}/**`, async route => {
        const requested = new URL(route.request().url()).pathname
        if (requested === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated fixture setup</title>' })
        const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        if (selected.slow === 'image' && /\/discover\/zane\/photo-1\.jpg$/.test(requested) || selected.slow === 'audio' && /\/discover\/zane\/voice-intro\.mp3$/.test(requested)) await new Promise(resolve => setTimeout(resolve, 1800))
        return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.goto(`${origin}/fixture-shell`)
      await page.evaluate(async ({ key, data, blob_id, audio_base64 }) => {
        localStorage.setItem(key, JSON.stringify({ type: 'object', data }))
        if (!blob_id) return
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('cimoa_media_v2', 1); request.onupgradeneeded = () => request.result.createObjectStore('blobs'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
        await new Promise((resolve, reject) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(new Blob([Uint8Array.from(atob(audio_base64), character => character.charCodeAt(0))], { type: 'audio/mpeg' }), blob_id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) }); db.close()
      }, { key, data: selected.data, blob_id: selected.blob_id, audio_base64: bytes.toString('base64') })
      if (selected.blob_id) await page.addInitScript(() => {
        const open = IDBFactory.prototype.open
        IDBFactory.prototype.open = function (...args) {
          const request = open.apply(this, args), proxy = { onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null, get result() { return request.result }, get error() { return request.error } }
          request.onsuccess = event => setTimeout(() => proxy.onsuccess?.call(proxy, event), 1400)
          for (const name of ['onerror', 'onupgradeneeded', 'onblocked']) request[name] = event => proxy[name]?.call(proxy, event)
          return proxy
        }
      })
      await page.goto(`${origin}/index.html#${selected.route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
      await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
      const driver = item.name === 'business' ? brand_loading_regression : feedback_global_regression
      const pending = page.evaluate(driver, selected.options), observed = pending.then(value => ({ value }), error => ({ error }))
      if (['profile_photo', 'portrait', 'profile_voice', 'event_audio', 'request_audio', 'icebreaker_audio', 'system'].includes(item.name)) {
        await page.locator(selected.options.selector || '.flow-state-panel').first().waitFor()
        const screenshot = `${item.name}-${item.width}x${item.height}${item.reduced ? '-reduced' : ''}.png`
        await page.screenshot({ path: path.join(output, screenshot) }); report.screenshots.push(screenshot)
      }
      const result = await observed; if (result.error) throw result.error
      report.results.push({ ...item, ...result.value })
    } catch (error) {
      report.failed_case = item
      report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2800) })).catch(() => null)
      await page?.screenshot({ path: path.join(output, `${item.name}-failure.png`) }).catch(() => {})
      throw error
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
  console.log(`PASS global feedback: ${report.results.length} cases; shared media/system marks, four Toast tones, real delayed profile write and one-time skeletons`)
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
