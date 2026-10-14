import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/evidence/coins')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, `.${new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html')}`)
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase: 'center', result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = message => { report.checks.push(message); console.log(`PASS ${message}`) }
let browser
try {
  fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary coin preview PID ${process.pid}: ${origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(origin)
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', Date.now()))
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  await page.goto(`${origin}/?phase=coin-center#/pages/profile/index`)
  const before = await state()
  await page.locator('[data-interaction="profile.openStore.click.1"]').click()
  await page.locator('.coin-center-page').waitFor()
  assert.equal(await page.locator('.coin-balance').innerText(), '260')
  assert.equal(await page.getByRole('radio').count(), 6)
  assert.equal(await page.getByRole('radio', { name: /300 Coins/ }).getAttribute('aria-checked'), 'true')
  await page.locator('.secondary-page-scroll').evaluate(element => { element.scrollTop = 0 })
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(output, 'center-default.png') })
  check('Profile opens Coin Center with Store-derived balance and all six source packages')

  await page.getByRole('radio', { name: /60 Coins/ }).click()
  assert.equal(await page.getByRole('radio', { name: /60 Coins/ }).getAttribute('aria-checked'), 'true')
  assert.deepEqual(await state(), before)
  check('Package selection is transient UI state and does not change the ledger or purchase requests')

  await page.locator('[data-interaction="coinStore.continuePurchase.click.1"]').click()
  assert.match(await page.getByRole('alert').innerText(), /still being restored/)
  assert.deepEqual(await state(), before)
  await page.locator('[data-interaction="coinStore.openHistory2.click.1"]').click()
  assert.match(await page.getByRole('alert').innerText(), /still being restored/)
  assert.deepEqual(await state(), before)
  check('Unrestored purchasing and history dependencies fail visibly without writes or fake success')

  await page.setViewportSize({ width: 320, height: 568 })
  const scroll_metrics = await page.locator('.coin-center-page').evaluate(root => [...root.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].map(element => [element.clientHeight, element.scrollHeight]))
  assert.ok(scroll_metrics.some(([height, scroll_height]) => scroll_height > height))
  await page.screenshot({ path: path.join(output, 'center-small.png') })
  await page.setViewportSize({ width: 393, height: 852 })
  await page.locator('[data-interaction="coinStore.goBack.click.1"]').click()
  await page.locator('.profile-content').waitFor()
  check('Coin Center scrolls in a small viewport and Back restores the Profile instance')

  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message)
  throw error
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  fs.writeFileSync(path.join(output, 'center-acceptance.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Temporary coin preview PID ${process.pid} stopped`)
}
