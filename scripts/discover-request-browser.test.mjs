import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { read_circa_source } from './lib/circa-source.mjs'
import { serve_h5, context_for, set_safe_area, write_comparison, close_to, sha256 } from './lib/pixel-acceptance.mjs'
import { discover_reference } from './lib/discover-request-reference.mjs'
const require=createRequire(import.meta.url),{chromium}=require(process.env.CIMOA_BROWSER_MODULE||'playwright'),phase=process.argv.find(arg=>arg.startsWith('--page='))?.split('=')[1]||'deck'
const folder=path.resolve(`docs/ui-restoration/discover-request-${phase}`),contract=JSON.parse(fs.readFileSync(path.join(folder,'source-contract.json'))),data=create_seed(),source=read_circa_source()
assert.equal(source.source_hash,contract.source.file_sha256);assert.equal(sha256(source.template.split('\n').slice(contract.source.lines[0]-1,contract.source.lines[1]).join('\n')),contract.source.fragment_sha256)
const question=data.icebreakers.find(r=>r.user_id==='user_zane');
if(['text','voice','preview'].includes(phase))data.drafts.push({draft_id:'draft_discover',owner_user_id:'user_cimoa',kind:'introduction',target_id:'user_zane',payload:{user_id:'user_zane',question_id:question.question_id,mode:phase==='text'?'text':'voice',text:'',operation_id:'discover-pixel'},updated_at:Date.now()})
fs.writeFileSync(path.join(folder,'native-fixture.json'),JSON.stringify({data,route:contract.route},null,2)+'\n')
const report={page:phase,result:'failed',checks:[],errors:[],deferred:[],source_sha256:source.source_hash},check=x=>{report.checks.push(x);console.log('PASS '+phase+': '+x)}
let server,browser
try{
  server=await serve_h5();report.server_pid=server.pid;console.log(`Temporary Discover request test PID ${server.pid}, ${server.origin}`)
  browser=await chromium.launch({headless:true,...(process.env.CIMOA_BROWSER_CHANNEL?{channel:process.env.CIMOA_BROWSER_CHANNEL}:{})})
  const reference=await browser.newPage({viewport:{width:393,height:852}});await reference.setContent(discover_reference(phase,contract,server.origin,data));await reference.evaluate(async()=>{await document.fonts.ready;for(const a of document.getAnimations())a.finish();await Promise.all([...document.images].map(i=>i.decode()))});await reference.screenshot({path:path.join(folder,'reference.png')});await reference.close()
  const context=await context_for(browser,STATE_KEY,data),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));let seq=0
  const open=route=>page.goto(`${server.origin}/?discoverRequest=${phase}-${seq++}#${route}`),click=id=>page.locator(`[data-interaction="${id}"]:visible`).click(),saved=()=>page.evaluate(()=>localStorage.getItem('cimoa_app_state_v2'))
  const freeze=async(top=54,bottom=0)=>{await set_safe_area(page,top,bottom);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(const a of document.getAnimations())if(a.effect.getComputedTiming().iterations!==Infinity)a.finish();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})}
  await open(contract.route);await page.locator('uni-page-body').waitFor();await page.waitForTimeout(400);await freeze();await page.screenshot({path:path.join(folder,'actual-browser.png')});report.comparison=await write_comparison(browser,folder,path.join(folder,'reference.png'),path.join(folder,'actual-browser.png'))
  if(phase==='deck'){
    const card=page.locator('.discover-photo-card--front');await card.waitFor();const r=await card.boundingBox();assert.ok(close_to(r.x,20));assert.ok(close_to(r.y,130));assert.ok(close_to(r.width,353));assert.ok(close_to(r.height,542));report.geometry={card:r,cta:await page.locator('.discover-send').boundingBox()};assert.ok(close_to(report.geometry.cta.y,688));
    const before=await saved();await click('photo.expand.click.1');await page.locator('.expanded-profile-page').waitFor();assert.match(page.url(),/user_zane/);await click('expanded.collapse.click.1');await card.waitFor();assert.equal(await card.getAttribute('data-user-id'),'user_zane');assert.equal(await saved(),before)
    await click('photo.sayHi.click.1');await page.locator('[data-interaction="ibSelect.answerGo.click.1"]').waitFor();assert.match(page.url(),/user_zane/);assert.equal(await saved(),before);await page.goBack();await card.waitFor();check('Source geometry and exact user entry/Back are read-only, with preserved deck order')
    for(const [width,height]of [[320,568],[375,667],[375,812],[390,844],[393,852],[402,874],[414,896],[430,932]]){await page.setViewportSize({width,height});await freeze(62,34);const b=await card.boundingBox(),cta=await page.locator('.discover-send').boundingBox(),bar=await page.locator('.tabbar').boundingBox();assert.ok(b.y+b.height<=cta.y);assert.ok(cta.y+cta.height<=bar.y);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&scrollY===0),true)}check('Eight iPhone viewports keep the whole card, CTA and Tabbar in one non-scrolling view')
    await page.setViewportSize({width:393,height:852});await freeze();
    for(const name of ['Events','Home','Discover','Home','Discover']){await page.getByRole('button',{name,exact:true}).click();await page.locator(`.tab[aria-label="${name}"][aria-current="page"]`).waitFor();assert.equal(await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth'),'1');assert.equal(await page.locator('.main-skeleton').count(),0)}check('Repeated Tab changes retain root depth, fixed bar and no repeated skeleton')
    const pending=structuredClone(data);pending.requests.push({request_id:'discover_pending',sender_id:'user_cimoa',recipient_id:'user_zane',question_id:question.question_id,question_text:question.text,kind:'text',text:'See you on campus.',audio_id:null,status:'pending',created_at:Date.now(),resolved_at:null});await page.evaluate(data=>localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data})),pending);await open(contract.route);await page.getByRole('button',{name:'Request sent',exact:true}).waitFor();const bytes=await saved();await click('photo.sayHi.click.1');await page.locator('.connection-sent-page').waitFor();assert.match(page.url(),/discover_pending/);assert.equal(await saved(),bytes);check('An existing request opens its canonical result instead of duplicate send or an eligibility dead end')
  }
  await context.close();assert.deepEqual(report.errors,[]);report.result='passed'
}catch(error){report.errors.push(error.stack||String(error));throw error}
finally{await browser?.close();await server?.close();report.cleaned_up=true;fs.writeFileSync(path.join(folder,'browser-acceptance.json'),JSON.stringify(report,null,2)+'\n')}
