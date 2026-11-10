import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { upgrade_additive_data } from '../src/stores/migration.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { test_account_regression } from './lib/test-account-regression.mjs'

const output = path.resolve('artifacts/test-account'), root = path.resolve('dist/build/h5'), origin = 'http://127.0.0.1:47877', now = Date.now()
const baseline = upgrade_additive_data(create_seed(now))
baseline.accounts[0].email = 'cimoa@gmail.com'
baseline.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
baseline.auth_flow.email = 'cimoa@gmail.com'
baseline.users.find(row => row.user_id === 'user_cimoa').user_name = 'Morgan'
baseline.users.find(row => row.user_id === 'user_cimoa').bio = 'Coffee, campus walks and good company.'
baseline.messages[0].body = 'Let’s keep our campus plans here.'
const fixtures = Object.fromEntries(['login', 'session', 'write-failure', 'conflict'].map(mode => {
  const data = clone_data(baseline)
  if (mode !== 'session') data.session = { account_id: null, current_user_id: null, expires_at: null }
  if (mode === 'conflict') data.accounts.push({ ...data.accounts[0], account_id: 'account_other', user_id: 'user_chloe', email: 'cimoa@connect.edu' })
  return [mode, { data, route: ['session', 'conflict'].includes(mode) ? '/pages/auth/splash' : '/pages/auth/login', options: { mode } }]
}))
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify({ created_at: now, fixtures }, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Account migration isolated fixtures prepared'); process.exit(0) }
const { chromium } = createRequire(import.meta.url)('/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, cases: [], errors: [], warnings: [], preview_server_started: false }
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const [mode, fixture] of Object.entries(fixtures)) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
    try {
      const page = await context.newPage()
      page.on('pageerror', error => report.errors.push(error.message))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
      await page.route(`${origin}/**`, route => {
        const requested = new URL(route.request().url()).pathname
        if (requested === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated account setup</title>' })
        const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.goto(`${origin}/fixture-shell`)
      await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), fixture.data)
      await page.goto(`${origin}/index.html#${fixture.route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('app')?.hydration_status !== undefined)
      const result = await page.evaluate(test_account_regression, fixture.options)
      if (['login', 'write-failure'].includes(mode)) {
        const bytes = await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.home-header').waitFor()
        const restored = await page.evaluate(() => ({ bytes: localStorage.getItem('cimoa_app_state_v2'), email: document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app').current_user.email }))
        assert.equal(restored.bytes, bytes); assert.equal(restored.email, 'cimoa@connect.edu'); result.checks.push('A full browser refresh restores the canonical identity and exact persisted business bytes')
      }
      await page.screenshot({ path: path.join(output, `${mode}-browser.png`) })
      report.cases.push({ mode, result }); console.log(`PASS test account ${mode}: ${result.checks.length} checks`)
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
