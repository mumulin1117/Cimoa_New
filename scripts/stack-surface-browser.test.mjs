import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { createPinia } from 'pinia'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { validate_data } from '../src/stores/selectors.js'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'

// Disposable browser contexts exercise the real bundled routes. Disk fulfillment
// needs no listener and cannot access the installed app's storage or native APIs.
const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/stack-surface-2026-11-03')
const origin = 'http://127.0.0.1:47896', key = 'cimoa_app_state_v2', now = Date.UTC(2026, 10, 3, 2)
const selected = process.argv.find(value => value.startsWith('--case='))?.slice(7)
const host = '[data-stack-surface-phase]', source_slot = '#cimoa-stack-surface-source', target_slot = '#cimoa-stack-surface-target'
const active = ['forward-pending', 'forward-ready', 'forward-attaching', 'forward-running', 'back-ready', 'back-running', 'back-dispatched']
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
function fixture(joined = false) {
  let disk = create_scenario(joined ? 'event_joined' : 'default', now)
  for (const row of disk.messages) row.read_by = [...new Set([...row.read_by, disk.session.current_user_id])]
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(disk), write: (_, data) => { disk = clone_data(data) } } })
  assert.equal(store.hydrate().success, true); assert.equal(store.set_app_consent(true).success, true)
  assert.equal(store.begin_auto_match_guide(store.auth_context).success, true); assert.equal(store.finish_auto_match_guide('skipped', store.auth_context).success, true)
  assert.equal(store.begin_discover_guide(store.discover_people[store.discover_card_index].user_id, store.auth_context).success, true)
  for (const step of [1, 2, 3, 4, 5, 6]) assert.equal(store.move_discover_guide(step, store.auth_context).success, true)
  assert.equal(store.finish_discover_guide('completed', store.auth_context).success, true)
  return store
}
const event_store = fixture(true), guest_store = fixture()
assert.equal(guest_store.logout().success, true)
const fixtures = { events: clone_data(event_store.data), guest: clone_data(guest_store.data) }
const account_store = fixture()
assert.equal(account_store.submit_report({ target_type: 'user', target_id: 'user_chloe', reason: 'Harassment', description: 'Concern submitted for this isolated navigation check.', context_id: 'conversation_chloe', also_block: false }).success, true)
fixtures.account = clone_data(account_store.data)
assert.equal(guest_store.save_registration_age('2000-01-01').success, true)
fixtures.registration = clone_data(guest_store.data)
const registration = fixture(); assert.equal(registration.logout().success, true)
const registered = await registration.register_local_account({ email: 'stack.member@connect.hkust.edu', password: 'Campus1234', confirmation: 'Campus1234', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
assert.equal(registered.success, true)
assert.equal(registration.apply_verification('009789', registration.local_verification.account_id).success, true)
assert.equal(registration.begin_onboarding(registration.local_verification.account_id).success, true)
fixtures.onboarding = clone_data(registration.data)
for (const value of Object.values(fixtures)) validate_data(value)
if (process.argv.includes('--fixtures-only')) { console.log('PASS isolated guest, joined-event and verified onboarding fixtures'); process.exit(0) }
const shared_file = fs.readdirSync(path.join(root, 'assets')).find(name => /^index-.*\.js$/.test(name) && fs.readFileSync(path.join(root, 'assets', name), 'utf8').includes('stack-surface'))
assert.ok(shared_file, 'Build H5 with the real stack surface before this regression')
const shared_code = fs.readFileSync(path.join(root, 'assets', shared_file), 'utf8')
const pages_symbol = shared_code.match(/function (\w+)\(\)\{return (\w+)\(\)\}function \2\(\)\{const \w+=\[\],\w+=\w+\.values\(\)/)?.[1]
const pages_export = shared_code.slice(shared_code.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${pages_symbol} as (\\w+)`))?.[1]
assert.ok(pages_export, 'Read existing getCurrentPages export without adding a production debug API')
const report = { passed: false, results: [], errors: [], warnings: [], screenshots: [], blocked_external_requests: [], preview_server_started: false, actual_user_storage_accessed: false, native_verified: false, dist_index_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex'), limitations: ['Touch-enabled Chromium is not WKWebView or an iPhone frame-rate result.', 'Injected visibility, viewport and router failures test cancellation only; native keyboard and background behavior require separate acceptance.', 'Paused WAAPI images measure actual real-frame geometry; unpaused pairs independently verify 240/180ms timing.', 'Consent and completed guide receipts exist only in disposable Store-created fixtures. No installed app data, purchase, microphone or external service is used.'] }
fs.mkdirSync(output, { recursive: true })
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
let browser
const button = (page, id) => page.locator(`[data-interaction="${id}"]:visible`).last()
const bytes = page => page.evaluate(key => localStorage.getItem(key), key)
const frame = selector => selector + ':visible'
const idle = page => page.waitForFunction(({ host, active }) => !active.includes(document.querySelector(host)?.dataset.stackSurfacePhase), { host, active })
const route = (page, wanted) => page.waitForFunction(wanted => location.hash.slice(1).split('?')[0] === wanted, wanted)
const mark = page => page.evaluate(() => window.__stack_trace.animations.length)
const background = page => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')) })
async function settled(page, selector) {
  await page.locator(frame(selector)).waitFor(); await idle(page)
  await page.waitForFunction(selector => {
    const node = [...document.querySelectorAll(selector)].find(item => item.isConnected && item.getBoundingClientRect().height > 0 && getComputedStyle(item).visibility !== 'hidden')
    return node && !node.closest('[inert]') && !node.getAnimations({ subtree: true }).some(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().iterations))
  }, selector)
}
const fill = async (page, label, value) => { await page.locator(`uni-input[aria-label="${label}"]:visible input`).fill(value); await page.waitForTimeout(25) }
async function screenshot(page, name) { await page.screenshot({ path: path.join(output, name + '.png') }); report.screenshots.push(name + '.png') }
async function prepare(item) {
  const context = await browser.newContext({ viewport: { width: item.width || 393, height: item.height || 852 }, isMobile: true, hasTouch: true, reducedMotion: item.reduced ? 'reduce' : 'no-preference' })
  const page = await context.newPage(); page.setDefaultTimeout(11000); await page.clock.setFixedTime(now)
  page.on('pageerror', error => report.errors.push({ case: item.name, message: error.message }))
  page.on('console', event => { if (event.type() === 'warning') report.warnings.push({ case: item.name, message: event.text() }) })
  await page.route('**/*', request => {
    const url = new URL(request.request().url())
    if (url.origin !== origin) { report.blocked_external_requests.push(url.origin + url.pathname); return request.abort('blockedbyclient') }
    if (url.pathname === '/fixture-shell') return request.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated stack transition check</title>' })
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return request.fulfill({ status: 404, body: '' })
    return request.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto(origin + '/fixture-shell'); await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: fixtures[item.fixture || (item.kind === 'events' ? 'events' : 'guest')] })
  await page.addInitScript(({ key, host, source_slot, target_slot }) => {
    const trace = window.__stack_trace = { writes: [], animations: [], phases: [], css: [], loading: [], navigation: [], samples: [] }; window.__stack_animations = []
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) trace.writes.push({ at: performance.now(), bytes: value.length }); return write.call(this, name, value) }
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options)
      if (this.matches('.secondary-page-frame,.main-tab-frame')) {
        const row = { start: performance.now(), class_name: this.className, frames: animation.effect.getKeyframes(), timing: animation.effect.getTiming(), route: location.hash, source: !!this.closest(source_slot), target: !!this.closest(target_slot) }
        trace.animations.push(row); window.__stack_animations.push(animation)
        if (window.__freeze_stack_pair) { animation.pause(); animation.currentTime = window.__freeze_stack_pair.time; if (--window.__freeze_stack_pair.remaining <= 0) delete window.__freeze_stack_pair; row.diagnostic_paused = true }
        animation.finished.then(() => { row.finish = performance.now() }, () => { row.cancel = performance.now() })
      }
      return animation
    }
    document.addEventListener('animationstart', event => { if (event.target.closest?.('[data-stack-motion]')) trace.css.push({ at: performance.now(), name: event.animationName, class_name: event.target.className, route: location.hash }) }, true)
    let last = ''
    new MutationObserver(() => {
      const node = document.querySelector(host), phase = node?.dataset.stackSurfacePhase
      if (phase !== last) { trace.phases.push({ phase, at: performance.now(), route: location.hash, issue: node?.dataset.stackSurfaceIssue }); last = phase }
      for (const node of document.querySelectorAll('.brand-action-loading,uni-toast,.loading-mask')) if (node.getBoundingClientRect().width && getComputedStyle(node).visibility !== 'hidden') trace.loading.push({ at: performance.now(), text: node.textContent.trim() })
    }).observe(document, { subtree: true, childList: true, attributes: true })
    document.addEventListener('DOMContentLoaded', () => {
      let count = 0
      const safe = () => { if (window.CommonTemplateSafeAreaBridge) window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }); else if (++count < 240) requestAnimationFrame(safe) }; safe()
    }, { once: true })
  }, { key, host, source_slot, target_slot })
  const initial = item.initial || (item.kind === 'events' ? '/pages/events/index' : '/pages/auth/welcome')
  await page.goto(origin + '/index.html#' + initial, { waitUntil: 'domcontentloaded' })
  await page.locator(frame(item.initial_selector || (item.kind === 'events' ? '.events-header' : '.welcome-page'))).waitFor()
  await page.waitForFunction(() => !document.querySelector('.main-skeleton')); await page.waitForTimeout(300)
  await page.evaluate(async ({ shared_file, pages_export }) => {
    window.__stack_pages = (await import(`/assets/${shared_file}`))[pages_export]
    const router = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$router; window.__stack_router = router
    for (const method of ['push', 'go']) { const original = router[method]; router[method] = function (...args) { window.__stack_trace.navigation.push({ method, at: performance.now(), path: args[0]?.path, delta: typeof args[0] === 'number' ? args[0] : null }); return original.apply(this, args) } }
  }, { shared_file, pages_export })
  return { context, page }
}
const snapshot = page => page.evaluate(({ host, source_slot, target_slot }) => {
  const source = document.querySelector(source_slot)?.firstElementChild, target = document.querySelector(target_slot)?.firstElementChild
  const node = element => {
    const rect = element?.getBoundingClientRect(), style = element && getComputedStyle(element)
    return element ? { class_name: element.className, connected: element.isConnected, opacity: Number(style.opacity), transform: style.transform, box: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, inert: !!element.closest('[inert]'), aria_hidden: !!element.closest('[aria-hidden="true"]'), same: element === window.__stack_expected_source || element === window.__stack_expected_target, background: style.backgroundImage } : null
  }
  return { phase: document.querySelector(host)?.dataset.stackSurfacePhase, issue: document.querySelector(host)?.dataset.stackSurfaceIssue, source: node(source), target: node(target), source_children: document.querySelector(source_slot)?.childElementCount || 0, target_children: document.querySelector(target_slot)?.childElementCount || 0, stack: window.__stack_pages?.().map(page => ({ route: page.route, id: page.$page?.id ?? page.$basePage?.id })) || [], route: location.hash }
}, { host, source_slot, target_slot })
const freeze = page => page.evaluate(() => { window.__freeze_stack_pair = { time: 0, remaining: 2 } })
const frozen = (page, count) => page.waitForFunction(count => window.__stack_animations.length >= count + 2 && window.__stack_animations.slice(-2).every(animation => animation.playState === 'paused'), count)
async function sample(page, time) { await page.evaluate(async time => { for (const animation of window.__stack_animations.slice(-2)) { animation.pause(); animation.currentTime = time }; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) }, time); return snapshot(page) }
async function resume(page) { await page.evaluate(() => window.__stack_animations.slice(-2).forEach(animation => animation.play())); await idle(page); await page.waitForTimeout(30) }
function translation(value) {
  if (!value || value === 'none') return 0
  const values = value.match(/^matrix(3d)?\((.*)\)$/)
  return values ? Number(values[2].split(',')[values[1] ? 12 : 4]) : Number.NaN
}
async function push_pair(page, id, source_selector, target_selector, checks, name, reduced = false) {
  await button(page, id).scrollIntoViewIfNeeded()
  await page.evaluate(selector => { window.__stack_expected_source = [...document.querySelectorAll(selector)].find(node => node.getBoundingClientRect().height > 0) }, source_selector)
  const before = await snapshot(page), index = await mark(page)
  await freeze(page); await button(page, id).tap(); await frozen(page, index)
  const start = await snapshot(page), pair = await page.evaluate(index => window.__stack_trace.animations.slice(index, index + 2), index)
  checks(start.source?.same && start.source.connected && start.source.inert && start.source.aria_hidden, `${name}: exact source remains connected and inaccessible during Push`)
  checks(start.target?.inert && start.target.aria_hidden && start.target.box.height > 0, `${name}: actual target is mounted but inert until transition settles`)
  checks(start.stack.length === before.stack.length + 1 && start.stack.slice(0, -1).every((row, i) => row.id === before.stack[i].id), `${name}: Push adds exactly one real route without replacing earlier page identities`)
  checks(pair.length === 2 && pair.every(row => row.timing.duration === 240), `${name}: both real frames share the retained 240ms Push duration`)
  if (!reduced) {
    checks(translation(start.target.transform) > start.target.box.width * .97 && Math.abs(translation(start.source.transform)) < 2, `${name}: target begins at the right edge with source in place`)
    const middle = await sample(page, 120)
    checks(translation(middle.target.transform) > 0 && translation(middle.target.transform) < middle.target.box.width && translation(middle.source.transform) < 0, `${name}: source and destination move together with no transparent blank page`)
    checks(middle.source.opacity > .94 && middle.target.opacity > .94 && middle.source.background !== 'none' && middle.target.background !== 'none', `${name}: real opaque page backgrounds cover the viewport during handoff`)
    checks(middle.source.box.left <= 0 && middle.source.box.left + middle.source.box.width >= middle.target.box.left - 1.5 && middle.target.box.left + middle.target.box.width >= middle.target.box.width - 1.5, `${name}: the two original frames overlap without an uncovered viewport strip`)
    await screenshot(page, name + '-push-mid')
  } else checks(pair.every(row => row.frames.every(keyframe => !keyframe.transform || keyframe.transform === 'none')), `${name}: reduced motion omits horizontal movement`)
  await resume(page); await settled(page, target_selector)
  await page.evaluate(selector => { window.__stack_expected_target = [...document.querySelectorAll(selector)].find(node => node.getBoundingClientRect().height > 0) }, target_selector)
  return before
}
async function pop_pair(page, id, selector, expected_stack, checks, name, reduced = false) {
  const hitbox = await button(page, id).boundingBox()
  checks(hitbox?.width >= 43.9 && hitbox?.height >= 43.9, `${name}: Back retains a 44pt touch area`)
  const index = await mark(page); await freeze(page); await button(page, id).tap(); await frozen(page, index)
  const start = await snapshot(page), pair = await page.evaluate(index => window.__stack_trace.animations.slice(index, index + 2), index)
  checks(pair.every(row => row.timing.duration === 180), `${name}: Pop moves both real frames in the retained 180ms`)
  checks(start.source?.inert && start.target?.inert && start.source.opacity > .94, `${name}: Pop preserves an opaque, inaccessible real underlay`)
  if (!reduced) {
    const middle = await sample(page, 90)
    checks(translation(middle.target.transform) > 0 && translation(middle.source.transform) < 0, `${name}: outgoing page moves right while its true parent returns from the left`)
    await screenshot(page, name + '-pop-mid')
  }
  await resume(page); await settled(page, selector)
  const after = await snapshot(page)
  checks(after.stack.length === expected_stack.length && after.stack.every((row, i) => row.id === expected_stack[i].id), `${name}: only the current layer is removed and original parent identities survive`)
  checks(after.source_children === 0 && after.target_children === 0, `${name}: temporary presentation slots release ownership after real source activation`)
}
async function run(item) {
  const { context, page } = await prepare(item), checks = [], check = (condition, message) => { assert.ok(condition, message); checks.push(message); console.log('PASS ' + message) }
  try {
    const original = await bytes(page)
    if (item.kind.startsWith('account-')) {
      const profile = '.secondary-page-frame:has(.profile-header)', home = '.main-tab-frame:has(.home-header)'
      if (['account-profile', 'account-settings', 'account-coins', 'account-exit'].includes(item.kind)) {
        const initial = await push_pair(page, 'home.openMe.click.1', home, profile, check, item.name + '-profile', item.reduced)
        const profile_stack = (await snapshot(page)).stack
        if (item.kind === 'account-profile') {
          await push_pair(page, 'profile.openEditBasic.click.1', profile, '.profile-edit-page', check, item.name + '-edit', item.reduced)
          const edit_stack = (await snapshot(page)).stack
          await button(page, 'editAll.eaSongRemove.click.1').tap()
          check(await button(page, 'editAll.eaOpenSong.click.1').innerText() === 'Add song', 'Removing the profile song stages an unsent change in this real editor only')
          for (const [entry, destination, back] of [
            ['profileEdit.basic.click.1', '.profile-basic-page', 'editBasic.goBack.click.1'],
            ['editAll.eaGoals.click.1', '.profile-goals-page', 'editGoals.goBack.click.1'],
            ['editAll.eaInterests.click.1', '.profile-interests-page', 'editInterests.goBack.click.1'],
            ['editAll.eaIce.click.1', '.profile-ice-page', 'editIce.goBack.click.1'],
            ['editAll.openEditPrefs.click.1', '.profile-preferences-page', 'editPrefs.goBack.click.1'],
          ]) {
            await button(page, entry).scrollIntoViewIfNeeded()
            await page.evaluate(() => { window.__account_edit = document.querySelector('.profile-edit-page'); window.__account_edit_scroll = [...window.__account_edit.querySelectorAll('*')].filter(node => node.scrollTop).map(node => [node, node.scrollTop]) })
            await push_pair(page, entry, '.profile-edit-page', destination, check, item.name + '-' + back.split('.')[0], item.reduced)
            if (destination === '.profile-basic-page') {
              await fill(page, 'Display name', 'Unsubmitted campus name')
              check(await page.locator('uni-input[aria-label="Display name"]:visible input').inputValue() === 'Unsubmitted campus name', 'Ordinary inputs remain editable in the original destination')
            }
            await pop_pair(page, back, '.profile-edit-page', edit_stack, check, item.name + '-' + back.split('.')[0], item.reduced)
            check(await page.evaluate(() => document.querySelector('.profile-edit-page') === window.__account_edit && window.__account_edit_scroll.every(([node, top]) => Math.abs(node.scrollTop - top) < 2)), 'Edit parent instance and scroll survive each child return')
            check(await button(page, 'editAll.eaOpenSong.click.1').innerText() === 'Add song', 'Unsubmitted parent changes survive the nested return without an implicit write')
          }
          await pop_pair(page, 'editAll.goBack.click.1', profile, profile_stack, check, item.name + '-edit', item.reduced)
          await push_pair(page, 'profile.openProfilePreview.click.1', profile, '.profile-preview-page', check, item.name + '-preview', item.reduced)
          await pop_pair(page, 'profilePreview.goBack.click.1', profile, profile_stack, check, item.name + '-preview', item.reduced)
          await push_pair(page, 'profile.openVerification.click.1', profile, '.profile-verification-page', check, item.name + '-verification', item.reduced)
          const verified_stack = (await snapshot(page)).stack
          await push_pair(page, 'verified.openReverify.click.1', '.profile-verification-page', '.profile-reverify-page', check, item.name + '-reverify', item.reduced)
          await pop_pair(page, 'reverify.goBack.click.1', '.profile-verification-page', verified_stack, check, item.name + '-reverify', item.reduced)
          await pop_pair(page, 'verified.goBack.click.1', profile, profile_stack, check, item.name + '-verification', item.reduced)
        } else if (item.kind === 'account-settings') {
          await push_pair(page, 'profile.openAppSettings.click.1', profile, '.settings-page', check, item.name + '-settings')
          const settings_stack = (await snapshot(page)).stack
          for (const [entry, destination, back] of [
            ['openSetNotif', '.settings-notifications-page', 'setNotif'], ['openSetPrivacy', '.settings-privacy-page', 'setPrivacy'],
            ['openSetPerm', '.settings-permissions-page', 'setPerm'], ['openSetLang', '.settings-language-page', 'setLang'],
            ['openBlockedList', '.settings-blocked-page', 'blockedList'],
          ]) {
            await push_pair(page, `settings.${entry}.click.1`, '.settings-page', destination, check, item.name + '-' + back)
            await pop_pair(page, `${back}.goBack.click.1`, '.settings-page', settings_stack, check, item.name + '-' + back)
          }
          await push_pair(page, 'settings.openSetLegal.click.1', '.settings-page', '.settings-legal-page', check, item.name + '-legal')
          const legal_stack = (await snapshot(page)).stack
          for (const kind of ['Terms', 'Privacy']) {
            await push_pair(page, `setLegal.open${kind}.click.1`, '.settings-legal-page', `.legal-${kind.toLowerCase()}-page`, check, item.name + '-' + kind)
            await pop_pair(page, 'isLegalDoc.goBack.click.1', '.settings-legal-page', legal_stack, check, item.name + '-' + kind)
          }
          await pop_pair(page, 'setLegal.goBack.click.1', '.settings-page', settings_stack, check, item.name + '-legal')
          await push_pair(page, 'settings.openReportsSubmitted.click.1', '.settings-page', '.safety-reports-page', check, item.name + '-reports')
          const reports_stack = (await snapshot(page)).stack
          await push_pair(page, 'reportsSubmitted.r.open.click.1', '.safety-reports-page', '.safety-report-detail-page', check, item.name + '-report-detail')
          const detail_stack = (await snapshot(page)).stack
          await push_pair(page, 'reportDetail.openSetSupport.click.1', '.safety-report-detail-page', '.settings-support-page', check, item.name + '-support')
          await pop_pair(page, 'setSupport.goBack.click.1', '.safety-report-detail-page', detail_stack, check, item.name + '-support')
          await pop_pair(page, 'reportDetail.goBack.click.1', '.safety-reports-page', reports_stack, check, item.name + '-report-detail')
          await pop_pair(page, 'reportsSubmitted.goBack.click.1', '.settings-page', settings_stack, check, item.name + '-reports')
          await push_pair(page, 'settings.openDelInfo.click.1', '.settings-page', '.delete-info-page', check, item.name + '-delete-info')
          const info_stack = (await snapshot(page)).stack
          await push_pair(page, 'delInfo.openDelReason.click.1', '.delete-info-page', '.delete-reason-page', check, item.name + '-delete-reason')
          await pop_pair(page, 'delReason.goBack.click.1', '.delete-info-page', info_stack, check, item.name + '-delete-reason')
          await pop_pair(page, 'delInfo.goBack.click.1', '.settings-page', settings_stack, check, item.name + '-delete-info')
          await pop_pair(page, 'settings.goBack.click.1', profile, profile_stack, check, item.name + '-settings')
        } else if (item.kind === 'account-coins') {
          await push_pair(page, 'profile.openStore.click.1', profile, '.coin-center-page', check, item.name + '-coins')
          const coins_stack = (await snapshot(page)).stack
          await push_pair(page, 'coinStore.openHistory2.click.1', '.coin-center-page', '.coin-history-page', check, item.name + '-history')
          const history_stack = (await snapshot(page)).stack
          await page.locator('[data-filter="all"]:visible').tap()
          await push_pair(page, 'coinHistory.t.go.click.1', '.coin-history-page', '.coin-purchase-detail-page', check, item.name + '-credit-detail')
          const credit_stack = (await snapshot(page)).stack
          await push_pair(page, 'coinPurchaseDetail.openSupport.click.1', '.coin-purchase-detail-page', '.coin-help-page', check, item.name + '-help')
          const help_stack = (await snapshot(page)).stack
          await button(page, 'coinHelp.h.toggle.click.1').tap()
          await push_pair(page, 'coinHelp.openPrivacy.click.1', '.coin-help-page', '.legal-privacy-page', check, item.name + '-privacy')
          await pop_pair(page, 'isLegalDoc.goBack.click.1', '.coin-help-page', help_stack, check, item.name + '-privacy')
          check(await page.locator('.help-question[aria-expanded="true"]:visible').count() === 1, 'Coin help keeps its expanded FAQ on return')
          await pop_pair(page, 'coinHelp.goBack.click.1', '.coin-purchase-detail-page', credit_stack, check, item.name + '-help')
          await pop_pair(page, 'coinPurchaseDetail.goBack.click.1', '.coin-history-page', history_stack, check, item.name + '-credit-detail')
          check(await page.locator('[data-filter="all"][aria-selected="true"]:visible').count() === 1, 'Transactions keeps All selected when returning from its real starting-credit entry')
          await page.locator('[data-filter="used"]:visible').tap()
          await push_pair(page, 'coinHistory.t.go.click.1', '.coin-history-page', '.coin-spend-detail-page', check, item.name + '-spend-detail')
          await pop_pair(page, 'coinSpendDetail.goBack.click.1', '.coin-history-page', history_stack, check, item.name + '-spend-detail')
          await pop_pair(page, 'coinHistory.goBack.click.1', '.coin-center-page', coins_stack, check, item.name + '-history')
          check(await button(page, 'coinStore.continuePurchase.click.1').getAttribute('aria-disabled') === 'true', 'Browser without StoreKit cannot start a purchase or manufacture success')
          await pop_pair(page, 'coinStore.goBack.click.1', profile, profile_stack, check, item.name + '-coins')
        } else {
          await push_pair(page, 'profile.openAppSettings.click.1', profile, '.settings-page', check, item.name + '-settings')
          await button(page, 'settings.openLogoutConfirm.click.1').scrollIntoViewIfNeeded()
          await button(page, 'settings.openLogoutConfirm.click.1').tap()
          await button(page, 'sheetLogout.closeSheet.click.2').tap()
          await button(page, 'settings.openLogoutConfirm.click.1').tap()
          await button(page, 'sheetLogout.logOut2.click.1').tap()
          await route(page, '/pages/auth/welcome'); await settled(page, '.welcome-page')
          const after = JSON.parse(await bytes(page)).data, before = JSON.parse(original).data, state = await snapshot(page)
          check(!after.session.account_id && state.stack.length === 1 && state.stack[0].route === 'pages/auth/welcome', 'Actual logout clears the protected route stack instead of animating back into Profile')
          check(state.source_children === 0 && state.target_children === 0 && state.phase === 'idle', 'Session change releases all borrowed frames and visual navigation locks')
          for (const field of ['users', 'relationships', 'requests', 'conversations', 'messages', 'coin_transactions', 'memberships']) check(JSON.stringify(after[field]) === JSON.stringify(before[field]), `Logout presentation preserves ${field}`)
        }
        if (item.kind !== 'account-exit') await pop_pair(page, 'profile.goBack.click.1', home, initial.stack, check, item.name + '-profile', item.reduced)
      } else if (item.kind === 'account-person') {
        const discover = '.main-tab-frame:has(.discover-header)', card_index = await page.locator('.discover-deck:visible').getAttribute('data-card-index')
        const initial = await push_pair(page, 'photo.expand.click.1', discover, '.expanded-profile-page', check, item.name + '-person')
        await page.locator('.expanded-profile-page .content-skeleton').waitFor({ state: 'detached' })
        const person_stack = (await snapshot(page)).stack
        await button(page, 'expanded.openSafetyMini.click.1').tap()
        await push_pair(page, 'sheetSafetyMini.openReport.click.1', '.expanded-profile-page', '.safety-report-user-page', check, item.name + '-report')
        await pop_pair(page, 'safetyReport.goBack.click.1', '.expanded-profile-page', person_stack, check, item.name + '-report')
        check(await page.locator('.expanded-profile-page .content-skeleton').count() === 0, 'Warm person return does not replay the entity skeleton')
        await pop_pair(page, 'expanded.collapse.click.1', discover, initial.stack, check, item.name + '-person')
        check(await page.locator('.discover-deck:visible').getAttribute('data-card-index') === card_index, 'Person and report return retain the same Discover card')
      } else if (item.kind === 'account-chat') {
        const chat = '.direct-chat-page'
        await fill(page, 'Message', 'Keep this unsent chat draft')
        const initial = await push_pair(page, 'chat.viewProfile.click.1', chat, '.expanded-profile-page', check, item.name + '-person')
        await page.locator('.expanded-profile-page .content-skeleton').waitFor({ state: 'detached' })
        await pop_pair(page, 'expanded.collapse.click.1', chat, initial.stack, check, item.name + '-person')
        check(await page.locator('uni-input[aria-label="Message"]:visible input').inputValue() === 'Keep this unsent chat draft', 'Chat → Profile → Chat retains unsent input without sending or persisting it')
      }
    } else if (item.kind === 'events') {
      const list = '.main-tab-frame:has(.events-header)'
      const initial = await push_pair(page, 'events.openEvent.click.1', list, '.event-detail-page', check, item.name + '-detail', item.reduced)
      await page.locator('.event-detail-page .content-skeleton').waitFor({ state: 'detached' })
      const detail = await snapshot(page)
      const participants = button(page, 'evDetail.openParticipantsList.click.1'); await participants.scrollIntoViewIfNeeded()
      await page.evaluate(() => { const root = document.querySelector('.event-detail-page'); window.__stack_detail_instance = root; window.__stack_detail_scroll = [...root.querySelectorAll('*')].filter(node => /auto|scroll/.test(getComputedStyle(node).overflowY)).map(node => [node, node.scrollTop]) })
      await push_pair(page, 'evDetail.openParticipantsList.click.1', '.event-detail-page', '.event-participants-page', check, item.name + '-participants', item.reduced)
      const people_stack = (await snapshot(page)).stack
      await fill(page, 'Search participants', 'Chloe')
      await push_pair(page, 'evParticipants.p.go.click.1', '.event-participants-page', '.expanded-profile-page', check, item.name + '-participant-profile', item.reduced)
      await page.locator('.expanded-profile-page .content-skeleton').waitFor({ state: 'detached' })
      await pop_pair(page, 'expanded.collapse.click.1', '.event-participants-page', people_stack, check, item.name + '-participant-profile', item.reduced)
      check(await page.locator('uni-input[aria-label="Search participants"]:visible input').inputValue() === 'Chloe', 'Cross-module person return preserves the actual participants filter instead of returning to Discover')
      await pop_pair(page, 'evParticipants.goBack.click.1', '.event-detail-page', detail.stack, check, item.name + '-participants', item.reduced)
      check(await page.evaluate(() => document.querySelector('.event-detail-page') === window.__stack_detail_instance && window.__stack_detail_scroll.every(([node, top]) => Math.abs(node.scrollTop - top) < 2)), `${item.name}: nested return retains exact Detail DOM and scroll offsets`)
      check(await page.locator('.event-detail-page .content-skeleton').count() === 0, `${item.name}: warm return does not consume another entity skeleton`)
      if (!item.reduced && item.width !== 320) {
        await push_pair(page, 'evDetail.openGroup.click.1', '.event-detail-page', '.event-group-page', check, item.name + '-group')
        const group_stack = (await snapshot(page)).stack
        await fill(page, 'Message event group', 'Keep this unsent thought')
        await push_pair(page, 'evGroup.openGroupMenu.click.1', '.event-group-page', '.event-group-report-page', check, item.name + '-report')
        await pop_pair(page, 'evReport.goBack.click.1', '.event-group-page', group_stack, check, item.name + '-report')
        check(await page.locator('uni-input[aria-label="Message event group"]:visible input').inputValue() === 'Keep this unsent thought', `${item.name}: Group → Report → Back retains unsent text without sending it`)
        await pop_pair(page, 'evGroup.goBack.click.1', '.event-detail-page', detail.stack, check, item.name + '-group')
      }
      await pop_pair(page, 'evDetail.goBack.click.1', list, initial.stack, check, item.name + '-detail', item.reduced)
    } else if (item.kind === 'registration') {
      const before = JSON.parse(original).data
      await push_pair(page, 'welcome.goAge.click.1', '.welcome-page', '.age-page', check, item.name + '-age')
      check(await page.locator('[data-date-value="2000-01-01"]:visible').count() === 1, 'Registration uses the valid age draft restored by the real Store fixture')
      await push_pair(page, 'age.goAgree.click.1', '.age-page', '.community-page', check, item.name + '-community')
      for (const key of ['terms', 'privacy', 'community']) await page.locator(`[data-agreement="${key}"]:visible`).tap()
      await push_pair(page, 'agree.goSignup.click.1', '.community-page', '.signup-page', check, item.name + '-signup')
      await fill(page, 'University email', 'transition.member@connect.hkust.edu'); await fill(page, 'Password', 'Campus1234'); await fill(page, 'Confirm password', 'Campus1234')
      await push_pair(page, 'signup.createAccount.click.1', '.signup-page', '.verification-email-page', check, item.name + '-email')
      await push_pair(page, 'verEmail.goVerCode.click.1', '.verification-email-page', '.verification-page', check, item.name + '-code')
      check(!/009789|Show code again/.test(await page.locator('.verification-page:visible').innerText()), 'The built-in code is not disclosed before the user enters it')
      await page.locator('.verification-input:visible input').fill('009789')
      await push_pair(page, 'verCode.goVerSuccess.click.1', '.verification-page', '.verification-success-page', check, item.name + '-success')
      await push_pair(page, 'verSuccess.goObBasic.click.1', '.verification-success-page', '.onboarding-basic-page', check, item.name + '-basic')
      await fill(page, 'Display name', 'Alex'); await page.locator('[data-interaction="obBasic.o.pick.click.1"]:visible').first().tap()
      const basic = await push_pair(page, 'obBasic.goObUni.click.1', '.onboarding-basic-page', '.onboarding-uni-page', check, item.name + '-uni')
      await pop_pair(page, 'obUni.goBack.click.1', '.onboarding-basic-page', basic.stack, check, item.name + '-uni')
      const after = JSON.parse(await bytes(page)).data, account = after.accounts.find(row => row.email === 'transition.member@connect.hkust.edu')
      check(account?.local_verification?.status === 'verified' && account.onboarding?.step === 'uni' && after.session.account_id === account.account_id, 'Registration and onboarding retain their real verified account and authenticated session across the scoped Push chain')
      for (const field of ['relationships', 'requests', 'conversations', 'messages', 'coin_transactions', 'memberships']) check(JSON.stringify(before[field]) === JSON.stringify(after[field]), `Registration transitions do not modify ${field}`)
    } else if (item.kind === 'onboarding') {
      await fill(page, 'Display name', 'Alex'); await page.locator('[data-interaction="obBasic.o.pick.click.1"]:visible').first().tap()
      const before = JSON.parse(await bytes(page)).data
      const initial = await push_pair(page, 'obBasic.goObUni.click.1', '.onboarding-basic-page', '.onboarding-uni-page', check, item.name + '-university')
      await fill(page, 'Field of study', 'Interaction design')
      await pop_pair(page, 'obUni.goBack.click.1', '.onboarding-basic-page', initial.stack, check, item.name + '-university')
      check(await page.locator('uni-input[aria-label="Display name"]:visible input').inputValue() === 'Alex', 'Onboarding warm return preserves the actual Basic form')
      const after = JSON.parse(await bytes(page)).data
      for (const field of ['relationships', 'requests', 'conversations', 'messages', 'coin_transactions', 'memberships']) check(JSON.stringify(before[field]) === JSON.stringify(after[field]), `Onboarding navigation does not modify ${field}`)
      check(after.accounts.find(row => row.email === 'stack.member@connect.hkust.edu').onboarding.step === 'uni', 'Only explicit validated Basic submission advances the persistent onboarding step')
    } else {
      const initial = await push_pair(page, 'welcome.goLogin.click.1', '.welcome-page', '.login-page', check, item.name + '-login', item.reduced)
      await fill(page, 'Email', 'my.unsent@connect.edu'); await fill(page, 'Password', 'Unsent1234')
      const login_stack = (await snapshot(page)).stack
      await push_pair(page, 'login.goFpEmail.click.1', '.login-page', '.reset-email-page', check, item.name + '-reset', item.reduced)
      await fill(page, 'Reset email', 'another.unsent@connect.edu')
      await pop_pair(page, 'fpEmail.goBack.click.1', '.login-page', login_stack, check, item.name + '-reset', item.reduced)
      check(await page.locator('uni-input[aria-label="Email"]:visible input').inputValue() === 'my.unsent@connect.edu' && await page.locator('uni-input[aria-label="Password"]:visible input').inputValue() === '', `${item.name}: cached Login retains email while its existing security policy clears the password`)
      await pop_pair(page, 'login.goBack.click.1', '.welcome-page', initial.stack, check, item.name + '-login', item.reduced)
      if (item.interrupt) {
        const live_start = await mark(page), navigation_before = await page.evaluate(() => window.__stack_trace.navigation.length)
        const hitbox = await button(page, 'welcome.goLogin.click.1').boundingBox()
        await page.touchscreen.tap(hitbox.x + hitbox.width / 2, hitbox.y + hitbox.height / 2)
        await page.touchscreen.tap(hitbox.x + hitbox.width / 2, hitbox.y + hitbox.height / 2)
        await settled(page, '.login-page')
        const pushed = await page.evaluate(index => window.__stack_trace.animations.slice(index), live_start)
        check(pushed.length === 2 && pushed.every(row => !row.diagnostic_paused && row.finish - row.start >= 200 && row.finish - row.start < 650), 'Rapid trusted touch produces one 240ms real-frame Push rather than duplicate routes')
        check((await snapshot(page)).stack.length === 2 && await page.evaluate(index => window.__stack_trace.navigation.slice(index).filter(row => row.method === 'push').length, navigation_before) === 1, 'Repeated touch cannot grow another authentication layer while busy')
        const live_back = await mark(page); await button(page, 'login.goBack.click.1').tap(); await settled(page, '.welcome-page')
        const popped = await page.evaluate(index => window.__stack_trace.animations.slice(index), live_back)
        check(popped.length === 2 && popped.every(row => !row.diagnostic_paused && row.finish - row.start >= 145 && row.finish - row.start < 600), 'Unpaused Pop retains real 180ms timing without another exit wait')
        await page.evaluate(() => { const remove = window.__stack_router.beforeEach(to => { if (!to.path.endsWith('/auth/login')) return; remove(); return false }) }); await button(page, 'welcome.goLogin.click.1').tap(); await idle(page); await settled(page, '.welcome-page')
        const failed = await snapshot(page)
        check(failed.stack.length === 1 && failed.source_children === 0 && failed.target_children === 0, 'Rejected navigation restores the original Welcome frame without stale portal or route')
        for (const reason of ['background', 'resize']) {
          const index = await mark(page); await freeze(page); await button(page, 'welcome.goLogin.click.1').tap(); await frozen(page, index)
          if (reason === 'background') await background(page); else await page.setViewportSize({ width: 394, height: 852 })
          await idle(page); await page.waitForTimeout(280)
          const current = await snapshot(page)
          check(current.source_children === 0 && current.target_children === 0 && current.stack.length === 2, `${reason}: cancelled Push leaves the actual target available and no borrowed frames`)
          await settled(page, '.login-page'); await button(page, 'login.goBack.click.1').tap(); await settled(page, '.welcome-page')
          check((await snapshot(page)).stack.length === 1, `${reason}: the next Back succeeds once without a stale navigation lock`)
        }
      }
    }
    const trace = await page.evaluate(() => window.__stack_trace)
    if (!['onboarding', 'registration', 'account-exit'].includes(item.kind)) {
      check(await bytes(page) === original && trace.writes.length === 0, `${item.name}: all navigation preserves exact persisted data with no hidden business write`)
      check(trace.loading.length === 0, `${item.name}: Push and Pop never show a navigation Loading or native Toast`)
    }
    check(trace.css.every(row => !/page-rise|content-rise|page-leave/.test(row.name)), `${item.name}: managed pages do not stack old cRise over horizontal motion`)
    await screenshot(page, item.name + '-returned')
    report.results.push({ name: item.name, width: item.width || 393, height: item.height || 852, reduced: !!item.reduced, checks, trace })
  } catch (error) {
    report.failure = { case: item.name, message: String(error.stack || error), state: await snapshot(page).catch(() => null), text: await page.locator('body').innerText().catch(() => '') }
    await screenshot(page, item.name + '-failure').catch(() => {}); throw error
  } finally { await context.close() }
}
const cases = [
  ...[
    { name: 'account-profile-393', kind: 'account-profile' },
    { name: 'account-profile-small-320', kind: 'account-profile', width: 320, height: 568 },
    { name: 'account-profile-reduced-430', kind: 'account-profile', width: 430, height: 932, reduced: true },
    { name: 'account-settings-393', kind: 'account-settings' },
    { name: 'account-coins-393', kind: 'account-coins' },
    { name: 'account-exit-393', kind: 'account-exit' },
    { name: 'account-person-393', kind: 'account-person', initial: '/pages/discover/index', initial_selector: '.discover-header' },
    { name: 'account-chat-393', kind: 'account-chat', initial: '/pages/messages/chat?conversation_id=conversation_chloe', initial_selector: '.direct-chat-page' },
  ].map(item => ({ fixture: 'account', initial: '/pages/home/index', initial_selector: '.home-header', ...item })),
  { name: 'auth-nested-393', kind: 'auth', interrupt: true },
  { name: 'events-nested-393', kind: 'events' },
  { name: 'auth-small-320', kind: 'auth', width: 320, height: 568 },
  { name: 'events-small-320', kind: 'events', width: 320, height: 568 },
  { name: 'auth-large-reduced-430', kind: 'auth', width: 430, height: 932, reduced: true },
  { name: 'events-large-reduced-430', kind: 'events', width: 430, height: 932, reduced: true },
  { name: 'onboarding-nested-393', kind: 'onboarding', fixture: 'onboarding', initial: '/pages/onboarding/basic', initial_selector: '.onboarding-basic-page' },
  { name: 'registration-flow-393', kind: 'registration', fixture: 'registration' },
]
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const chosen = cases.filter(item => !selected || item.name.includes(selected)); assert.ok(chosen.length, `No case matches ${selected}`)
  for (const item of chosen) await run(item)
  assert.equal(report.errors.length, 0, 'No uncaught page error is allowed'); report.passed = true
} finally {
  await browser?.close(); fs.writeFileSync(path.join(output, `browser-report${selected ? '-' + selected : ''}.json`), JSON.stringify(report, null, 2) + '\n')
}
console.log(`PASS ${report.results.length} stack-surface cases, ${report.results.reduce((sum, row) => sum + row.checks.length, 0)} assertions; ${report.warnings.length} browser warnings`)
