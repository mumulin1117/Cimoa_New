import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'detail'
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/evidence/event-pages')
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2' }
const server = http.createServer((req,res) => { const file = path.resolve(root, '.' + new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html')); if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return } res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res) })
const report = { phase, result:'failed', server_pid:process.pid, checks:[], errors:[] }, check = message => { report.checks.push(message); console.log('PASS '+message) }
let browser, page
try {
  fs.mkdirSync(output,{recursive:true}); await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  const origin = `http://127.0.0.1:${server.address().port}`; console.log(`Temporary events preview PID ${process.pid}: ${origin}`)
  browser = await chromium.launch({headless:true,channel:process.env.CIMOA_BROWSER_CHANNEL || 'chrome'}); page = await browser.newPage({viewport:{width:393,height:852}}); page.setDefaultTimeout(10000)
  page.on('pageerror',error=>report.errors.push(error.message)); const now = Date.UTC(2026,9,13,1); await page.clock.setFixedTime(new Date(now)); await page.goto(origin)
  const goto = route=>page.goto(`${origin}/?phase=${phase}#${route}`), click = id=>page.locator(`[data-interaction="${id}"]:visible`).click(), button = name=>page.getByRole('button',{name,exact:true})
  const state = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const load = async (route,transform) => {const data=create_scenario('default',now);transform?.(data);await page.evaluate(data=>localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data})),data);await goto(route);await page.reload()}
  const detail = '/pages/events/detail?event_id=event_picnic', shot = async name=>{await page.locator('.page-transition:visible').last().evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));await page.screenshot({path:path.join(output,name+'.png')})}
  const settle = ()=>page.locator('.event-loading:visible').waitFor({state:'hidden'}), closed = ()=>page.locator('.event-dialog:visible').waitFor({state:'hidden'})
  await load('/pages/events/index'); await click('events.openEvent.click.1'); await page.locator('.event-detail-page').waitFor(); await page.locator('.event-detail-cover .profile-photo[data-media-status="ready"]').waitFor(); await shot('detail-default')
  assert.match(await page.locator('[data-event-count]').innerText(),/3 of 20/); const card=await page.locator('.event-detail-info').boundingBox(); assert.ok(Math.abs(card.width-353)<1)
  await button('Back').click(); await page.locator('.events-header:visible').waitFor(); assert.equal(await page.locator('.tabbar').count(),1)
  check('Events → exact detail → original Tab; source card geometry, local cover and actual count')
  await click('events.openEvent.click.1'); const before=await state(); await click('evDetail.askJoin.click.1'); await page.getByRole('dialog',{name:'Sunset Picnic'}).waitFor(); await button('Not now').click(); await closed(); assert.deepEqual(await state(),before)
  await click('evDetail.askJoin.click.1'); await button('Confirm join').click(); await page.locator('.event-loading').waitFor(); assert.deepEqual(await state(),before); await settle()
  if(phase !== 'detail' && phase !== 'participants') { await page.locator('.event-success-page').waitFor(); await click('evJoinSuccess.openJoined.click.1') }
  await page.locator('[data-event-count]:visible').waitFor(); assert.match(await page.locator('[data-event-count]:visible').innerText(),/4 of 20/); assert.equal((await state()).memberships.filter(row=>row.user_id==='user_cimoa'&&row.event_id==='event_picnic').length,1)
  await page.reload(); await page.locator('.event-detail-page').waitFor(); assert.match(await page.locator('[data-event-count]').innerText(),/4 of 20/); await shot('detail-joined')
  await click('evDetail.manageAttendance.click.1'); await button('Keep my spot').click(); await closed(); const joined=await state()
  await click('evDetail.manageAttendance.click.1'); await page.evaluate(()=>{window.originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='cimoa_app_state_v2')throw Error('Storage full');return window.originalWrite.call(this,k,v)}}); await button('Cancel attendance').click(); await settle(); await page.locator('.event-dialog-error:visible').waitFor(); assert.deepEqual(await state(),joined)
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalWrite}); await button('Cancel attendance').click(); await settle(); await closed(); assert.match(await page.locator('[data-event-count]').innerText(),/3 of 20/)
  check('Join/cancel confirmation and pre-write Loading; unique membership, refresh, rollback and released seat')
  await click('evDetail.openEventMore.click.1'); await click('sheetEvMore.openEventReport.click.1'); assert.match(await page.getByRole('dialog').innerText(),/not been restored/); await click('sheetEvMore.shareEvent.click.1'); assert.match(await page.getByRole('dialog').innerText(),/Sunset Picnic/); await click('sheetEvMore.closeSheet.click.2'); await closed()
  await click('eventDetail.location.open.click.1'); await click('eventDetail.location.map.click.1'); assert.match(await page.getByRole('dialog').innerText(),/coordinates have not/); await click('sheetEvMore.closeSheet.click.2'); await closed()
  check('Real share summary and address; missing maps/report services fail without fake success')
  await page.setViewportSize({width:320,height:568}); await shot('detail-small'); const footer=await page.locator('.event-page-footer').boundingBox(); assert.ok(footer.y+footer.height<=568); assert.equal(await page.locator('.event-page-body').evaluate(el=>el.scrollWidth<=el.clientWidth),true); await page.setViewportSize({width:393,height:852})
  await load(detail,d=>{d.events[0].description='A long campus event description. '.repeat(70);d.events[0].schedule=[];d.events[0].notes=''}); await page.locator('.event-detail-page').waitFor(); assert.equal(await page.locator('.event-page-body').evaluate(el=>el.scrollWidth<=el.clientWidth),true); await shot('detail-long')
  for(const [transform,pattern] of [[d=>{d.events[0].capacity=3},/full/],[d=>{d.events[0].ends_at=now-1;d.events[0].starts_at=now-7200000},/ended/],[d=>{d.users[0].verification_status='pending'},/verification/]]){await load(detail,transform);await click('evDetail.askJoin.click.1');assert.match(await page.getByRole('alert').innerText(),pattern);assert.equal(await page.locator('.event-loading:visible').count(),0)}
  await load('/pages/events/detail?event_id=missing'); await page.getByRole('alert').waitFor(); assert.equal(await page.locator('.event-detail-cover').count(),0)
  check('Small/long/empty-source details scroll; full/ended/unverified/invalid-ID errors stay honest')
  // Further phases append their own assertions below, retaining the completed page regressions.
  if(!['detail','participants'].includes(phase)) {
    await load('/pages/events/index');await click('events.openEvent.click.1');await click('evDetail.askJoin.click.1');await button('Confirm join').click();await page.locator('.event-success-page').waitFor();await shot('join-success');const saved=await state();await click('evJoinSuccess.openJoined.click.1');await page.locator('.event-detail-page:visible').waitFor();assert.equal(await page.locator('.event-detail-page:visible').getAttribute('data-page-depth'),'2');assert.deepEqual(await state(),saved)
    await goto('/pages/events/join-success?event_id=event_picnic');await page.reload();await page.locator('.event-success-name').waitFor();assert.equal(await page.locator('.event-success-name').innerText(),'Sunset Picnic');assert.deepEqual(await state(),saved)
    if(phase==='success'){await click('evJoinSuccess.openMyEvents.click.1');assert.match(await page.getByRole('alert').innerText(),/not been restored/)}
    await load('/pages/events/join-success?event_id=event_picnic');await page.getByRole('alert').waitFor();assert.equal(await page.locator('.event-success-icon').count(),0);await button('Back to events').click();await page.locator('.events-header').waitFor()
    check('Success page reads actual membership, reload is read-only, Open event pops original detail, cancelled attendance cannot show success')
  }
  if(phase !== 'detail') {
    await load(detail);await click('evDetail.openParticipantsList.click.1');await page.locator('.event-participants-page').waitFor();assert.equal(await page.locator('.event-person').count(),3);await shot('participants')
    const field=page.locator('uni-input[aria-label="Search participants"] input');await field.fill('Chloe');assert.equal(await page.locator('.event-person').count(),1);await page.locator('.event-person').click();assert.match(await page.getByRole('alert').innerText(),/not been restored/)
    await field.fill('no matching student');await page.getByText('No participants match your search.').waitFor();assert.equal(await page.locator('.event-person').count(),0);await click('evParticipants.goBack.click.1');await page.locator('.event-detail-page:visible').waitFor()
    await load('/pages/events/participants?event_id=event_picnic',d=>{d.blocked_users.push({block_id:'event_test_block',owner_user_id:'user_cimoa',user_id:'user_chloe',created_at:now});d.users.find(u=>u.user_id==='user_alex').user_name='A very long campus participant name '.repeat(4)})
    await page.locator('.event-person').first().waitFor();assert.equal(await page.locator('.event-person').count(),2);assert.equal(await page.locator('.event-page-body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await page.reload();await page.locator('.event-person').first().waitFor();assert.equal(await page.locator('.event-person').count(),2)
    await load('/pages/events/participants?event_id=event_picnic',d=>{d.memberships=d.memberships.filter(m=>m.event_id!=='event_picnic')});await page.getByText('No visible participants yet.').waitFor()
    check('Participants search, empty/long, deferred person, correct return and persistent block filter; no automatic friendship')
  }
  assert.deepEqual(report.errors,[]); report.result='passed'
} catch(error){report.failure=String(error.stack||error);report.visible_failure=await page?.evaluate(()=>({route:location.hash,text:document.body.innerText.slice(-1800)})).catch(()=>null);console.error(report.failure,report.visible_failure);process.exitCode=1}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,`${phase}-acceptance.json`),JSON.stringify(report,null,2)+'\n');console.log('Temporary event server and isolated browser closed.')}
