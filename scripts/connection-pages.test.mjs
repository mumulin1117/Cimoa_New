// Offline source renderer + built-H5 regression. Never executes the prototype logic.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { read_circa_source, walk_html, attribute } from './lib/circa-source.mjs'
import { serve_h5, context_for, set_safe_area, write_comparison, sha256, close_to } from './lib/pixel-acceptance.mjs'
import { create_seed } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--page='))?.split('=')[1] || 'sent'
const output = path.resolve(`docs/ui-restoration/connection-${phase}`), contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json')))
const source = read_circa_source(), source_lines = source.template.split('\n')
assert.equal(source.source_hash, contract.source.file_sha256)
assert.equal(sha256(source_lines.slice(contract.source.lines[0] - 1, contract.source.lines[1]).join('\n')), sha256(contract.source.fragment))
const data = create_seed(), now = Date.now(), target = phase === 'sent' ? 'user_chloe' : 'user_lina'
if (phase !== 'chat') {
  data.relationships = data.relationships.filter(row => ![row.from_user_id, row.to_user_id].includes(target))
  const removed = data.conversations.filter(row => row.kind === 'direct' && row.participant_ids.includes(target)).map(row => row.conversation_id)
  data.conversations = data.conversations.filter(row => !removed.includes(row.conversation_id)); data.messages = data.messages.filter(row => !removed.includes(row.conversation_id))
  data.requests = data.requests.filter(row => row.request_id !== 'request_lina')
  data.requests.push({ request_id: 'request_pixel', sender_id: phase === 'sent' ? 'user_cimoa' : target, recipient_id: phase === 'sent' ? target : 'user_cimoa', question_id: `${phase === 'sent' ? target : 'user_cimoa'}_q_0`, question_text: 'How would you spend your ideal weekend?', kind: 'text', text: 'A long walk and coffee by the sea.', audio_id: null, status: phase === 'accepted' ? 'accepted' : phase === 'declined' ? 'declined' : 'pending', created_at: now - 1000, resolved_at: ['accepted', 'declined'].includes(phase) ? now : null })
  if (phase === 'accepted') {
    for (const [from_user_id, to_user_id] of [['user_cimoa', target], [target, 'user_cimoa']]) data.relationships.push({ relationship_id: `pixel_${from_user_id}`, from_user_id, to_user_id, created_at: now, source_request_id: 'request_pixel', source_match_id: null })
    data.conversations.push({ conversation_id: 'conversation_pixel', kind: 'direct', participant_ids: ['user_cimoa', target], event_id: null })
  }
}
const route = `/pages/${phase === 'chat' ? 'messages/chat?conversation_id=conversation_chloe' : `connections/${phase}?request_id=request_pixel`}`
fs.writeFileSync(path.join(output, 'native-fixture.json'), JSON.stringify({ route, data }, null, 2) + '\n')
const report = { page: phase, result: 'failed', checks: [], geometry: {}, errors: [], reference: 'Offline HTML AST, original inline styles, no prototype script/runtime', source_sha256: source.source_hash }
const check = message => { report.checks.push(message); console.log(`PASS ${phase}: ${message}`) }
const resources = JSON.parse(fs.readFileSync('docs/circa-source-audit.json')).resources
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
function reference_markup(origin) {
  let root; walk_html(source.html, node => { if (node.tag === 'sc-if' && attribute(node, 'value').includes(contract.source.condition)) root = node })
  const context = { qText: 'How would you spend your ideal weekend?', answerPreview: 'A long walk and coffee by the sea.', isPhoto0: true, isPhoto1: false, isPhoto2: false, otherPlayingNot: true, otherPlaying: false, liamPlaying: false, liamNotPlaying: true, profileDots: [{ bg: '#fff' }, { bg: 'rgba(255,255,255,.4)' }, { bg: 'rgba(255,255,255,.4)' }] }
  context.msgs = data.messages.filter(row => row.conversation_id === 'conversation_chloe').map(row => ({ text: row.body, them: row.sender_id !== 'user_cimoa', align: row.sender_id === 'user_cimoa' ? 'flex-end' : 'flex-start', bg: row.sender_id === 'user_cimoa' ? 'linear-gradient(100deg,#1ec8f5 0%,#8b5cf6 55%,#f845f0 100%)' : '#fff', ink: row.sender_id === 'user_cimoa' ? '#fff' : '#0b1b3a', shadow: row.sender_id === 'user_cimoa' ? '0 10px 24px rgba(139,92,246,.22)' : '0 8px 22px rgba(16,36,74,.07)' }))
  const interpolate = (value, scope) => value.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => escape(key.split('.').reduce((row, field) => row?.[field], scope)))
  const render = (node, scope = context) => {
    if (node.type === 2) return interpolate(node.content, scope)
    if (node.type === 5) return interpolate(node.loc.source, scope)
    if (node.type !== 1) return ''
    // Source's voice card has an authorized text-answer variant; no fake 18s media.
    if (phase === 'received' && node.loc.start.line === 953) return '<div style="font-size:17px;line-height:1.45;margin-top:6px;color:#26364f;text-wrap:pretty">A long walk and coffee by the sea.</div>'
    const children = () => (node.children || []).map(child => render(child, scope)).join('')
    if (node.tag === 'sc-if') { const key = attribute(node, 'value').replace(/[{}\s]/g, ''), value = key.split('.').reduce((row,field) => row?.[field], scope); return (value === undefined ? attribute(node, 'hint-placeholder-val').includes('true') : value) ? children() : '' }
    if (node.tag === 'sc-for') { const key = attribute(node, 'list').replace(/[{}\s]/g, ''); return (scope[key] || []).map(value => (node.children || []).map(child => render(child, { ...scope, [attribute(node, 'as')]: value })).join('')).join('') }
    const attrs = (node.props || []).filter(prop => prop.type === 6 && !prop.name.startsWith('sc-camel-on-')).map(prop => {
      const name = prop.name.replace('sc-camel-view-box', 'viewBox').replace('sc-camel-gradient-units', 'gradientUnits')
      let value = prop.value?.content || ''
      for (const asset of resources) if (asset.local_path) value = value.replaceAll(asset.bundle_id, `${origin}/${asset.local_path}`)
      return ` ${name}="${interpolate(value, scope).replaceAll('"', '&quot;')}"`
    }).join('')
    return `<${node.tag}${attrs}>${children()}${['img','input','br'].includes(node.tag) ? '' : `</${node.tag}>`}`
  }
  let content = (root.children || []).map(node => render(node)).join('')
  if (phase === 'accepted') content = content.replaceAll('Chloe', 'Lina').replaceAll('/head/maya-av.png', '/head/maya-full.png').replaceAll('Alex Chan', 'Ethan')
  if (phase === 'declined') content = content.replace('No introduction was shared and no reason is passed on.', 'No connection was created and no reason is passed on.')
  if (phase === 'chat') content = content.replace('Online', 'Connected').replace('Today, 2:14 PM', 'Today, ' + new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(data.messages[0].sent_at))
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{height:100%;width:100%;margin:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;color:#0b1b3a;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);-webkit-font-smoothing:antialiased}::-webkit-scrollbar{display:none}</style></head><body>${content}</body></html>`
}
let browser, server
try {
  server = await serve_h5(); console.log(`Temporary connection preview PID ${server.pid}, ${server.origin}`)
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  const reference = await browser.newPage({ viewport: { width: 393, height: 852 } }); await reference.setContent(reference_markup(server.origin)); await reference.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))) }); await reference.screenshot({ path: path.join(output, 'reference.png') }); await reference.close()
  const context = await context_for(browser, STATE_KEY, data), page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.errors.push(error.message))
  let document_id = 0
  const open = target_route => page.goto(`${server.origin}/?connectionPage=${phase}-${document_id++}#${target_route}`)
  const freeze = async (top = 54, bottom = 0) => { await set_safe_area(page, top, bottom); await page.evaluate(async () => { await document.fonts.ready; for (const animation of document.getAnimations()) if (animation.effect.getComputedTiming().iterations !== Infinity) animation.finish(); await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) }) }
  await open(route); await page.locator(`.connection-${phase}-page${phase === 'chat' ? ',.direct-chat-page' : ''}`).waitFor(); if (phase === 'chat') await page.locator('.chat-read-progress').waitFor({ state: 'hidden' }); await freeze()
  report.geometry = await page.evaluate(() => {
    const box = selector => { const element = document.querySelector(selector); if (!element) return null; const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom } }
    return { header: box('.connection-header,.chat-header'), footer: box('.connection-footer,.chat-composer'), hero: box('.sent-check,.accepted-content,.declined-content'), question: box('.sent-question'), answer: box('.sent-answer'), photo: box('.received-photo-card'), text: document.querySelector('uni-page-body').innerText }
  })
  await page.screenshot({ path: path.join(output, 'actual-browser.png') })
  report.comparison = await write_comparison(browser, output, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  if (phase === 'sent') {
    assert.ok(close_to(report.geometry.header.x, 20)); assert.ok(close_to(report.geometry.header.y, 58)); assert.ok(close_to(report.geometry.hero.y, 138)); assert.ok(close_to(report.geometry.hero.width, 88)); assert.ok(close_to(report.geometry.footer.bottom, 852)); assert.match(report.geometry.text, /Waiting for Chloe/)
    const before = await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')); await page.reload(); await page.locator('.sent-status').waitFor(); assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), before)
    await page.locator('[data-interaction="reqSent.doneSent.click.1"]').click(); await page.locator('.discover-header').waitFor(); assert.equal(await page.locator('.main-tab-frame').getAttribute('data-page-depth'), '1')
    check('Source geometry/copy, persisted pending, refresh and Done clear-stack to Discover')
  }
  if (phase === 'received') {
    assert.ok(close_to(report.geometry.header.y, 58)); assert.ok(close_to(report.geometry.photo.y, 118)); assert.ok(close_to(report.geometry.photo.width, 353)); assert.ok(close_to(report.geometry.photo.height, 353 * 4 / 3))
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
    await page.locator('[data-interaction="reqReceived.openGallery.click.1"]').click(); const gallery = page.getByRole('dialog', { name: 'Lina photo gallery' }); await gallery.waitFor(); await gallery.locator('.profile-photo[data-media-status="ready"]').waitFor(); const mask = await gallery.locator('..').boundingBox(); assert.ok(close_to(mask.height, 852)); await gallery.getByRole('button', { name: 'Close', exact: true }).click(); await gallery.waitFor({ state: 'hidden' })
    check('Photo gallery owns the full viewport overlay outside the scrolling/clipped profile body')
    await page.locator('[data-interaction="reqReceived.notNow.click.1"]').click(); await page.locator('.dialog__cancel').click(); assert.equal((await saved()).requests.find(row => row.request_id === 'request_pixel').status, 'pending')
    await page.locator('[data-interaction="reqReceived.notNow.click.1"]').click(); await page.locator('.dialog__confirm').click(); await page.locator('.home-header').waitFor()
    assert.equal((await saved()).requests.find(row => row.request_id === 'request_pixel').status, 'declined'); assert.equal(await page.locator('[data-interaction="home.openJordan.click.1"]').count(), 0)
    check('Decline cancellation keeps the invitation; confirmation closes it and removes the Home Invite')
    await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data: fixture })), { key: STATE_KEY, fixture: data }); await open(route)
    const before_failure = await saved(); await page.evaluate(() => { window.__connectionWrite = Storage.prototype.setItem; Storage.prototype.setItem = function(key,value) { if (key === 'cimoa_app_state_v2') throw Error('Storage full'); return window.__connectionWrite.call(this,key,value) } })
    await page.locator('[data-interaction="reqReceived.accept.click.1"]').click(); await page.locator('.dialog__confirm').click(); await page.locator('.event-loading:visible').waitFor(); await page.locator('.event-loading:visible').waitFor({ state: 'hidden' }); assert.match(await page.getByRole('alert').innerText(), /doesn’t have enough space/); assert.deepEqual(await saved(), before_failure)
    await page.evaluate(() => { Storage.prototype.setItem = window.__connectionWrite; delete window.__connectionWrite }); check('Accept storage failure preserves the complete pending request, consent, messages and balance; retry stays available')
    await page.locator('[data-interaction="reqReceived.accept.click.1"]').click(); await page.getByRole('dialog').getByRole('button', { name: 'Accept', exact: true }).click()
    await page.locator('.event-loading').waitFor({ state: 'visible' }); assert.equal((await saved()).requests.find(row => row.request_id === 'request_pixel').status, 'pending')
    await page.locator('[data-interaction="reqAccepted.startChat.click.1"]').waitFor(); const accepted = await saved()
    assert.equal(accepted.requests.find(row => row.request_id === 'request_pixel').status, 'accepted'); assert.equal(accepted.conversations.filter(row => row.kind === 'direct' && row.participant_ids.includes('user_lina')).length, 1)
    check('Accept writes after business Loading and creates one real conversation')
  }
  if (phase === 'accepted') {
    assert.ok(close_to(report.geometry.hero.y, 150)); assert.match(report.geometry.text, /View Lina’s Profile/); assert.match(report.geometry.text, /YOU BOTH LIKE/)
    await page.locator('[data-interaction="reqAccepted.viewProfile.click.1"]').click(); await page.locator('.expanded-profile-page').waitFor(); assert.equal(await page.locator('[data-interaction="expanded.sayHi.click.1"]').innerText(), 'Chat'); await page.locator('[data-interaction="expanded.collapse.click.1"]').click(); await page.locator('.connection-accepted-page').waitFor()
    await page.locator('[data-interaction="reqAccepted.startChat.click.1"]').click(); await page.locator('.chat-composer').waitFor(); assert.ok(page.url().includes('conversation_pixel')); await page.locator('[data-interaction="chat.goBack.click.1"]').click(); await page.locator('.connection-accepted-page').waitFor()
    await page.locator('[data-interaction="reqAccepted.closeAccepted.click.1"]').click(); await page.locator('.home-header').waitFor(); assert.equal(await page.locator('.main-tab-frame').getAttribute('data-page-depth'), '1')
    check('Real counterpart/shared interests; profile Chat CTA and chat use unique conversation; both Back owners correct; Close clears Home')
  }
  if (phase === 'declined') {
    assert.ok(close_to(report.geometry.hero.y, 170)); assert.match(report.geometry.text, /No connection was created and no reason is passed on/)
    for (const id of ['reqDeclined.backToDiscover.click.1','reqDeclined.backToDiscover.click.2']) { await open(route); await page.locator(`[data-interaction="${id}"]`).click(); await page.locator('.discover-header').waitFor(); assert.equal(await page.locator('.main-tab-frame').getAttribute('data-page-depth'), '1') }
    check('Source closed result, truthful no-connection copy and both completion actions clear-stack to Discover')
  }
  if (phase === 'chat') {
    assert.ok(close_to(report.geometry.header.y, 56)); assert.ok(close_to(report.geometry.header.height, 64)); assert.ok(close_to(report.geometry.footer.height, 56)); assert.ok(close_to(report.geometry.footer.bottom, 818)); assert.equal(await page.locator('.chat-message').count(), 5)
    assert.ok(!report.geometry.text.includes('stored locally')); assert.equal(await page.locator('.chat-time').count(), 0)
    const message = page.locator('uni-input[aria-label="Message"] input'); await message.fill('See you at the library after class.'); await page.locator('[data-interaction="chat.send.click.1"]').click(); assert.ok(await page.locator('.chat-send .chat-action-loading:visible').count())
    await page.waitForFunction(() => document.querySelector('.chat-messages').textContent.includes('See you at the library after class.')); await page.waitForFunction(() => document.querySelector('uni-input[aria-label="Message"] input').value === '')
    await page.reload(); await page.locator('.chat-composer').waitFor(); assert.match(await page.locator('.chat-messages').innerText(), /See you at the library after class/)
    await page.locator('[data-interaction="chat.viewProfile.click.1"]').click(); await page.locator('.expanded-profile-page').waitFor(); await page.locator('[data-interaction="expanded.sayHi.click.1"]').click(); await page.locator('.chat-composer').waitFor(); assert.ok(page.url().includes('conversation_chloe'))
    await page.locator('[data-interaction="chat.startCall.click.1"]').click(); await page.locator('.waiting-call-page').waitFor(); await page.locator('[data-interaction="callActive.endCall.click.1"]').click(); await page.locator('.chat-composer').waitFor()
    check('Source header/composer/icons/message geometry; real send→refresh, same profile Chat CTA and waiting-call return')
  }
  await page.evaluate(({ key, data: fixture }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data: fixture })), { key: STATE_KEY, data })
  await page.setViewportSize({ width: 320, height: 568 }); await open(route); await set_safe_area(page, 62, 34); await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(output, 'actual-browser-small.png') }); check('Narrow iPhone width with real safe-area budget has no horizontal clipping')
  if (phase === 'chat') {
    await page.locator('uni-input[aria-label="Message"] input').focus(); await page.setViewportSize({ width: 320, height: 360 }); await page.waitForFunction(() => document.querySelector('.direct-chat-page')?.classList.contains('direct-chat-page--keyboard')); const composer = await page.locator('.chat-composer').boundingBox(); assert.ok(composer.y + composer.height <= 360); await page.screenshot({ path: path.join(output, 'actual-browser-keyboard.png') }); check('Keyboard-height viewport keeps the composer above the keyboard without a second bottom safe area')
  }
  if (phase === 'received') {
    const long = structuredClone(data); long.requests.find(row => row.request_id === 'request_pixel').text = 'A'.repeat(300); long.users.find(row => row.user_id === 'user_lina').user_name = 'Lina with a very long campus profile name'
    await page.evaluate(initial => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data: initial })), long); await open(route); await freeze(62,34); await page.locator('.received-actions').waitFor(); const actions = await page.locator('.received-actions').boundingBox(); assert.ok(actions.y + actions.height <= 534); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.screenshot({ path: path.join(output, 'actual-browser-long.png') })
    await open('/pages/connections/received?request_id=missing'); await page.getByRole('alert').waitFor(); await freeze(62,34); assert.equal(await page.locator('[data-interaction="reqReceived.accept.click.1"]').count(),0); await page.screenshot({ path: path.join(output, 'actual-browser-error.png') }); await page.locator('[data-interaction="reqReceived.goBack.click.1"]').click(); await page.locator('.home-header').waitFor(); check('Long names/300-character answers keep both decisions visible; forged request ID exposes no private content and Back restores Home')
  }
  await context.close(); assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.errors.push(error.stack || error.message); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
