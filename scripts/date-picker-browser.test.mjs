import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { serve_h5, set_safe_area } from './lib/pixel-acceptance.mjs'
import { choose_date_of_birth } from './lib/date-picker-driver.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/age/date-picker-2026-10-19'), report = { result: 'failed', checks: [], errors: [] }
let server, browser
try {
  server = await serve_h5(); report.server_pid = server.pid; console.log(`Temporary DOB preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } }), page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).click(), value = () => page.locator('.age-date-value:visible').getAttribute('data-date-value'), stored = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const dialog = page.getByRole('dialog', { name: 'Date of birth', exact: true }), check = text => { report.checks.push(text); console.log('PASS ' + text) }
  const shot = async name => { if (await dialog.isVisible()) await page.locator('.dob-picker.event-dialog--open').waitFor(); await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }); await page.screenshot({ path: path.join(folder, name + '.png') }) }
  await page.goto(server.origin + '/#/pages/auth/age'); await page.locator('.age-page').waitFor(); await set_safe_area(page, 54, 0); await shot('actual-browser')
  assert.equal(await value(), ''); assert.equal(await page.locator('.age-page input').count(), 0)
  await click('age.goAgree.click.1'); await page.getByRole('alert').waitFor(); assert.equal(await stored(), null)
  await click('age.openDatePicker.click.1'); await dialog.waitFor(); assert.equal(await dialog.getByRole('spinbutton').count(), 3); await shot('picker-browser'); assert.equal(await stored(), null)
  const indicator = await dialog.locator('.uni-picker-view-indicator').first().boundingBox(); assert.ok(Math.abs(indicator.height - 40) < 1)
  const year = dialog.getByRole('spinbutton', { name: 'Year', exact: true }), before_year = Number(await year.getAttribute('aria-valuenow'))
  await year.locator('.uni-picker-view-group').dispatchEvent('wheel', { deltaY: 30 }); await page.waitForFunction(y => Number(document.querySelector('[role=spinbutton][aria-label=Year]').getAttribute('aria-valuenow')) === y + 1, before_year)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); assert.equal(await value(), ''); assert.equal(await stored(), null)
  check('Click opens three real uni-app calendar wheels without a text keyboard; wheel works and Cancel preserves the empty draft/storage')
  await choose_date_of_birth(page, '2024-02-29'); assert.equal(await value(), '2024-02-29'); assert.equal(await stored(), null)
  await click('age.openDatePicker.click.1'); await dialog.waitFor(); assert.equal(await dialog.getByRole('spinbutton', { name: 'Day', exact: true }).getAttribute('aria-valuemax'), '29'); await dialog.getByRole('spinbutton', { name: 'Year', exact: true }).press('ArrowUp'); assert.equal(await dialog.getByRole('spinbutton', { name: 'Day', exact: true }).getAttribute('aria-valuemax'), '28'); await dialog.getByRole('button', { name: 'Done', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); assert.equal(await value(), '2025-02-28')
  await click('age.goAgree.click.1'); await page.locator('.age-under').waitFor(); assert.equal(await stored(), null)
  check('Done fills YYYY-MM-DD only; leap-year/month changes clamp correctly; an under-18 date is rejected without saving')
  await choose_date_of_birth(page, '2000-01-01'); await click('age.openDatePicker.click.1'); await dialog.waitFor(); await dialog.getByRole('spinbutton', { name: 'Year', exact: true }).press('ArrowUp'); await page.locator('[data-interaction="age.datePicker.mask.click.1"]').click({ position: { x: 3, y: 3 } }); await dialog.waitFor({ state: 'hidden' }); assert.equal(await value(), '2000-01-01')
  await page.evaluate(() => { window.__savedSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === 'cimoa_app_state_v2') throw Error('Injected storage failure'); return window.__savedSetItem.call(this, k, v) } })
  await click('age.goAgree.click.1'); await page.locator('.loading:visible').waitFor(); assert.equal(await stored(), null); await page.getByRole('alert').waitFor(); await page.locator('.loading:visible').waitFor({ state: 'hidden' }); assert.equal(await value(), '2000-01-01'); assert.equal(await stored(), null)
  await page.evaluate(() => { Storage.prototype.setItem = window.__savedSetItem; delete window.__savedSetItem })
  check('Mask cancellation preserves the prior date; failed Continue rolls back storage and retains the chosen date for retry')
  await click('age.goAgree.click.1'); await page.locator('.loading:visible').waitFor(); assert.equal(await stored(), null); await page.locator('.community-page').waitFor(); const committed = await stored(); assert.equal(JSON.parse(committed).data.auth_flow.profile_draft.date_of_birth, '2000-01-01')
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.locator('.age-page').waitFor(); assert.equal(await value(), '2000-01-01'); await page.reload(); await page.locator('.age-page').waitFor(); assert.equal(await value(), '2000-01-01'); assert.equal(await stored(), committed)
  check('Adult Continue persists only after custom Loading, reaches Community, and restores the same date on Back and refresh')
  await page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(page, 62, 34); await click('age.openDatePicker.click.1'); await dialog.waitFor(); await shot('picker-browser-small')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); const bounds = await dialog.boundingBox(); assert.ok(bounds.y >= 62 - 1); assert.ok(bounds.y + bounds.height <= 568 - 34 + 1)
  await dialog.getByRole('spinbutton', { name: 'Year', exact: true }).press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.equal(await value(), '2000-01-01'); await click('age.goBack.click.1'); await page.locator('.welcome-page').waitFor()
  check('320x568 with 62/34 safe areas keeps the picker within the screen; Escape closes it and direct Back belongs to Welcome')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
