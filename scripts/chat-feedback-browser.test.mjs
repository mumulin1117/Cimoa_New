import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { serve_h5, context_for, set_safe_area } from './lib/pixel-acceptance.mjs'
import { chat_feedback_regression } from './lib/chat-feedback-regression.mjs'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/chat-feedback-2026-10-20'), baseline = create_seed()
const report = { result: 'failed', checks: [], errors: [] }
let browser, server, page
fs.mkdirSync(folder, { recursive: true })
try {
  server = await serve_h5(); report.server_pid = server.pid; console.log(`Temporary chat feedback preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const context = await context_for(browser, 'cimoa_app_state_v2', baseline); page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(`${server.origin}/#/pages/home/index`); await page.locator('.home-header').waitFor(); await set_safe_area(page, 62, 34)
  const result = await page.evaluate(chat_feedback_regression, {}); report.checks.push(...result.checks)
  await page.reload(); await page.locator('.chat-composer').waitFor(); await set_safe_area(page, 62, 34)
  const restored = await page.evaluate(chat_feedback_regression, { recovery: true }); report.checks.push(...restored.checks)
  for (const check of report.checks) console.log('PASS ' + check)
  await page.screenshot({ path: path.join(folder, 'restored-browser.png') })
  fs.writeFileSync(path.join(folder, 'native-fixture.json'), JSON.stringify({ data: baseline, driver: chat_feedback_regression.toString() }, null, 2) + '\n')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) {
  report.failure = String(error.stack || error)
  if (page && !page.isClosed()) { report.failure_state = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 2200) })); await page.screenshot({ path: path.join(folder, 'failure-browser.png') }) }
  throw error
} finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
