import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { serve_h5, context_for, set_safe_area } from './lib/pixel-acceptance.mjs'
import { discover_cursor_regression } from './lib/discover-cursor-regression.mjs'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/discover-cursor-2026-10-20'), key = 'cimoa_app_state_v2'
const report = { result: 'failed', checks: [], errors: [], cases: [] }
let browser, server, page
fs.mkdirSync(folder, { recursive: true })
const fixtures = ['default', 'home_empty'].map(name => ({ name, data: create_scenario(name), empty_home: name === 'home_empty' }))
const ids = fixtures[0].data.users.filter(user => Number.isInteger(user.discover_order)).sort((a, b) => a.discover_order - b.discover_order).map(user => user.user_id)
try {
  server = await serve_h5(); report.server_pid = server.pid; console.log(`Temporary cursor preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  for (const fixture of fixtures) {
    const context = await context_for(browser, key, fixture.data); page = await context.newPage(); page.setDefaultTimeout(10000)
    page.on('pageerror', error => report.errors.push(error.message))
    await page.goto(`${server.origin}/#/pages/discover/index`); await page.locator('.discover-photo-card--front').waitFor(); await set_safe_area(page, 62, 34)
    const result = await page.evaluate(discover_cursor_regression, { ids, empty_home: fixture.empty_home })
    for (const check of result.checks) { report.checks.push(`${fixture.name}: ${check}`); console.log('PASS ' + check) }
    report.cases.push({ name: fixture.name, ...result })
    await page.screenshot({ path: path.join(folder, `${fixture.name}-browser.png`) })
    await context.close()
  }
  assert.deepEqual(report.errors, []); report.result = 'passed'
  fs.writeFileSync(path.join(folder, 'native-fixtures.json'), JSON.stringify({ fixtures, ids, driver: discover_cursor_regression.toString() }, null, 2) + '\n')
} catch (error) {
  report.failure = String(error.stack || error)
  if (page && !page.isClosed()) { report.failure_state = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 2200) })); await page.screenshot({ path: path.join(folder, 'failure-browser.png') }) }
  throw error
} finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
