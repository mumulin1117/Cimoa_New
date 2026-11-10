import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { choose_date_of_birth } from './lib/date-picker-driver.mjs'

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/auth-flow-motion-2026-11-02')
const origin = 'http://127.0.0.1:47933', storage_key = 'cimoa_app_state_v2', now = Date.now()
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], cases: [], screenshots: [], errors: [], warnings: [], preview_server_started: false, isolated_contexts: true, limitations: ['The diagnostic native-cover case uses an explicit versioned bridge stub, not an actual WKWebView or iOS rendering result.', 'Chromium cannot open the iOS software keyboard. Browser focus/blur and no-keyboard navigation are checked; system keyboard closure still needs WKWebView acceptance.', 'Date-of-birth input uses the existing accessible picker UI helper; no application Store or business action is invoked from the browser driver.'] }
const check = (condition, message) => { assert.ok(condition, message); report.checks.push(message); console.log(`PASS ${message}`) }
const guest_fixture = accepted => {
  const data = create_scenario('default', now)
  data.session = { account_id: null, current_user_id: null, expires_at: null }
  data.app_consent = accepted ? { revision: APP_CONSENT_REVISION, accepted_at: now } : { revision: null, accepted_at: null }
  return clone_data(data)
}
let browser, current_page
async function setup({ width = 393, height = 852, reduced = false, accepted = true, native_cover = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  const page = await context.newPage(); current_page = page; page.setDefaultTimeout(12000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push(event.text()) })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.fulfill({ status: 204, body: '' })
    if (url.pathname === '/fixture-shell') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated authentication motion check</title>' })
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(`${origin}/fixture-shell`)
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key: storage_key, data: guest_fixture(accepted) })
  await page.addInitScript(({ native_cover }) => {
    const trace = window.__auth_motion_trace = { frames: [], animation_starts: [], native_requests: [], native_acks: [], active: true }
    const rect = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }
    const style = node => node ? { opacity: +getComputedStyle(node).opacity, transform: getComputedStyle(node).transform, animation: getComputedStyle(node).animationName } : null
    const surface = () => {
      const host = document.querySelector('[data-stack-surface-phase]'), source = document.querySelector('#cimoa-stack-surface-source > .secondary-page-frame'), target = document.querySelector('#cimoa-stack-surface-target > .secondary-page-frame')
      return { phase: host?.dataset.stackSurfacePhase, direction: host?.dataset.stackSurfaceDirection, source_class: source?.className || '', target_class: target?.className || '', source: rect(source), target: rect(target), source_style: style(source), target_style: style(target), source_transition: style(source?.querySelector('.page-transition')), target_transition: style(target?.querySelector('.page-transition')), source_content: style(source?.querySelector('.secondary-page-scroll')), target_content: style(target?.querySelector('.secondary-page-scroll')) }
    }
    const current = selector => {
      const nodes = [...document.querySelectorAll(selector)].filter(node => { const page = node.closest('uni-page'), bounds = node.getBoundingClientRect(); return (!page || page === [...document.querySelectorAll('uni-page')].at(-1)) && bounds.width > 0 && bounds.height > 0 && getComputedStyle(node).display !== 'none' })
      // Several registration pages share .onboarding-page. During Push/Pop the
      // foreground target is the genuine next/current page, not the underlay.
      return nodes.find(node => node.closest('#cimoa-stack-surface-target')) || nodes[0]
    }
    const collect = () => {
      if (!trace.active) return
      const welcome = current('.welcome-page'), login = current('.login-page'), reset = current('.reset-email-page'), onboarding = current('.onboarding-page')
      const page = login || reset || onboarding || welcome
      if (page && trace.frames.length < 2200) {
        const frame = page.querySelector('.page-transition'), content = page.querySelector('.secondary-page-scroll'), header = page.querySelector('.auth-header,.onboarding-header'), footer = page.querySelector('.auth-footer,.onboarding-footer'), fill = page.querySelector('.onboarding-fill'), track = page.querySelector('.onboarding-track')
        trace.frames.push({ at: performance.now(), route: location.hash.split('?')[0], phase: welcome?.dataset.startupPhase, root: style(frame), content: style(content), actual_frame: rect(page), surface: surface(), copy: style(welcome?.querySelector('.welcome-copy')), header: rect(header), footer: rect(footer), leaving: !!frame?.classList.contains('page-transition--leaving'), eula: !!current('.eula-dialog.event-dialog--open'), finite_running: [...page.querySelectorAll('[data-startup-reveal]')].flatMap(node => node.getAnimations()).filter(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().iterations)).length, fill: fill && track ? fill.getBoundingClientRect().width / track.getBoundingClientRect().width * 100 : null, progress_animation: fill ? getComputedStyle(fill).animationName : null })
      }
      requestAnimationFrame(collect)
    }
    document.addEventListener('animationstart', event => { trace.animation_starts.push({ at: performance.now(), route: location.hash, name: event.animationName, class_name: event.target.className }) }, true)
    if (native_cover) {
      window.webkit = { messageHandlers: { CimoaHost: { postMessage(payload) {
        if (payload.method !== 'finishLaunch') return Promise.resolve({ version: 1, request_id: payload.request_id, success: true, result: {} })
        trace.native_requests.push({ at: performance.now(), route: location.hash, waiting: style(current('.welcome-page .welcome-copy')) })
        window.dispatchEvent(new CustomEvent('cimoa:launch-reveal', { detail: { attempt: new URL(location.href).searchParams.get('launch') } }))
        const cover = document.querySelector('#diagnostic-native-cover')
        cover?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in-out', fill: 'both' })
        return new Promise(resolve => setTimeout(() => { cover?.remove(); trace.native_acks.push(performance.now()); resolve({ version: 1, request_id: payload.request_id, success: true, result: { ready: true } }) }, 240))
      } } } }
    }
    document.addEventListener('DOMContentLoaded', () => {
      if (native_cover) { const cover = document.createElement('div'); cover.id = 'diagnostic-native-cover'; cover.setAttribute('aria-hidden', 'true'); cover.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#e4f4fb;pointer-events:none'; document.body.append(cover) }
      const safe = () => { if (window.CommonTemplateSafeAreaBridge) window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); else requestAnimationFrame(safe) }; safe()
      requestAnimationFrame(collect)
    }, { once: true })
  }, { native_cover })
  await page.goto(`${origin}/index.html?launch=auth-motion-regression#/pages/auth/splash`, { waitUntil: 'domcontentloaded' })
  return { context, page, width, height, reduced, native_cover }
}
const current_selector = selector => `${selector}:visible`
async function tap(page, id) {
  const node = page.locator(`[data-interaction="${id}"]:visible`).first(); await node.waitFor()
  const rect = await node.boundingBox(); assert.ok(rect, id)
  await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2)
}
async function settled(page, selector) {
  await page.locator(current_selector(selector)).waitFor()
  await page.waitForFunction(selector => {
    const nodes = [...document.querySelectorAll(selector)], node = nodes.find(item => item.getBoundingClientRect().height > 0)
    if (!node) return false
    const frame = node.querySelector('.page-transition'), content = node.querySelector('.secondary-page-scroll')
    const phase = document.querySelector('[data-stack-surface-phase]')?.dataset.stackSurfacePhase
    return (!phase || ['idle', 'settled'].includes(phase)) && frame && +getComputedStyle(frame).opacity > .99 && (!content || +getComputedStyle(content).opacity > .99) && !frame.classList.contains('page-transition--leaving') && !(node.getAnimations({ subtree: true }).some(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().iterations)))
  }, selector)
}
async function screenshot(page, name) { await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name) }
const inherited_scope = (page, selector, descendant) => page.locator(selector).evaluate((root, descendant) => {
  const content = root.querySelector(descendant), scopes = content?.getAttributeNames().filter(name => /^data-v-[a-f\d]+$/.test(name)) || []
  return scopes.length > 0 && scopes.every(name => root.hasAttribute(name))
}, descendant)
const bytes = page => page.evaluate(key => localStorage.getItem(key), storage_key)
const mark = page => page.evaluate(() => performance.now())
const frames = (page, since = 0) => page.evaluate(since => window.__auth_motion_trace.frames.filter(frame => frame.at >= since), since)
const fill = async (page, label, value) => { const input = page.locator(`uni-input[aria-label="${label}"]:visible input, uni-textarea[aria-label="${label}"]:visible textarea`).first(); await input.fill(value); await page.waitForTimeout(35) }
async function capture_failure(page, error) {
  report.failure = String(error.stack || error)
  report.visible_failure = await page.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(-3000), trace: window.__auth_motion_trace })).catch(() => null)
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
}
async function cold_case(options) {
  const h = await setup({ ...options, accepted: false }), { page, context } = h
  try {
    await page.locator('.eula-dialog.event-dialog--open:visible').waitFor()
    const trace = await page.evaluate(() => window.__auth_motion_trace), cold = trace.frames.filter(frame => frame.route === '#/pages/auth/welcome')
    check(cold.some(frame => frame.phase === 'running' && frame.copy.opacity > .01 && frame.copy.opacity < .99), `${h.native_cover ? 'Diagnostic native cover' : 'Browser'}: Welcome visibly enters after reveal, not invisibly behind the cover`)
    check(cold.every(frame => frame.root.opacity >= .99), 'Cold Welcome frame is statically painted while only its intended content enters')
    check(await inherited_scope(page, '.welcome-page:visible', '.welcome-copy'), 'Cold Welcome retains its parent-page scoped styles on the real frame despite the Teleport root')
    check(cold.filter(frame => frame.eula).every(frame => frame.phase === 'complete' && frame.finite_running === 0), 'First EULA waits for real entrance completion rather than cutting off the campus halo')
    if (h.native_cover) {
      check(trace.native_requests.length === 1 && trace.native_acks.length === 1 && trace.native_requests[0].waiting.opacity === 0, 'Diagnostic cover receives one readiness request before the Welcome content begins')
      const first_eula = cold.find(frame => frame.eula)
      check(first_eula && first_eula.at >= trace.native_acks[0], 'Diagnostic-cover EULA never appears before the 240ms native completion acknowledgment')
    }
    check((await bytes(page)).includes('"accepted_at":null'), 'Showing the guide entrance and EULA does not silently accept consent')
    await screenshot(page, `${h.native_cover ? 'diagnostic-native' : 'browser'}-eula-${h.width}x${h.height}.png`)
    report.cases.push({ kind: h.native_cover ? 'diagnostic-native-cold' : 'browser-cold', width: h.width, height: h.height, trace })
  } catch (error) { await capture_failure(page, error); throw error }
  finally { await context.close() }
}
async function auth_case({ width = 393, height = 852, reduced = false, registration = false } = {}) {
  const h = await setup({ width, height, reduced }), { context, page } = h
  try {
    await page.waitForFunction(() => document.querySelector('.welcome-page')?.dataset.startupPhase === 'complete')
    const original = await bytes(page), entrance_at = await mark(page)
    await tap(page, 'welcome.goLogin.click.1'); await settled(page, '.login-page')
    const entry_frames = (await frames(page, entrance_at)).filter(frame => frame.route === '#/pages/auth/login' && frame.header && frame.footer)
    check(entry_frames.length > 2 && entry_frames.every(frame => frame.root.opacity > .99 && frame.content.opacity > .99), `${width}px Login: real frame and form remain fully painted without an extra cRise`)
    check(await inherited_scope(page, '.login-page:visible', '.auth-header'), `${width}px Login: real frame inherits the AuthPageFrame scoped styles after presentation hand-off`)
    const relative = (frame, key, field) => frame[key][field] - (field === 'x' || field === 'y' ? frame.actual_frame[field] : 0)
    const extent = (key, field) => Math.max(...entry_frames.map(frame => relative(frame, key, field))) - Math.min(...entry_frames.map(frame => relative(frame, key, field)))
    check(['x', 'y', 'width', 'height'].every(field => extent('header', field) < 1 && extent('footer', field) < 1), `${width}px Login: Header and footer stay stable relative to their real frame throughout Push`)
    const pushing = entry_frames.map(frame => frame.surface).filter(value => value.phase === 'forward-running' && value.target_class.includes('login-page') && value.source_class.includes('welcome-page'))
    check(pushing.length > 1 && pushing.every(value => value.source && value.target && value.source_transition.animation === 'none' && value.target_transition.animation === 'none' && value.target_content.animation === 'none'), `${width}px Login: one paired real Welcome/Login presentation replaces the old form entrance without navigation Loading`)
    if (reduced) check(pushing.every(value => value.source_style.transform === 'none' && value.target_style.transform === 'none') && pushing.some(value => value.target_style.opacity > .01 && value.target_style.opacity < .99), 'Reduced motion keeps both real frames in place and fades only the incoming page')
    else check(pushing.some(value => value.target.x > 1 && value.target.x < width - 1 && value.source.x < -1 && value.source.x > -width * .31) && pushing.every(value => value.source_style.opacity > .99 && value.target_style.opacity > .99), 'Normal authentication Push slides the actual incoming page right-to-left with a modest source parallax and no transparent gap')
    await screenshot(page, `login-${width}x${height}${reduced ? '-reduced' : ''}.png`)
    const client = await context.newCDPSession(page), action = page.locator('.login-page .auth-primary:visible'), action_box = await action.boundingBox()
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: action_box.x + action_box.width / 2, y: action_box.y + action_box.height / 2 }] })
    await page.waitForTimeout(70)
    const pressed = await action.evaluate(node => ({ transform: getComputedStyle(node).transform, pressed: node.getAttribute('data-touch-state') }))
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await page.waitForTimeout(210)
    check(pressed.pressed !== null && (reduced || pressed.transform !== 'none'), `${width}px primary action responds to a real touch-down without submitting`)
    check(await action.getAttribute('data-touch-state') === null && await bytes(page) === original && await page.locator('.login-page .auth-error-box').count() === 0, `${width}px pointer cancellation removes the press without a ghost submission or business write`)
    await client.detach()
    const forward_at = await mark(page)
    await tap(page, 'login.goFpEmail.click.1')
    await page.locator('.reset-email-page:visible').waitFor()
    const arrival_ms = await page.evaluate(started => performance.now() - started, forward_at)
    check(arrival_ms < 650, `${width}px no-keyboard navigation does not wait for a simulated keyboard-close deadline`)
    await settled(page, '.reset-email-page')
    const returning_at = await mark(page)
    await tap(page, 'fpEmail.goBack.click.1'); await settled(page, '.login-page')
    const return_frames = await frames(page, returning_at), leaving = return_frames.map(frame => frame.surface).filter(value => value.phase === 'back-running' && value.source_class.includes('login-page') && value.target_class.includes('reset-email-page'))
    check(leaving.length > 1 && leaving.every(value => value.source_style.opacity > .99 && value.source_transition.opacity > .99 && value.source_content.opacity > .99 && value.target_transition.animation === 'none'), `${width}px Back keeps the retained Login fully painted below the outgoing Reset page, without a transparent gap or second cRise`)
    if (reduced) check(leaving.every(value => value.source_style.transform === 'none' && value.target_style.transform === 'none'), 'Reduced-motion Pop uses no horizontal geometry')
    else check(leaving.some(value => value.target.x > 1 && value.target.x < width - 1 && value.source.x < -1 && value.source.x > -width * .31), 'Normal Pop moves the real Reset page right while its exact Login parent returns from the left')
    const returned = return_frames.filter(frame => frame.route === '#/pages/auth/login')
    check(returned.length > 0 && returned.every(frame => frame.root.opacity > .99 && frame.content.opacity > .99), `${width}px cached Login returns in place without replaying its entrance`)
    check(await bytes(page) === original, `${width}px navigation, Return and visual presses preserve exact persisted account bytes`)
    await screenshot(page, `login-return-${width}x${height}${reduced ? '-reduced' : ''}.png`)
    if (registration) {
      await tap(page, 'login.goAge.click.1'); await settled(page, '.age-page')
      await choose_date_of_birth(page, '2000-01-01'); await tap(page, 'age.goAgree.click.1'); await settled(page, '.community-page')
      for (const key of ['terms', 'privacy', 'community']) await page.locator(`[data-agreement="${key}"]:visible`).tap()
      await tap(page, 'agree.goSignup.click.1'); await settled(page, '.signup-page')
      await fill(page, 'University email', 'motion.member@connect.hkust.edu'); await fill(page, 'Password', 'Campus1234'); await fill(page, 'Confirm password', 'Campus1234')
      await tap(page, 'signup.createAccount.click.1'); await settled(page, '.verification-email-page')
      await tap(page, 'verEmail.goVerCode.click.1'); await settled(page, '.verification-page')
      await page.locator('.verification-input:visible input').fill('009789'); await page.waitForTimeout(35)
      await tap(page, 'verCode.goVerSuccess.click.1'); await settled(page, '.verification-success-page')
      await tap(page, 'verSuccess.goObBasic.click.1'); await settled(page, '.onboarding-basic-page')
      const basic_step = await page.locator('.onboarding-basic-page .onboarding-step').innerText()
      await fill(page, 'Display name', 'Alex'); await page.locator('[data-interaction="obBasic.o.pick.click.1"]:visible').first().tap()
      const save_before = await bytes(page), progress_at = await mark(page)
      await tap(page, 'obBasic.goObUni.click.1'); await page.locator('.onboarding-uni-page:visible').waitFor(); await settled(page, '.onboarding-uni-page')
      const step_frames = (await frames(page, progress_at)).filter(frame => frame.route === '#/pages/onboarding/uni' && frame.fill !== null)
      const uni_step = await page.locator('.onboarding-uni-page .onboarding-step').innerText(), stored = JSON.parse(await bytes(page)).data
      const registered_account = stored.accounts.find(account => account.email === 'motion.member@connect.hkust.edu')
      check(/1\s*\/\s*8/.test(basic_step) && /2\s*\/\s*8/.test(uni_step), 'Registration retains the existing page-design step labels; motion does not rewrite the business flow')
      check(step_frames.some(frame => frame.fill > 14.2 && frame.fill < 25.8) && Math.abs(step_frames.at(-1).fill - 26) < .3, 'Adjacent registration progress visibly continues from 14% to 26% instead of popping')
      check(registered_account?.onboarding?.step === 'uni' && !registered_account.onboarding.completed && await bytes(page) !== save_before, 'Only the explicit validated Basic submission advances the persistent registration step')
      check(!/009789|Show code again/.test(await page.locator('.onboarding-uni-page').innerText()), 'The flow never adds a visible built-in verification-code explanation')
      await screenshot(page, 'registration-university-393x852.png')
    }
    report.cases.push({ kind: reduced ? 'reduced-auth' : 'auth-and-registration', width, height, reduced, trace: await page.evaluate(() => { window.__auth_motion_trace.active = false; return window.__auth_motion_trace }) })
  } catch (error) { await capture_failure(page, error); throw error }
  finally { await context.close() }
}
try {
  fs.mkdirSync(output, { recursive: true })
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Build H5 before running the isolated motion regression')
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  await cold_case({ width: 393, height: 852 })
  await cold_case({ width: 393, height: 852, native_cover: true })
  await auth_case({ registration: true })
  await auth_case({ width: 320, height: 568, reduced: true })
  assert.deepEqual(report.errors, []); report.passed = true
  console.log(`PASS authentication continuity: ${report.checks.length} checks in ${report.cases.length} isolated cases; no preview server or user-account mutation`)
} catch (error) {
  if (!report.failure && current_page) await capture_failure(current_page, error)
  report.failure ||= String(error.stack || error)
  throw error
} finally {
  await browser?.close(); report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
