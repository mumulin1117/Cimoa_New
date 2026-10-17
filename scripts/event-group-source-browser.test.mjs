// Independent source-only reference: never imports production templates or CSS.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { event_group } from '../src/stores/eventMessaging.js'
import { read_circa_source, walk_html, attribute, binding } from './lib/circa-source.mjs'
import { serve_h5, context_for, set_safe_area, write_comparison } from './lib/pixel-acceptance.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const output = path.resolve('docs/ui-restoration/event-group'), epoch = Date.UTC(2026, 9, 13, 1), data = create_seed(epoch)
const owner = data.session.current_user_id, route = '/pages/events/group?event_id=event_picnic&conversation_id=group_picnic'
data.memberships.push({ membership_id: 'member_group_pixel', event_id: 'event_picnic', user_id: owner, status: 'joined', joined_at: epoch, admission_id: 'admission_group_pixel' })
data.messages.push(...[['group_pixel_1', 'user_chloe', 'See you at the picnic!'], ['group_pixel_2', owner, 'I’ll bring a picnic mat.']].map(([message_id, sender_id, body], index) => ({ message_id, sender_id, body, kind: 'text', media_id: null, conversation_id: 'group_picnic', sent_at: epoch - (2 - index) * 60000, read_by: [sender_id] })))
const source = read_circa_source(), contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json')))
assert.equal(contract.source.file_sha256, source.source_hash)
const report = { result: 'failed', source_sha256: source.source_hash, checks: [], errors: [], approved_deltas: ['Canonical fixture users/messages, not prototype peer delivery', 'No organizer update is fabricated when saved organizer has none', 'Real safe area and keyboard-aware fixed skeleton'] }
const check = value => { report.checks.push(value); console.log('PASS ' + value) }
function reference(origin) {
  const group = event_group(data, 'event_picnic', 'group_picnic', epoch), event = data.events.find(e => e.event_id === 'event_picnic')
  const vars = { evTitle: event.title, evParticipantsLabel: '4 participants', groupDraft: '', groupMsgs: group.messages.map(m => ({ name: m.mine ? 'You' : m.sender.user_name, time: m.time_label, text: m.body, avatar: m.sender.avatar_url, showLeftAvatar: !m.mine, showRightAvatar: m.mine, isMaya: !m.mine, me: m.mine, notMe: !m.mine, justify: m.mine ? 'flex-end' : 'flex-start', align: m.mine ? 'flex-end' : 'flex-start', bg: m.mine ? 'linear-gradient(95deg,#1ec8f5 0%,#4a7bf7 34%,#a855f7 64%,#f81ce5 100%)' : '#fff', ink: m.mine ? '#fff' : '#0b1b3a' })) }
  const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  const resolve = (key, scope) => key.split('.').reduce((v, k) => v?.[k], scope)
  const fill = (value, scope) => value.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => escape(resolve(key, scope)))
  const render = (node, scope = vars) => {
    if (node.type === 2 || node.type === 5) return fill(node.type === 2 ? node.content : node.loc.source, scope)
    if (node.type !== 1) return ''
    if (node.loc.start.line === 2065) return ''
    if (node.tag === 'sc-if') return resolve(binding(attribute(node, 'value')), scope) ? node.children.map(n => render(n, scope)).join('') : ''
    if (node.tag === 'sc-for') return (resolve(binding(attribute(node, 'list')), scope) || []).map(row => node.children.map(n => render(n, { ...scope, [attribute(node, 'as')]: row })).join('')).join('')
    const attrs = node.props.filter(p => p.type === 6 && !p.name.startsWith('sc-camel-on-') && !p.name.startsWith('hint-')).map(p => {
      let value = p.value?.content || ''
      if (p.name === 'src') value = origin + (node.loc.start.line === 2055 ? event.image_url : scope.m.avatar)
      return ' ' + p.name.replace('sc-camel-view-box', 'viewBox') + '="' + fill(value, scope) + '"'
    }).join('')
    return '<' + node.tag + attrs + '>' + node.children.map(n => render(n, scope)).join('') + (['input', 'img'].includes(node.tag) ? '' : '</' + node.tag + '>')
  }
  let root; walk_html(source.html, n => { if (n.tag === 'sc-if' && binding(attribute(n, 'value')) === 'isEvGroup') root = n.children.find(n => n.type === 1) })
  return '<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;color:#0b1b3a;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);-webkit-font-smoothing:antialiased}input{font-family:inherit;border:0;outline:0;color:inherit}::-webkit-scrollbar{display:none}</style></head><body>' + render(root) + '</body></html>'
}
let browser, server
try {
  fs.mkdirSync(output, { recursive: true }); server = await serve_h5(); console.log('Temporary group source preview PID ' + server.pid + ': ' + server.origin)
  fs.writeFileSync(path.join(output, 'native-fixture.json'), JSON.stringify({ route, data }, null, 2) + '\n')
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const ref = await browser.newPage({ viewport: { width: 393, height: 852 } }); await ref.setContent(reference(server.origin)); await ref.evaluate(() => Promise.all([...document.images].map(i => i.decode()))); await ref.screenshot({ path: path.join(output, 'reference.png') }); await ref.close()
  const context = await context_for(browser, 'cimoa_app_state_v2', data), page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => report.errors.push(e.message)); await page.clock.setFixedTime(new Date(epoch))
  await page.goto(server.origin + '/#' + route); await page.locator('.event-loading:visible').waitFor()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.messages.find(m => m.message_id === 'group_pixel_1').read_by.includes('user_cimoa')), false)
  await page.locator('.event-loading').waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.messages.find(m => m.message_id === 'group_pixel_1').read_by.includes('user_cimoa')), true)
  check('500ms custom Loading precedes visible group unread persistence, without changing peer read state')
  await set_safe_area(page, 54, 0)
  await page.evaluate(async () => { for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) })
  const geometry = await page.evaluate(() => { const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom } }; return { header: box('.event-group-header'), footer: box('.event-group-composer'), mine_avatar: box('.event-message--mine .event-message-avatar'), input: document.querySelector('.event-group-composer .uni-input-placeholder').textContent } })
  assert.ok(Math.abs(geometry.header.height - 80) < 1); assert.ok(Math.abs(geometry.footer.height - 118) < 1); assert.equal(geometry.input, 'Message the group'); assert.ok(Math.abs(geometry.mine_avatar.width - 36) < 1)
  report.geometry = geometry; await page.screenshot({ path: path.join(output, 'actual-browser.png') }); report.comparison = await write_comparison(browser, output, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  check('Independent original HTML styles/SVG reference plus fixed 393×852 actual, overlay and diff; source header/composer/right avatar geometry')
  const saved = await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')); await page.reload(); await page.locator('.event-message').first().waitFor(); await page.waitForTimeout(600); assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), saved)
  await page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(page, 62, 34); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.waitForFunction(() => Math.abs(document.querySelector('.event-group-page').getBoundingClientRect().height - visualViewport.height) < 1)
  const footer = await page.locator('.event-group-composer').boundingBox(); assert.ok(footer.y + footer.height <= 568 - 34 + 1)
  check('Refresh does not rewrite read receipts; narrow layout and actual bottom-safe owner preserve the fixed composer')
  await context.close(); assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'source-browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
