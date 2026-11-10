import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { toast_geometry, toast_report_regression } from './lib/toast-regression.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/brand-toast'), origin = 'http://127.0.0.1:47841'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false }, check = message => { report.checks.push(message); console.log('PASS ' + message) }
let browser, page
try {
  fs.mkdirSync(output, { recursive: true })
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(8000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  const now = Date.UTC(2026, 9, 13, 1); await page.clock.setFixedTime(new Date(now)); await page.goto(origin)
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', now))
  const go = async route => { await page.goto(`${origin}/#${route}`); await page.reload(); await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge); await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 })) }
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).first().click()
  const toast = () => page.locator('.brand-toast:not(.brand-toast-leave-active)')
  const state = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  await go('/pages/settings/lang'); await page.locator('.language-choice').first().waitFor(); const initial = await state()
  await page.locator('.language-choice').first().click(); await toast().waitFor()
  assert.match(await toast().innerText(), /English is already selected/); report.info = await page.evaluate(toast_geometry)
  assert.equal(await page.locator('#cimoa-toast-root').count(), 1)
  await page.screenshot({ path: path.join(output, 'info-393x852.png') })
  await page.getByRole('button', { name: 'Dismiss notification' }).focus(); await page.keyboard.press('Enter'); await toast().waitFor({ state: 'hidden' })
  assert.equal(await state(), initial)
  check('Info Toast is centered below the safe area with theme border/icon, one host, keyboard close and no data write')
  await page.locator('.language-choice').first().click(); await toast().waitFor(); await toast().waitFor({ state: 'hidden', timeout: 5500 })
  check('Normal feedback automatically disappears')
  await page.locator('.language-choice').first().click(); await toast().waitFor(); const first = await toast().getAttribute('data-toast-id')
  await page.locator('.language-choice').last().click(); await page.waitForFunction(id => { const toast = document.querySelector('.brand-toast:not(.brand-toast-leave-active)'); return toast && toast.dataset.toastId !== id && toast.dataset.toastTone === 'error' }, first)
  assert.equal(await toast().count(), 1); assert.equal((await page.evaluate(toast_geometry)).live, 'assertive')
  await page.screenshot({ path: path.join(output, 'error-393x852.png') })
  check('New failure replaces previous feedback with an error icon and assertive announcement, without stacking')
  await go('/pages/profile/basic'); await page.locator('.profile-basic-page').waitFor()
  await page.locator('uni-input[aria-label="Display name"] input').fill('')
  await click('editBasic.saveBasic.click.1'); await toast().waitFor(); const validation = await toast().innerText()
  await page.getByRole('button', { name: 'Dismiss notification' }).click(); await toast().waitFor({ state: 'hidden' })
  await click('editBasic.saveBasic.click.1'); await toast().waitFor(); assert.equal(await toast().innerText(), validation)
  check('Closing a form error clears only its transient UI state; repeating the same invalid action shows feedback again')
  await page.getByRole('button', { name: 'Dismiss notification' }).click(); await toast().waitFor({ state: 'hidden' })
  await page.locator('uni-input[aria-label="Display name"] input').pressSequentially('Ethan')
  await page.waitForFunction(() => document.querySelector('uni-input[aria-label="Display name"]').__vueParentComponent.props.modelValue === 'Ethan')
  await click('editBasic.saveBasic.click.1'); await page.waitForFunction(() => document.querySelector('.brand-toast:not(.brand-toast-leave-active) .brand-toast-message')?.textContent === 'Profile updated')
  assert.match(await toast().innerText(), /Profile updated/); assert.equal(await toast().getAttribute('data-toast-tone'), 'success')
  await page.screenshot({ path: path.join(output, 'success-393x852.png') })
  check('A real profile update finishes its write and return before showing Profile updated')
  await go('/pages/profile/prefs'); await click('editPrefs.savePrefs.click.1'); await page.waitForFunction(() => document.querySelector('.brand-toast:not(.brand-toast-leave-active) .brand-toast-message')?.textContent === 'Preferences updated'); assert.match(await toast().innerText(), /Preferences updated/)
  check('Profile preferences show Preferences updated after the actual action')
  await go('/pages/auto-match/preferences'); await click('amPrefs.savePrefs.click.1'); await page.waitForFunction(() => document.querySelector('.brand-toast:not(.brand-toast-leave-active) .brand-toast-message')?.textContent === 'Preferences updated'); assert.match(await toast().innerText(), /Preferences updated/)
  check('Auto Match preferences use the same success feedback')
  await go('/pages/events/detail?event_id=event_picnic'); await page.locator('.event-detail-cover').waitFor()
  // Both browser and native execute the same DOM/state assertions.
  report.report = await page.evaluate(`(() => { ${toast_geometry.toString()} return (${toast_report_regression.toString()})(); })()`)
  await page.screenshot({ path: path.join(output, 'report-393x852.png') })
  check('Report acknowledgement follows validation, returns to Event detail and changes no persisted data')
  report.layouts = []
  for (const viewport of [{ width: 320, height: 568 }, { width: 440, height: 956 }, { width: 852, height: 393 }]) {
    await page.setViewportSize(viewport); await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 })); await toast().waitFor()
    report.layouts.push(await page.evaluate(toast_geometry))
  }
  check('Event acknowledgement stays readable on small, large and landscape viewports without a report record')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await toast().evaluate(element => getComputedStyle(element).transitionDuration), '0s')
  await go('/pages/home/index'); assert.equal(await toast().count(), 0)
  check('Reduced motion is supported and navigation clears stale feedback')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} catch (error) { report.failure = String(error.stack || error); report.visible_failure = await page?.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-2200), inputs: [...document.querySelectorAll('input')].map(input => input.value), toast: document.querySelector('.brand-toast')?.textContent, saveDisabled: document.querySelector('[data-interaction="editBasic.saveBasic.click.1"]')?.getAttribute('aria-disabled'), state: JSON.parse(localStorage.getItem('cimoa_app_state_v2'))?.data?.users?.find(user => user.user_id === 'user_cimoa') })).catch(() => null); throw error }
finally { await browser?.close(); fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
