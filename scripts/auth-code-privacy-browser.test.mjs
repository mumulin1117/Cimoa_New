import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { auth_code_privacy_regression } from './lib/auth-code-privacy-regression.mjs'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/auth-code-privacy'), origin = 'http://127.0.0.1:47850'
const key = 'cimoa_app_state_v2', now = Date.now()
const guest = () => {
  let disk = create_seed(now)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  assert.equal(store.set_app_consent(true).success, true)
  assert.equal(store.logout().success, true)
  return store
}
const registration = guest(), reset = guest()
const registered = await registration.register_local_account({ email: 'privacy.member@connect.hkust.edu', password: 'PrivacyPass123', confirmation: 'PrivacyPass123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
assert.equal(registered.success, true)
const resetRequest = reset.begin_password_reset('cimoa@connect.edu'); assert.equal(resetRequest.success, true)
const fixtures = { registration: { data: clone_data(registration.data), route: '/pages/auth/verification/code' }, reset: { data: clone_data(reset.data), route: `/pages/auth/reset/code?reset_id=${encodeURIComponent(resetRequest.data.reset_id)}` } }
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'native-fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n')
if (process.argv.includes('--fixtures-only')) { console.log('PASS Store-created guest registration/reset fixtures ready; no browser started'); process.exit(0) }

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], scenarios: [], screenshots: [], errors: [], warnings: [], preview_server_started: false }
const check = message => { report.checks.push(message); console.log('PASS ' + message) }
let browser, page
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const kind of ['registration', 'reset']) {
    const fixture = fixtures[kind], context = await browser.newContext({ viewport: { width: 393, height: 852 } })
    try {
      page = await context.newPage(); page.setDefaultTimeout(10000)
      page.on('pageerror', error => report.errors.push(`${kind}: ${error.message}`))
      page.on('console', event => { if (event.type() === 'warning') report.warnings.push(`${kind}: ${event.text()}`) })
      await page.route(`${origin}/**`, async route => {
        const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.addInitScript(({ data, origin, key }) => { if (location.origin === origin && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ type: 'object', data })) }, { data: fixture.data, origin, key })
      const selector = kind === 'registration' ? '.verification-page' : '.reset-code-page'
      const url = suffix => `${origin}/index.html?privacy=${kind}-${suffix}#${fixture.route}`
      const ready = async () => { await page.locator(`${selector}:visible`).waitFor(); await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge); await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 })) }
      const bytes = () => page.evaluate(key => localStorage.getItem(key), key)
      const shot = async name => { await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name) }
      const run = async mode => page.evaluate(auth_code_privacy_regression, { kind, mode, code: '009789' })
      const scenario = { kind, inspect: [] }
      await page.goto(url('empty')); await ready()
      for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }]) {
        await page.setViewportSize(viewport); await ready()
        scenario.inspect.push(await run('inspect'))
        await shot(`${kind}-empty-${viewport.width}x${viewport.height}.png`)
      }
      await page.setViewportSize({ width: 393, height: 852 }); await ready()
      const before = await bytes()
      await page.locator(`${selector} input`).fill('123'); await page.reload(); await ready()
      assert.equal(await page.locator(`${selector} input`).inputValue(), '')
      assert.equal(await bytes(), before)
      scenario.refresh = await run('inspect')
      check(`${kind}: refreshing partial manual entry clears the field without verifying or changing persistent data`)
      await page.locator(`${selector} input`).fill('123')
      const previousInput = await page.locator(`${selector} input`).elementHandle()
      await page.locator(`[data-interaction="${kind === 'registration' ? 'verCode.goBack.click.1' : 'fpCode.goBack.click.1'}"]:visible`).click()
      await page.locator(`${kind === 'registration' ? '.login-page' : '.reset-email-page'}:visible`).waitFor()
      assert.equal(await previousInput.evaluate(element => !element.isConnected || element.value === ''), true)
      assert.equal(await bytes(), before)
      await page.goto(url('return')); await ready(); scenario.return = await run('inspect')
      check(`${kind}: Back clears partial input, preserves request ownership and cannot prematurely confirm an account`)
      scenario.verify = await run('verify')
      await shot(`${kind}-confirmed-393x852.png`)
      report.scenarios.push(scenario)
      check(`${kind}: empty UI hides all accepted-code hints; invalid manual code is inert; correct code commits once after branded progress`)
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, [])
  report.passed = true
} catch (error) { report.failure = String(error.stack || error); report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2000) })).catch(() => null); throw error }
finally { await browser?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
