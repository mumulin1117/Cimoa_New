import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { serve_h5, context_for, set_safe_area } from './lib/pixel-acceptance.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/report-submit-label-2026-10-20'), key = 'cimoa_app_state_v2'
const report = { result: 'failed', checks: [], errors: [] }
let server, browser
try {
  fs.mkdirSync(folder, { recursive: true }); server = await serve_h5(); report.server_pid = server.pid; console.log(`Temporary report copy preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  const context = await context_for(browser, key, create_scenario('default', Date.now())), page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', e => report.errors.push(e.message))
  for (const test of [
    { name: 'user', route: '/pages/safety/report-user?target_user_id=user_lina', reason: 'Harassment', target_type: 'user', target_id: 'user_lina', interaction: 'safetyReport.submitReport.click.1', destination: '.messages-page' },
    { name: 'event', route: '/pages/events/report?event_id=event_picnic', reason: 'Unsafe activity', target_type: 'event', target_id: 'event_picnic', interaction: 'evReport.submitEvReport.click.1', destination: '.event-detail-page' },
  ]) {
    await page.goto(server.origin + '/#' + test.route); const button = page.getByRole('button', { name: 'Submit report', exact: true }); await button.waitFor(); await set_safe_area(page, 62, 34)
    assert.equal(await button.getAttribute('data-interaction'), test.interaction); assert.equal(await button.getAttribute('aria-disabled'), 'true')
    const before = await page.evaluate(key => localStorage.getItem(key), key)
    await button.evaluate(e => e.click()); assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
    await page.getByRole('radio', { name: test.reason, exact: true }).click(); assert.equal(await button.getAttribute('aria-disabled'), 'false')
    await page.screenshot({ path: path.join(folder, `${test.name}-ready.png`) })
    await button.click(); assert.equal(await button.getAttribute('aria-disabled'), 'true'); assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
    await button.evaluate(e => e.click()); await page.locator(test.destination).waitFor()
    await page.locator('.brand-toast--info').waitFor()
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
    assert.equal(await page.locator('.report-saved,.event-report-saved').count(), 0)
    assert.equal(await button.count(), 0)
    assert.match(await page.locator('.brand-toast-message:visible').innerText(), /Thank you for sharing your concern.*review it as soon as possible/s)
    await page.goto(server.origin + '/#' + test.route)
    const repeat = page.getByRole('button', { name: 'Submit report', exact: true })
    await page.getByRole('radio', { name: test.reason, exact: true }).click()
    await repeat.click(); await page.locator(test.destination).waitFor(); await page.locator('.brand-toast--info').waitFor()
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before)
    report.checks.push(`${test.name}: exact Submit report label/interaction; reason required; duplicate lock; branded Loading; source return; no report record; repeat allowed`); console.log('PASS ' + report.checks.at(-1))
  }
  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1 }
finally { if (browser) await browser.close(); if (server) await server.close(); report.cleaned = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
