import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { set_locale, t } from '../src/i18n/index.js'

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/localization'), origin = 'http://127.0.0.1:47907'
const now = Date.now(), key = 'cimoa_app_state_v2'
const secondary = process.argv.includes('--secondary')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const store = use_app_store(createPinia())
let disk = create_scenario('event_joined', now)
configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(disk), write: (_, value) => { disk = clone_data(value) } } })
assert.ok(store.hydrate().success)
assert.ok(store.set_app_consent(true).success)
assert.ok(store.begin_auto_match_guide(store.auth_context).success)
assert.ok(store.finish_auto_match_guide('skipped', store.auth_context).success)
assert.ok(store.begin_discover_guide(store.discover_people[store.discover_card_index].user_id, store.auth_context).success)
assert.ok(store.finish_discover_guide('skipped', store.auth_context).success)
const account = clone_data(store.data)
assert.ok(store.logout().success)
const guest = clone_data(store.data)
const routes = [
  'home/index', 'discover/index', 'discover/profile?user_id=user_zane',
  'discover/icebreaker/select?user_id=user_zane', 'discover/icebreaker/text?user_id=user_zane&question_id=user_zane_q_0',
  'discover/icebreaker/voice?user_id=user_zane&question_id=user_zane_q_0',
  'events/index', 'events/detail?event_id=event_picnic', 'events/participants?event_id=event_picnic',
  'events/group?event_id=event_picnic&conversation_id=group_picnic', 'events/upcoming', 'events/report?event_id=event_picnic',
  'auto-match/index', 'auto-match/preferences', 'auto-match/history', 'auto-match/found?match_id=match_liam',
  'connections/received?request_id=request_lina', 'messages/chat?conversation_id=conversation_chloe',
  'profile/index', 'profile/edit', 'profile/basic', 'profile/interests', 'profile/goals', 'profile/ice', 'profile/preview', 'profile/prefs', 'profile/verification', 'profile/reverify',
  'settings/index', 'settings/notif', 'settings/privacy', 'settings/perm', 'settings/blocked', 'settings/legal', 'settings/support', 'settings/delete/info', 'settings/delete/reason', 'settings/delete/final',
  'coins/index', 'coins/help', 'coins/history', 'legal/privacy', 'legal/terms',
  'safety/report-user?user_id=user_chloe', 'system/offline', 'system/maintenance', 'system/session-expired',
]
const report = { passed: false, routes: [], errors: [], untranslated: [], browser_warnings: [], preview_server_started: false }
fs.mkdirSync(output, { recursive: true })
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: 'en-US', isMobile: true, hasTouch: true })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.browser_warnings.push(event.text()) })
  await page.route('**/*', async request => {
    const url = new URL(request.request().url())
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
    if (url.origin !== origin || !file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return request.fulfill({ status: 404, body: '' })
    await request.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(origin)
  await page.evaluate(({ key, account }) => {
    localStorage.setItem(key, JSON.stringify({ type: 'object', data: account }))
    localStorage.setItem('cimoa_locale_preference_v1', JSON.stringify({ locale: 'en-US', source: 'user' }))
  }, { key, account })
  await page.goto(origin + '/#/pages/settings/lang'); await page.reload()
  await page.locator('.language-choice').nth(1).click()
  await page.waitForFunction(() => document.documentElement.lang === 'fr-FR')
  await page.getByText('Langue mise à jour', { exact: true }).waitFor()
  assert.equal(await page.locator('.language-choice[aria-checked="true"]').innerText(), 'Français')
  await page.reload()
  await page.getByText('Langue', { exact: true }).waitFor()
  assert.equal(await page.locator('.language-choice[aria-checked="true"]').innerText(), 'Français')
  await page.locator('.language-choice').nth(0).click()
  await page.waitForFunction(() => document.documentElement.lang === 'en-US')
  await page.getByText('Language updated', { exact: true }).waitFor()
  assert.equal(await page.locator('.language-choice[aria-checked="true"]').innerText(), 'English')
  await page.locator('.language-choice').nth(1).click()
  await page.waitForFunction(() => document.documentElement.lang === 'fr-FR')
  await page.getByText('Langue mise à jour', { exact: true }).waitFor()
  report.language_switch = 'EN → FR → reload → EN → FR passed through actual settings controls'
  set_locale('fr-FR')
  const audit = async route => {
    await page.goto(origin + '/#/pages/' + route); await page.reload()
    await page.waitForFunction(() => document.documentElement.lang === 'fr-FR' && !!document.querySelector('uni-page-body'))
    await page.waitForTimeout(720)
    const visible = await page.evaluate(() => {
      const root = document.querySelector('uni-page-body'), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), rows = []
      let node
      while ((node = walker.nextNode())) {
        const parent = node.parentElement, value = node.nodeValue.trim()
        if (!value || parent.closest('[data-i18n="verbatim"],input,textarea,script,style')) continue
        const range = document.createRange(); range.selectNode(node)
        if (!range.getBoundingClientRect().height || getComputedStyle(parent).visibility === 'hidden') continue
        rows.push(value)
      }
      for (const node of root.querySelectorAll('[placeholder],[aria-label],[title],[alt]')) {
        if (!node.getBoundingClientRect().height) continue
        for (const attribute of ['placeholder', 'aria-label', 'title', 'alt']) if (node.getAttribute(attribute)) rows.push(node.getAttribute(attribute))
      }
      return [...new Set(rows)]
    })
    const leaks = visible.filter(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && (t(value).toLowerCase() !== value.toLowerCase() || /\b(?:your|you|choose|please|unavailable|remaining|something|someone|couldn’t|could not|would|should|what|which|before|after|without|between)\b/i.test(value)))
    report.routes.push({ route, visible })
    console.log('AUDIT ' + route)
    for (const value of leaks) report.untranslated.push({ route, value })
    if (['home/index', 'discover/index', 'events/index', 'profile/index', 'settings/index', 'coins/index', 'events/detail?event_id=event_picnic'].includes(route)) await page.screenshot({ path: path.join(output, route.replace(/[^\w-]/g, '_') + '.png') })
  }
  if (!secondary) {
    for (const route of routes) await audit(route)
    await page.evaluate(({ key, guest }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data: guest })), { key, guest })
    for (const route of ['auth/welcome', 'auth/login', 'auth/age', 'auth/community', 'auth/signup', 'auth/reset/email', 'auth/reset/code', 'auth/reset/new', 'auth/verification/email', 'auth/verification/code']) await audit(route)
  } else {
    const registration = await store.register_local_account({ email: 'locale.member@campus.edu', password: 'Campus1234', confirmation: 'Campus1234', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
    assert.ok(registration.success)
    assert.ok(store.apply_verification('009789', registration.data.account_id).success)
    assert.ok(store.begin_onboarding(registration.data.account_id).success)
    const setup = clone_data(store.data)
    // These are disposable render fixtures; real save/validation behavior is
    // covered separately. Each page receives its own current onboarding step.
    for (const step of setup.onboarding_steps) {
      if (step === 'complete') continue
      const snapshot = clone_data(setup)
      snapshot.accounts.find(row => row.account_id === registration.data.account_id).onboarding.step = step
      await page.evaluate(({ key, snapshot }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data: snapshot })), { key, snapshot })
      await audit('onboarding/' + step)
    }
    await page.evaluate(({ key, account }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data: account })), { key, account })
    for (const route of ['permissions/photos', 'permissions/camera', 'permissions/mic', 'permissions/notif', 'events/join-success?event_id=event_picnic', 'discover/icebreaker/preview?user_id=user_zane', 'connections/sent?request_id=missing', 'connections/accepted?request_id=missing', 'connections/declined?request_id=missing', 'coins/purchasing', 'coins/success', 'coins/failed', 'coins/cancelled', 'coins/purchase-detail?transaction_id=seed_opening', 'coins/spend-detail', 'coins/processing', 'coins/spend-failed', 'settings/lang', 'settings/delete/success', 'safety/reports', 'safety/report-detail', 'system/index', 'system/loading', 'system/error', 'system/empty', 'system/perm-denied']) await audit(route)
    for (const status of ['searching', 'paused', 'waiting', 'connected', 'passed', 'expired', 'no_match']) {
      const snapshot = create_scenario('match_' + status, Date.now())
      snapshot.app_consent = account.app_consent
      snapshot.settings[0].auto_match_guide = account.settings[0].auto_match_guide
      snapshot.settings[0].discover_guide = account.settings[0].discover_guide
      await page.evaluate(({ key, snapshot }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data: snapshot })), { key, snapshot })
      await audit('auto-match/' + status.replace('_', '-') + '?match_id=match_liam')
    }
  }
  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.untranslated, [])
  report.passed = true
  console.log(`French localization passed on ${report.routes.length} routes, including real language switching and reload.`)
} finally {
  await browser?.close()
  fs.writeFileSync(path.join(output, secondary ? 'secondary-browser-report.json' : 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
