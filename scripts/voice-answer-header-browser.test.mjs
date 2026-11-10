import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { voice_answer_header_regression } from './lib/voice-answer-header-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/voice-answer-header'), origin = 'http://127.0.0.1:47863'
const now = Date.now(), data = create_scenario('default', now), route = '/pages/discover/icebreaker/select?user_id=user_zane'
data.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures: { default: { data, route, options: { mode: 'flow' } } } }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS voice answer header fixture ready'); process.exit(0) }
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, errors: [], warnings: [], results: [], preview_server_started: false }
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route(`${origin}/**`, async request => {
    const pathname = new URL(request.request().url()).pathname, file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return request.fulfill({ status: 404, body: '' })
    await request.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.addInitScript(({ data, origin }) => { if (location.origin === origin && !localStorage.getItem('cimoa_app_state_v2')) localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })) }, { data, origin })
  await page.goto(`${origin}/index.html#${route}`)
  await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
  report.results.push(await page.evaluate(voice_answer_header_regression, { mode: 'flow' }))
  for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }, { width: 440, height: 956 }]) {
    await page.setViewportSize(viewport)
    await page.waitForFunction(width => Math.abs(document.querySelector('.ice-voice-page').getBoundingClientRect().width - width) < 1, viewport.width)
    report.results.push(await page.evaluate(voice_answer_header_regression, { mode: 'inspect' }))
    await page.screenshot({ path: path.join(output, `voice-header-${viewport.width}x${viewport.height}.png`) })
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true; console.log('PASS voice answer header, three viewports, permission cancellation, text switch and actual Back')
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
