import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const browserModule = process.env.CIMOA_BROWSER_MODULE || 'playwright'
const { chromium } = require(browserModule), dependencies = createRequire(path.join(require.resolve(browserModule), '../package.json'))
const { PNG } = dependencies('pngjs'), pixelmatch = (await import(dependencies.resolve('pixelmatch'))).default
const report = { passed: false, checks: [], visual: [], errors: [], csp: [], externalRequests: [], serverStarted: false, deployed: false }
const directory = path.resolve('artifacts/cimoa-static'), root = path.join(directory, 'Cimoa/public'), origin = 'https://cimoabeam.online'
const input = JSON.parse(fs.readFileSync(path.join(directory, 'build-report.json'))).input
const source = fs.readFileSync(input, 'utf8'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.xml': 'application/xml', '.txt': 'text/plain' }
const policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
const check = text => { report.checks.push(text); console.log('PASS ' + text) }
const pages = ['index', 'about', 'privacy', 'terms', 'support', 'safety', '404']
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'https://source.invalid' && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: source })
    if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort() }
    const filename = path.resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname))
    const exists = filename.startsWith(root + path.sep) && fs.existsSync(filename) && fs.statSync(filename).isFile()
    return route.fulfill({ status: exists ? 200 : 404, contentType: mime[path.extname(filename)] || 'application/octet-stream', headers: { 'Content-Security-Policy': policy, 'X-Content-Type-Options': 'nosniff' }, body: fs.readFileSync(exists ? filename : path.join(root, '404.html')) })
  })
  const page = await context.newPage(); page.setDefaultTimeout(8000)
  page.on('pageerror', error => report.errors.push(error.message))
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', event => window.__csp.push(event.violatedDirective + ': ' + event.blockedURI)) })
  const ready = async () => {
    await page.locator('h1').waitFor()
    await page.evaluate(async () => {
      await document.fonts.ready; window.scrollTo(0, 0)
      const visible = [...document.images].filter(image => { const r = image.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 })
      let timer
      try { await Promise.race([Promise.all(visible.map(image => image.decode())), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Visible website image decode timed out')), 6000) })]) }
      finally { clearTimeout(timer) }
    })
    await page.waitForTimeout(80)
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 393, height: 852 }]) {
    await page.setViewportSize(viewport)
    await page.goto('https://source.invalid/#home'); await ready()
    const original = await page.screenshot({ path: path.join(directory, `source-${viewport.width}.png`) })
    await page.goto(origin + '/'); await ready()
    const actual = await page.screenshot({ path: path.join(directory, `actual-${viewport.width}.png`) })
    const a = PNG.sync.read(original), b = PNG.sync.read(actual), diff = new PNG({ width: a.width, height: a.height })
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: .1 })
    fs.writeFileSync(path.join(directory, `diff-${viewport.width}.png`), PNG.sync.write(diff))
    report.visual.push({ viewport, changedPixels: changed, ratio: changed / (a.width * a.height) })
    assert.ok(changed / (a.width * a.height) < .001, JSON.stringify(report.visual.at(-1)))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    report.csp.push(...await page.evaluate(() => window.__csp))
  }
  check('Desktop/mobile first-screen pixel comparison preserves the supplied latest design under the same reduced-motion phase')
  for (const index of [1, 2, 0]) {
    await page.locator('#tab-' + index).click()
    assert.equal(await page.locator('.feature-panel:visible').getAttribute('id'), 'panel-' + index)
  }
  await page.locator('#tab-0').focus(); await page.keyboard.press('End')
  assert.equal(await page.locator('.feature-panel:visible').getAttribute('id'), 'panel-2')
  await page.keyboard.press('Home'); assert.equal(await page.locator('#tab-0').getAttribute('aria-selected'), 'true')
  await page.locator('.faq-list summary').first().click(); assert.equal(await page.locator('.faq-list details').first().getAttribute('open'), '')
  check('All three feature panels, arrow/Home/End keyboard semantics and native FAQ interaction remain functional')
  await page.locator('.menu-toggle').click(); assert.equal(await page.locator('#main-nav').getAttribute('class'), 'nav open')
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false')
  await page.locator('.store-button').first().click(); await page.locator('dialog[open]').waitFor()
  assert.match(await page.locator('#dialog-description').textContent(), /CimoaTeam@gmail.com/)
  assert.equal(await page.locator('#main').evaluate(node => node.inert), true)
  await page.keyboard.press('Escape'); await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.store-button').first().evaluate(node => document.activeElement === node), true)
  assert.equal(await page.locator('#main').evaluate(node => node.inert), false)
  check('Mobile menu and download-availability dialog preserve Escape, focus return and background interaction isolation')
  await page.locator('.footer-bottom a[href="privacy.html"]').click(); assert.equal(new URL(page.url()).pathname, '/privacy.html')
  assert.equal(await page.locator('.legal-body>section').count(), 11)
  await page.locator('.legal-contents a').nth(8).click(); assert.match(page.url(), /#legal-section-9$/)
  await page.locator('.header-actions [lang=en]').click(); assert.equal(new URL(page.url()).pathname, '/en/privacy.html')
  assert.equal(await page.locator('html').getAttribute('lang'), 'en')
  await page.reload(); assert.equal(await page.locator('html').getAttribute('lang'), 'en')
  await page.goto(origin + '/'); await page.waitForURL('**/en/index.html')
  await page.goto(origin + '/en/privacy.html#legal-section-9')
  await page.locator('.header-actions [lang=fr]').click(); assert.equal(new URL(page.url()).pathname, '/privacy.html')
  check('Policies have real direct paths, working contents anchors and matching French/English navigation through refresh')
  await page.goto(origin + '/index.html#/terms/section-2')
  await page.waitForURL('**/terms.html#legal-section-2')
  check('Previously distributed hash policy URLs migrate to the corresponding real document and section')
  await page.goto(origin + '/'); await ready(); await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator('.meet-motion').click(); assert.equal(await page.locator('.meet-section').getAttribute('data-paused'), 'true')
  await page.locator('.meet-motion').click(); assert.equal(await page.locator('.meet-section').getAttribute('data-paused'), 'false')
  const track = () => page.locator('.avatar-track').first().evaluate(node => getComputedStyle(node).transform)
  const first = await track(); await page.waitForTimeout(150); assert.notEqual(await track(), first)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
  assert.equal(await page.locator('.meet-section').getAttribute('data-paused'), 'true')
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await page.locator('.avatar-track').first().evaluate(node => getComputedStyle(node).animationName), 'none')
  check('Avatar light-band animation actually moves and respects manual pause, background visibility and reduced motion')
  for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    for (const relative of ['support.html', 'safety.html', 'terms.html', 'en/privacy.html']) {
      await page.goto(origin + '/' + relative); await ready()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${relative} ${viewport.width}`)
      assert.equal(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true)
      report.csp.push(...await page.evaluate(() => window.__csp))
    }
  }
  check('Support/safety/legal pages and self-hosted resources render without overflow at 320, 393 and 1440px under the supplied CSP')
  const nojs = await browser.newContext({ javaScriptEnabled: false })
  await nojs.route('**/*', async route => {
    const url = new URL(route.request().url()), file = path.join(root, url.pathname)
    if (url.origin !== origin || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  const plain = await nojs.newPage()
  for (const prefix of ['', 'en/']) for (const name of pages) { await plain.goto(origin + '/' + prefix + name + '.html'); assert.ok((await plain.locator('h1').textContent()).length > 0); assert.ok((await plain.locator('main').innerText()).length > 80) }
  await nojs.close(); check('All 14 pages expose real readable HTML with JavaScript disabled')
  await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw Error('Preference access denied') } }) })
  await page.goto(origin + '/'); await ready(); assert.equal(await page.locator('html').getAttribute('lang'), 'fr')
  await page.locator('.header-actions [lang=en]').click(); await page.waitForURL('**/en/index.html')
  check('Denied preference access does not prevent rendering or language navigation')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.csp, []); assert.deepEqual(report.externalRequests, [])
  report.passed = true
} finally {
  await browser?.close()
  fs.writeFileSync(path.join(directory, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
