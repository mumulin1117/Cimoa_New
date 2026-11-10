import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { upgrade_additive_data } from '../src/stores/migration.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'

// Disposable touch contexts read the built bundle via route.fulfill. This
// runner never opens a listener, accesses installed app storage, or records.
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/discover-guide-2026-11-03')
const origin = 'http://127.0.0.1:47937', key = 'cimoa_app_state_v2', now = Date.now()
const only = process.argv.find(value => value.startsWith('--case='))?.slice(7)
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const report = { passed: false, executed_at: new Date().toISOString(), h5_index_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex'), checks: [], screenshots: [], layout: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false, native_verified: false, limitations: ['Trusted Chrome emulated touch is not actual iPhone touch latency or native scroll acceptance.', 'Lifecycle and navigation failures are injected only in disposable browser contexts; these do not establish real iOS background or keyboard acceptance.', 'Deleting an isolated browser context models cleared installation app data, not an actual iOS uninstall or an offloaded app retaining documents.', 'No microphone permission, recording, introduction submission, purchase or coin spending is performed.'] }
fs.mkdirSync(output, { recursive: true })
const contexts = []
let browser, active_page
const guide = page => page.locator('.discover-guide:visible').last()
const control = (page, name) => page.locator(`[data-interaction="discoverGuide.${name}.click.1"]:visible`).last()
const target = (page, id) => page.locator(`[data-interaction="${id}"]:visible`).last()
const raw = page => page.evaluate(key => localStorage.getItem(key), key)
const data = async page => JSON.parse(await raw(page)).data
const receipt = async page => (await data(page)).settings.find(row => row.owner_user_id === 'user_cimoa')?.discover_guide || null
const social = state => Object.fromEntries(['users', 'accounts', 'match_sessions', 'match_quota', 'match_preferences', 'coin_transactions', 'relationships', 'requests', 'conversations', 'messages', 'memberships', 'operation_receipts', 'drafts', 'media_files', 'blocked_users'].map(field => [field, state[field]]))
const check = label => { report.checks.push(label); console.log('PASS ' + label) }
const wait_step = async (page, step) => {
  await page.locator(`.discover-guide[data-guide-step="${step}"][data-guide-ready="true"]:visible`).waitFor()
  await page.locator(`.discover-guide [aria-label="Step ${step + 1} of 7"]:visible`).waitFor()
  await page.waitForFunction(step => [...document.querySelectorAll('.discover-guide')].some(node => node.dataset.guideStep === String(step) && node.getBoundingClientRect().width > 0 && Number(getComputedStyle(node.querySelector('.guide-card')).opacity) >= .999), step)
}
const next = async (page, step) => { await control(page, 'next').tap(); await wait_step(page, step) }
const screenshot = async (page, filename) => { await page.screenshot({ path: path.join(output, filename) }); report.screenshots.push(filename) }
const store_eval = (page, callback, argument) => page.evaluate(({ source, argument }) => {
  const store = document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('app')
  if (!store) throw Error('App store is unavailable to isolated diagnostic')
  return Function('store', 'argument', `return (${source})(store, argument)`)(store, argument)
}, { source: callback.toString(), argument })
const all_finished = page => page.waitForFunction(() => ![...document.querySelectorAll('.brand-action-loading')].some(node => node.getBoundingClientRect().width > 0))
const disk_unchanged = async (page, before, label) => { assert.deepEqual(social(await data(page)), before, label); assert.equal(await page.evaluate(() => window.__discoverGuideTrace.microphones), 0) }
const fixture = ({ kind = 'default', login = false } = {}) => {
  const state = create_seed(now), me = 'user_cimoa', settings = state.settings.find(row => row.owner_user_id === me)
  state.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
  state.users.find(row => row.user_id === me).onboarding_status = 'complete'
  settings.auto_match_guide = { revision: 1, outcome: 'completed', completed_at: now - 1000 }
  const person = state.users.filter(row => Number.isInteger(row.discover_order) && row.discoverable).sort((a, b) => a.discover_order - b.discover_order)[0]
  for (const message of state.messages) message.read_by = [...new Set([...message.read_by, me])]
  if (kind === 'chat') {
    for (const [from_user_id, to_user_id] of [[me, person.user_id], [person.user_id, me]]) state.relationships.push({ relationship_id: `discover_guide_${from_user_id}_${to_user_id}`, from_user_id, to_user_id, created_at: now })
    state.conversations.push({ conversation_id: 'discover_guide_existing_chat', kind: 'direct', participant_ids: [me, person.user_id], event_id: null })
  }
  if (kind === 'waiting') {
    const question = state.icebreakers.find(row => row.user_id === person.user_id)
    state.requests.push({ request_id: 'discover_guide_pending', sender_id: me, recipient_id: person.user_id, question_id: question.question_id, question_text: question.text, kind: 'text', text: 'Which campus walk would you recommend?', audio_id: null, status: 'pending', created_at: now, resolved_at: null })
  }
  if (kind === 'empty') state.users.forEach(row => { row.discoverable = false })
  if (kind === 'restricted') state.users.find(row => row.user_id === me).verification_status = 'expired'
  if (kind === 'receipt') settings.discover_guide = { revision: 1, outcome: 'completed', completed_at: now - 500 }
  if (login) state.session = { account_id: null, current_user_id: null, expires_at: null }
  const normalized = upgrade_additive_data(state)
  validate_data(normalized)
  return { state: normalized, user_id: person.user_id }
}
const open = async (options = {}) => {
  const context = await browser.newContext({ viewport: { width: options.width || 393, height: options.height || 852 }, isMobile: true, hasTouch: true, reducedMotion: options.reduced ? 'reduce' : 'no-preference' })
  contexts.push(context)
  const page = await context.newPage(); active_page = page; page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', item => { if (item.type() === 'warning') report.warnings.push(item.text()) })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated Discover guide acceptance</title>' })
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(origin + '/fixture-shell')
  const initial = fixture(options)
  if (!options.fresh) await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data: state })), { key, state: initial.state })
  else assert.equal(await raw(page), null, 'Fresh isolated installation has genuinely empty persistence')
  await page.addInitScript(({ key }) => {
    const trace = window.__discoverGuideTrace = { writes: [], receipt_writes: [], microphones: 0, skeleton_overlap: false, guide_seen: false, routes: [] }
    window.__failDiscoverGuideWrite = false
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) {
        const next = JSON.parse(value).data.settings?.some(row => !!row.discover_guide), previous = this.getItem(name), had = previous && JSON.parse(previous).data.settings?.some(row => !!row.discover_guide)
        if (next && !had && window.__failDiscoverGuideWrite) throw new DOMException('Injected guide persistence failure', 'QuotaExceededError')
        trace.writes.push(performance.now())
        if (next && !had) trace.receipt_writes.push(performance.now())
      }
      return write.call(this, name, value)
    }
    if (navigator.mediaDevices?.getUserMedia) navigator.mediaDevices.getUserMedia = () => { trace.microphones++; return Promise.reject(Error('No microphone used during teaching acceptance.')) }
    document.addEventListener('DOMContentLoaded', () => {
      const scan = () => {
        const shown = node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden'
        const visible_guide = [...document.querySelectorAll('.discover-guide')].some(shown)
        const skeleton = [...document.querySelectorAll('[data-skeleton="discover"],.main-skeleton')].some(shown)
        trace.guide_seen ||= visible_guide; trace.skeleton_overlap ||= visible_guide && skeleton
        if (trace.routes.at(-1) !== location.hash) trace.routes.push(location.hash)
      }
      new MutationObserver(scan).observe(document.body, { subtree: true, attributes: true, childList: true }); scan()
    }, { once: true })
  }, { key })
  await page.goto(origin + '/index.html#/pages/' + (options.fresh ? 'auth/splash' : options.login ? 'auth/login' : 'discover/index'), { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
  await page.evaluate(() => { window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); window.dispatchEvent(new Event('resize')) })
  if (!options.fresh && !options.login && !['chat', 'waiting', 'empty', 'restricted', 'receipt'].includes(options.kind)) await wait_step(page, 0)
  return { page, context, initial }
}
const close = async ({ context }) => { await context.close(); contexts.splice(contexts.indexOf(context), 1) }
const login = async (page, { wait = true, skip_auto_match = false } = {}) => {
  await page.locator('.login-page input').first().fill('cimoa@connect.edu'); await page.locator('.login-page input').last().fill('12341234')
  await target(page, 'login.loginNow.click.1').tap(); await page.locator('.home-header:visible').waitFor()
  if (skip_auto_match) {
    await page.locator('.auto-match-guide--open:visible').waitFor()
    await target(page, 'autoMatchGuide.skip.click.1').tap()
    await page.locator('.auto-match-guide:visible').waitFor({ state: 'hidden' })
    await all_finished(page)
  }
  await page.getByRole('button', { name: 'Discover', exact: true }).tap()
  if (wait) await wait_step(page, 0)
  else { await page.locator('.discover-deck:visible').waitFor(); await page.waitForTimeout(850) }
}
const reach_select = async page => {
  await wait_step(page, 0); await next(page, 1); assert.ok(page.url().includes('/pages/discover/profile?user_id='))
  await next(page, 2); assert.ok(page.url().includes('/pages/discover/index'))
  await next(page, 3); assert.ok(page.url().includes('/pages/discover/icebreaker/select?user_id='))
}
const choose_question = async page => {
  const question = page.locator('[data-interaction="ibSelect.q.pick.click.1"]:visible').first()
  assert.equal(await guide(page).getAttribute('data-guide-target-ready'), 'true', 'Question spotlight preserves its actual operable target')
  assert.equal(await control(page, 'next').getAttribute('aria-disabled'), 'true', 'Question guidance requires deliberate selection')
  const bounds = await question.boundingBox()
  assert.ok(bounds && bounds.width > 0 && bounds.height >= 44)
  await question.tap()
  assert.equal(await question.getAttribute('aria-pressed'), 'true', 'Trusted touch through spotlight actually selects the existing question')
  await page.waitForFunction(() => [...document.querySelectorAll('[data-interaction="discoverGuide.next.click.1"]')].some(node => node.getBoundingClientRect().width > 0 && node.getAttribute('aria-disabled') !== 'true'))
  await next(page, 4)
}
const reach_final = async (page, mode = 'text') => {
  await reach_select(page); await choose_question(page)
  await target(page, `ibSelect.pick${mode === 'voice' ? 'Voice' : 'Text'}.click.1`).tap()
  assert.equal(await target(page, `ibSelect.pick${mode === 'voice' ? 'Voice' : 'Text'}.click.1`).getAttribute('aria-pressed'), 'true')
  await next(page, 5); assert.ok(page.url().includes(`/pages/discover/icebreaker/${mode}?`))
  await next(page, 6)
}
const check_layout = async (page, width, height, step) => {
  const layout = await guide(page).evaluate(node => {
    const box = element => { const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } }
    const card = node.querySelector('.guide-card'), copy = node.querySelector('.guide-copy'), body = node.querySelector('.guide-body')
    return { card: box(card), body: box(body), copy: box(copy), transform: getComputedStyle(card).transform, opacity: Number(getComputedStyle(card).opacity), scroll_width: card.scrollWidth, client_width: card.clientWidth, controls: [...card.querySelectorAll('[role="button"]')].map(button => ({ text: button.innerText, ...box(button), scroll: button.scrollWidth, client: button.clientWidth })), modal: card.getAttribute('aria-modal'), interactive: node.classList.contains('spotlight-guide--interactive'), target_ready: node.dataset.guideTargetReady }
  })
  report.layout.push({ width, height, step, ...layout })
  assert.ok(layout.card.left >= -1 && layout.card.right <= width + 1)
  assert.ok(layout.card.top >= 61 && layout.card.bottom <= height - 33, 'Guide respects injected physical safe areas')
  assert.ok(layout.scroll_width <= layout.client_width + 1, 'Guide has no horizontal overflow')
  assert.ok(layout.copy.width > 0 && layout.copy.height > 0, 'Explanation remains readable in its scroll body')
  assert.ok(['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(layout.transform), 'Ready actions are not moving touch targets')
  assert.ok(layout.opacity >= .999, 'Ready teaching card has completed its existing fade and is readable')
  for (const button of layout.controls) {
    assert.ok(button.width >= 43.99 && button.height >= 43.99, `${button.text} is at least 44pt`)
    assert.ok(button.scroll <= button.client + 1, `${button.text} is not truncated`)
    assert.ok(button.top >= layout.card.top - 1 && button.bottom <= layout.card.bottom + 1)
  }
  if ([3, 4].includes(step)) { assert.equal(layout.interactive, true); assert.equal(layout.target_ready, 'true', 'Interactive lesson cannot discard its only operable target'); assert.notEqual(layout.modal, 'true', 'Interactive target must not be hidden behind a modal-only focus claim') }
}

const cases = {
  async text() {
    const item = await open({ login: true }), { page } = item
    await login(page)
    const before = social(await data(page)), write_count = await page.evaluate(() => window.__discoverGuideTrace.writes.length)
    assert.ok(before.match_sessions.length > 0, 'Existing matching history does not suppress an unseen guide')
    await screenshot(page, 'step-1-card.png'); await check_layout(page, 393, 852, 0)
    await reach_select(page); await screenshot(page, 'step-4-question.png'); await check_layout(page, 393, 852, 3)
    const trace = await page.evaluate(() => window.__discoverGuideTrace); assert.equal(trace.skeleton_overlap, false)
    await choose_question(page); await check_layout(page, 393, 852, 4); await next(page, 5)
    assert.ok(page.url().includes('/pages/discover/icebreaker/text?'))
    assert.equal(await page.locator('.ice-text-page textarea').inputValue(), '', 'Guide never invents an answer')
    assert.equal(await page.evaluate(() => document.activeElement?.matches?.('input,textarea,[contenteditable="true"]') || false), false, 'Guide does not focus an editor')
    await screenshot(page, 'step-6-text-answer.png'); await next(page, 6); await check_layout(page, 393, 852, 6)
    await disk_unchanged(page, before, 'All seven teaching steps preserve persisted entities and drafts')
    assert.equal(await page.evaluate(() => window.__discoverGuideTrace.writes.length), write_count, 'Navigation and deliberate UI choices never write account data')
    assert.equal(await receipt(page), null); assert.equal(await page.evaluate(() => window.__discoverGuideTrace.receipt_writes.length), 0)
    const start = await page.evaluate(() => performance.now()); await control(page, 'finish').tap()
    await page.locator('.brand-action-loading:visible').waitFor(); assert.equal(await receipt(page), null)
    await page.evaluate(() => document.querySelector('[data-interaction="discoverGuide.finish.click.1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.discover_guide?.outcome === 'completed'))
    const done = await receipt(page), timings = await page.evaluate(start => ({ writes: window.__discoverGuideTrace.receipt_writes.length, elapsed: window.__discoverGuideTrace.receipt_writes[0] - start }), start)
    assert.deepEqual({ revision: done.revision, outcome: done.outcome }, { revision: 1, outcome: 'completed' }); assert.equal(timings.writes, 1); assert.ok(timings.elapsed >= 450 && timings.elapsed < 1800)
    await all_finished(page); await disk_unchanged(page, before)
    await page.reload(); await page.waitForTimeout(850); assert.equal(await guide(page).count(), 0); assert.deepEqual(await receipt(page), done)
    check('Real login → Discover → profile → return → Send point transition → manual question → real text answer; no typing, permissions, sends or charges; one 500ms completion survives reload')
    await close(item)
  },
  async voice() {
    const item = await open(), { page } = item, before = social(await data(page))
    await reach_final(page, 'voice'); await screenshot(page, 'step-7-voice-next-steps.png')
    assert.equal(await page.locator('.ice-preview-page:visible').count(), 0, 'No fake voice preview is opened')
    assert.equal(await page.locator('.ice-record-time').innerText(), '00:00')
    assert.equal(await page.locator('.event-dialog--open:visible').count(), 0, 'Teaching never opens microphone or fee confirmation')
    await disk_unchanged(page, before)
    await control(page, 'finish').tap(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.discover_guide?.outcome === 'completed'))
    await disk_unchanged(page, before); check('Voice teaching reaches the real answer page without recording, permission, audio, fake preview, request or coin changes')
    await close(item)
  },
  async lifecycle() {
    const item = await open(), { page } = item, before = await raw(page)
    const cdp = await page.context().newCDPSession(page), next_bounds = await control(page, 'next').boundingBox()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: next_bounds.x + next_bounds.width / 2, y: next_bounds.y + next_bounds.height / 2, id: 1, radiusX: 1, radiusY: 1, force: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await wait_step(page, 0)
    assert.equal(await raw(page), before, 'Cancelled touch does not navigate or write')
    await page.evaluate(() => { window.__failDiscoverGuideWrite = true }); await control(page, 'skip').tap()
    await guide(page).locator('.guide-error').waitFor(); assert.equal(await raw(page), before); assert.equal(await receipt(page), null)
    await page.evaluate(() => { window.__failDiscoverGuideWrite = false }); await control(page, 'skip').tap()
    await page.locator('.brand-action-loading:visible').waitFor()
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
    await page.waitForTimeout(650); assert.equal(await raw(page), before); assert.equal(await receipt(page), null)
    await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) }); await wait_step(page, 0)
    const router_cancel = await page.evaluate(() => { const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router; window.__removeDiscoverGuard = router.beforeEach(to => to.path.includes('/pages/discover/profile') ? false : undefined); return true })
    assert.equal(router_cancel, true); await control(page, 'next').tap(); await page.waitForTimeout(400)
    assert.ok(page.url().includes('/pages/discover/index')); assert.equal(await receipt(page), null)
    await page.evaluate(() => window.__removeDiscoverGuard()); await wait_step(page, 0); await next(page, 1)
    await page.goBack(); await wait_step(page, 2)
    assert.equal(await raw(page), before, 'Real header back cannot complete or persist teaching')
    await control(page, 'skip').tap(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.discover_guide?.outcome === 'skipped'))
    const skipped = await receipt(page); await page.reload(); await page.waitForTimeout(850); assert.equal(await guide(page).count(), 0); assert.deepEqual(await receipt(page), skipped)
    check('Storage failure stays retryable; background cancels receipt wait; rejected navigation recovers; real header Back reconciles route; Skip persists independently without replay')
    await close(item)
  },
  async deferral() {
    for (const kind of ['chat', 'waiting', 'empty', 'restricted', 'receipt']) {
      const item = await open({ kind }), { page } = item, before = await raw(page)
      await page.waitForTimeout(1000); assert.equal(await guide(page).count(), 0, `${kind} cannot teach an unavailable new introduction`)
      assert.equal(await raw(page), before); if (kind !== 'receipt') assert.equal(await receipt(page), null)
      await close(item)
    }
    for (const interruption of ['block', 'privacy', 'identity']) {
      const item = await open(), { page } = item, user_id = item.initial.user_id, before = await raw(page)
      await store_eval(page, (store, { user_id, interruption }) => {
        if (interruption === 'block') store.data.blocked_users.push({ block_id: 'discover_guide_interruption', owner_user_id: store.session.current_user_id, user_id, created_at: Date.now() })
        if (interruption === 'privacy') {
          const setting = store.data.settings.find(row => row.owner_user_id === user_id)
          if (setting) setting.privacy = { ...setting.privacy, discover_visible: false }
          else store.data.settings.push({ owner_user_id: user_id, privacy: { discover_visible: false } })
        }
        if (interruption === 'identity') store.data.session = { account_id: null, current_user_id: null, expires_at: null }
      }, { user_id, interruption })
      await page.waitForTimeout(350); assert.equal(await guide(page).count(), 0, `${interruption} removes teaching instead of silently changing the target or account`)
      assert.equal(await raw(page), before); assert.equal(await receipt(page), null)
      await close(item)
    }
    check('Chat, pending request, no profiles, expired verification and existing receipt defer correctly; block/privacy/identity loss never silently teaches a replacement or writes a receipt')
  },
  async layouts() {
    for (const { width, height, reduced } of [{ width: 320, height: 568, reduced: true }, { width: 430, height: 932, reduced: false }]) {
      const item = await open({ width, height, reduced }), { page } = item
      for (let step = 0; step <= 6; step++) {
        await wait_step(page, step); await check_layout(page, width, height, step)
        await screenshot(page, `viewport-${width}x${height}-step-${step + 1}.png`)
        if (reduced) assert.equal(await guide(page).locator('.guide-stage-glow').evaluate(node => getComputedStyle(node).animationName), 'none')
        if (step === 3) { await choose_question(page); continue }
        if (step < 6) await next(page, step + 1)
      }
      assert.equal(await page.evaluate(() => window.__discoverGuideTrace.microphones), 0); await close(item)
    }
    check('All seven steps fit 320×568 / 393×852 / 430×932, respect safe areas, 44pt controls, readable text, interactive targets and reduced motion')
  },
  async installation() {
    const item = await open({ fresh: true }), { page } = item
    await target(page, 'welcome.eula.accept.click.1').tap(); await page.locator('.eula-dialog.event-dialog--open').waitFor({ state: 'hidden' })
    assert.equal(await receipt(page), null)
    await target(page, 'welcome.goLogin.click.1').tap(); await login(page, { skip_auto_match: true })
    const before = social(await data(page)); await control(page, 'skip').tap()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.settings.some(row => row.discover_guide?.outcome === 'skipped'))
    const first_receipt = await receipt(page); await disk_unchanged(page, before)
    await page.goto(origin + '/index.html#/pages/settings/index'); await target(page, 'settings.openLogoutConfirm.click.1').scrollIntoViewIfNeeded(); await target(page, 'settings.openLogoutConfirm.click.1').tap()
    await target(page, 'sheetLogout.logOut2.click.1').tap(); await target(page, 'welcome.goLogin.click.1').tap(); await login(page, { wait: false })
    assert.equal(await guide(page).count(), 0); assert.deepEqual(await receipt(page), first_receipt)
    const reinstalled = await open({ fresh: true })
    await target(reinstalled.page, 'welcome.eula.accept.click.1').tap(); await reinstalled.page.locator('.eula-dialog.event-dialog--open').waitFor({ state: 'hidden' })
    await target(reinstalled.page, 'welcome.goLogin.click.1').tap(); await login(reinstalled.page, { skip_auto_match: true })
    assert.equal(await receipt(reinstalled.page), null); assert.deepEqual(await receipt(page), first_receipt)
    check('Genuinely empty app data follows Splash/EULA/real login/Home/Discover; same-install logout/login retains receipt, cleared-install context shows it again without resetting the previous installation')
    await close(item); await close(reinstalled)
  },
}

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const [name, run] of Object.entries(cases)) if (!only || only === name) { report.running_case = name; await run() }
  assert.ok(!only || Object.hasOwn(cases, only), `Unknown --case=${only}`)
  assert.deepEqual(report.errors, []); report.passed = true
} catch (error) {
  if (active_page && !active_page.isClosed()) {
    await active_page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    report.failure_state = await active_page.evaluate(() => {
      const store = document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('app')
      return { route: location.hash, guide: store?.discover_guide, session: store?.discover_guide_session, trace: window.__discoverGuideTrace, visible: [...document.querySelectorAll('.discover-guide')].filter(node => node.getBoundingClientRect().width).map(node => ({ step: node.dataset.guideStep, ready: node.dataset.guideReady, text: node.innerText })), loading: [...document.querySelectorAll('.brand-action-loading')].filter(node => node.getBoundingClientRect().width).map(node => node.innerText) }
    }).catch(() => null)
  }
  report.failure = { message: error.message, stack: error.stack }; throw error
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser?.close(); report.cleaned_up = true
  fs.writeFileSync(path.join(output, `browser-report${only ? '-' + only : ''}.json`), JSON.stringify(report, null, 2) + '\n')
}
