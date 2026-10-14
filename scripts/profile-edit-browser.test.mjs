import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'edit'
const settings_only = process.argv.includes('--settings-only')
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/evidence/profile-edit')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }
const server = http.createServer((req,res) => { const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html')); if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return } res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res) })
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }, check = message => { report.checks.push(message); console.log(`PASS ${message}`) }
let browser, page
try {
  fs.mkdirSync(output, { recursive: true }); await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`; console.log(`Temporary profile preview PID ${process.pid}: ${origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  page = await browser.newPage({ viewport: { width:393, height:852 } }); page.setDefaultTimeout(10000); page.on('pageerror',error => report.errors.push(error.message))
  await page.goto(origin); await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type:'object', data })), create_scenario('default', Date.now()))
  const goto = route => page.goto(`${origin}/?phase=${phase}#${route}`), state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const click = id => page.locator(`[data-interaction="${id}"]`).click(), button = name => page.getByRole('button',{ name,exact:true })
  const field = label => page.locator(`uni-input[aria-label="${label}"] input, uni-textarea[aria-label="${label}"] textarea`)
  const settle = () => page.locator('.page-transition').last().evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  const shot = async name => {
    await settle()
    await page.waitForFunction(()=>[...document.querySelectorAll('.event-dialog')].filter(el=>el.offsetHeight>0).every(el=>el.classList.contains('event-dialog--open')))
    await page.locator('.event-dialog:visible').evaluateAll(els=>Promise.all(els.flatMap(el=>el.getAnimations({subtree:true}).map(animation=>animation.finished))))
    await page.screenshot({ path:path.join(output, `${name}.png`) })
  }
  if (!settings_only) {
  await goto('/pages/profile/index'); await click('profile.openEditBasic.click.1'); await page.locator('.profile-edit-page').waitFor(); await shot('edit-default')
  const card = await page.locator('.score-card').boundingBox(), icon = await page.locator('.editor-icon').first().boundingBox()
  assert.ok(Math.abs(card.width - 353) < 1); assert.ok(Math.abs(icon.width - 20) < 1); assert.equal(await page.locator('.score-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)')
  check('393px source geometry: 353px white card, 20px icon and correctly scoped shared styling')
  const before = await state(); await click('editAll.eaOpenBio.click.1'); await page.getByRole('dialog',{ name:'Edit bio' }).waitFor()
  await field('Profile bio').fill('A new campus introduction.'); await button('Poppins').click(); await click('editAll.eaBioDone.click.1'); await page.getByRole('dialog',{ name:'Edit bio' }).waitFor({ state:'hidden' })
  assert.deepEqual(await state(), before); await button('Back').click(); await page.locator('.profile-title').waitFor(); assert.deepEqual(await state(), before)
  check('Profile → Edit All → Back: unsaved bio/font do not alter public data')
  await click('profile.openEditBasic.click.1'); await click('editAll.eaOpenBio.click.1'); await field('Profile bio').fill('Saved campus introduction.'); await button('Poppins').click(); await click('editAll.eaBioDone.click.1')
  await page.getByRole('dialog',{ name:'Edit bio' }).waitFor({ state:'hidden' }); await click('editAll.eaSave.click.1'); await page.locator('.loading').waitFor(); assert.deepEqual(await state(), before)
  await page.locator('.profile-title').waitFor(); assert.equal((await state()).users[0].bio, 'Saved campus introduction.'); await page.reload(); await page.locator('.profile-bio').waitFor(); assert.match(await page.locator('.profile-bio').innerText(), /Saved campus/)
  check('500ms custom Loading precedes save; canonical Profile and refresh contain saved text')
  await click('profile.openEditBasic.click.1'); await button('Edit MBTI type').click(); await button('ENTJ').click(); await page.getByRole('dialog').waitFor({ state:'hidden' }); assert.equal((await state()).users[0].mbti, 'INFP')
  await click('editAll.eaSave.click.1'); await page.locator('.profile-title').waitFor(); assert.equal((await state()).users[0].mbti,'ENTJ')
  check('Source picker Sheet opens, stages selection, closes and persists through Save')
  await click('profile.openEditBasic.click.1'); const chooser = page.waitForEvent('filechooser'); await button('Add profile photo').click(); await (await chooser).setFiles(path.resolve('static/assets/head/maya-full.png'))
  await page.getByRole('button',{ name:'Edit photo 2',exact:true }).waitFor(); const media_before = await state(); assert.equal(media_before.profile_photos.filter(row=>row.user_id==='user_cimoa').length,1)
  await button('Edit photo 2').click(); await button('Set as Primary').click(); await page.getByRole('dialog').waitFor({state:'hidden'}); await click('editAll.eaSave.click.1'); await page.locator('.profile-title').waitFor()
  const saved = await state(); assert.match(saved.users[0].avatar_url,/^indexeddb:/); await page.reload(); await page.locator('.profile-avatar img').waitFor(); await page.waitForFunction(()=>document.querySelector('.profile-avatar img')?.naturalWidth > 0)
  check('Real photo chooser → decoded Blob → primary/order save → Profile avatar → IndexedDB refresh')
  await click('profile.openEditBasic.click.1'); await click('editAll.eaOpenBio.click.1'); await field('Profile bio').fill('Failure must not change my profile.'); await click('editAll.eaBioDone.click.1'); await page.getByRole('dialog').waitFor({state:'hidden'})
  const failure_before = await state(); await page.evaluate(()=>{ window.__originalWrite = Storage.prototype.setItem; Storage.prototype.setItem = function(key,value) { if(key==='cimoa_app_state_v2') throw Error('Storage full'); return window.__originalWrite.call(this,key,value) } })
  await click('editAll.eaSave.click.1'); await page.locator('.loading').waitFor({state:'detached'}); await page.getByRole('alert').waitFor(); assert.deepEqual(await state(), failure_before); assert.match(await page.locator('.profile-edit-page').innerText(),/Failure must not/)
  await page.evaluate(()=>{ Storage.prototype.setItem=window.__originalWrite; delete window.__originalWrite }); await button('Back').click(); await page.locator('.profile-title').waitFor()
  check('Injected persistence failure preserves original entities and the retryable draft')
  await click('profile.openEditBasic.click.1'); await click('editAll.eaOpenSong.click.1'); await page.getByRole('dialog',{ name:'Add profile song' }).waitFor(); await button('Play Espresso').click(); assert.match(await page.getByRole('dialog').innerText(),/No playable audio/); assert.equal((await state()).users[0].song_id,'espresso'); await button('Close').click()
  await page.getByRole('dialog').waitFor({state:'hidden'}); await page.setViewportSize({width:320,height:568}); await shot('edit-small'); const footer = await page.locator('.editor-footer').boundingBox(); assert.ok(footer.y+footer.height <= 568); await page.setViewportSize({width:393,height:852})
  check('Missing song audio fails honestly; 320px viewport keeps fixed Save visible and body scrollable')
  const preserved = await state()
  for (const mode of ['empty', 'long', 'expired']) {
    const fixture = create_scenario(mode === 'expired' ? 'session_expired' : 'default', Date.now())
    if (mode === 'empty') { fixture.users[0].photo_ids=[]; fixture.users[0].icebreaker_ids=[]; fixture.users[0].bio=''; fixture.users[0].interest_ids=[]; fixture.users[0].goal_ids=[]; fixture.profile_photos=fixture.profile_photos.filter(row=>row.user_id!=='user_cimoa') }
    if (mode === 'long') { fixture.users[0].bio='A long campus introduction. '.repeat(10); fixture.users[0].major='Interdisciplinary studies and collaborative campus research' }
    await page.evaluate(data=>localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data})),fixture); await page.reload(); await page.locator('.profile-edit-page').waitFor()
    if (mode === 'empty') assert.match(await page.locator('.profile-edit-page').innerText(),/No introduction yet/)
    if (mode === 'long') assert.equal(await page.locator('.editor-body').evaluate(el=>el.scrollWidth<=el.clientWidth),true)
    if (mode === 'expired') { await page.getByRole('alert').waitFor(); assert.equal(await button('Save').count(),0); assert.equal(await page.locator('.edit-photo').count(),0) }
    await shot(`edit-${mode}`)
  }
  await page.evaluate(data=>localStorage.setItem('cimoa_app_state_v2',JSON.stringify({type:'object',data})),preserved); await page.reload()
  check('Empty/long/expired Store scenarios stay readable; expired session hides profile data and Save')
  if (phase !== 'edit') {
    await click('profileEdit.basic.click.1'); await page.locator('.profile-basic-page').waitFor(); const before = await state()
    await field('Display name').fill(''); await click('editBasic.saveBasic.click.1'); await page.getByRole('alert').waitFor(); assert.deepEqual(await state(),before); assert.equal(await page.locator('.loading').count(),0)
    await field('Display name').fill('Morgan Campus'); await button('they / them').click(); await button('Year 2').click(); await field('Field of study').fill('Collaborative Design'); await shot('basic')
    await click('editBasic.saveBasic.click.1'); await page.locator('.loading').waitFor(); assert.deepEqual(await state(),before); await page.locator('.profile-edit-page:visible').waitFor()
    assert.equal((await state()).users[0].user_name,'Morgan Campus'); assert.equal((await state()).users[0].university,'HKUST')
    await click('profileEdit.basic.click.1'); await field('Display name').fill('Cancel this name'); await button('Back').click(); assert.equal((await state()).users[0].user_name,'Morgan Campus')
    await goto('/pages/profile/basic'); await page.reload(); await page.locator('.profile-basic-page').waitFor(); assert.equal(await field('Display name').inputValue(),'Morgan Campus'); await button('Contact support').click(); assert.match(await page.getByRole('alert').innerText(),/not been restored/)
    await button('Back').click(); await page.locator('.profile-edit-page').waitFor()
    check('Basic validates before Loading; name/pronouns/year/major save, cancel, refresh and correct fallback return; support remains deferred')
  }
  if (!['edit', 'basic'].includes(phase)) {
    await click('editAll.eaInterests.click.1'); await page.locator('.profile-interests-page').waitFor(); const before = await state()
    await page.locator('[data-choice-id="music"]').click(); await click('editInterests.saveInterests.click.1'); await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(),/at least three/); assert.deepEqual(await state(),before)
    await page.locator('[data-choice-id="films"]').click(); await shot('interests'); await click('editInterests.saveInterests.click.1'); await page.locator('.profile-edit-page:visible').waitFor()
    assert.deepEqual((await state()).users[0].interest_ids,['photography','coffee','films']); await click('editAll.eaSave.click.1'); await page.locator('.profile-title').waitFor(); assert.deepEqual(await page.locator('.interest-label').allTextContents(),['Photography','Coffee','Films'])
    await goto('/pages/profile/interests'); await page.reload(); await page.locator('.profile-interests-page').waitFor(); assert.equal(await page.locator('[data-choice-id="films"]').getAttribute('aria-pressed'),'true'); await page.locator('[data-choice-id="art"]').click(); await button('Back').click(); assert.deepEqual((await state()).users[0].interest_ids,['photography','coffee','films'])
    check('Interests enforces three, saves canonical IDs, survives parent Save/refresh and cancels draft-only changes')
  }
  if (!['edit', 'basic', 'interests'].includes(phase)) {
    await click('editAll.eaGoals.click.1'); await page.locator('.profile-goals-page').waitFor(); const before = await state()
    for (const id of before.users[0].goal_ids) await page.locator(`[data-choice-id="${id}"]`).click()
    await click('editGoals.saveGoals.click.1'); assert.match(await page.getByRole('alert').innerText(),/at least one/); assert.deepEqual(await state(),before)
    await page.locator('[data-choice-id="career"]').click(); await page.locator('[data-choice-id="coffee"]').click(); await shot('goals'); await click('editGoals.saveGoals.click.1'); await page.locator('.profile-edit-page:visible').waitFor()
    assert.deepEqual((await state()).users[0].goal_ids,['career','coffee']); assert.match(await page.locator('.profile-edit-page').innerText(),/Career Networking/)
    await goto('/pages/profile/goals'); await page.reload(); await page.locator('.profile-goals-page').waitFor(); assert.equal(await page.locator('[data-choice-id="career"]').getAttribute('aria-pressed'),'true'); await button('Back').click()
    check('Goals rejects empty selection; canonical catalog expansion, parent summary and refresh persist both selections')
  }
  if (!['edit', 'basic', 'interests', 'goals'].includes(phase)) {
    await click('editAll.eaIce.click.1'); await page.locator('.profile-ice-page').waitFor(); const before = await state()
    await button('Remove question 1').click(); await click('editIce.saveIce.click.1'); assert.match(await page.getByRole('alert').innerText(),/three different/); assert.deepEqual(await state(),before)
    await field('Custom icebreaker').fill('What campus tradition should we start?'); await click('editIce.addCustom.click.1'); await click('editIce.saveIce.click.1'); await page.locator('.profile-edit-page:visible').waitFor()
    const saved = await state(), user = saved.users[0]; assert.equal(user.icebreaker_ids.length,3); assert.equal(saved.icebreakers.find(row=>row.question_id===user.icebreaker_ids[2]).text,'What campus tradition should we start?')
    for (const id of before.users[0].icebreaker_ids) assert.ok(saved.icebreakers.some(row=>row.question_id===id))
    await goto('/pages/profile/ice'); await page.reload(); await page.locator('.profile-ice-page').waitFor(); assert.match(await page.locator('.chosen-list').innerText(),/campus tradition/)
    await field('Custom icebreaker').fill('What campus tradition should we start?'); await click('editIce.addCustom.click.1'); assert.match(await page.getByRole('alert').innerText(),/already selected/)
    await button('Remove question 1').click(); await page.locator('.library-question').first().click(); await shot('ice'); await button('Back').click(); assert.deepEqual((await state()).users[0].icebreaker_ids,user.icebreaker_ids)
    check('Icebreakers enforce three unique questions, preserve historical entities, save and refresh canonical active IDs; Back discards draft')
  }
  if (!['edit', 'basic', 'interests', 'goals', 'ice'].includes(phase)) {
    await goto('/pages/profile/index'); await click('profile.openProfilePreview.click.1'); await page.locator('.profile-preview-page').waitFor(); await page.locator('.preview-photo .profile-photo[data-media-status="ready"]').waitFor(); await shot('preview')
    assert.match(await page.locator('.preview-name').innerText(),/Morgan Campus/); assert.match(await page.locator('.preview-body').innerText(),/Career Networking/); assert.match(await page.locator('.preview-body').innerText(),/Films/)
    assert.equal(await page.locator('.photo-dots > uni-view').count(),2); await click('profilePreview.nextPhoto.click.1'); assert.equal(await page.locator('.photo-dots > uni-view').nth(1).getAttribute('aria-current'),'true'); await click('profilePreview.prevPhoto.click.1'); assert.equal(await page.locator('.photo-dots > uni-view').first().getAttribute('aria-current'),'true')
    await click('profilePreview.eaSongPlay.click.1'); assert.match(await page.getByRole('alert').innerText(),/No playable audio/)
    await click('profilePreview.openEditBasic.click.1'); await page.locator('.profile-edit-page:visible').waitFor(); await click('editAll.eaOpenBio.click.1'); await field('Profile bio').fill('Updated from my profile preview.'); await click('editAll.eaBioDone.click.1'); await page.getByRole('dialog').waitFor({state:'hidden'}); await click('editAll.eaSave.click.1'); await page.locator('.profile-preview-page:visible').waitFor(); assert.match(await page.locator('.preview-body:visible').innerText(),/Updated from my profile preview/)
    await click('profilePreview.goBack.click.1'); await page.locator('.profile-title').waitFor(); assert.match(await page.locator('.profile-bio').innerText(),/Updated from my profile preview/)
    await goto('/pages/profile/preview'); await page.reload(); await page.locator('.preview-photo .profile-photo[data-media-status="ready"]').waitFor(); assert.match(await page.locator('.editor-bio').innerText(),/Updated from my profile preview/)
    await page.setViewportSize({width:320,height:568}); await shot('preview-small'); const footer=await page.locator('.editor-footer').boundingBox(); assert.ok(footer.y+footer.height<=568); await page.setViewportSize({width:393,height:852})
    check('Preview reads saved entities and real photo order, edits return to the originating preview, Profile/refresh synchronize, small-screen footer stays fixed')
  }
  }
  if (settings_only) { await page.evaluate(()=>{const e=JSON.parse(localStorage.getItem('cimoa_app_state_v2'));e.data.users[0].user_name='Morgan Campus';localStorage.setItem('cimoa_app_state_v2',JSON.stringify(e))}); await goto('/pages/profile/preview'); await page.locator('.profile-preview-page').waitFor() }
  if (phase === 'settings') {
    await click('profilePreview.goBack.click.1'); await page.locator('.profile-title').waitFor(); await click('profile.openAppSettings.click.1'); await page.locator('.settings-page').waitFor(); await page.locator('.settings-avatar .profile-photo[data-media-status="ready"]').waitFor(); await shot('settings')
    const before = await state(); await click('settings.openEditBasic.click.1'); await page.locator('.profile-edit-page:visible').waitFor(); await click('editAll.eaSave.click.1'); await page.locator('.settings-page:visible').waitFor(); assert.equal((await state()).users[0].user_name,before.users[0].user_name)
    for (const id of ['openStore','openSetNotif','openSetPrivacy','openSetPerm','openSetLang','openBlockedList','openReportsSubmitted','openSetSupport','openSetLegal','openDelInfo']) { await click(`settings.${id}.click.1`); assert.match(await page.locator('.editor-error:visible').innerText(),/not been restored/) }
    await click('settings.openAgreeInfo.click.1'); await page.getByRole('dialog',{name:'Community Guidelines'}).waitFor(); assert.match(await page.getByRole('dialog').innerText(),/Respect boundaries/); await button('Close').click(); await page.getByRole('dialog').waitFor({state:'hidden'})
    check('Settings restores source sections, canonical avatar/balance and Account return; guidelines open; missing children fail without fake navigation')
    const saved = await state(); await click('settings.openLogoutConfirm.click.1'); await page.getByRole('dialog',{name:'Log out of Cimoa?'}).waitFor(); await shot('logout'); await click('sheetLogout.closeSheet.click.2'); await page.getByRole('dialog').waitFor({state:'hidden'}); assert.deepEqual(await state(),saved)
    await click('settings.openLogoutConfirm.click.1'); await page.getByRole('dialog',{name:'Log out of Cimoa?'}).waitFor(); await page.evaluate(()=>{window.__originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cimoa_app_state_v2')throw Error('Storage full');return window.__originalWrite.call(this,key,value)}})
    await click('sheetLogout.logOut2.click.1'); await page.locator('.loading').waitFor(); assert.deepEqual(await state(),saved); await page.locator('.loading').waitFor({state:'detached'}); assert.match(await page.getByRole('dialog').innerText(),/Storage full/); assert.deepEqual(await state(),saved)
    await page.evaluate(()=>{Storage.prototype.setItem=window.__originalWrite;delete window.__originalWrite}); await click('sheetLogout.logOut2.click.1'); await page.locator('.welcome-page').waitFor(); assert.equal((await state()).session.account_id,null)
    for (const key of ['users','accounts','profile_photos','media_files','icebreakers','relationships','coin_transactions','settings']) assert.deepEqual((await state())[key],saved[key])
    await page.reload(); await page.locator('.welcome-page').waitFor(); await goto('/pages/home/index'); await page.locator('.welcome-page').waitFor(); assert.equal(await page.locator('.tabbar').count(),0)
    check('Logout cancel and failed storage preserve session; confirmed logout waits before writing, keeps all account entities, clears stack and survives refresh/guard')
    await click('welcome.goLogin.click.1'); await page.locator('.login-page').waitFor(); await field('Email').fill('cimoa@gmail.com'); await field('Password').fill('wrong-password'); await click('login.loginNow.click.1'); await page.locator('.login-page [role="alert"]').waitFor(); assert.equal((await state()).session.account_id,null)
    await field('Password').fill('12341234'); await click('login.loginNow.click.1'); await page.locator('.main-skeleton').waitFor(); await page.locator('.main-skeleton').waitFor({state:'hidden'}); assert.equal((await state()).session.account_id,saved.session.account_id)
    for (const name of ['Discover','Events']) { await button(name).click(); await page.locator('.main-skeleton').waitFor(); await page.locator('.main-skeleton').waitFor({state:'hidden'}) }
    await button('Home').click(); await page.locator('.home-header').waitFor(); assert.equal(await page.locator('.main-skeleton').count(),0); await click('home.openMe.click.1'); await page.locator('.profile-title').waitFor(); assert.match(await page.locator('.profile-name').innerText(),/Morgan Campus/); await page.locator('.profile-avatar .profile-photo[data-media-status="ready"]').waitFor(); await page.reload(); await page.locator('.profile-avatar .profile-photo[data-media-status="ready"]').waitFor()
    for (const key of ['users','profile_photos','media_files','icebreakers','relationships','coin_transactions','settings']) assert.deepEqual((await state())[key],saved[key])
    check('Wrong password fails; real relogin restores edited profile/photos/questions, consumes one skeleton per Tab and reload keeps every entity')
  }
  assert.deepEqual(report.errors,[]); report.result='passed'
} catch(error) { report.failure=String(error.stack||error); report.visible_failure=await page?.evaluate(()=>({route:location.hash,text:document.body.innerText.slice(-2500),loading:!!document.querySelector('.loading')})).catch(()=>null); console.error(report.failure,report.visible_failure); process.exitCode=1 }
finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); fs.writeFileSync(path.join(output,`${phase}-acceptance.json`),JSON.stringify(report,null,2)+'\n'); console.log('Temporary profile server and isolated browser closed.') }
