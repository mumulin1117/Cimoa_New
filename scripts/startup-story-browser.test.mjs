import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { startup_story_regression } from './lib/startup-story-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/startup-story'), origin = 'http://127.0.0.1:47876', key = 'cimoa_app_state_v2', now = Date.now(), record_preview = process.argv.includes('--record-preview')
const accepted = { revision: APP_CONSENT_REVISION, accepted_at: now }
const valid = create_scenario('default', now)
valid.app_consent = accepted
for (const message of valid.messages) message.read_by = [...new Set([...message.read_by, valid.session.current_user_id])]
const guest = clone_data(valid); guest.session = { account_id: null, current_user_id: null, expires_at: null }; guest.app_consent = { revision: null, accepted_at: null }
const consented = clone_data(guest); consented.app_consent = accepted
let disk = null
const photo_bytes = fs.readFileSync('static/assets/icons/ic-connect.png'), photo_media = new Map()
const setup = use_app_store(createPinia())
configure_store_runtime(setup, {
  persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now,
  media: { put: async (id, blob) => photo_media.set(id, blob), get: async id => photo_media.get(id), delete: async id => photo_media.delete(id) },
  inspect_media: async blob => { assert.equal(Buffer.from(await blob.arrayBuffer()).equals(photo_bytes), true); return {} },
})
assert.equal(setup.hydrate().success, true); assert.equal(setup.set_app_consent(true).success, true)
const member = { email: 'startup.story@campus.edu', password: 'Campus1234', confirmation: 'Campus1234', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } }
const registered = await setup.register_local_account(member)
assert.equal(registered.success, true)
const verification = clone_data(setup.data)
assert.equal(setup.apply_verification('009789', registered.data.account_id).success, true)
assert.equal(setup.begin_onboarding(registered.data.account_id).success, true)
assert.equal((await setup.save_onboarding_step('basic', { user_name: 'Campus Member', date_of_birth: member.date_of_birth, gender: 'Woman', pronouns: 'she / her' }, registered.data.account_id)).success, true)
const onboarding = clone_data(setup.data)
for (const [step, patch] of [['uni', { university: 'HKUST', year: 'Year 3', major: '', graduation_year: '2027' }], ['major', { major: 'Engineering' }]]) assert.equal((await setup.save_onboarding_step(step, patch, registered.data.account_id)).success, true)
assert.equal((await setup.add_onboarding_photos([new Blob([photo_bytes], { type: 'image/png' }), new Blob([photo_bytes], { type: 'image/png' })], null, registered.data.account_id)).success, true)
for (const [step, patch] of [['photos', {}], ['about', { bio: 'Campus walks, good coffee and conversations after class.' }], ['interests', { interest_ids: ['coffee', 'photography', 'music'] }], ['goal', { goal_ids: ['friends', 'study'] }], ['ice', { questions: ['Your favorite campus spot?', 'What is your ideal weekend?', 'Which book should I read next?'] }], ['notif', { notification_permission: 'skipped' }]]) assert.equal((await setup.save_onboarding_step(step, patch, registered.data.account_id)).success, true)
const complete = clone_data(setup.data)
assert.equal(setup.onboarding.step, 'complete'); assert.equal(setup.onboarding.completed, false)
const photo_blobs = complete.media_files.filter(item => item.owner_user_id === registered.data.user_id && item.kind === 'image').map(item => ({ media_id: item.media_id, mime: item.mime, base64: photo_bytes.toString('base64') }))
assert.equal(photo_blobs.length, 2)
for (const data of [valid, guest, consented, verification, onboarding, complete]) validate_data(data)
const route = '/pages/auth/splash', fixtures = {
  guest: { data: guest, route, options: { kind: 'guest' } },
  background: { data: guest, route, options: { kind: 'background' } },
  accepted: { data: consented, route, options: { kind: 'accepted' } },
  reduced: { data: consented, route, options: { kind: 'reduced' } },
  slow: { data: guest, route, options: { kind: 'slow' } },
  failure: { data: consented, route, options: { kind: 'failure' } },
  valid: { data: valid, route, options: { kind: 'valid' } },
  verification: { data: verification, route, options: { kind: 'verification' } },
  onboarding: { data: onboarding, route, options: { kind: 'onboarding' } },
  complete: { data: complete, route, options: { kind: 'complete', photo_blobs } },
  login: { data: consented, route, options: { kind: 'login', email: valid.accounts[0].email, password: '12341234' } },
  'native-delay': { data: guest, route, options: { kind: 'native-delay', native: true } },
  corrupt: { data: '{corrupt', route, options: { kind: 'corrupt' } },
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Startup story isolated fixtures prepared; no browser or preview server started'); process.exit(0) }
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, results: [], screenshots: [], errors: [], warnings: [], preview_server_started: false, actual_microphone_requested: false, limitations: ['The browser native-delay case is explicit diagnostic bridge instrumentation. Final production-cover timing is verified separately by actual WKWebView tests.', 'Slow and failed image responses are diagnostic resource injections; they do not replace actual image decoding or declare fake network service results.', 'The background case injects document.visibilityState/hidden and dispatches visibilitychange; it is not a claim of actual iOS system-background or foreground testing.'] }
let browser, page
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const cases = [
    ...[320, 393, 440].map((width, index) => ({ kind: 'accepted', width, height: [568, 852, 956][index] })),
    ...['guest', 'native-delay', 'reduced', 'slow', 'failure', 'valid', 'verification', 'onboarding', 'login', 'complete', 'corrupt', 'background'].map(kind => ({ kind, width: 393, height: 852 })),
  ]
  const requested_cases = process.argv.find(argument => argument.startsWith('--case='))?.slice(7).split(',')
  for (const item of cases.filter(item => record_preview ? item.kind === 'accepted' && item.width === 393 : !requested_cases || requested_cases.includes(item.kind))) {
    const selected = fixtures[item.kind], context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: true, hasTouch: true, reducedMotion: item.kind === 'reduced' ? 'reduce' : 'no-preference', ...(record_preview ? { recordVideo: { dir: path.join(output, 'preview-recordings'), size: { width: 393, height: 852 } } } : {}) })
    let photo_requests = 0
    try {
      page = await context.newPage(); page.setDefaultTimeout(14000)
      page.on('pageerror', error => report.errors.push(error.message))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
      await page.route(`${origin}/**`, async route => {
        const requested = new URL(route.request().url()).pathname
        if (requested === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated startup fixture setup</title>' })
        const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        if (requested === '/static/assets/img/welcome-campus.png') {
          photo_requests++
          if (item.kind === 'slow' && photo_requests === 1) await new Promise(resolve => setTimeout(resolve, 3800))
          if (item.kind === 'failure' && photo_requests <= 2) return route.fulfill({ status: 404, body: '' })
        }
        return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.goto(`${origin}/fixture-shell`)
      await page.evaluate(({ key, data }) => localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify({ type: 'object', data })), { key, data: selected.data })
      await page.addInitScript(({ native }) => {
        const trace = window.__startup_story_trace = { decodes: [], splash_at: null, welcome_at: null, phases: [], eula_opens: [], native_requests: [], native_acks: [], early_eula: false }
        const decode = HTMLImageElement.prototype.decode
        HTMLImageElement.prototype.decode = function (...args) {
          const item = { url: this.src, started: performance.now() }; trace.decodes.push(item)
          return decode.apply(this, args).then(value => { item.ended = performance.now(); return value }, error => { item.failed = performance.now(); throw error })
        }
        let previous_eula = false
        const collect = () => {
          if (document.querySelector('.splash-page') && trace.splash_at === null) trace.splash_at = performance.now()
          const welcome = document.querySelector('.welcome-page')
          if (welcome && trace.welcome_at === null) trace.welcome_at = performance.now()
          if (welcome && trace.phases.at(-1)?.phase !== welcome.dataset.startupPhase) trace.phases.push({ phase: welcome.dataset.startupPhase, at: performance.now() })
          const eula = !!document.querySelector('.eula-dialog.event-dialog--open')
          if (eula && !previous_eula) { trace.eula_opens.push(performance.now()); if (native && trace.native_acks.length === 0) trace.early_eula = true }
          previous_eula = eula
        }
        new MutationObserver(collect).observe(document, { attributes: true, childList: true, subtree: true })
        if (native) window.webkit = { messageHandlers: { CimoaHost: { postMessage(payload) {
          if (payload.method !== 'finishLaunch') return Promise.resolve({ version: 1, request_id: payload.request_id, success: true, result: {} })
          trace.native_requests.push({ at: performance.now(), route: location.hash })
          window.dispatchEvent(new CustomEvent('cimoa:launch-reveal', { detail: { attempt: new URL(location.href).searchParams.get('launch') } }))
          return new Promise(resolve => setTimeout(() => { trace.native_acks.push(performance.now()); resolve({ version: 1, request_id: payload.request_id, success: true, result: { ready: true } }) }, 240))
        } } } }
        document.addEventListener('DOMContentLoaded', () => {
          const safe = () => { if (window.CommonTemplateSafeAreaBridge) { window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); return } requestAnimationFrame(safe) }; safe()
        }, { once: true })
      }, { native: !!selected.options.native })
      await page.goto(`${origin}/index.html?launch=browser-startup-story#${selected.route}`, { waitUntil: 'domcontentloaded' })
      const pending = page.evaluate(startup_story_regression, { ...selected.options, require_trace: true }), observed = pending.then(value => ({ value }), error => ({ error }))
      await page.locator('.splash-page').waitFor()
      const prefix = `${record_preview ? 'preview-' : ''}${item.kind}-${item.width}x${item.height}`
      await page.waitForTimeout(360)
      await page.screenshot({ path: path.join(output, `${prefix}-splash.png`) }); report.screenshots.push(`${prefix}-splash.png`)
      const result = await observed; if (result.error) throw result.error
      await page.screenshot({ path: path.join(output, `${prefix}-result.png`) }); report.screenshots.push(`${prefix}-result.png`)
      report.results.push({ ...item, photo_requests, ...result.value })
      console.log(`PASS startup story ${prefix}: ${result.value.checks.length} assertions`)
    } catch (error) {
      report.failed_case = item
      report.visible_failure = await page?.evaluate(() => ({ route: location.hash, startup_phase: document.querySelector('.welcome-page')?.dataset.startupPhase, campus: document.querySelector('.welcome-page')?.dataset.campusStatus, trace: window.__startup_story_trace, text: document.body.innerText.slice(-3000) })).catch(() => null)
      await page?.screenshot({ path: path.join(output, `${item.kind}-failure.png`) }).catch(() => {})
      throw error
    } finally {
      const video = record_preview ? page?.video() : null
      await context.close()
      if (video) { await video.saveAs(path.join(output, 'startup-campus-preview.webm')); await video.delete(); report.video = 'startup-campus-preview.webm' }
    }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
  console.log(`PASS startup story: ${report.results.length} isolated browser cases; no preview server, actual-account mutation or microphone access`)
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, record_preview ? 'preview-report.json' : 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
