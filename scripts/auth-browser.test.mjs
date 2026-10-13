// One-shot, isolated authentication test. The prototype is never served.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/evidence/auth')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'splash'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res)
})
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
let browser
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary authentication preview PID ${process.pid}, ${origin}`)
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } }), page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  const saved = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const write = data => page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', typeof data === 'string' ? data : JSON.stringify({ type: 'object', data })), data)
  fs.mkdirSync(output, { recursive: true })
  await page.goto(`${origin}/#/pages/auth/splash`)
  await page.locator('.brand--splash').waitFor()
  await page.locator('.page-transition').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  assert.equal(await saved(), null)
  assert.equal(await page.locator('.brand-tagline').count(), 0)
  assert.ok(Math.abs((await page.locator('.brand-arc').boundingBox()).width - 81) < 1)
  await page.screenshot({ path: path.join(output, 'splash.png') })
  check('fresh launch renders source brand/progress without authenticating or writing storage')
  if (phase === 'splash') {
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').innerText(), /not been restored/)
    assert.equal(await saved(), null)
    check('unrestored Welcome is an explicit deferred failure, not a legacy replacement')
  } else {
    await page.locator('.welcome-page').waitFor()
    assert.equal(await saved(), null)
    check('source automatic launch reaches actual Welcome once without a session write')
  }
  await write(create_scenario('default'))
  await page.goto(`${origin}/#/pages/auth/splash`); await page.reload()
  await page.getByRole('button', { name: 'Continue to Cimoa' }).dblclick()
  await page.locator('.home-header').waitFor()
  assert.equal(await page.locator('.main-skeleton').count(), 0)
  assert.equal(await page.locator('.main-tab-frame').getAttribute('data-page-depth'), '1')
  check('saved session restores Home at stack one; double tap/timer cannot duplicate or prepare skeleton')
  await write('{corrupt'); await page.goto(`${origin}/#/pages/auth/splash`); await page.reload()
  await page.getByRole('alert').waitFor()
  assert.equal(await saved(), '{corrupt')
  await write(create_scenario('default'))
  await page.getByRole('button', { name: 'Continue to Cimoa' }).click(); await page.locator('.home-header').waitFor()
  check('corrupt snapshot is not overwritten and retry recovers repaired data')
  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  report.cleaned_up = true
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, `${phase}-browser.json`), JSON.stringify(report, null, 2) + '\n')
  console.log('Authentication preview and browser closed.')
}
