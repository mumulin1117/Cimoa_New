import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/permission-actions-2026-10-26'), origin = 'http://127.0.0.1:47887'
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const key = 'cimoa_app_state_v2', now = Date.now(), mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false, physical_permissions_requested: false, actual_user_storage_accessed: false, boundary: 'Permission adapters are exercised with controlled browser capability responses; this is not a new iOS OS-dialog acceptance.' }
const check = label => { report.checks.push(label); console.log('PASS ' + label) }
fs.mkdirSync(output, { recursive: true })
const store = use_app_store(createPinia())
configure_store_runtime(store, { persistence: { read: () => null, write: () => {} }, clock: () => now })
assert.equal(store.hydrate().success, true)
const registered = await store.register_local_account({ email: 'permission.actions@campus.edu', password: 'permission123', confirmation: 'permission123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
assert.equal(registered.success, true)
assert.equal(store.apply_verification('009789', registered.data.account_id).success, true)
assert.equal(store.begin_onboarding(registered.data.account_id).success, true)
const setup_data = step => {
  const data = clone_data(store.data), account = data.accounts.find(row => row.account_id === registered.data.account_id)
  account.onboarding = { step, completed_steps: step === 'photos' ? ['basic', 'uni', 'major'] : ['basic', 'uni', 'major', 'photos', 'about', 'interests', 'goal', 'ice'] }
  data.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
  return data
}
let browser
const contexts = []
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const open = async (data, route) => {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
    contexts.push(context)
    const page = await context.newPage(); page.setDefaultTimeout(7000)
    page.on('pageerror', cause => report.errors.push({ message: cause.message, stack: cause.stack, route: page.url() }))
    page.on('console', item => { if (item.type() === 'warning') report.warnings.push(item.text()) })
    await page.route('**/*', request => {
      const url = new URL(request.request().url())
      if (url.origin !== origin) return request.abort()
      if (url.pathname === '/fixture-shell') return request.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated permission acceptance</title>' })
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return request.fulfill({ status: 404, body: '' })
      return request.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await page.addInitScript(() => {
      window.__permissionRequests = { notification: 0, microphone: 0 }
      window.__notificationResult = 'denied'
      Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default', requestPermission: () => { window.__permissionRequests.notification++; return Promise.resolve(window.__notificationResult) } } })
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { window.__permissionRequests.microphone++; throw new DOMException('Permission denied', 'NotAllowedError') } } })
    })
    await page.goto(`${origin}/fixture-shell`)
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data })
    await page.goto(`${origin}/index.html#${route}`)
    await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
    return page
  }
  const raw = page => page.evaluate(key => localStorage.getItem(key), key)
  const control = (page, id) => page.locator(`[data-interaction="${id}"]:visible`)
  const labels = async (page, primary, secondary) => {
    assert.equal((await control(page, primary).innerText()).trim(), 'Continue')
    assert.equal((await control(page, secondary).innerText()).trim(), 'Cancel')
    for (const id of [primary, secondary]) {
      const bounds = await control(page, id).boundingBox()
      assert.ok(bounds.width >= 44 && bounds.height >= 44, `${id} needs a 44pt touch target`)
    }
  }
  for (const kind of ['camera', 'photos']) {
    const primary = `perm${kind === 'camera' ? 'Camera' : 'Photos'}.allowPhotos.click.1`, secondary = `perm${kind === 'camera' ? 'Camera' : 'Photos'}.denyPhotos.click.1`
    const page = await open(setup_data('photos'), `/pages/permissions/${kind}`)
    await labels(page, primary, secondary)
    const before = await raw(page)
    await control(page, secondary).evaluate(node => { node.click(); node.click() })
    await page.locator('.onboarding-photos-page:visible').waitFor()
    assert.equal(await raw(page), before)
    assert.deepEqual(await page.evaluate(() => window.__permissionRequests), { notification: 0, microphone: 0 })
    await page.goto(`${origin}/index.html#/pages/permissions/${kind}`)
    const chooser = page.waitForEvent('filechooser')
    await control(page, primary).tap()
    await (await chooser).setFiles({ name: 'invalid-photo.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') })
    await page.locator('[role="alert"]:visible').first().waitFor()
    assert.equal(await raw(page), before)
    await page.screenshot({ path: path.join(output, `${kind}-continue-error.png`) })
    check(`${kind}: Continue opens the real picker adapter; invalid media preserves data; double Cancel returns once without a permission request`)
  }
  for (const [route, primary, secondary] of [
    ['/pages/onboarding/notif', 'obNotif.enableNotifs.click.1', 'obNotif.skipNotifs.click.1'],
    ['/pages/permissions/notif', 'permNotif.allowNotifs.click.1', 'permNotif.denyNotifs.click.1'],
  ]) {
    const page = await open(setup_data('notif'), route)
    await labels(page, primary, secondary)
    const before = await raw(page)
    await control(page, primary).evaluate(node => { node.click(); node.click() })
    await page.locator('[role="alert"]:visible').first().waitFor()
    assert.equal(await page.evaluate(() => window.__permissionRequests.notification), 1)
    assert.equal(await raw(page), before)
    assert.ok(page.url().endsWith(route))
    await page.screenshot({ path: path.join(output, route.includes('onboarding') ? 'onboarding-notification-denied.png' : 'notification-denied.png') })
    await control(page, secondary).tap()
    await page.locator('.onboarding-complete-page:visible').waitFor()
    assert.equal(await page.evaluate(() => window.__permissionRequests.notification), 1)
    const data = JSON.parse(await raw(page)).data, account = data.accounts.find(row => row.account_id === data.session.account_id)
    assert.equal(account.onboarding.notification_permission, 'denied')
    assert.equal(data.settings.find(row => row.owner_user_id === data.session.current_user_id).notifications.master, false)
    const success = await open(setup_data('notif'), route)
    await success.evaluate(() => { window.__notificationResult = 'granted' })
    await control(success, primary).evaluate(node => { node.click(); node.click() })
    await success.locator('.onboarding-complete-page:visible').waitFor()
    assert.equal(await success.evaluate(() => window.__permissionRequests.notification), 1)
    check(`${route}: Continue requests directly once, denial never saves; Cancel skips without re-request; granted capability advances only through the Store`)
  }
  const microphone = await open(setup_data('photos'), '/pages/permissions/mic')
  await labels(microphone, 'permMic.allowMic.click.1', 'permMic.denyMic.click.1')
  const mic_before = await raw(microphone)
  await control(microphone, 'permMic.allowMic.click.1').evaluate(node => { node.click(); node.click() })
  await microphone.locator('[role="alert"]:visible').first().waitFor()
  assert.equal(await microphone.evaluate(() => window.__permissionRequests.microphone), 1)
  assert.equal(await raw(microphone), mic_before)
  check('Microphone page: Continue reaches the media adapter once; OS denial remains an error without a grant or write')

  const data = create_seed(now), question = data.icebreakers.find(row => row.user_id === 'user_zane')
  data.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
  data.drafts.push({ draft_id: 'permission_voice_draft', owner_user_id: 'user_cimoa', kind: 'introduction', target_id: 'user_zane', payload: { user_id: 'user_zane', question_id: question.question_id, mode: 'voice', text: '', operation_id: 'permission-voice' }, updated_at: now })
  const voice = await open(data, '/pages/discover/icebreaker/voice?user_id=user_zane&draft_id=permission_voice_draft')
  await control(voice, 'ibVoice.record.click.1').tap()
  await labels(voice, 'sheetMic.allowMic.click.1', 'sheetMic.denyMic.click.1')
  const voice_before = await raw(voice)
  await voice.waitForFunction(() => {
    const panel = document.querySelector('.intro-sheet--microphone.event-dialog--open .event-dialog-panel')
    return panel && getComputedStyle(panel).opacity === '1'
  })
  await voice.screenshot({ path: path.join(output, 'voice-permission.png') })
  await control(voice, 'sheetMic.denyMic.click.1').tap()
  await voice.getByRole('dialog', { name: 'Allow microphone access', exact: true }).waitFor({ state: 'hidden' })
  assert.equal(await voice.evaluate(() => window.__permissionRequests.microphone), 0)
  assert.equal(await raw(voice), voice_before)
  await control(voice, 'ibVoice.record.click.1').tap()
  await control(voice, 'sheetMic.allowMic.click.1').tap()
  await voice.locator('.brand-toast--error:visible').waitFor()
  assert.equal(await voice.evaluate(() => window.__permissionRequests.microphone), 1)
  assert.equal(await raw(voice), voice_before)
  check('Voice introduction shared pre-prompt: Cancel closes with zero requests; Continue invokes recording permission and truthful denial feedback')
  assert.deepEqual(report.errors, [])
  report.passed = true
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
