import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'

const root = path.resolve('dist/build/h5'), output = path.resolve('artifacts/avatar-relay-2026-10-26'), origin = 'http://127.0.0.1:47913'
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const key = 'cimoa_app_state_v2', now = Date.now()
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const report = { passed: false, checks: [], results: [], errors: [], warnings: [], preview_server_started: false, actual_user_storage_accessed: false, native_verified: false }
const check = label => { report.checks.push(label); console.log('PASS ' + label) }
fs.mkdirSync(output, { recursive: true })
const data = create_scenario('home_long', now)
data.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
for (const message of data.messages) message.read_by = [...new Set([...message.read_by, data.session.current_user_id])]
const contexts = []
const shared_file = fs.readdirSync(path.join(root, 'assets')).find(name => /^index-.*\.js$/.test(name) && fs.readFileSync(path.join(root, 'assets', name), 'utf8').includes('cimoa-avatar-relay-root'))
const shared_code = fs.readFileSync(path.join(root, 'assets', shared_file), 'utf8'), relay_name = shared_code.match(/\b\w+=\w+=>\b(\w+)\.capture\(\w+\)/)?.[1]
const relay_export = shared_code.slice(shared_code.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${relay_name} as (\\w+)`))?.[1]
let browser, current_page
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const open = async ({ reduced = false, broken = false } = {}) => {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' })
    contexts.push(context)
    const page = await context.newPage(); current_page = page; page.setDefaultTimeout(7000)
    page.on('pageerror', cause => report.errors.push({ message: cause.message, route: page.url() }))
    page.on('console', item => { if (item.type() === 'warning') report.warnings.push(item.text()) })
    await page.route('**/*', request => {
      const url = new URL(request.request().url())
      if (url.origin !== origin) return request.abort()
      if (url.pathname === '/fixture-shell') return request.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated avatar relay acceptance</title>' })
      if (broken && url.pathname.endsWith('/head/2.png')) return request.fulfill({ status: 404, body: '' })
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return request.fulfill({ status: 404, body: '' })
      return request.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await page.goto(`${origin}/fixture-shell`)
    const snapshot = structuredClone(data)
    if (broken) snapshot.users.find(row => row.user_id === 'fixture_long_4').avatar_url = '/static/assets/head/missing-relay-avatar.png'
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: snapshot })
    await page.goto(`${origin}/index.html#/pages/home/index`)
    await page.waitForFunction(() => !!window.CommonTemplateSafeAreaBridge)
    await page.evaluate(() => window.CommonTemplateSafeAreaBridge.update({ top: 62, bottom: 34 }))
    await page.locator('#connection-fixture_long_4').waitFor()
    await page.waitForFunction(() => !document.querySelector('.main-tab-skeleton'))
    if (process.env.CIMOA_RELAY_DIAG === '1' && relay_export) await page.evaluate(async ({ shared_file, relay_export }) => {
      const relay = (await import(`/assets/${shared_file}`))[relay_export]
      window.__avatarRelayDebug = []
      for (const name of ['capture', 'arrive', 'prepare_return', 'resume_home', 'route_changed', 'clear']) {
        const original = relay[name].bind(relay)
        relay[name] = (...args) => {
          const element = args[0]?.element, img = element?.querySelector?.('img'), bounds = element?.getBoundingClientRect?.()
          const row = { name, pending_before: relay.pending, route: location.hash, user_id: args[0]?.user_id, conversation_id: args[0]?.conversation_id, element: !!element, image: img && { complete: img.complete, width: img.naturalWidth, height: img.naturalHeight }, bounds: bounds && { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }, pages: typeof getCurrentPages === 'function' ? getCurrentPages().map(page => ({ route: page.route, id: page.$page?.id ?? page.$basePage?.id, path: page.$page?.fullPath || page.$basePage?.fullPath })) : [] }
          const result = original(...args); row.result = result; row.pending_after = relay.pending; window.__avatarRelayDebug.push(row); return result
        }
      }
    }, { shared_file, relay_export })
    await page.evaluate(() => {
      window.__avatarRelayEvents = []
      const seen = new WeakSet()
      const rect = node => { const r = node?.getBoundingClientRect(); return r && { left: r.left, top: r.top, width: r.width, height: r.height } }
      const sample = () => {
        const node = document.querySelector('.avatar-relay')
        if (!node || seen.has(node)) return
        seen.add(node)
        const row = { direction: node.dataset.relayDirection, time: performance.now(), reduced: node.classList.contains('avatar-relay--reduced'), pointer_events: getComputedStyle(node).pointerEvents, aria_hidden: node.getAttribute('aria-hidden'), frames: [] }
        window.__avatarRelayEvents.push(row)
        const frame = () => {
          if (!node.isConnected) return
          const header_node = document.querySelector('.direct-chat-page .chat-avatar .user-avatar')
          row.frames.push({ avatar: rect(node), header: rect(header_node), header_visibility: header_node && getComputedStyle(header_node).visibility, visible: getComputedStyle(node).visibility !== 'hidden', source: rect(document.querySelector('#connection-fixture_long_4 .user-avatar')), image: node.querySelector('img')?.currentSrc || '', route: location.hash })
          requestAnimationFrame(frame)
        }
        frame()
      }
      window.__avatarRelayObserver = new MutationObserver(sample)
      window.__avatarRelayObserver.observe(document.body, { childList: true, subtree: true })
    })
    return page
  }
  const raw = page => page.evaluate(key => localStorage.getItem(key), key)
  const card = page => page.locator('#connection-fixture_long_4')
  const ready_card = async (page, broken = false) => {
    await card(page).scrollIntoViewIfNeeded()
    if (!broken) await page.waitForFunction(() => { const image = document.querySelector('#connection-fixture_long_4 img'); return image?.complete && image.naturalWidth > 0 })
  }
  const inspect = page => page.evaluate(() => ({ events: window.__avatarRelayEvents, relay_count: document.querySelectorAll('.avatar-relay').length, scroll: document.querySelector('.main-tab-scroll .uni-scroll-view-scrollbar-hidden')?.scrollTop, header_src: document.querySelector('.direct-chat-page .chat-avatar img')?.currentSrc || '' }))

  const page = await open()
  await ready_card(page)
  const before = await raw(page), home_position = await page.evaluate(() => document.querySelector('.main-tab-scroll .uni-scroll-view-scrollbar-hidden')?.scrollTop)
  assert.ok(home_position > 100, 'long fixture must really scroll the Home list before source capture')
  await page.evaluate(() => { window.__relayOriginalSource = document.querySelector('#connection-fixture_long_4 .user-avatar') })
  const user = await card(page).getAttribute('id')
  const destination = await card(page).getAttribute('data-target')
  await card(page).tap()
  await page.locator('.direct-chat-page:visible').waitFor()
  await page.waitForFunction(() => window.__avatarRelayEvents.some(row => row.direction === 'forward'))
  await page.screenshot({ path: path.join(output, 'forward-midflight.png') })
  await page.locator('.avatar-relay').waitFor({ state: 'hidden' })
  const forward = await inspect(page)
  assert.ok(page.url().endsWith(destination))
  const cue = forward.events.find(row => row.direction === 'forward')
  assert.ok(cue.frames.length >= 2)
  assert.ok(cue.frames.filter(row => row.visible).every(row => row.image === forward.header_src), 'one resolved avatar belongs to this Header')
  assert.equal(cue.pointer_events, 'none'); assert.equal(cue.aria_hidden, 'true')
  const first = cue.frames[0].avatar, last = cue.frames.at(-1).avatar
  assert.ok(last.top < first.top, 'avatar should move toward the real Header, not remain at its source')
  assert.ok(Math.abs(last.width - 52) < 4, 'Header landing width follows measured avatar rather than fixed card dimensions')
  assert.ok(Math.abs(last.top - cue.frames.at(-1).header.top) < 4, 'relay reaches the resting Header before its original deadline')
  assert.ok(cue.frames.filter(row => row.visible).every(row => row.header_visibility === 'hidden'), 'only the owned flight avatar is visible, not a duplicate landing avatar')
  assert.equal(await page.locator('.direct-chat-page .chat-avatar .user-avatar').evaluate(node => getComputedStyle(node).visibility), 'visible')
  assert.equal(await raw(page), before)
  check('touching a scrolled Home connected card reaches the correct conversation with a viewport relay, without business writes')
  await page.screenshot({ path: path.join(output, 'chat-header-arrived.png') })
  await page.locator('[data-interaction="chat.viewProfile.click.1"]').tap()
  await page.locator('.expanded-profile-page:visible').waitFor()
  await page.locator('[data-interaction="expanded.collapse.click.1"]:visible').tap()
  await page.locator('.direct-chat-page:visible').waitFor()
  assert.equal((await inspect(page)).events.filter(row => row.direction === 'forward').length, 1)
  await page.locator('[data-interaction="chat.goBack.click.1"]:visible').tap()
  await card(page).waitFor({ state: 'visible' })
  await page.waitForFunction(() => window.__avatarRelayEvents.some(row => row.direction === 'back'))
  await page.screenshot({ path: path.join(output, 'back-midflight.png') })
  await page.locator('.avatar-relay').waitFor({ state: 'hidden' })
  const returned = await inspect(page)
  assert.equal(returned.events.filter(row => row.direction === 'back').length, 1)
  const back_frames = returned.events.find(row => row.direction === 'back').frames
  assert.ok(Math.abs(back_frames.at(-1).avatar.top - back_frames.at(-1).source.top) < 4, 'return relay lands within the real source card after cRise translation is removed')
  assert.ok(Math.abs(returned.scroll - home_position) <= 1, 'Home scroll must not reset on nested return')
  assert.equal(await raw(page), before)
  report.results.push({ mode: 'normal', user, destination, home_position, returned })
  await page.screenshot({ path: path.join(output, 'home-return-preserved.png') })
  check('chat → same-person Profile → chat → Home preserves source, does not replay forward, and returns once to original scrolled card')

  const reduced = await open({ reduced: true }); await ready_card(reduced); await card(reduced).tap()
  await reduced.waitForFunction(() => window.__avatarRelayEvents.some(row => row.direction === 'forward'))
  await reduced.locator('.avatar-relay').waitFor({ state: 'hidden' })
  assert.equal((await inspect(reduced)).events[0].reduced, true)
  report.results.push({ mode: 'reduced', ...(await inspect(reduced)) })
  check('reduced motion keeps a target fade rather than a travelling avatar')

  const resized = await open(); await ready_card(resized); await card(resized).tap()
  await resized.waitForFunction(() => window.__avatarRelayEvents.some(row => row.direction === 'forward'))
  await resized.setViewportSize({ width: 440, height: 956 })
  await resized.locator('.avatar-relay').waitFor({ state: 'hidden' })
  await resized.locator('[data-interaction="chat.goBack.click.1"]:visible').tap()
  await card(resized).waitFor({ state: 'visible' })
  assert.equal((await inspect(resized)).events.some(row => row.direction === 'back'), false)
  check('resize clears geometry and source ownership, so return does not reuse stale viewport coordinates')

  const touch = await open(); await ready_card(touch); await card(touch).tap()
  await touch.waitForFunction(() => window.__avatarRelayEvents.some(row => row.direction === 'forward'))
  await touch.touchscreen.tap(300, 155)
  await touch.locator('.avatar-relay').waitFor({ state: 'hidden' })
  assert.equal(await touch.locator('.direct-chat-page .chat-avatar .user-avatar').evaluate(node => getComputedStyle(node).visibility), 'visible')
  assert.ok(touch.url().includes('/pages/messages/chat?conversation_id=fixture_conversation_4'))
  check('a new touch immediately takes over the visual relay and restores the real avatar without blocking the touch')

  const background = await open(); await ready_card(background); await card(background).tap()
  await background.waitForFunction(() => window.__avatarRelayEvents.some(row => row.direction === 'forward'))
  await background.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await background.locator('.avatar-relay').waitFor({ state: 'hidden' })
  assert.equal(await background.locator('.direct-chat-page .chat-avatar .user-avatar').evaluate(node => getComputedStyle(node).visibility), 'visible')
  await background.locator('[data-interaction="chat.goBack.click.1"]:visible').tap()
  await card(background).waitFor({ state: 'visible' })
  assert.equal((await inspect(background)).events.some(row => row.direction === 'back'), false)
  check('pagehide cleanup restores the real avatar and removes the source association without a late return cue')

  const account = await open(); await ready_card(account); await card(account).tap()
  await account.locator('.direct-chat-page:visible').waitFor()
  await account.evaluate(() => {
    const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app')
    store.$patch(state => { state.data.session = { account_id: null, current_user_id: null, expires_at: null } })
  })
  await account.locator('.avatar-relay').waitFor({ state: 'hidden' })
  assert.match(await account.locator('.chat-state:visible').innerText(), /session has expired/i)
  check('account invalidation cancels any in-flight overlay and removes protected chat access')

  const broken = await open({ broken: true }); await ready_card(broken, true); const broken_before = await raw(broken); await card(broken).tap()
  await broken.locator('.direct-chat-page:visible').waitFor()
  assert.equal((await inspect(broken)).events.length, 0)
  assert.equal(await raw(broken), broken_before)
  check('missing avatar falls back to normal cRise immediately, with correct navigation and no fake image or write')

  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (cause) {
  report.failure = String(cause.stack || cause)
  if (current_page) {
    report.failure_context = await current_page.evaluate(() => ({ route: location.hash, text: document.body.innerText.slice(0, 2000), events: window.__avatarRelayEvents, trace: window.__avatarRelayDebug, source_connected: window.__relayOriginalSource?.isConnected, images: [...document.querySelectorAll('#connection-fixture_long_4 img, .direct-chat-page .chat-avatar img')].map(node => ({ complete: node.complete, naturalWidth: node.naturalWidth, currentSrc: node.currentSrc })), host: !!document.getElementById('cimoa-avatar-relay-root') })).catch(() => null)
    await current_page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    if (await current_page.locator('[data-interaction="chat.goBack.click.1"]:visible').count()) {
      await current_page.locator('[data-interaction="chat.goBack.click.1"]:visible').tap().catch(() => {})
      await current_page.locator('#connection-fixture_long_4').waitFor({ state: 'visible' }).catch(() => {})
      report.failure_return_context = await current_page.evaluate(() => ({ route: location.hash, original_connected: window.__relayOriginalSource?.isConnected, restored_same_node: document.querySelector('#connection-fixture_long_4 .user-avatar') === window.__relayOriginalSource })).catch(() => null)
    }
  }
  throw cause
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser?.close()
  report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
}
