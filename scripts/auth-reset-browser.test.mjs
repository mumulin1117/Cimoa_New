import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'email'
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/evidence/auth-reset')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, `.${new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html')}`)
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(response)
})
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = message => { report.checks.push(message); console.log(`PASS ${message}`) }
let browser
try {
  fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary reset preview PID ${process.pid}: ${origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(origin)
  const guest = create_scenario('default', Date.now()); guest.session = { account_id: null, current_user_id: null, expires_at: null }
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), guest)
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const field = label => page.locator(`uni-input[aria-label="${label}"] input`)

  if (phase === 'email') {
    await page.goto(`${origin}/?phase=reset-email#/pages/auth/login`)
    const before = await state()
    await page.locator('[data-interaction="login.appleAuth.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /Apple sign-in is not configured/)
    assert.deepEqual(await state(), before)
    check('Apple login is explicitly unavailable and performs no local account write')

    await page.locator('[data-interaction="login.goFpEmail.click.1"]').click()
    await page.locator('.reset-email-page').waitFor()
    await field('Reset email').fill('not-an-email')
    await page.locator('[data-interaction="fpEmail.goFpCode.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /valid email/)
    assert.deepEqual(await state(), before)
    await field('Reset email').fill('cimoa@gmail.com')
    await page.locator('[data-interaction="fpEmail.goFpCode.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /step has not been restored yet/)
    assert.deepEqual(await state(), before)
    check('Reset Email validates locally and dependency-gates Code before creating a reset record')

    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(output, 'email.png') })
    await page.reload(); await page.locator('.reset-email-page').waitFor()
    assert.equal(await field('Reset email').inputValue(), '')
    assert.deepEqual(await state(), before)
    await page.locator('.auth-back').click(); await page.locator('.login-page').waitFor()
    check('Reset Email refresh leaks no unsaved address and Back restores Login')
  }

  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message)
  throw error
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  fs.writeFileSync(path.join(output, `${phase}-acceptance.json`), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Temporary reset preview PID ${process.pid} stopped`)
}
