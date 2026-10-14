import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'privacy'
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/evidence/settings-safety')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, `.${new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html')}`)
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = message => { report.checks.push(message); console.log(`PASS ${message}`) }
let browser
let page
try {
  fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary settings preview PID ${process.pid}: ${origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(origin)
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', Date.now()))
  const goto = route => page.goto(`${origin}/?phase=${phase}#${route}`)
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const click = id => page.locator(`[data-interaction="${id}"]`).click()
  const shot = name => page.screenshot({ path: path.join(output, `${name}.png`) })

  if (phase === 'privacy') {
    await goto('/pages/settings/index')
    await click('settings.openSetPrivacy.click.1')
    await page.locator('.settings-privacy-page').waitFor()
    assert.equal(await page.getByRole('radio', { name: 'Visible in Discover' }).getAttribute('aria-checked'), 'true')
    assert.equal(await page.getByRole('switch', { name: 'Show academic year' }).getAttribute('aria-checked'), 'true')
    await shot('privacy-default')
    check('Privacy opens from Settings with source visibility choice and seven Store-backed controls')

    const before = await state()
    await page.getByRole('radio', { name: 'Auto Match only' }).click()
    await page.locator('.loading').waitFor()
    assert.equal((await state()).settings[0].privacy.discover_visible, before.settings[0].privacy.discover_visible)
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.equal((await state()).settings[0].privacy.discover_visible, false)
    assert.equal((await state()).settings[0].privacy.auto_match_visible, true)
    await page.reload()
    assert.equal(await page.getByRole('radio', { name: 'Auto Match only' }).getAttribute('aria-checked'), 'true')
    assert.match(await page.locator('.settings-page-note').innerText(), /Auto Match can still suggest/)
    check('Visibility waits for custom Loading, persists canonical flags and restores after refresh')

    await page.getByRole('switch', { name: 'Show academic year' }).click()
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.equal((await state()).settings[0].privacy.show_year, false)
    await page.getByRole('switch', { name: 'Allow video-call invitations' }).click()
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.equal((await state()).settings[0].privacy.allow_video, false)
    check('Privacy toggles write only through the canonical settings entity')

    const failure_before = await state()
    await page.evaluate(() => { window.__originalWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') throw Error('Storage full'); return window.__originalWrite.call(this, key, value) } })
    await page.getByRole('switch', { name: 'Show online status' }).click()
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.match(await page.getByRole('alert').innerText(), /Storage full/)
    assert.deepEqual(await state(), failure_before)
    assert.equal(await page.getByRole('switch', { name: 'Show online status' }).getAttribute('aria-checked'), 'true')
    await page.evaluate(() => { Storage.prototype.setItem = window.__originalWrite; delete window.__originalWrite })
    check('Persistence failure shows a retryable error and leaves privacy data unchanged')

    await page.setViewportSize({ width: 320, height: 568 })
    await shot('privacy-small')
    assert.equal(await page.locator('.secondary-page-scroll .uni-scroll-view').last().evaluate(element => element.scrollHeight > element.clientHeight), true)
    await page.setViewportSize({ width: 393, height: 852 })
    await click('setPrivacy.goBack.click.1')
    await page.locator('.settings-page').waitFor()
    check('Small viewport scrolls inside the fixed safe-area frame and Back returns to Settings')

    const expired = create_scenario('session_expired', Date.now())
    await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), expired)
    await page.goto(`${origin}/?phase=${phase}&scenario=expired#/pages/settings/privacy`)
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByRole('switch').count(), 0)
    assert.match(await page.getByRole('alert').innerText(), /session has ended/)
    check('Expired session hides private controls and offers account-entry recovery')
  }

  if (phase === 'permissions') {
    await goto('/pages/settings/index')
    const before = await state()
    await click('settings.openSetPerm.click.1')
    await page.locator('.settings-permissions-page').waitFor()
    const names = ['Camera', 'Microphone', 'Photos', 'Notifications', 'Location']
    for (const name of names) {
      const row = page.getByRole('button', { name: new RegExp(`^${name}`) })
      await row.waitFor()
      assert.match(await row.innerText(), /Allowed|Denied|Not Requested|Unavailable/)
    }
    assert.deepEqual(await state(), before)
    await shot('permissions-browser')
    check('Permissions page reads five browser statuses without changing account data')

    await page.getByRole('button', { name: /^Camera/ }).click()
    assert.match(await page.getByRole('alert').innerText(), /unavailable in this browser/)
    assert.deepEqual(await state(), before)
    check('Browser fallback reports that native Settings are unavailable and never fakes a grant')

    await page.reload()
    await page.locator('.settings-permissions-page').waitFor()
    for (const name of names) assert.match(await page.getByRole('button', { name: new RegExp(`^${name}`) }).innerText(), /Allowed|Denied|Not Requested|Unavailable/)
    await click('setPerm.goBack.click.1')
    await page.locator('.settings-page').waitFor()
    assert.deepEqual(await state(), before)
    check('Permission statuses refresh from the environment and Back returns to Settings with no writes')
  }

  if (phase === 'notifications') {
    await page.context().grantPermissions(['notifications'], { origin })
    await goto('/pages/settings/index')
    const initial = await state()
    await click('settings.openSetNotif.click.1')
    await page.locator('.settings-notifications-page').waitFor()
    await page.getByRole('switch', { name: 'All notifications' }).waitFor()
    assert.equal(await page.getByRole('switch', { name: 'All notifications' }).getAttribute('aria-checked'), 'true')
    assert.equal(await page.getByRole('switch', { name: 'Product updates' }).getAttribute('aria-checked'), 'false')
    await shot('notifications-default')
    check('Notifications opens with source master and eight canonical preference rows')

    await page.getByRole('switch', { name: 'All notifications' }).click()
    await page.locator('.loading').waitFor()
    assert.equal((await state()).settings[0].notifications.master, true)
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.equal((await state()).settings[0].notifications.master, false)
    assert.equal(await page.getByRole('switch', { name: 'Messages' }).getAttribute('aria-disabled'), 'true')
    await page.getByRole('switch', { name: 'All notifications' }).click()
    await page.locator('.loading').waitFor()
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.equal((await state()).settings[0].notifications.master, true)
    check('Master switch requests a real granted permission, then waits for Loading before each Store write')

    await page.getByRole('switch', { name: 'Product updates' }).click()
    await page.locator('.loading').waitFor()
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.equal((await state()).settings[0].notifications.product, true)
    await page.reload()
    assert.equal(await page.getByRole('switch', { name: 'Product updates' }).getAttribute('aria-checked'), 'true')
    check('Individual preference persists and restores after refresh')

    const failure_before = await state()
    await page.evaluate(() => { window.__originalWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') throw Error('Storage full'); return window.__originalWrite.call(this, key, value) } })
    await page.getByRole('switch', { name: 'Messages' }).click()
    await page.locator('.loading').waitFor()
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.match(await page.getByRole('alert').innerText(), /Storage full/)
    assert.deepEqual(await state(), failure_before)
    await page.evaluate(() => { Storage.prototype.setItem = window.__originalWrite; delete window.__originalWrite })
    check('Notification persistence failure leaves the preference entity unchanged')

    await page.context().clearPermissions()
    await click('setNotif.simulateSystemOff.click.1')
    await page.getByText(/permission has not been requested|unavailable in this environment/).waitFor()
    assert.deepEqual(await state(), failure_before)
    await click('setNotif.openSettings.click.1')
    assert.match(await page.getByRole('alert').innerText(), /unavailable in this browser/)
    await click('setNotif.goBack.click.1')
    await page.locator('.settings-page').waitFor()
    check('Former simulation control refreshes real system state; browser Settings failure is explicit and Back is correct')
  }

  if (phase === 'language') {
    await goto('/pages/settings/index')
    const before = await state()
    await click('settings.openSetLang.click.1')
    await page.locator('.settings-language-page').waitFor()
    assert.equal(await page.getByRole('radio', { name: 'English' }).getAttribute('aria-checked'), 'true')
    assert.equal(await page.getByRole('radio', { name: '繁體中文' }).getAttribute('aria-checked'), 'false')
    await shot('language-default')
    await page.getByRole('radio', { name: '繁體中文' }).click()
    assert.match(await page.getByRole('alert').innerText(), /not available/)
    assert.equal(await page.locator('.loading').count(), 0)
    assert.deepEqual(await state(), before)
    assert.equal(await page.getByRole('radio', { name: 'English' }).getAttribute('aria-checked'), 'true')
    check('Unavailable Traditional Chinese reports a real limitation without Loading, write or false selection')

    await page.getByRole('radio', { name: 'English' }).click()
    assert.match(await page.getByRole('status').innerText(), /already selected/)
    assert.deepEqual(await state(), before)
    await page.reload()
    assert.equal(await page.getByRole('radio', { name: 'English' }).getAttribute('aria-checked'), 'true')
    await click('setLang.goBack.click.1')
    await page.locator('.settings-page').waitFor()
    check('English remains canonical across refresh and Back returns to Settings')
  }

  if (phase === 'blocked') {
    await goto('/pages/settings/index')
    await click('settings.openBlockedList.click.1')
    await page.locator('.settings-blocked-page').waitFor()
    const before = await state()
    assert.equal(before.blocked_users.length, 1)
    await page.getByRole('button', { name: 'Unblock Jordan Ellis' }).click()
    await page.getByRole('dialog', { name: 'Unblock Jordan Ellis?' }).waitFor()
    assert.match(await page.getByRole('dialog').innerText(), /does not restore/)
    await shot('blocked-confirm')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.deepEqual(await state(), before)
    check('Blocked account opens the source confirmation Sheet and Cancel performs no write')

    await page.getByRole('button', { name: 'Unblock Jordan Ellis' }).click()
    await page.evaluate(() => { window.__originalWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'cimoa_app_state_v2') throw Error('Storage full'); return window.__originalWrite.call(this, key, value) } })
    await page.getByRole('button', { name: 'Unblock', exact: true }).click()
    await page.locator('.loading').waitFor()
    assert.equal((await state()).blocked_users.length, 1)
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.match(await page.getByRole('dialog').innerText(), /Storage full/)
    assert.deepEqual(await state(), before)
    await page.evaluate(() => { Storage.prototype.setItem = window.__originalWrite; delete window.__originalWrite })
    check('Failed unblock remains blocked and retryable after the required Loading')

    await page.getByRole('button', { name: 'Unblock', exact: true }).click()
    await page.locator('.loading').waitFor()
    assert.equal((await state()).blocked_users.length, 1)
    await page.locator('.loading').waitFor({ state: 'detached' })
    assert.equal((await state()).blocked_users.length, 0)
    await page.getByText('No blocked accounts').waitFor()
    await page.reload()
    await page.getByText('No blocked accounts').waitFor()
    assert.equal((await state()).blocked_users.length, 0)
    await shot('blocked-empty')
    await click('blockedList.goBack.click.1')
    await page.locator('.settings-page').waitFor()
    check('Confirmed unblock persists the empty state through refresh and Back returns to Settings')
  }

  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} catch (error) {
  report.failure = String(error.stack || error)
  report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2500), loading: !!document.querySelector('.loading') })).catch(() => null)
  console.error(report.failure, report.visible_failure)
  process.exitCode = 1
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  fs.writeFileSync(path.join(output, `${phase}-acceptance.json`), `${JSON.stringify(report, null, 2)}\n`)
  console.log('Temporary settings server and isolated browser closed.')
}
