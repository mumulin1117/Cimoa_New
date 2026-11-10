import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/content-loading'), origin = 'http://127.0.0.1:47842'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const report = { passed: false, checks: [], errors: [], warnings: [], preview_server_started: false }
const check = text => { report.checks.push(text); console.log('PASS ' + text) }
let browser, page
try {
  fs.mkdirSync(output, { recursive: true })
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true }); page.setDefaultTimeout(8000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route(`${origin}/**`, async route => {
    const requested = new URL(route.request().url()).pathname, file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    await route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.addInitScript(() => {
    window.__skeletons = []
    const seen = new WeakSet()
    new MutationObserver(() => {
      document.querySelectorAll('[data-skeleton]').forEach(node => {
        if (seen.has(node)) return
        seen.add(node); const row = { kind: node.dataset.skeleton, start: performance.now() }; window.__skeletons.push(row)
        const observer = new MutationObserver(() => { if (!node.isConnected || node.dataset.skeleton !== row.kind) { row.duration = performance.now() - row.start; observer.disconnect() } })
        observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-skeleton'] })
      })
    }).observe(document, { subtree: true, childList: true })
  })
  const now = Date.now(); await page.goto(origin)
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', now))
  await page.goto(`${origin}/#/pages/home/index`); await page.reload()
  await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
  await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 59, bottom: 34 }))
  const skeleton = kind => page.locator(`[data-skeleton="${kind}"]:visible`)
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).first().click()
  const tab = name => page.locator(`.tabbar [aria-label="${name}"]:visible`).click()
  const state = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const shot = async name => {
    await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('.page-transition')].flatMap(node => node.getAnimations().map(animation => animation.finished))); await new Promise(resolve => requestAnimationFrame(resolve)) })
    await page.screenshot({ path: path.join(output, name + '.png') })
  }
  await skeleton('home').waitFor(); assert.equal(await page.getByRole('button', { name: 'Open profile', exact: true }).count(), 1); assert.equal(await page.locator('.tabbar').count(), 1)
  await shot('home-skeleton-393x852'); await skeleton('home').waitFor({ state: 'hidden' }); await page.locator('.connection').first().waitFor()
  const before = await state(), homeNames = await page.locator('.connection-name').allTextContents()
  check('Cold-start Home skeleton replaces content only; Header and Tabbar remain available')
  await tab('Discover'); await skeleton('discover').waitFor(); await shot('discover-skeleton-393x852'); await skeleton('discover').waitFor({ state: 'hidden' }); await page.locator('.discover-deck').waitFor()
  const cdp = await page.context().newCDPSession(page)
  const gesture = async (x, y, dx, dy, steps = 8) => {
    await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('.page-transition')].flatMap(node => node.getAnimations().map(animation => animation.finished))) })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps, id: 1 }] }); await page.waitForTimeout(12) }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const deck = await page.locator('.discover-deck').boundingBox()
  await gesture(deck.x + deck.width * .3, deck.y + deck.height * .45, deck.width * .55, 5)
  await page.waitForFunction(() => document.querySelector('.discover-deck')?.dataset.cardIndex === '1' && document.querySelector('.discover-deck')?.dataset.resetting === 'false')
  const retained = await page.locator('.discover-deck').getAttribute('data-card-index')
  await page.waitForTimeout(350)
  await page.locator('.discover-photo-card--front').click()
  await skeleton('profile').waitFor(); assert.equal(await page.getByRole('button', { name: 'Back', exact: true }).count(), 1)
  await shot('profile-skeleton-393x852'); await skeleton('profile').waitFor({ state: 'hidden' }); await page.locator('.expanded-photo-card').waitFor()
  await click('expanded.collapse.click.1'); await page.locator('.discover-deck').waitFor()
  await page.locator('.discover-photo-card--front').click(); await page.locator('.expanded-photo-card').waitFor(); assert.equal(await skeleton('profile').count(), 0)
  await click('expanded.collapse.click.1'); await page.locator('.discover-deck').waitFor()
  check('Discover keeps its selected card and completed profile cache avoids flashing on a warm revisit')
  await tab('Events'); await skeleton('events').waitFor(); await shot('events-skeleton-393x852'); await skeleton('events').waitFor({ state: 'hidden' })
  const eventCard = page.locator('.event-card .event-cover:visible').first()
  await eventCard.click(); await skeleton('event').waitFor(); await shot('event-skeleton-393x852'); await skeleton('event').waitFor({ state: 'hidden' }); await page.locator('.event-detail-cover').waitFor()
  await click('evDetail.goBack.click.1'); await page.locator('.events-header').waitFor(); await page.locator('.event-card .event-cover:visible').first().click()
  await page.locator('.event-detail-cover').waitFor(); assert.equal(await skeleton('event').count(), 0)
  await click('evDetail.goBack.click.1'); await page.locator('.events-header').waitFor()
  check('Events and per-event first-visit skeletons follow their layouts; cached detail revisits have no skeleton')
  await tab('Home'); await page.locator('.connection').first().waitFor(); assert.equal(await skeleton('home').count(), 0)
  const list = await page.locator('.main-tab-scroll').boundingBox()
  await gesture(180, list.y + 35, 0, 22)
  assert.equal(await page.locator('.brand-refresh--active').count(), 0)
  await gesture(180, list.y + 35, 0, 180)
  await page.locator('.brand-refresh--active').waitFor()
  assert.deepEqual(await page.locator('.connection-name').allTextContents(), homeNames)
  await shot('home-refresh-393x852'); await page.locator('.brand-refresh--active').waitFor({ state: 'hidden' })
  assert.equal(await state(), before)
  await tab('Discover'); await page.locator('.discover-deck').waitFor(); assert.equal(await page.locator('.discover-deck').getAttribute('data-card-index'), retained); assert.equal(await skeleton('discover').count(), 0)
  check('Real touch pull refresh retains list content and exact persistence bytes; a short pull does not refresh; Discover order is unchanged')
  await tab('Home'); await page.locator('.connection').first().waitFor()
  await page.waitForTimeout(300)
  await gesture(180, list.y + 35, 0, 180); await page.locator('.brand-refresh--active').waitFor()
  await tab('Events'); await page.locator('.events-header').waitFor(); await page.waitForTimeout(750); assert.equal(await state(), before)
  await tab('Home'); await page.locator('.connection').first().waitFor(); assert.equal(await page.locator('.brand-refresh--active').count(), 0)
  check('Tabbar remains usable during refresh; leaving cancels the delayed read and restores the control')
  report.skeletons = await page.evaluate(() => window.__skeletons)
  for (const row of report.skeletons) assert.ok(row.duration >= 470 && row.duration <= 850, JSON.stringify(row))
  report.layouts = []
  for (const viewport of [{ width: 320, height: 568 }, { width: 440, height: 956 }]) {
    await page.setViewportSize(viewport)
    report.layouts.push(await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, tab: document.querySelector('.tabbar').getBoundingClientRect().toJSON(), header: document.querySelector('.home-header').getBoundingClientRect().toJSON() })))
    assert.equal(report.layouts.at(-1).scrollWidth, viewport.width)
    await shot(`home-${viewport.width}x${viewport.height}`)
  }
  await page.setViewportSize({ width: 393, height: 852 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload(); await skeleton('home').waitFor(); assert.equal(await page.locator('.skeleton-block').first().evaluate(e => getComputedStyle(e, '::after').animationName), 'none')
  await skeleton('home').waitFor({ state: 'hidden' })
  check('A new cold start renews eligibility; reduced motion stops shimmer; small and large layouts retain fixed navigation')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  // Return during a first entity skeleton: navigation stays available, interrupted
  // content is not cached as completed, and a different ID has its own eligibility.
  await tab('Discover'); await skeleton('discover').waitFor({ state: 'hidden' }); await page.locator('.discover-photo-card--front').waitFor()
  await page.locator('.discover-photo-card--front').click(); await skeleton('profile').waitFor()
  await click('expanded.collapse.click.1'); await page.locator('.discover-photo-card--front').waitFor()
  await page.locator('.discover-photo-card--front').click(); await skeleton('profile').waitFor(); await skeleton('profile').waitFor({ state: 'hidden' })
  await click('expanded.collapse.click.1'); await page.locator('.discover-photo-card--front').waitFor()
  const nextDeck = await page.locator('.discover-deck').boundingBox()
  await gesture(nextDeck.x + nextDeck.width * .3, nextDeck.y + nextDeck.height * .45, nextDeck.width * .55, 5)
  await page.waitForFunction(() => document.querySelector('.discover-deck')?.dataset.cardIndex === '1' && document.querySelector('.discover-deck')?.dataset.resetting === 'false'); await page.waitForTimeout(350)
  await page.locator('.discover-photo-card--front').click(); await skeleton('profile').waitFor(); await skeleton('profile').waitFor({ state: 'hidden' })
  check('Back works during first detail loading; interrupted loads do not mark a cache hit; each profile ID loads independently')
  await click('expanded.collapse.click.1'); await page.locator('.discover-deck').waitFor(); await tab('Home'); await page.locator('.connection').first().waitFor()
  await click('home.openMe.click.1'); await click('profile.openAppSettings.click.1'); await click('settings.openLogoutConfirm.click.1')
  await click('sheetLogout.logOut2.click.1')
  await page.locator('.welcome-page').waitFor()
  await page.goto(`${origin}/#/pages/auth/login`); await page.locator('uni-input[aria-label="Email"] input').waitFor()
  await page.locator('uni-input[aria-label="Email"] input').fill('cimoa@connect.edu'); await page.locator('uni-input[aria-label="Password"] input').fill('12341234')
  await click('login.loginNow.click.1'); await skeleton('home').waitFor(); await skeleton('home').waitFor({ state: 'hidden' })
  await tab('Discover'); await skeleton('discover').waitFor(); await skeleton('discover').waitFor({ state: 'hidden' })
  await tab('Events'); await skeleton('events').waitFor(); await skeleton('events').waitFor({ state: 'hidden' })
  await tab('Home'); await page.locator('.connection').first().waitFor(); assert.equal(await skeleton('home').count(), 0)
  check('Actual logout and successful credential login renew all three first-visit skeletons exactly once')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); report.passed = true
} catch (error) { report.failure = String(error.stack || error); report.diagnostic = await page?.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(-1200), skeletons: window.__skeletons, html: document.querySelector('.main-tab-scroll')?.outerHTML.slice(0, 3000) })).catch(() => null); throw error }
finally { await browser?.close(); fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n') }
