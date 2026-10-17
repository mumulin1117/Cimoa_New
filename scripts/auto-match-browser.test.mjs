import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {create_seed} from '../src/stores/seed.js'
import {STATE_KEY} from '../src/utils/statePersistence.js'
import {serve_h5,context_for,set_safe_area,write_comparison} from './lib/pixel-acceptance.mjs'
import {auto_match_reference} from './lib/auto-match-reference.mjs'
const require=createRequire(import.meta.url),{chromium}=require(process.env.CIMOA_BROWSER_MODULE||'playwright'),pageName=process.argv.find(s=>s.startsWith('--page='))?.slice(7)||'index',folder=path.resolve(`docs/ui-restoration/auto-match-${pageName}`),now=Date.now()
const data=create_seed(now)
if(!['index','preferences','history'].includes(pageName))data.match_sessions.push({match_id:'match_pixel',owner_user_id:'user_cimoa',candidate_id:'user_zane',status:pageName==='no-match'?'no_match':pageName,created_at:now,started_at:now,paused_at:pageName==='paused'?now:null,expires_at:now+3600000,priority_until:null,self_accepted:pageName==='waiting'||pageName==='connected',peer_accepted:pageName==='connected',queue_position:null,estimated_wait_seconds:9,fixture:false,search_revision:0})
if(pageName==='connected'){
  const id='match_pixel';data.relationships.push({relationship_id:'pixel_a',from_user_id:'user_cimoa',to_user_id:'user_zane',status:'connected',source_match_id:id,created_at:now},{relationship_id:'pixel_b',from_user_id:'user_zane',to_user_id:'user_cimoa',status:'connected',source_match_id:id,created_at:now});data.conversations.push({conversation_id:'pixel_chat',kind:'direct',participant_ids:['user_cimoa','user_zane'],created_at:now})
}
const route=`/pages/auto-match/${pageName}${data.match_sessions.some(m=>m.match_id==='match_pixel')?'?match_id=match_pixel':''}`
fs.writeFileSync(path.join(folder,'native-fixture.json'),JSON.stringify({data,route},null,2)+'\n')
const server=await serve_h5(),browser=await chromium.launch({channel:process.env.CIMOA_BROWSER_CHANNEL||'chrome',headless:true})
console.log(`Temporary H5 test server PID ${server.pid}: ${server.origin}`)
try{
  const context=await context_for(browser,STATE_KEY,data),page=await context.newPage(),errors=[]
  page.on('pageerror',e=>errors.push(e.message));await page.goto(server.origin+'/#'+route);await page.locator('.auto-match-'+pageName).waitFor();await set_safe_area(page,54,0);await page.waitForTimeout(350)
  const settle=async p=>p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));for(const a of document.getAnimations()){if(a.effect.getComputedTiming().iterations===Infinity){a.pause();a.currentTime=0}else a.finish()}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})
  await settle(page);await page.screenshot({path:path.join(folder,'actual-browser.png')})
  const reference=await browser.newPage({viewport:{width:393,height:852}});await reference.setContent(auto_match_reference(pageName,data,server.origin));await settle(reference);await reference.screenshot({path:path.join(folder,'reference.png')})
  const metrics=await write_comparison(browser,folder,path.join(folder,'reference.png'),path.join(folder,'actual-browser.png'))
  const geometry=async p=>p.evaluate(()=>{const result={};for(const e of document.querySelectorAll('[data-source-line]')){const r=e.getBoundingClientRect();if(r.height>0&&!result[e.dataset.sourceLine])result[e.dataset.sourceLine]={x:r.x,y:r.y,width:r.width,height:r.height,text:e.textContent.trim().replace(/\s+/g,' ')}}return result})
  const expected=await geometry(reference),actual=await geometry(page),differences=[]
  for(const[line,a]of Object.entries(actual)){const b=expected[line];if(!b)continue;for(const k of['x','y','width','height'])if(Math.abs(a[k]-b[k])>1)differences.push({line,dimension:k,expected:b[k],actual:a[k]})}
  fs.writeFileSync(path.join(folder,'browser-geometry.json'),JSON.stringify({viewport:{width:393,height:852},safe:[54,0],expected,actual,differences,pixels:metrics},null,2)+'\n')
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  if(pageName==='index'){
    const before=await page.evaluate(key=>localStorage.getItem(key),STATE_KEY);await page.locator('[data-interaction="amEntry.openPrefs.click.1"]').click();await page.locator('[data-interaction="amPrefs.savePrefs.click.1"]').waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),STATE_KEY),before);await page.goBack();await page.locator('.auto-match-index').waitFor();await page.waitForTimeout(250)
    await page.locator('[data-interaction="amEntry.joinPool.click.1"]').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(key=>localStorage.getItem(key),STATE_KEY),before);await page.locator('[data-interaction="amSearching.pauseQueue.click.1"]').waitFor();const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).data,STATE_KEY);assert.equal(saved.match_quota.find(q=>q.owner_user_id==='user_cimoa'&&q.date_key===new Date().toISOString().slice(0,10)).used_count,1)
    const poor=structuredClone(data);poor.match_quota.push({owner_user_id:'user_cimoa',date_key:new Date().toISOString().slice(0,10),used_count:3});poor.coin_transactions=poor.coin_transactions.filter(t=>t.owner_user_id!=='user_cimoa');const second=await context_for(browser,STATE_KEY,poor),p=await second.newPage();await p.goto(server.origin+'/#/pages/auto-match/index');await p.locator('.auto-match-index').waitFor();await p.waitForTimeout(300);const original=await p.evaluate(key=>localStorage.getItem(key),STATE_KEY);await p.locator('[data-interaction="amEntry.joinPool.click.1"]').click();await p.locator('.match-confirm .event-dialog--open').waitFor();await p.waitForTimeout(280);await p.locator('[data-interaction="sheetInsufficient.closeSheet.click.2"]').click();assert.equal(await p.evaluate(key=>localStorage.getItem(key),STATE_KEY),original);await second.close()
    const compact=await context_for(browser,STATE_KEY,data,{width:320,height:568}),small=await compact.newPage();await small.goto(server.origin+'/#/pages/auto-match/index');await small.locator('.auto-match-index').waitFor();await set_safe_area(small,20,20);assert.equal(await small.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await small.locator('[data-interaction="amEntry.joinPool.click.1"]').waitFor({state:'visible'});await compact.close()
  }
  fs.writeFileSync(path.join(folder,'browser-acceptance.json'),JSON.stringify({passed:true,page:pageName,route,errors,geometry_passed:differences.length===0,differences,source:'Offline source AST, approved data/safe-area/fixed-frame transformations only',server_pid:server.pid,cleaned_up:true},null,2)+'\n')
  console.log(JSON.stringify({page:pageName,geometry_differences:differences.length,pixels:metrics},null,2));await context.close()
}finally{await browser.close();await server.close();console.log(`Stopped temporary server PID ${server.pid}`)}
