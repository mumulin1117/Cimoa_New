import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { ux_entry_flow_regression } from './lib/ux-entry-flow-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/ux-entry-flow'), origin = 'http://127.0.0.1:47852'
const key = 'cimoa_app_state_v2', now = Date.now(), fixtures = {}
async function onboarding_fixture(step) {
  let disk = create_seed(now)
  disk.session = { account_id: null, current_user_id: null, expires_at: null }
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  const registration = await store.register_local_account({ email: `${step}.entry@campus.edu`, password: 'EntryFlow123', confirmation: 'EntryFlow123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
  assert.equal(registration.success, true)
  const id = registration.data.account_id
  assert.equal(store.apply_verification('009789', id).success, true)
  assert.equal(store.begin_onboarding(id).success, true)
  if (step === 'about') {
    for (const [name, patch] of [
      ['basic', { user_name: 'Flow Member', date_of_birth: '2000-01-01', gender: 'Man', pronouns: 'he / him' }],
      ['uni', { university: 'HKUST', year: 'Year 3', major: 'Computer Science', graduation_year: '2027' }],
      ['major', { major: 'Computer Science' }],
    ]) assert.equal((await store.save_onboarding_step(name, patch, id)).success, true)
    // Match the existing About visual fixture; this is prerequisite scaffolding, not a media acceptance test.
    store.data.accounts.find(account => account.account_id === id).onboarding = { step: 'about', completed_steps: ['basic', 'uni', 'major', 'photos'] }
  }
  return { data: clone_data(store.data), route: `/pages/onboarding/${step}`, clock_ms: now }
}
fixtures.basic = await onboarding_fixture('basic')
fixtures.about = await onboarding_fixture('about')
const authenticated = use_app_store(createPinia())
let authDisk = create_seed(now)
configure_store_runtime(authenticated, { persistence: { read: () => clone_data(authDisk), write: (_, data) => { authDisk = clone_data(data) } }, clock: () => now })
assert.equal(authenticated.hydrate().success, true)
assert.equal(authenticated.set_app_consent(true).success, true)
const expired = clone_data(authenticated.data)
expired.session.expires_at = now - 1
fixtures.expired = { data: expired, route: '/pages/home/index', clock_ms: now }
fixtures['runtime-expiry'] = { data: clone_data(authenticated.data), route: '/pages/home/index', clock_ms: now }
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Entry flow fixtures ready; no browser or preview server started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, scenarios: [], errors: [], warnings: [], preview_server_started: false, system_keyboard_tested: false }
let browser, page
async function scenario(kind, action = 'inspect', route = fixtures[kind].route) {
  const fixture = fixtures[kind], context = await browser.newContext({ viewport: { width: 393, height: 852 } })
  try {
    page = await context.newPage(); page.setDefaultTimeout(10000)
    page.on('pageerror', error => report.errors.push(`${kind}: ${error.message}`))
    page.on('console', event => { if (event.type() === 'warning') report.warnings.push(`${kind}: ${event.text()}`) })
    await page.route(`${origin}/**`, async request => {
      const pathname = new URL(request.request().url()).pathname, file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return request.fulfill({ status: 404, body: '' })
      await request.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await page.addInitScript(({ data, key, origin, now }) => {
      if (location.origin !== origin) return
      Date.now = () => now
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ type: 'object', data }))
    }, { data: fixture.data, key, origin, now: fixture.clock_ms })
    await page.goto(`${origin}/index.html?entry-flow=${kind}-${action}#${route}`)
    await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
    const result = await page.evaluate(ux_entry_flow_regression, { kind, action })
    report.scenarios.push({ source_route: route, ...result })
    await page.screenshot({ path: path.join(output, `${kind}-${action}-${route.split('/').at(-2)}.png`) })
    console.log(`PASS ${kind} ${action}: ${result.checks.join('; ')}`)
  } finally { await context.close() }
}
try {
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  for (const kind of ['basic', 'about']) for (const action of ['back', 'continue']) await scenario(kind, action)
  for (const tab of ['home', 'discover', 'events']) await scenario('expired', 'inspect', `/pages/${tab}/index`)
  await scenario('runtime-expiry')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true
} catch (error) {
  report.failure = String(error.stack || error)
  report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2000) })).catch(() => null)
  throw error
} finally {
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
