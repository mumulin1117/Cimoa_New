import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { display_copy_fixtures } from './lib/display-copy-cases.mjs'
import { terms_document, privacy_document, community_document } from '../src/utils/legalDocuments.js'
import { serve_h5, set_safe_area } from './lib/pixel-acceptance.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/display-copy-2026-10-20'), key = 'cimoa_app_state_v2', report = { result: 'failed', checks: [], errors: [] }
let browser, server
try {
  fs.mkdirSync(folder, { recursive: true }); const fixture = await display_copy_fixtures(); fs.writeFileSync(path.join(folder, 'native-fixtures.json'), JSON.stringify(fixture, null, 2) + '\n')
  server = await serve_h5(); report.server_pid = server.pid; console.log(`Temporary display-copy preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true }); const page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(7000)
  page.on('pageerror', e => report.errors.push(e.message)); await page.goto(server.origin)
  const visit = async item => {
    const data = fixture.fixtures[item.fixture]; await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data })
    await page.goto(`${server.origin}/?copy=${item.name}#${item.route}`); await page.locator(item.selector).waitFor(); await set_safe_area(page, 62, 34)
    await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish() })
  }
  for (const item of fixture.cases) {
    await visit(item); const text = await page.locator(item.selector).innerText(); assert.ok(text.includes(item.text), `${item.name}: missing ${item.text}`)
    assert.doesNotMatch(text, /local (?:account|data|demo|social|build|mode|code|verification|draft|profile|session)|saved locally|local-only|this build|TEST STATES/i)
    if (['login', 'verification-code', 'report-user', 'support', 'privacy', 'delete-success'].includes(item.name)) await page.screenshot({ path: path.join(folder, `${item.name}-browser.png`) })
    if (item.name === 'login') { assert.equal(await page.locator('.auth-test-states').count(), 0); assert.equal(await page.locator('[data-interaction="login.appleAuth.click.1"]').count(), 0) }
    report.checks.push(item.name); console.log('PASS ' + item.name)
  }
  await visit(fixture.cases.find(c => c.name === 'community'))
  const agreements_before = await page.evaluate(key => localStorage.getItem(key), key)
  for (const doc of [terms_document, privacy_document, community_document]) {
    await page.getByRole('button', { name: `Read ${doc.title}`, exact: true }).click(); const dialog = page.getByRole('dialog', { name: doc.title, exact: true }); await dialog.waitFor(); const text = await dialog.innerText(); assert.ok(text.includes(doc.intro)); for (const [title, copy] of doc.sections) { assert.ok(text.includes(title)); assert.ok(text.includes(copy)) }
    await dialog.getByRole('button', { name: `Close ${doc.title}`, exact: true }).click(); await dialog.waitFor({ state: 'hidden' })
  }
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), agreements_before); report.checks.push('Community sheets use the same full canonical documents and X close without changing consent')
  await visit(fixture.cases.find(c => c.name === 'support')); await page.locator('[data-interaction="setSupport.openSupportForm.click.1"]').click(); await page.getByRole('radio', { name: 'Technical issue', exact: true }).click(); await page.locator('textarea').fill('Please keep these details for my purchase concern.'); const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data.support_requests.length, key)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.waitForFunction(() => document.querySelector('.support-delivery')?.textContent.includes('Support delivery is currently unavailable'))
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data.support_requests.length, key), before); assert.doesNotMatch(await page.locator('.support-delivery').innerText(), /ticket created|sent successfully/i); report.checks.push('support saves draft without pretending delivery')
  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1 }
finally { if (browser) await browser.close(); if (server) await server.close(); report.cleaned = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
