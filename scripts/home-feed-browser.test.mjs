// Built H5 only. Source is parsed offline for reference pixels, never executed.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { read_circa_source, walk_html, attribute } from './lib/circa-source.mjs'
import { serve_h5, context_for, set_safe_area, write_comparison, close_to, sha256 } from './lib/pixel-acceptance.mjs'
import { create_scenario } from '../src/stores/scenarios.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
const require=createRequire(import.meta.url),{chromium}=require(process.env.CIMOA_BROWSER_MODULE||'playwright')
const output=path.resolve('docs/ui-restoration/home'),contract=JSON.parse(fs.readFileSync(path.join(output,'source-contract.json'))),source=read_circa_source()
assert.equal(source.source_hash,contract.source.file_sha256);assert.equal(sha256(source.template.split('\n').slice(213,358).join('\n')),contract.source.fragment_sha256)
const data=create_scenario('default'),report={result:'failed',checks:[],errors:[],deferred:[],source_sha256:source.source_hash}
// Navigation-only fixture: the Chat page's legitimate mark-read transaction is
// independently tested in home-feed.test.mjs; it is not a navigation write.
for(const message of data.messages)if(!message.read_by.includes(data.session.current_user_id))message.read_by.push(data.session.current_user_id)
fs.writeFileSync(path.join(output,'native-fixture.json'),JSON.stringify({data},null,2)+'\n')
const escape=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
function reference(origin,pop=false){
  let root;walk_html(source.html,node=>{if(node.tag==='sc-if'&&attribute(node,'value')==='{{ isHome }}')root=node})
  const goals=id=>data.users.find(x=>x.user_id===id).goal_ids.map(id=>data.goals.find(x=>x.item_id===id))
  const values={hasFreeMatches:true,noFreeMatches:false,freeMatchesLeft:'3',newUser:false,hasConnections:true,anyGoalPop:pop,popIsMaya:pop,popIsLiam:false,popIsJordan:false,amCard:false,goalsMaya:goals('user_chloe'),goalsLiam:goals('user_liam'),goalsJordan:goals('user_lina')}
  const resources=JSON.parse(fs.readFileSync('docs/circa-source-audit.json')).resources
  const fill=(text,scope)=>text.replace(/{{\s*([\w.]+)\s*}}/g,(_,key)=>escape(key.split('.').reduce((x,k)=>x?.[k],scope)))
  function render(node,scope=values){
    if(node.type===2)return fill(node.content,scope)
    if(node.type===5)return fill(node.loc.source,scope)
    if(node.type!==1)return ''
    const children=()=>node.children.map(x=>render(x,scope)).join('')
    if(node.tag==='sc-if'){const key=attribute(node,'value').replace(/[{}\s]/g,'');return (scope[key]??attribute(node,'hint-placeholder-val').includes('true'))?children():''}
    if(node.tag==='sc-for')return(scope[attribute(node,'list').replace(/[{}\s]/g,'')]||[]).map(g=>node.children.map(x=>render(x,{...scope,[attribute(node,'as')]:g})).join('')).join('')
    const attrs=node.props.filter(x=>x.type===6&&!x.name.startsWith('sc-camel-on-')).map(p=>{
      let value=p.value?.content||'';for(const asset of resources)if(asset.local_path)value=value.replaceAll(asset.bundle_id,`${origin}/${asset.local_path}`)
      return ` ${p.name.replace('sc-camel-view-box','viewBox').replace('sc-camel-gradient-units','gradientUnits')}="${fill(value,scope)}"`
    }).join('')
    return `<${node.tag} data-source-line="${node.loc.start.line}"${attrs}>${children()}${node.tag==='img'?'':`</${node.tag}>`}`
  }
  let content=root.children.map(x=>render(x)).join('').replace('CIRCA','Cimoa').replace('Berkeley','HKUST').replaceAll('Jordan Ellis','Lina').replace('Lina, 20','Lina, 21').replace('UCLA','HKU').replaceAll('/head/jordan-av.png','/head/maya-full.png')
  for(const [old,id]of [['🙋📖☕','user_chloe'],['🏃🎸🍜','user_liam'],['💬🗣️✈️','user_lina']])content=content.replace(old,goals(id).slice(0,3).map(x=>x.emoji).join(''))
  const tab=contract.source.tab_component.replaceAll(/onClick="[^"]*"/g,'').replaceAll(/{{\s*(\w+)\s*}}/g,(_,key)=>key==='homeBg'?'linear-gradient(120deg,#1ec8f5 0%,#4a7bf7 38%,#a855f7 68%,#f81ce5 100%)':key==='homeInk'?'#fff':key.endsWith('Bg')?'transparent':'#0b1b3a')
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;color:#0b1b3a;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);-webkit-font-smoothing:antialiased}::-webkit-scrollbar{display:none}</style></head><body>${content}<div style="position:absolute;left:20px;right:20px;bottom:28px;height:62px">${tab}</div></body></html>`
}
const check=message=>{report.checks.push(message);console.log('PASS '+message)}
let browser,server
try{
  server=await serve_h5();report.server_pid=server.pid;console.log(`Temporary Home preview PID ${server.pid}, ${server.origin}`)
  browser=await chromium.launch({headless:true,...(process.env.CIMOA_BROWSER_CHANNEL?{channel:process.env.CIMOA_BROWSER_CHANNEL}:{})})
  const ref=await browser.newPage({viewport:{width:393,height:852}});await ref.setContent(reference(server.origin));await ref.evaluate(()=>Promise.all([...document.images].map(x=>x.decode())));await ref.screenshot({path:path.join(output,'reference.png')})
  report.reference_geometry=await ref.evaluate(()=>Object.fromEntries([['profile',219],['title',238],['card',259],['avatar',261],['status',262]].map(([key,line])=>{const r=document.querySelector(`[data-source-line="${line}"]`).getBoundingClientRect();return[key,{x:r.x,y:r.y,width:r.width,height:r.height}]})))
  await ref.setContent(reference(server.origin,true));await ref.evaluate(()=>Promise.all([...document.images].map(x=>x.decode())));await ref.screenshot({path:path.join(output,'reference-goals.png')});await ref.close()
  const context=await context_for(browser,STATE_KEY,data),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message))
  let sequence=0
  const open=route=>page.goto(`${server.origin}/?homeFeed=${sequence++}#${route}`)
  const freeze=async(top=54,bottom=0)=>{await set_safe_area(page,top,bottom);await page.evaluate(async()=>{await document.fonts.ready;for(const a of document.getAnimations())if(a.effect.getComputedTiming().iterations!==Infinity)a.finish();await Promise.all([...document.images].map(x=>x.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})}
  const load=async(name='default',change=()=>{})=>{const fixture=create_scenario(name);change(fixture);await page.evaluate(data=>localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data})),fixture);await open('/pages/home/index');await page.locator('.home-title').waitFor();await freeze();return fixture}
  const saved=()=>page.evaluate(()=>localStorage.getItem('cimoa_app_state_v2'))
  const click=id=>page.locator(`[data-interaction="${id}"]:visible`).click()
  const box=selector=>page.locator(selector).first().evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}})
  await open('/pages/home/index');await page.locator('.connection').first().waitFor();await freeze()
  report.geometry={header:await box('.home-header'),card:await box('.connection'),avatar:await box('.connection-avatar'),tabbar:await box('.tabbar')}
  assert.deepEqual(await page.locator('.connection-name').allTextContents(),['Chloe Lin, 21','Liam Park, 22','Lina, 21'])
  assert.ok(close_to(report.geometry.card.width,353));assert.ok(close_to(report.geometry.avatar.width,78));assert.ok(close_to(report.geometry.tabbar.height,62))
  for(const [key,selector]of [['profile','.home-profile'],['title','.home-title'],['card','.connection'],['avatar','.connection-avatar'],['status','.connection-status']]){const actual=await box(selector);for(const property of ['x','y','width','height'])assert.ok(close_to(actual[property],report.reference_geometry[key][property]),`${key}.${property}: ${actual[property]} vs ${report.reference_geometry[key][property]}`)}
  await page.screenshot({path:path.join(output,'actual-browser.png')});report.comparison=await write_comparison(browser,output,path.join(output,'reference.png'),path.join(output,'actual-browser.png'))
  check('Default source geometry, canonical profiles, original card groups and no invented message/unread UI')
  const before=await saved(),panel=page.getByRole('dialog',{name:'Connection goals'})
  for(const id of ['user_chloe','user_liam','user_lina']){
    for(let i=0;i<2;i++){await page.locator(`#connection-${id} .goals-tag`).click();await panel.waitFor();await page.locator('.goal-label').first().click();assert.equal(await panel.isVisible(),true);assert.ok((await box('.goals-panel')).bottom<=report.geometry.tabbar.y);if(id==='user_chloe'){await freeze();await page.screenshot({path:path.join(output,'actual-browser-goals.png')})}await page.locator('.goals-mask').click({position:{x:2,y:2}});await panel.waitFor({state:'hidden'})}
  }
  fs.mkdirSync(path.join(output,'goals'),{recursive:true});report.goals_comparison=await write_comparison(browser,path.join(output,'goals'),path.join(output,'reference-goals.png'),path.join(output,'actual-browser-goals.png'))
  assert.equal(await saved(),before);check('First/repeated full goals Popovers, bounds, outside close and propagation isolation are read-only')
  for(const [id,selector,back]of [['home.openMe.click.1','.profile-name','profile.goBack.click.1'],['home.startAutoMatch.click.1','[data-interaction="amEntry.joinPool.click.1"]','amEntry.goBack.click.1'],['home.openMaya.click.1','.chat-composer','chat.goBack.click.1'],['home.openJordan.click.1','.received-actions','reqReceived.goBack.click.1']]){
    await click(id);await page.locator(selector).waitFor();await page.locator(`[data-interaction="${back}"]:visible`).click();await page.locator('.home-header:visible').waitFor();assert.equal(await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth'),'1');assert.equal(await saved(),before)
  }
  check('Profile, matching entry, canonical chat and received request open real entities and Back restores the exact Home without writes')
  await click('home.openLiam.click.1');await page.locator('.match-found-avatar').waitFor();assert.match(await page.locator('.found-copy').innerText(),/Liam Park/);await click('amFound.askLeaveMatch.click.1');await page.locator('.dialog__cancel').click();assert.equal(await saved(),before);await page.goBack();await page.locator('.home-header:visible').waitFor()
  check('Candidate opens the same Liam match; leave cancellation preserves consent and browser Back restores Home')
  for(let cycle=0;cycle<2;cycle++)for(const name of ['Discover','Events','Home']){await page.getByRole('button',{name,exact:true}).click();await page.locator(`.tab[aria-label="${name}"][aria-current="page"]`).waitFor();assert.equal(await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth'),'1');assert.equal(await page.locator('.main-skeleton').count(),0)}
  check('Two main-Tab cycles preserve root depth and never replay an authentication skeleton')
  await load('home_empty');await page.screenshot({path:path.join(output,'actual-browser-empty.png')});await click('home.exploreDiscover.click.1');await page.locator('.discover-header').waitFor();await page.getByRole('button',{name:'Home',exact:true}).click();await page.locator('.home-empty').waitFor();assert.equal(await page.locator('.connection').count(),0)
  check('Real empty Home offers source CTAs without fabricated contacts and Explore replaces Discover')
  await load('request_accepted');assert.equal(await page.locator('#connection-user_lina .connection-status').innerText(),'Connected');await page.reload();await page.locator('#connection-user_lina').waitFor();assert.equal(await page.locator('#connection-user_lina .connection-status').innerText(),'Connected')
  await load('blocked');assert.equal(await page.locator('#connection-user_chloe').count(),0);check('Accepted requests aggregate into one connected card; block filtering and refresh use the same facts')
  for(const status of ['searching','paused','found','waiting']){const fixture=await load(`match_${status}`),bytes=await saved();assert.equal(await page.locator('.match-status').getAttribute('data-target'),`/pages/auto-match/${status}?match_id=match_liam`);await page.reload();await page.locator('.match-status').waitFor();assert.equal(await saved(),bytes);assert.equal(JSON.parse(bytes).data.match_sessions[0].expires_at,fixture.match_sessions[0].expires_at);await freeze();await page.locator('.match-status').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`actual-browser-match-${status}.png`)})}
  check('Four matching status cards retain exact routes, candidate and persisted deadlines after refresh')
  await load('home_long');await page.setViewportSize({width:320,height:568});await freeze(62,34);await page.screenshot({path:path.join(output,'actual-browser-long.png')})
  await page.locator('#connection-user_chloe').scrollIntoViewIfNeeded();await page.waitForTimeout(120);await page.locator('#connection-user_chloe .goals-tag').click();await panel.waitFor();await page.waitForFunction(()=>{const e=document.querySelector('.goals-panel--open');return e&&Number(getComputedStyle(e).opacity)===1});assert.ok((await box('.goals-panel')).bottom<=(await box('.tabbar')).y);await page.screenshot({path:path.join(output,'actual-browser-small.png')})
  report.goal_scroll=await panel.locator('.uni-scroll-view-scrollbar-hidden').first().evaluate(e=>{e.scrollTop=e.scrollHeight;return{height:e.scrollHeight,client:e.clientHeight,top:e.scrollTop}});assert.ok(report.goal_scroll.top>0);await page.waitForFunction(()=>{const panel=document.querySelector('.goals-panel'),last=panel.querySelector('.goal-row:last-child');return last.getBoundingClientRect().bottom<=panel.getBoundingClientRect().bottom});await page.screenshot({path:path.join(output,'actual-browser-small-goals-end.png')});await page.locator('.goals-mask').click({position:{x:2,y:2}});await panel.waitFor({state:'hidden'})
  const fixed=await box('.home-header');report.content_scroll=await page.locator('.main-tab-scroll .uni-scroll-view-scrollbar-hidden').first().evaluate(e=>{e.scrollTop=e.scrollHeight;return{height:e.scrollHeight,client:e.clientHeight,top:e.scrollTop}});assert.ok(report.content_scroll.top>0);assert.deepEqual(await box('.home-header'),fixed);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(output,'actual-browser-long-end.png')})
  check('Long data and 320×568 real safe-area budget keep Popover, fixed header and Tabbar usable')
  await page.setViewportSize({width:393,height:852});await page.evaluate(()=>localStorage.setItem('cimoa_app_state_v2','{corrupt'));await page.reload();await page.locator('.home-read-error').waitFor();await freeze();await click('home.retry.click.1');assert.equal(await saved(),'{corrupt');assert.equal(await page.locator('.connection,.quota-badge,.coin-badge').count(),0);await page.screenshot({path:path.join(output,'actual-browser-error.png')})
  check('Corrupt storage is a retryable error, never an empty success or metadata overwrite')
  await load('quota_used');assert.equal(await page.locator('.coin-badge').count(),1);const quota_bytes=await saved();await page.reload();await page.locator('.coin-badge').waitFor();assert.equal(await saved(),quota_bytes)
  // Playwright's clock installation is context-scoped: do not shift the main
  // regression page into tomorrow while its Node fixtures still use real time.
  const clock_context=await browser.newContext({viewport:{width:393,height:852}}),clock_page=await clock_context.newPage(),midnight=Date.UTC(2026,9,18),quota=create_scenario('quota_used',midnight-1000)
  await clock_page.clock.install({time:new Date(midnight-1000)});await clock_page.addInitScript(data=>localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data})),quota);await clock_page.goto(`${server.origin}/?quotaProbe#/pages/home/index`);await clock_page.locator('.coin-badge').waitFor();await clock_page.clock.fastForward(2000);await clock_page.getByLabel('3 free matches remaining',{exact:true}).waitFor();assert.deepEqual(await clock_page.evaluate(()=>JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.match_quota),quota.match_quota);await clock_context.close()
  check('Exhausted quota persists and UTC midnight restores three free uses without rewriting history')
  await load('default',data=>{data.match_sessions[0].expires_at=Date.now()+8000});await page.locator('#connection-user_liam .goals-tag').press('Enter');await panel.waitFor();const pending_bytes=await saved();await page.waitForFunction(()=>!document.querySelector('#connection-user_liam'));await panel.waitFor({state:'hidden'});assert.equal(await saved(),pending_bytes)
  check('Keyboard goals activation works and derived candidate expiry clears both card and Popover without writing')
  const logged_out=create_scenario('default');logged_out.session={account_id:null,current_user_id:null,expires_at:null};await page.evaluate(data=>localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data})),logged_out);await open('/pages/auth/login');await page.locator('.login-page input').first().fill('cimoa@gmail.com');await page.locator('.login-page input').nth(1).fill('12341234');await click('login.loginNow.click.1');await page.locator('.main-skeleton').waitFor();assert.equal(await page.locator('.tabbar').count(),1);await page.locator('.main-skeleton').waitFor({state:'hidden'})
  for(const name of ['Discover','Events']){await page.getByRole('button',{name,exact:true}).click();await page.locator('.main-skeleton').waitFor();await page.locator('.main-skeleton').waitFor({state:'hidden'})}await page.getByRole('button',{name:'Home',exact:true}).click();await page.locator('.home-title').waitFor();assert.equal(await page.locator('.main-skeleton').count(),0);await page.reload();await page.locator('.home-title').waitFor();assert.equal(await page.locator('.main-skeleton').count(),0)
  check('Successful real fixture login grants one skeleton per Tab; Tab return and refresh grant none and retain the fixed bar')
  // The source returnHome uses root("home"), not a second Home pushed/replaced in the stack.
  await load();await click('home.openLiam.click.1');await click('amFound.passMatch.click.1');await page.locator('.dialog__confirm').click();await page.locator('[data-interaction="amPassed.returnHome.click.1"]').waitFor();await click('amPassed.returnHome.click.1');await page.locator('.home-header:visible').waitFor()
  const result_depth=await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth')
  assert.equal(result_depth,'1');check('Candidate Pass result clears to root Home as the source returnHome requires')
  for(const status of ['expired','no_match','connected']){
    await load(`match_${status}`);const unchanged=await saved();await page.evaluate(status=>{location.hash='#/pages/auto-match/'+(status==='no_match'?'no-match':status)+'?match_id=match_liam'},status);await page.locator('.flow-state-panel,.flow-title,.flow-header').first().waitFor();await page.getByRole('button',{name:'Back',exact:true}).last().click();await page.locator('.home-header:visible').waitFor();assert.equal(await page.locator('.main-tab-frame:visible').getAttribute('data-page-depth'),'1');assert.equal(await saved(),unchanged)
  }
  check('All four shared AutoMatchResultPage consumers return to one root Home without extra business writes')
  await context.close();assert.deepEqual(report.errors,[]);report.result='passed'
}catch(error){report.errors.push(error.stack||error.message);throw error}
finally{await browser?.close();await server?.close();report.cleaned_up=true;fs.writeFileSync(path.join(output,'browser-acceptance.json'),JSON.stringify(report,null,2)+'\n')}
