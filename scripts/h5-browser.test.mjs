// One-shot test of independently built H5 only. Never serves the prototype.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), evidence = path.resolve('docs/evidence')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  const filename = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname))
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream'); fs.createReadStream(filename).pipe(res)
})
let browser
const errors = [], report = { runtime: 'Chromium, fresh isolated profile, 393 x 852', server_pid: process.pid, checks: [] }
const check = (name, detail) => { report.checks.push({ name, result: 'passed', detail }); console.log(`PASS ${name}`) }
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary H5 preview PID ${process.pid}, ${origin}`)
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin + '/#/pages/home/index', { waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: 'Primary navigation' }).waitFor()
  const read = () => page.evaluate(() => ({
    route: location.hash === '#/' ? '#/pages/home/index' : location.hash, depth: Number(document.querySelector('.main-tab-frame')?.dataset.pageDepth),
    active: document.querySelector('.tab[aria-current="page"]')?.getAttribute('aria-label'),
    bar: (() => { const r = document.querySelector('.tabbar').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })(),
    scroll: (() => { const r = document.querySelector('.main-tab-scroll').getBoundingClientRect(); return { bottom: r.bottom, height: r.height } })(),
    skeleton: !!document.querySelector('.main-skeleton'),
  }))
  const baseline = await read()
  assert.equal(baseline.active, 'Home'); assert.equal(baseline.depth, 1); assert.equal(baseline.skeleton, false)
  assert.ok(Math.abs(baseline.bar.width - 353) < 1); assert.ok(Math.abs(baseline.bar.height - 62) < 1)
  check('three source tabs, capsule geometry, restored session has no skeleton', baseline)
  for (let round = 0; round < 2; round++) {
    for (const name of ['Discover', 'Events', 'Discover', 'Home']) {
      await page.getByRole('button', { name, exact: true }).click()
      await page.waitForFunction((label) => document.querySelector('.tab[aria-current="page"]')?.getAttribute('aria-label') === label, name)
      await page.locator('.page-transition').evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
      const state = await read(); assert.equal(state.depth, 1); assert.equal(state.skeleton, false); assert.deepEqual(state.bar, baseline.bar); assert.ok(state.scroll.bottom <= state.bar.y)
    }
  }
  await page.getByRole('button', { name: 'Home', exact: true }).dblclick()
  assert.deepEqual(await read(), baseline)
  check('two bidirectional cycles, same-tab double click, unchanged stack and fixed bar')
  await page.getByRole('button', { name: 'Events', exact: true }).click()
  await page.locator('.page-transition').evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
  const scrolled = await page.locator('.main-tab-scroll .uni-scroll-view-scrollbar-hidden').first().evaluate((element) => { element.scrollTop = element.scrollHeight; return element.scrollTop > 0 })
  assert.equal(scrolled, true)
  assert.deepEqual((await read()).bar, baseline.bar)
  check('scroll does not move navigation or cover final content')
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
  const safe = await read(); assert.ok(Math.abs(safe.bar.y - baseline.bar.y + 34) < 1)
  assert.equal(await page.locator('.safe-area').first().evaluate((element) => element.getBoundingClientRect().height), 59)
  check('browser bridge injection owns top and bottom once (not native-device evidence)', safe)
  await page.reload({ waitUntil: 'networkidle' }); assert.equal((await read()).skeleton, false)
  await page.goto(origin + '/#/pages/auth/index?view=login', { waitUntil: 'networkidle' })
  await page.locator('input').nth(0).fill('cimoa@gmail.com')
  await page.locator('input').nth(1).fill('12341234')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  page.on('console', (message) => { if (message.type() === 'error') console.log('Browser:', message.text()) })
  await page.locator('.main-skeleton').waitFor({ state: 'visible' }); await page.locator('.main-skeleton').waitFor({ state: 'hidden' })
  for (const name of ['Discover', 'Events']) { await page.getByRole('button', { name, exact: true }).click(); await page.locator('.main-skeleton').waitFor({ state: 'visible' }); await page.locator('.main-skeleton').waitFor({ state: 'hidden' }) }
  await page.getByRole('button', { name: 'Home', exact: true }).click(); assert.equal((await read()).skeleton, false)
  check('real fixture login: each main tab consumes one skeleton; return consumes none')
  await page.reload({ waitUntil: 'networkidle' }); assert.equal((await read()).skeleton, false)
  check('refresh does not prepare another skeleton cycle')
  const media_source = fs.readFileSync('src/utils/mediaRepository.js', 'utf8')
  const media_url = 'data:text/javascript;base64,' + Buffer.from(media_source).toString('base64')
  await page.evaluate(async (url) => { const { media_repository } = await import(url); await media_repository.put('browser_fixture', new Blob(['persisted across reload'], { type: 'text/plain' })) }, media_url)
  await page.reload({ waitUntil: 'networkidle' })
  const media_result = await page.evaluate(async (url) => { const { media_repository } = await import(url); const blob = await media_repository.get('browser_fixture'); const value = await blob.text(); await media_repository.delete('browser_fixture'); return { value, deleted: !await media_repository.get('browser_fixture') } }, media_url)
  assert.deepEqual(media_result, { value: 'persisted across reload', deleted: true })
  check('real IndexedDB Blob survives page reload and is deleted cleanly')
  fs.mkdirSync(evidence, { recursive: true })
  await page.screenshot({ path: path.join(evidence, 'stage4-foundation.png') })
  assert.deepEqual(errors, [])
  check('no browser runtime exceptions')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  report.cleaned_up = true
  fs.mkdirSync(evidence, { recursive: true })
  fs.writeFileSync(path.join(evidence, 'stage4-browser.json'), JSON.stringify(report, null, 2) + '\n')
  console.log('Temporary preview and browser closed.')
}
