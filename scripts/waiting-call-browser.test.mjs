import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { read_circa_source, walk_html, attribute } from './lib/circa-source.mjs'
import { serve_h5, context_for, set_safe_area, write_comparison, close_to } from './lib/pixel-acceptance.mjs'
import { create_seed } from '../src/stores/seed.js'
import { connection_for } from '../src/stores/connectionEntities.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const output = path.resolve('docs/ui-restoration/call-waiting'), source = read_circa_source()
const contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json')))
assert.equal(source.source_hash, contract.source.file_sha256)
assert.equal(source.template.split('\n').slice(1314, 1359).join('\n'), contract.source.fragment)
const epoch = Date.now(), data = create_seed(epoch), connection = connection_for(data, 'user_chloe', epoch)
for (const message of data.messages) if (message.conversation_id === 'conversation_chloe') message.read_by = ['user_cimoa', 'user_chloe']
data.call_sessions.push({ call_id: 'call_pixel', owner_user_id: 'user_cimoa', participant_id: 'user_chloe', conversation_id: 'conversation_chloe', connection_id: connection.connection_id, session_expires_at: data.session.expires_at, started_at: epoch - 450, expires_at: epoch + 11550, ended_at: null })
const route = '/pages/messages/call/waiting?conversation_id=conversation_chloe&call_id=call_pixel'
fs.writeFileSync(path.join(output, 'native-fixture.json'), JSON.stringify({ route, data }, null, 2) + '\n')
const report = { result: 'failed', checks: [], errors: [], source_sha256: source.source_hash, geometry: {} }
const check = message => { report.checks.push(message); console.log('PASS ' + message) }
function reference(origin) {
  const nodes = new Map(); walk_html(source.html, node => { if (node.type === 1) nodes.set(node.loc.start.line + ':' + node.tag, node) })
  const assets = JSON.parse(fs.readFileSync('docs/circa-source-audit.json')).resources
  const render = node => {
    if (node.type === 2) return node.content
    if (node.type !== 1 || node.tag === 'sc-if') return ''
    const attrs = (node.props || []).filter(p => p.type === 6 && !p.name.startsWith('sc-camel-on-')).map(p => {
      let value = p.value?.content || ''
      for (const asset of assets) if (asset.local_path) value = value.replaceAll(asset.bundle_id, origin + '/' + asset.local_path)
      return ' ' + p.name.replace('sc-camel-view-box','viewBox') + '="' + value.replaceAll('"','&quot;') + '"'
    }).join('')
    return '<' + node.tag + attrs + '>' + (node.children || []).map(render).join('') + (node.tag === 'img' ? '' : '</' + node.tag + '>')
  }
  const node = (line, tag = 'div') => render(nodes.get(line + ':' + tag))
  const other = data.users.find(u => u.user_id === 'user_chloe').avatar_url
  const own = data.profile_photos.find(p => p.user_id === 'user_cimoa').media_url
  const main_photo = node(1321, 'img').replace(/src="[^"]+"/, 'src="' + origin + other + '"')
  const preview = node(1329).replace(/src="[^"]+"/, 'src="' + origin + own + '"')
  const waiting = node(1335).replace(node(1336), '').replace('Connected', 'Waiting for Chloe Lin.')
  const controls = node(1339).replace('justify-content:space-between','justify-content:center')
    .replace(node(1340), '').replace(node(1343), '').replace(node(1346), '').replace(node(1349), '')
  return '<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;-webkit-font-smoothing:antialiased}</style></head><body><div style="position:absolute;inset:0;background:#08101f">' + main_photo + node(1322) + node(1323) + node(1317) + '<div style="position:absolute;top:66px;left:76px;right:76px;text-align:center">' + node(1325) + '</div>' + preview + waiting + controls + '</div></body></html>'
}
let browser, server
try {
  server = await serve_h5(); console.log('Temporary waiting-call preview PID ' + server.pid + ': ' + server.origin)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const ref = await browser.newPage({ viewport: { width: 393, height: 852 } }); await ref.setContent(reference(server.origin)); await ref.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())) }); await ref.screenshot({ path: path.join(output, 'reference.png') }); await ref.close()
  const pixel = await context_for(browser, STATE_KEY, data); await pixel.addInitScript(at => { Date.now = () => at }, epoch)
  const page = await pixel.newPage(); page.on('pageerror', e => report.errors.push(e.message)); await page.goto(server.origin + '/#' + route); await page.locator('.waiting-call-own .profile-photo[data-media-status="ready"]').waitFor(); await page.locator('.waiting-call-background .profile-photo[data-media-status="ready"]').waitFor()
  await set_safe_area(page, 54, 0); await page.waitForTimeout(500)
  await page.evaluate(async () => { for (const a of document.getAnimations()) a.finish(); await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r))) })
  report.geometry = await page.evaluate(() => { const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom } }; return { back:box('.waiting-call-round'),own:box('.waiting-call-own'),end:box('.waiting-call-end'),state:document.querySelector('.waiting-call-state').textContent } })
  assert.ok(close_to(report.geometry.back.y, 58)); assert.ok(close_to(report.geometry.own.y, 116)); assert.ok(close_to(report.geometry.own.width, 104)); assert.ok(close_to(report.geometry.own.height, 142)); assert.ok(close_to(report.geometry.end.width, 64)); assert.ok(close_to(report.geometry.end.bottom, 808))
  const background_src = await page.locator('.waiting-call-background .profile-photo img').getAttribute('src')
  assert.ok(background_src.endsWith(data.users.find(user => user.user_id === 'user_chloe').avatar_url))
  assert.ok(!background_src.endsWith(data.profile_photos.find(photo => photo.photo_id === data.users.find(user => user.user_id === 'user_chloe').photo_ids[0]).media_url))
  await page.screenshot({ path: path.join(output, 'actual-browser.png') }); report.comparison = await write_comparison(browser, output, path.join(output,'reference.png'), path.join(output,'actual-browser.png')); await pixel.close()
  check('Current conversation participant avatar is the call background; gradients, header/preview/hangup geometry remain fixed at 393×852 and the selected dot phase')
  const initial = create_seed(); for (const m of initial.messages) if (m.conversation_id === 'conversation_chloe') m.read_by = ['user_cimoa','user_chloe']
  const context = await context_for(browser, STATE_KEY, initial), live = await context.newPage(); live.setDefaultTimeout(13000); live.on('pageerror', e => report.errors.push(e.message))
  const state = () => live.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const click = id => live.locator('[data-interaction="' + id + '"]').click()
  await live.goto(server.origin + '/#/pages/messages/chat?conversation_id=conversation_chloe'); await live.locator('.chat-composer').waitFor()
  const before = await state(); await click('chat.startCall.click.1'); await live.locator('.chat-call .chat-action-loading:visible').waitFor(); assert.equal((await state()).call_sessions.length, 0)
  await live.locator('.waiting-call-page').waitFor(); await live.locator('.waiting-call-background .profile-photo[data-media-status="ready"]').waitFor(); const started = (await state()).call_sessions.at(-1), url = live.url()
  const live_state = await state(), live_participant = live_state.users.find(user => user.user_id === started.participant_id)
  assert.ok((await live.locator('.waiting-call-background .profile-photo img').getAttribute('src')).endsWith(live_participant.avatar_url))
  assert.equal(await live.locator('video').count(),0); assert.equal(await live.locator('.waiting-call-copy').count(),0)
  await live.waitForTimeout(1200); await live.reload(); await live.locator('.waiting-call-own').waitFor(); assert.equal((await state()).call_sessions.at(-1).expires_at, started.expires_at)
  const cdp = await context.newCDPSession(live); await cdp.send('Page.setWebLifecycleState',{ state:'frozen' }); await new Promise(r=>setTimeout(r,1200)); await cdp.send('Page.setWebLifecycleState',{ state:'active' })
  assert.equal((await state()).call_sessions.at(-1).expires_at, started.expires_at)
  await live.setViewportSize({ width:320,height:568 }); await set_safe_area(live,62,34)
  assert.equal(await live.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await live.locator('.chat-composer').waitFor({ timeout:13000 }); assert.ok(Date.now() - started.started_at < 14000); assert.equal((await state()).call_sessions.at(-1).ended_at,null)
  assert.deepEqual((await state()).messages,before.messages); assert.ok(live.url().includes('conversation_id=conversation_chloe'))
  check('Loading precedes call creation; reload/freeze/resume preserve deadline; small-screen timeout returns once to exact Chat without messages/coins/peer consent')
  await click('chat.startCall.click.1'); await live.locator('.waiting-call-page').waitFor()
  await live.evaluate(()=>{window.oldWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw Error('Storage full');return window.oldWrite.call(this,key,value)}})
  await click('callActive.endCall.click.1'); await live.getByRole('alert').filter({hasText:/doesn’t have enough space/}).waitFor(); assert.equal((await state()).call_sessions.at(-1).ended_at,null)
  await live.evaluate(()=>{Storage.prototype.setItem=window.oldWrite}); await click('callActive.endCall.click.1'); await live.locator('.chat-composer').waitFor(); assert.ok((await state()).call_sessions.at(-1).ended_at!==null)
  check('Manual end storage failure remains retryable; retry persists end and returns once')
  await live.goto(url); await live.locator('.chat-composer').waitFor()
  await live.goto(server.origin + '/#/pages/messages/call/waiting?conversation_id=missing&call_id=forged'); await live.getByRole('alert').waitFor(); assert.equal(await live.locator('.waiting-call-own').count(),0)
  await click('callActive.goBack.click.1'); await live.locator('.home-header').waitFor()
  check('Expired waiting URL never restarts; forged conversation shows no private preview and Back returns Home')
  await live.goto(server.origin + '/?callSafety=1#/pages/messages/chat?conversation_id=conversation_chloe'); await live.locator('.chat-composer').waitFor()
  await click('chat.startCall.click.1'); await live.locator('.waiting-call-own').waitFor(); await click('callActive.openSafetyMini.click.1'); await click('sheetSafetyMini.openReport.click.1'); await live.locator('.safety-report-user-page').waitFor()
  assert.ok((await state()).call_sessions.at(-1).ended_at != null)
  await click('safetyReport.goBack.click.1'); await live.locator('.chat-composer').waitFor()
  await click('chat.startCall.click.1'); await live.locator('.waiting-call-own').waitFor(); await click('callActive.openSafetyMini.click.1'); await click('sheetSafetyMini.openBlock.click.1'); await click('sheetBlock.confirmBlock.click.1'); await live.locator('.home-header').waitFor()
  assert.equal((await state()).call_sessions.length,0); assert.equal((await state()).conversations.some(c=>c.conversation_id==='conversation_chloe'),false)
  check('Source safety flag ends waiting before Report and returns to exact Chat; confirmed Block clears connection/call and returns Home')
  await context.close(); assert.deepEqual(report.errors,[]); report.result='passed'
} finally { await browser?.close(); await server?.close(); report.cleaned_up=true; fs.writeFileSync(path.join(output,'browser-acceptance.json'),JSON.stringify(report,null,2)+'\n') }
