import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { group_voice_regression } from './lib/group-voice-regression.mjs'

const now = Date.now(), output = path.resolve('artifacts/group-voice'), root = path.resolve('dist/build/h5'), origin = 'http://127.0.0.1:47880', key = 'cimoa_app_state_v2'
const baseline = create_scenario('event_joined', now)
baseline.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
for (const message of baseline.messages) message.read_by = [...new Set([...message.read_by, 'user_cimoa'])]
validate_data(baseline)
const cases = [
  { name: 'idle-small', kind: 'idle', width: 320, height: 568 },
  { name: 'idle-standard', kind: 'idle', width: 393, height: 852 },
  { name: 'idle-large', kind: 'idle', width: 440, height: 956 },
  { name: 'preview-small', kind: 'preview', width: 320, height: 568 },
  { name: 'reduced-motion', kind: 'reduce', width: 393, height: 852, reduced: true },
  ...['preview', 'denied', 'missing', 'late-cancel', 'cancel', 'rerecord', 'send-retry', 'access-cancel'].map(kind => ({ name: kind, kind, width: 393, height: 852 })),
  { name: 'touch-send', kind: 'send', width: 393, height: 852, touch_controls: true },
]
const fixtures = Object.fromEntries(cases.map(item => [item.name, { data: clone_data(baseline), route: '/pages/events/group?event_id=event_picnic&conversation_id=group_picnic', options: { kind: item.kind, group: true, ...(item.touch_controls ? { touch_controls: true } : {}) } }]))
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS isolated event-group voice fixtures prepared; no service started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, cases: [], errors: [], warnings: [], preview_server_started: false, physical_microphone_requested: false, actual_user_storage_accessed: false, shared_driver: 'voice_message_regression({ group: true })', generated_audio: 'AudioContext oscillator → MediaStreamDestination → unchanged production MediaRecorder/decoder/player/Store; no physical microphone or real system permission test.' }
const requested = process.argv.find(arg => arg.startsWith('--case='))?.slice(7).split(',')
const report_name = process.argv.find(arg => arg.startsWith('--report='))?.slice(9) || 'browser-report'
assert.match(report_name, /^[a-z0-9-]+$/, 'Report name must be a simple artifact name')
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
  for (const item of cases.filter(item => !requested || requested.includes(item.name))) {
    const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: true, hasTouch: true, reducedMotion: item.reduced ? 'reduce' : 'no-preference' })
    let page
    try {
      page = await context.newPage(); page.setDefaultTimeout(10000)
      if (item.touch_controls) await page.exposeBinding('__cimoaVoiceQATouch', async ({ page }, id, repeat) => {
        const control = page.locator(`[data-interaction="${id}"]:visible`)
        const rect = await control.boundingBox()
        await control.tap()
        // The second real touch lands on the now-disabled control. Locator.tap
        // intentionally refuses disabled elements, unlike a user's finger.
        if (repeat) await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2)
      })
      page.on('pageerror', error => report.errors.push({ kind: item.name, error: error.message }))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push({ kind: item.name, warning: event.text() }) })
      await page.route(`${origin}/**`, route => {
        const requested = new URL(route.request().url()).pathname
        if (requested === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated group voice QA</title>' })
        const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.goto(`${origin}/fixture-shell`)
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: fixtures[item.name].data })
      await page.goto(`${origin}/index.html#${fixtures[item.name].route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('app')?.hydration_status === 'ready')
      await page.evaluate(({ small }) => window.CommonTemplateSafeAreaBridge?.update({ top: small ? 20 : 62, bottom: small ? 0 : 34 }), { small: item.width === 320 })
      await page.locator('[data-interaction="evGroup.recordGroupVoice.click.1"]:visible').tap()
      const value = await page.evaluate(async options => {
        try { return { value: await (0, eval)(options.driver)(options.fixture) } }
        catch (cause) { return { error: String(cause.stack || cause), diagnostic: cause.voice_message_diagnostic } }
      }, { driver: `(${group_voice_regression.toString()})`, fixture: fixtures[item.name].options })
      await page.screenshot({ path: path.join(output, `${item.name}-browser.png`) })
      if (item.name === 'idle-standard' && value.value?.passed) {
        const before = await page.evaluate(key => localStorage.getItem(key), key)
        const close = page.locator('[data-interaction="eventGroup.media.dismiss.click.1"]:visible'), cancel = page.locator('[data-interaction="eventGroup.media.close.click.2"]:visible'), entry = page.locator('[data-interaction="evGroup.recordGroupVoice.click.1"]:visible')
        await close.focus(); await page.keyboard.press('Shift+Tab'); assert.equal(await cancel.evaluate(element => document.activeElement === element), true)
        await page.keyboard.press('Tab'); assert.equal(await close.evaluate(element => document.activeElement === element), true)
        await page.keyboard.press('Escape'); await page.locator('.chat-voice-sheet').waitFor({ state: 'hidden' })
        await entry.focus(); await page.keyboard.press('Enter'); await page.locator('.chat-voice-sheet.event-dialog--open').waitFor()
        await page.keyboard.press('Escape'); await page.locator('.chat-voice-sheet').waitFor({ state: 'hidden' })
        assert.equal(await entry.evaluate(element => document.activeElement === element), true)
        value.value.checks.push('Group voice modal traps keyboard focus; Escape closes and restores focus to the group voice entry')
        await entry.tap(); await page.locator('.chat-voice-sheet.event-dialog--open').waitFor()
        await page.locator('.chat-voice-sheet .event-dialog-mask').tap({ position: { x: 1, y: 1 } }); await page.locator('.chat-voice-sheet').waitFor({ state: 'hidden' })
        assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
        value.value.checks.push('Repeated group voice opening and backdrop dismissal never change event, membership or message data')
      }
      if (item.kind === 'send-retry' && value.value?.passed) {
        await page.reload(); await page.locator('.event-group-composer').waitFor()
        value.recovery = await page.evaluate(group_voice_regression, { kind: 'recovery', group: true })
        await page.screenshot({ path: path.join(output, 'recovery-browser.png') })
      }
      report.cases.push({ name: item.name, ...value })
      console.log(`${value.error ? 'FAIL' : 'PASS'} Group voice ${item.name}${value.value ? `: ${value.value.checks.length} assertions` : ': ' + value.error.split('\n')[0]}`)
    } catch (cause) {
      report.cases.push({ name: item.name, error: String(cause.stack || cause) })
      if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, `${item.name}-failure.png`) })
      console.log(`FAIL Group voice ${item.name}: ${cause.message}`)
    } finally { await context.close() }
  }
  report.passed = report.cases.length > 0 && report.cases.every(row => row.value?.passed && (!row.recovery || row.recovery.passed)) && report.errors.length === 0 && report.warnings.length === 0
  assert.equal(report.passed, true, 'Group voice browser regression failed; inspect artifacts/group-voice/browser-report.json')
} finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, `${report_name}.json`), JSON.stringify(report, null, 2) + '\n') }
