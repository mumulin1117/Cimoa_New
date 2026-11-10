import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { create_seed } from '../src/stores/seed.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'

// No preview server or real user storage: every request is fulfilled from the
// production H5 bundle inside disposable, touch-enabled browser contexts.
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/auto-match-reinstall-2026-11-02')
const origin = 'http://127.0.0.1:47932', key = 'cimoa_app_state_v2', now = Date.now()
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, executed_at: new Date().toISOString(), h5_index_sha256: createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex'), checks: [], screenshots: [], layout: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false, native_verified: false, limitations: ['visibilitychange/pagehide cases are browser lifecycle injection, not actual iOS system-background proof.', 'Most fixtures mark a complete profile and remove matching history only in isolated browser contexts; the fresh-install case starts with genuinely empty storage and does not override production seed or history. No production seed or actual user data is edited.', 'A disposable browser context verifies a clean installation storage boundary, not an actual iOS uninstall/reinstall.'] }
const contexts = [], check = label => { report.checks.push(label); console.log('PASS ' + label) }
fs.mkdirSync(output, { recursive: true })
let browser, active_page
const control = (page, name) => page.locator(`[data-interaction="autoMatchGuide.${name}.click.1"]:visible`).first()
const raw = page => page.evaluate(key => localStorage.getItem(key), key)
const data = async page => JSON.parse(await raw(page)).data
const receipt = async page => (await data(page)).settings.find(row => row.owner_user_id === 'user_cimoa').auto_match_guide || null
const relevant = state => Object.fromEntries(['match_sessions', 'match_quota', 'match_preferences', 'coin_transactions', 'relationships', 'requests', 'conversations', 'messages', 'memberships', 'operation_receipts'].map(field => [field, state[field]]))
const touch = (cdp, type, point) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ ...point, radiusX: 1, radiusY: 1, force: 1, id: 1 }] })
const visible_guide = page => page.locator('.auto-match-guide--open:visible').first()
const pending = page => page.locator('.brand-action-loading:visible').filter({ hasText: 'Finishing your guide' })
const wait_step = async (page, index) => {
  await visible_guide(page).waitFor()
  await page.locator(`.auto-match-guide--open [aria-label="Step ${index + 1} of 4"]:visible`).waitFor()
  await page.waitForFunction(index => {
    const layers = [...document.querySelectorAll('.auto-match-guide--open')].filter(node => node.getBoundingClientRect().width > 0)
    return layers.some(node => node.querySelector(`[aria-label="Step ${index + 1} of 4"]`) && getComputedStyle(node.querySelector('.guide-card')).opacity === '1' && [...node.querySelectorAll('[role="button"]')].every(button => button.getAttribute('aria-disabled') !== 'true'))
  }, index)
}
const advance = async (page, index) => { await control(page, 'next').tap(); await wait_step(page, index) }
const final_step = async page => { await wait_step(page, 0); for (let index = 1; index <= 3; index++) await advance(page, index) }
const snapshot = async (page, filename) => { await page.screenshot({ path: path.join(output, filename) }); report.screenshots.push(filename) }
const login_account = async page => {
  await page.locator('.login-page input').first().fill('cimoa@connect.edu')
  await page.locator('.login-page input').last().fill('12341234')
  await page.locator('[data-interaction="login.loginNow.click.1"]:visible').tap()
}
const logout_and_login = async page => {
  await page.goto(origin + '/index.html#/pages/settings/index')
  const logout = page.locator('[data-interaction="settings.openLogoutConfirm.click.1"]:visible')
  await logout.waitFor(); await logout.scrollIntoViewIfNeeded(); await logout.tap()
  await page.locator('.logout-dialog.event-dialog--open [data-interaction="sheetLogout.logOut2.click.1"]:visible').tap()
  const welcome_login = page.locator('[data-interaction="welcome.goLogin.click.1"]:visible')
  await welcome_login.waitFor(); await welcome_login.tap()
  await page.locator('.login-page:visible').waitFor(); await login_account(page)
  await page.locator('.home-header:visible').waitFor()
  await page.waitForFunction(() => !document.querySelector('.main-skeleton'))
  await page.waitForTimeout(500)
}
const check_layout = async (page, width, height, step) => {
  const layout = await visible_guide(page).evaluate(node => {
    const bounds = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
    const card = node.querySelector('.guide-card'), body = node.querySelector('.guide-body'), copy = node.querySelector('.guide-copy')
    return { card: bounds(card), card_transform: getComputedStyle(card).transform, card_active_animations: (card.getAnimations?.({ subtree: false }) || []).filter(animation => animation.playState === 'running' || animation.pending).length, body: bounds(body), copy: bounds(copy), buttons: [...card.querySelectorAll('[role="button"]')].map(button => ({ text: button.innerText, ...bounds(button), scroll: button.scrollWidth, client: button.clientWidth })), title: bounds(card.querySelector('.guide-title')), description: bounds(card.querySelector('.guide-description')), card_scroll: card.scrollWidth, card_client: card.clientWidth, body_scroll: body.querySelector('.uni-scroll-view')?.scrollHeight || body.scrollHeight, body_client: body.querySelector('.uni-scroll-view')?.clientHeight || body.clientHeight }
  })
  report.layout.push({ width, height, step, ...layout })
  assert.ok(layout.card.left >= -1 && layout.card.right <= width + 1, 'coach card stays horizontally in viewport')
  assert.ok(layout.card.top >= 62 - 1 && layout.card.bottom <= height - 34 + 1, 'coach card respects actual injected 62/34pt safe areas')
  assert.ok(layout.card_scroll <= layout.card_client + 1, 'card has no horizontal clipping')
  assert.ok(['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(layout.card_transform), 'enabled coach buttons have arrived at their final position before a touch can begin')
  for (const button of layout.buttons) { assert.ok(button.width >= 43.99 && button.height >= 43.99, `${button.text} retains a 44pt touch target`); assert.ok(button.scroll <= button.client + 1, `${button.text} is not truncated`); assert.ok(button.left >= layout.card.left - 1 && button.right <= layout.card.right + 1 && button.top >= layout.card.top - 1 && button.bottom <= layout.card.bottom + 1, `${button.text} is fully within the card`) }
  assert.ok(layout.description.width > 0 && layout.title.width > 0, 'all explanatory copy remains measurable')
  // Compact layouts may scroll only the explanation, leaving all actions fixed.
  if (layout.body_scroll > layout.body_client + 1) {
    const body = visible_guide(page).locator('.guide-body .uni-scroll-view').last()
    await body.evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')) })
    assert.ok(await body.evaluate(node => node.scrollTop > 0), 'long explanation is genuinely scrollable, not clipped')
  }
}

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const open = async ({ width = 393, height = 852, reduced = false, login = false, history = false, fresh_install = false } = {}) => {
    const fixture = create_seed(now)
    fixture.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
    fixture.users.find(row => row.user_id === 'user_cimoa').onboarding_status = 'complete'
    if (!history) fixture.match_sessions = []
    for (const message of fixture.messages) if (!message.read_by.includes('user_cimoa')) message.read_by.push('user_cimoa')
    if (login) fixture.session = { account_id: null, current_user_id: null, expires_at: null }
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' })
    contexts.push(context)
    const page = await context.newPage(); active_page = page; page.setDefaultTimeout(9000)
    page.on('pageerror', error => report.errors.push(error.message))
    page.on('console', item => { if (item.type() === 'warning') report.warnings.push(item.text()) })
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Auto Match guide acceptance</title>' })
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await page.addInitScript(() => {
      window.__guideWrites = 0; window.__guideWriteTimes = []; window.__failGuideWrite = false
      window.__guideTouches = []
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'click']) {
        for (const capture of [true, false]) document.addEventListener(type, event => {
          const control = event.target.closest?.('[data-interaction]')
          window.__guideTouches.push({ type, capture, at: performance.now(), id: control?.dataset.interaction, disabled: control?.getAttribute('aria-disabled'), transform: control?.closest('.guide-card') && getComputedStyle(control.closest('.guide-card')).transform, x: event.clientX, y: event.clientY, prevented: event.defaultPrevented })
          if (window.__guideTouches.length > 100) window.__guideTouches.shift()
        }, capture)
      }
      window.__guideTimeline = { skeleton_seen: false, overlap: false, first_guide_at: null, last_skeleton_at: null }
      const write = Storage.prototype.setItem
      Storage.prototype.setItem = function (name, value) {
        if (name === 'cimoa_app_state_v2') {
          const next = JSON.parse(value).data.settings?.some(row => !!row.auto_match_guide)
          const previous = this.getItem(name), had = previous && JSON.parse(previous).data.settings?.some(row => !!row.auto_match_guide)
          if (next && !had) {
            if (window.__failGuideWrite) throw new DOMException('Injected test storage full', 'QuotaExceededError')
            window.__guideWrites++; window.__guideWriteTimes.push(performance.now())
          }
        }
        return write.call(this, name, value)
      }
      document.addEventListener('DOMContentLoaded', () => {
        const scan = () => {
          const skeleton = [...document.querySelectorAll('.main-skeleton')].some(node => node.getBoundingClientRect().width > 0)
          const guide = [...document.querySelectorAll('.auto-match-guide--open')].some(node => node.getBoundingClientRect().width > 0)
          if (skeleton) { window.__guideTimeline.skeleton_seen = true; window.__guideTimeline.last_skeleton_at = performance.now() }
          if (guide && window.__guideTimeline.first_guide_at === null) window.__guideTimeline.first_guide_at = performance.now()
          if (skeleton && guide) window.__guideTimeline.overlap = true
        }
        new MutationObserver(scan).observe(document.body, { childList: true, attributes: true, subtree: true }); scan()
      }, { once: true })
    })
    await page.goto(origin + '/fixture-shell')
    if (!fresh_install) await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data: fixture })), { key, fixture })
    else assert.equal(await raw(page), null, 'new installation begins with no account persistence')
    await page.goto(origin + '/index.html#/pages/' + (fresh_install ? 'auth/splash' : login ? 'auth/login' : 'home/index'))
    await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => { window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); window.dispatchEvent(new Event('resize')) })
    if (!login && !fresh_install) await wait_step(page, 0)
    return page
  }

  const page = await open({ login: true })
  await login_account(page)
  await wait_step(page, 0)
  assert.ok(page.url().includes('/pages/home/index'), 'real authenticated login routes to Home')
  const timeline = await page.evaluate(() => window.__guideTimeline)
  assert.equal(timeline.skeleton_seen, true); assert.equal(timeline.overlap, false); assert.ok(timeline.first_guide_at > timeline.last_skeleton_at)
  report.login_timeline = timeline
  const baseline = relevant(await data(page))
  await check_layout(page, 393, 852, 0); await snapshot(page, 'step-1-home.png')
  const cdp = await page.context().newCDPSession(page), first = await control(page, 'next').boundingBox(), point = { x: first.x + first.width / 2, y: first.y + first.height / 2 }
  await touch(cdp, 'touchStart', point); await touch(cdp, 'touchCancel'); await page.waitForTimeout(100)
  await wait_step(page, 0); assert.equal(await receipt(page), null)
  check('Real email/password login enters Home; its existing first skeleton finishes before the guide. Pointer cancellation does not advance or write')
  await advance(page, 1); assert.ok(page.url().includes('/pages/auto-match/index'))
  await check_layout(page, 393, 852, 1); await snapshot(page, 'step-2-preferences.png')
  await control(page, 'back').tap(); await wait_step(page, 0); assert.ok(page.url().includes('/pages/home/index'))
  await advance(page, 1); await advance(page, 2)
  await check_layout(page, 393, 852, 2); await snapshot(page, 'step-3-join-cost.png')
  await control(page, 'back').tap(); await wait_step(page, 1); await advance(page, 2); await advance(page, 3)
  await check_layout(page, 393, 852, 3); await snapshot(page, 'step-4-mutual-choice.png')
  assert.deepEqual(relevant(await data(page)), baseline)
  check('Four steps navigate to the real entry, teach actual preferences and Join costs, explain mutual consent, and preserve matching, quota, coins and relationship entities; Back returns correctly')
  const finish_started = await page.evaluate(() => performance.now())
  await control(page, 'finish').tap()
  await pending(page).waitFor()
  assert.equal(await receipt(page), null, 'receipt is not persisted before the existing 500ms write wait')
  await page.evaluate(() => document.querySelector('[data-interaction="autoMatchGuide.finish.click.1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.auto_match_guide))
  const completed = await receipt(page), timing = await page.evaluate(start => ({ writes: window.__guideWrites, elapsed: window.__guideWriteTimes[0] - start }), finish_started)
  assert.deepEqual({ revision: completed.revision, outcome: completed.outcome }, { revision: 1, outcome: 'completed' }); assert.ok(Number.isFinite(completed.completed_at))
  assert.equal(timing.writes, 1); assert.ok(timing.elapsed >= 480 && timing.elapsed < 1500); report.finish_timing = timing
  assert.deepEqual(relevant(await data(page)), baseline)
  await visible_guide(page).waitFor({ state: 'hidden' }); await page.reload(); await page.locator('.auto-match-index:visible').waitFor(); await page.waitForTimeout(500)
  assert.equal(await visible_guide(page).count(), 0); assert.deepEqual(await receipt(page), completed)
  check('Got it uses one branded 500ms pending state; rapid repeated completion produces one receipt only. Reload retains completion without replay or business changes')
  await logout_and_login(page)
  assert.equal(await visible_guide(page).count(), 0); assert.deepEqual(await receipt(page), completed)
  assert.deepEqual(relevant(await data(page)), baseline)
  check('Completed receipt survives the actual Settings logout confirmation and email/password login in the same installation without replay or business changes')
  await page.locator('[data-interaction="home.startAutoMatch.click.1"]:visible').tap()
  await page.locator('.auto-match-index:visible').waitFor()
  await page.locator('[data-interaction="amEntry.joinPool.click.1"]:visible').tap()
  await page.locator('.auto-match-searching:visible').waitFor()
  const joined = await data(page)
  assert.equal(joined.match_sessions.length, 1); assert.equal(joined.match_sessions[0].status, 'searching'); assert.equal(joined.match_quota[0].used_count, 1)
  assert.deepEqual(joined.coin_transactions, baseline.coin_transactions)
  check('After teaching is finished, the original Join control still starts exactly one real matching session and consumes its actual free allowance only then')

  for (const step of [0, 1, 2, 3]) {
    const skipped = await open()
    const unchanged = relevant(await data(skipped))
    for (let index = 1; index <= step; index++) await advance(skipped, index)
    await control(skipped, 'skip').tap()
    await skipped.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.auto_match_guide?.outcome === 'skipped'))
    assert.deepEqual(relevant(await data(skipped)), unchanged); assert.equal(await skipped.evaluate(() => window.__guideWrites), 1)
    await skipped.reload(); await skipped.waitForTimeout(800); assert.equal(await visible_guide(skipped).count(), 0)
    if (step === 0) {
      const skipped_receipt = await receipt(skipped)
      await logout_and_login(skipped)
      assert.equal(await visible_guide(skipped).count(), 0); assert.deepEqual(await receipt(skipped), skipped_receipt)
      assert.deepEqual(relevant(await data(skipped)), unchanged)
    }
    await skipped.context().close(); contexts.splice(contexts.indexOf(skipped.context()), 1)
  }
  check('Skip is available in all four steps, persists one skipped receipt, changes no social/matching data, and never replays after refresh or same-install Settings logout/login')

  const interrupted = await open(); await final_step(interrupted)
  const untouched = await raw(interrupted)
  await control(interrupted, 'finish').tap(); await pending(interrupted).waitFor()
  await interrupted.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
  await interrupted.waitForTimeout(650); assert.equal(await raw(interrupted), untouched); assert.equal(await receipt(interrupted), null)
  await interrupted.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) }); await wait_step(interrupted, 3)
  await control(interrupted, 'finish').tap(); await pending(interrupted).waitFor()
  await interrupted.evaluate(() => { location.hash = '#/pages/events/index' })
  await interrupted.locator('.events-header:visible').waitFor(); await interrupted.waitForTimeout(650)
  assert.equal(await raw(interrupted), untouched); assert.equal(await receipt(interrupted), null); assert.equal(await pending(interrupted).count(), 0)
  check('Background and page switching cancel unfinished completion, release the loading overlay, and cannot leave a late receipt or other business write')

  const failed = await open(), failed_before = await raw(failed)
  await failed.evaluate(() => { window.__failGuideWrite = true }); await control(failed, 'skip').tap()
  await visible_guide(failed).locator('.guide-error').waitFor(); assert.match(await visible_guide(failed).locator('.guide-error').innerText(), /Couldn’t finish the guide/)
  assert.equal(await raw(failed), failed_before); assert.equal(await receipt(failed), null)
  await failed.evaluate(() => { window.__failGuideWrite = false }); await control(failed, 'skip').tap()
  await failed.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.auto_match_guide?.outcome === 'skipped'))
  assert.equal(await failed.evaluate(() => window.__guideWrites), 1)
  check('Persistence failure keeps the guide and contextual error open with no partial receipt; the same controls recover after a successful retry')

  for (const { width, height, reduced } of [{ width: 320, height: 568, reduced: true }, { width: 430, height: 932, reduced: false }]) {
    const sized = await open({ width, height, reduced })
    for (let index = 0; index <= 3; index++) {
      await wait_step(sized, index); await check_layout(sized, width, height, index)
      if (reduced) assert.equal(await visible_guide(sized).locator('.guide-stage-glow').evaluate(node => getComputedStyle(node).animationName), 'none')
      await snapshot(sized, `viewport-${width}x${height}-step-${index + 1}.png`)
      if (index < 3) await advance(sized, index + 1)
    }
  }
  check('320×568, 393×852 and 430×932 layouts respect 62/34pt safe areas, keep all important buttons at least 44pt, and retain scrollable unclipped explanations; Reduce Motion removes decorative motion')
  const experienced = await open({ history: true })
  const historical = relevant(await data(experienced))
  assert.ok(historical.match_sessions.length > 0); assert.equal(await receipt(experienced), null)
  await final_step(experienced); assert.deepEqual(relevant(await data(experienced)), historical)
  await control(experienced, 'finish').tap(); await pending(experienced).waitFor()
  await experienced.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.auto_match_guide?.outcome === 'completed'))
  assert.deepEqual(relevant(await data(experienced)), historical)
  check('An account with existing matching history but no installation receipt receives all four teaching steps; completing them does not remove or change its history, quota, coins or social entities')

  const fresh = await open({ fresh_install: true })
  await fresh.locator('[data-interaction="welcome.eula.accept.click.1"]:visible').tap()
  await fresh.locator('.eula-dialog.event-dialog--open').waitFor({ state: 'hidden' })
  const initial = await data(fresh)
  assert.equal(initial.session.account_id, null)
  assert.equal(initial.users.find(row => row.user_id === 'user_cimoa').onboarding_status, undefined)
  assert.ok(initial.match_sessions.some(row => row.owner_user_id === 'user_cimoa'), 'real production hydration retains prepared account history')
  assert.equal(await receipt(fresh), null)
  await fresh.locator('[data-interaction="welcome.goLogin.click.1"]:visible').tap(); await login_account(fresh)
  await wait_step(fresh, 0)
  const fresh_entities = relevant(await data(fresh))
  await snapshot(fresh, 'reinstalled-login-guide.png'); await final_step(fresh)
  assert.deepEqual(relevant(await data(fresh)), fresh_entities)
  assert.deepEqual(fresh_entities.match_sessions, initial.match_sessions)
  await control(fresh, 'finish').tap(); await pending(fresh).waitFor()
  await fresh.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.auto_match_guide?.outcome === 'completed'))
  assert.deepEqual(relevant(await data(fresh)), fresh_entities)
  assert.deepEqual(await receipt(page), completed, 'fresh installation never edits the previous completed installation')
  check('A genuinely empty disposable installation follows Splash → EULA → Welcome → Login and shows the guide again for the same prepared account, without changing profile or matching history or accessing a real app container')
  const fresh_receipt = await receipt(fresh)
  await logout_and_login(fresh)
  assert.equal(await visible_guide(fresh).count(), 0); assert.deepEqual(await receipt(fresh), fresh_receipt)
  assert.deepEqual(relevant(await data(fresh)), fresh_entities)
  check('Finishing in the reinstalled context establishes its own receipt: a subsequent ordinary logout/login no longer replays the guide')
  const auth_navigation = fs.readFileSync('src/utils/authNavigation.js', 'utf8'), onboarding = fs.readFileSync('src/pages/onboarding/complete.vue', 'utf8')
  assert.match(auth_navigation, /AUTHENTICATED_MAIN_ROUTE = '\/pages\/home\/index'/); assert.ok(!onboarding.includes("navigate_relaunch('/pages/discover/index')"))
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  if (active_page && !active_page.isClosed()) {
    await active_page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    report.failure_state = await active_page.evaluate(() => {
      const store = document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('app')
      return { route: location.hash, visibility: document.visibilityState, guide: store?.auto_match_guide, loading: [...document.querySelectorAll('.brand-action-loading')].map(node => ({ text: node.innerText, scope: node.dataset.loadingScope })), buttons: [...document.querySelectorAll('.auto-match-guide [role="button"]')].map(node => ({ text: node.innerText, disabled: node.getAttribute('aria-disabled'), interaction: node.dataset.interaction, touch: node.dataset.touchState })), writes: window.__guideWrites, touches: window.__guideTouches }
    }).catch(() => null)
  }
  report.failure = { message: error.message, stack: error.stack }; throw error
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
