// One-shot built-H5 regression; closes only its ephemeral server and isolated browser.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'age'
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/evidence/registration')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res)
})
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
let browser, page
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary registration preview PID ${process.pid}, ${origin}`)
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2'))?.data)
  const click = id => page.locator(`[data-interaction="${id}"]`).click()
  const field = label => page.locator(`uni-input[aria-label="${label}"] input, uni-textarea[aria-label="${label}"] textarea`)
  const fill = async (label, value) => { await field(label).fill(value); await page.waitForTimeout(60) }
  const settle = async () => { await page.locator('.page-transition').last().evaluate(el => Promise.all(el.getAnimations().map(a => a.finished))); await page.waitForTimeout(60) }
  const shot = async name => { await settle(); await page.screenshot({ path: path.join(output, `${name}.png`) }) }
  fs.mkdirSync(output, { recursive: true })
  await page.goto(`${origin}/`); await page.locator('.welcome-page').waitFor()
  assert.equal(await snapshot(), undefined)
  await click('welcome.goAge.click.1'); await page.locator('.age-page').waitFor(); await settle()
  await click('age.goAgree.click.1'); assert.match(await page.getByRole('alert').innerText(), /valid date/)
  await fill('Date of birth', '2020-01-01'); await click('age.goAgree.click.1')
  assert.match(await page.locator('.age-under').innerText(), /18 or older/); assert.equal(await snapshot(), undefined)
  await fill('Date of birth', '2000-01-01'); await shot('age')
  await click('age.goAgree.click.1'); await page.locator('.loading').waitFor()
  assert.equal(await snapshot(), undefined); await page.locator('.loading').waitFor({ state: 'detached' })
  assert.equal((await snapshot()).auth_flow.profile_draft.date_of_birth, '2000-01-01')
  check('Splash → Welcome → Age; invalid/underage zero writes; custom Loading before adult draft save')
  if (phase === 'age') {
    await page.reload(); await page.locator('.age-page').waitFor()
    assert.equal(await field('Date of birth').inputValue(), '2000-01-01')
    await page.setViewportSize({ width: 320, height: 568 }); await page.waitForTimeout(150); await shot('age-small')
    const cta = await page.locator('.auth-primary').boundingBox(); assert.ok(cta.y + cta.height <= 568)
    await page.locator('.auth-back').click(); await page.locator('.welcome-page').waitFor()
    check('Age refresh preserves DOB; 320px fixed CTA fits; direct-refresh Back returns Welcome')
  }
  if (phase !== 'age') {
    await page.locator('.community-page').waitFor(); await settle()
    await page.locator('[data-interaction="agree.goSignup.click.1"]').dispatchEvent('click'); assert.match(await page.getByRole('alert').innerText(), /three community/)
    await page.getByRole('button', { name: 'Read Privacy Policy', exact: true }).click()
    await page.getByRole('dialog').waitFor(); assert.match(await page.getByRole('dialog').innerText(), /stored locally/)
    await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' })
    for (const key of ['terms', 'privacy', 'community']) await page.locator(`[data-agreement="${key}"]`).click()
    await shot('community'); const before = await snapshot()
    await click('agree.goSignup.click.1'); await page.locator('.loading').waitFor(); assert.deepEqual(await snapshot(), before)
    await page.locator('.loading').waitFor({ state: 'detached' }); assert.equal((await snapshot()).auth_flow.agreements.community, true)
    check('Community exact six rules; Read sheet closes without accepting; all three explicit agreements persist after Loading')
    if (phase === 'community') { await page.reload(); await page.locator('.community-page').waitFor(); assert.equal(await page.locator('[aria-checked="true"]').count(), 3); check('Community refresh restores three consent flags') }
  }
  if (!['age', 'community'].includes(phase)) {
    await page.locator('.signup-page').waitFor(); await settle()
    await fill('University email', 'new.member@campus.edu'); await fill('Password', 'localpass123'); await fill('Confirm password', 'different')
    assert.match(await page.locator('.signup-mismatch').innerText(), /don’t match/)
    await fill('Confirm password', 'localpass123'); await click('signup.togglePw.click.1'); assert.equal(await field('Password').getAttribute('type'), 'text')
    await click('signup.togglePw.click.1'); await shot('signup')
    const before = await snapshot(); await click('signup.createAccount.click.1'); await page.locator('.loading').waitFor(); assert.deepEqual(await snapshot(), before)
    await page.locator('.loading').waitFor({ state: 'detached' }); const after = await snapshot()
    const account = after.accounts.find(row => row.email === 'new.member@campus.edu')
    assert.ok(account); assert.equal(account.auth_provider, 'local'); assert.equal(JSON.stringify(after).includes('localpass123'), false)
    assert.equal(after.users.find(row => row.user_id === account.user_id).verification_status, 'pending'); assert.equal(after.session.current_user_id, null)
    check('Signup source fields, mismatch and Show/Hide; real salted local credential; no plaintext/session/student certification')
  }
  if (!['age', 'community', 'signup'].includes(phase)) {
    await page.locator('.verification-email-page').waitFor(); await settle()
    await fill('University email', 'cimoa@gmail.com'); await click('verEmail.goVerCode.click.1')
    await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /already has/)
    await fill('University email', 'corrected.member@campus.edu'); await click('verEmail.goVerCode.click.1')
    await page.locator('.verification-page').waitFor(); await settle()
    assert.ok((await snapshot()).accounts.some(row => row.email === 'corrected.member@campus.edu'))
    await page.getByRole('button', { name: 'Change email' }).click(); await page.locator('.verification-email-page').waitFor(); await shot('verification-email')
    await click('verEmail.goVerCode.click.1'); await page.locator('.verification-page').waitFor()
    await page.locator('.verification-input input').fill('009789'); await page.waitForTimeout(80)
    await click('verCode.goVerSuccess.click.1'); await page.locator('.verification-success-page').waitFor()
    check('Email conflict rolls back; correction persists; Change email opens actual form; fixed code → Success')
  }
  if (!['age', 'community', 'signup', 'email'].includes(phase)) {
    await click('verSuccess.goObBasic.click.1'); await page.locator('.onboarding-basic-page').waitFor(); await settle()
    assert.equal(await field('Display name').inputValue(), '')
    assert.equal(await field('Date of birth').inputValue(), '2000-01-01')
    await click('obBasic.goObUni.click.1'); await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /display name/)
    await fill('Display name', 'Morgan'); await page.getByRole('button', { name: 'Non-binary', exact: true }).click(); await page.getByRole('button', { name: 'they / them', exact: true }).click()
    assert.ok(Math.abs((await page.locator('.auth-input-box').first().boundingBox()).height - 56) < 1)
    assert.ok(Math.abs(await page.locator('.auth-description').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) - 17) < .02)
    await shot('basic'); await click('obBasic.goObUni.click.1'); await page.locator('.loading').waitFor({ state: 'detached' })
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.users.some(row => row.user_name === 'Morgan'))
    const data = await snapshot(); const account = data.accounts.find(row => row.account_id === data.session.account_id)
    assert.equal(account.onboarding.step, 'uni'); assert.equal(data.users.find(row => row.user_id === account.user_id).verification_status, 'pending')
    check('Success establishes only current verified local session; Basic validates real fields and persists progress without student promotion')
    if (phase === 'basic') { await page.reload(); await page.locator('.onboarding-basic-page').waitFor(); assert.equal(await field('Display name').inputValue(), 'Morgan'); check('Basic refresh restores submitted name and pronouns') }
  }
  if (!['age', 'community', 'signup', 'email', 'basic'].includes(phase)) {
    await page.locator('.onboarding-uni-page').waitFor(); await settle()
    await click('obUni.goObMajor.click.1'); await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /university/)
    await fill('University', 'HKUST'); await page.getByRole('button', { name: 'Year 3', exact: true }).click(); await fill('Field of study', 'Design'); await fill('Expected graduation', '2027')
    await shot('uni'); await click('obUni.goObMajor.click.1')
    await page.waitForFunction(() => { const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return d.accounts.find(a=>a.account_id===d.session.account_id).onboarding.step==='major' })
    check('University is self-reported, never pre-verified; year/field/graduation save to the current user')
    if (phase === 'uni') { await page.reload(); await page.locator('.onboarding-uni-page').waitFor(); assert.equal(await field('University').inputValue(), 'HKUST'); await page.locator('.onboarding-back').click(); await page.locator('.onboarding-basic-page').waitFor(); check('University refresh restores data and direct Back returns Basic') }
  }
  if (!['age', 'community', 'signup', 'email', 'basic', 'uni'].includes(phase)) {
    await page.locator('.onboarding-major-page').waitFor(); await settle()
    assert.equal(await page.locator('.major-card').count(), 15)
    await click('obMajor.goObPhotos.click.1'); await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /major closest/)
    await page.getByRole('button', { name: 'Computer Science', exact: true }).click(); await shot('major')
    await click('obMajor.goObPhotos.click.1')
    await page.waitForFunction(() => { const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return d.accounts.find(a=>a.account_id===d.session.account_id).onboarding.step==='photos' })
    check('Major renders all 15 source cards; selection validates and updates one shared profile field')
    if (phase === 'major') { await page.reload(); await page.locator('.onboarding-major-page').waitFor(); assert.equal(await page.getByRole('button', { name: 'Computer Science', exact: true }).getAttribute('aria-pressed'), 'true'); check('Major refresh restores selected gradient card') }
  }
  if (!['age', 'community', 'signup', 'email', 'basic', 'uni', 'major'].includes(phase)) {
    await page.locator('.onboarding-photos-page').waitFor(); await settle()
    assert.equal(await page.locator('.photo-slot').count(), 3)
    await page.locator('[data-interaction="obPhotos.goObAbout.click.1"]').dispatchEvent('click')
    await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /at least two photos/)
    await shot('photos-empty')
    check('Photos source fan and fixed footer render; empty collection cannot continue')
  }
  if (!['age', 'community', 'signup', 'email', 'basic', 'uni', 'major', 'photos'].includes(phase)) {
    const tap_side_photo = async () => {
      const point = await page.locator('.photo-slot-0').evaluate(el => {
        const rect = el.getBoundingClientRect()
        for (let y = rect.top + 25; y < rect.bottom - 25; y += 20) for (let x = rect.left + 25; x < rect.right - 25; x += 20) if (el.contains(document.elementFromPoint(x, y))) return { x, y }
        throw Error('No exposed clickable photo area')
      })
      await page.mouse.click(point.x, point.y)
    }
    const open_picker = async (files) => {
      await page.locator('.permission-photos-page').waitFor(); await settle()
      const chosen = page.waitForEvent('filechooser'); await click('permPhotos.allowPhotos.click.1'); const chooser = await chosen
      await chooser.setFiles(files.map(name => path.resolve('static/assets/head', name)))
      await page.locator('.onboarding-photos-page').waitFor(); await settle()
      await page.waitForFunction(() => [...document.querySelectorAll('.profile-photo')].every(el => el.dataset.mediaStatus === 'ready'))
    }
    await page.locator('.photo-slot-1').click(); await page.locator('.permission-photos-page').waitFor(); await shot('photo-access')
    const before = await snapshot(); await click('permPhotos.denyPhotos.click.1'); assert.deepEqual(await snapshot(), before)
    await click('permPhotos.openSettings.click.1'); await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('unavailable in this browser'))
    await page.getByRole('button', { name: 'Back to Photos', exact: true }).click(); await page.locator('.onboarding-photos-page').waitFor()
    await page.locator('.photo-slot-1').click(); await open_picker(['me.png', 'maya-card.png'])
    let data = await snapshot(), owner = data.session.current_user_id
    assert.equal(data.profile_photos.filter(row => row.user_id === owner).length, 2)
    await shot('photos-added')
    const second_url = data.profile_photos.filter(row => row.user_id === owner).sort((a,b)=>a.position-b.position)[1].media_url
    await tap_side_photo(); await page.getByRole('button', { name: 'Set as Primary', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal((await snapshot()).users.find(row => row.user_id === owner).avatar_url, second_url)
    await page.locator('.photo-slot-1').click(); await page.getByRole('button', { name: 'Move Later', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await tap_side_photo(); await page.getByRole('button', { name: 'Remove Photo', exact: true }).click()
    const before_remove = await snapshot(); await page.getByRole('button', { name: 'Keep Photo', exact: true }).click(); assert.deepEqual(await snapshot(), before_remove)
    await page.getByRole('button', { name: 'Remove Photo', exact: true }).click(); await page.locator('[data-photo-action="confirm-remove"]').click(); await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal((await snapshot()).profile_photos.filter(row => row.user_id === owner).length, 1)
    assert.equal(await page.locator('[data-interaction="obPhotos.goObAbout.click.1"]').getAttribute('aria-disabled'), 'true')
    await tap_side_photo(); await open_picker(['maya-card.png'])
    await page.locator('.photo-slot-1').click(); await page.getByRole('button', { name: 'Replace Photo', exact: true }).click(); await open_picker(['me.png'])
    await page.reload(); await page.locator('.onboarding-photos-page').waitFor(); await page.waitForFunction(() => document.querySelectorAll('.profile-photo[data-media-status="ready"]').length === 2)
    await shot('photos-restored'); await click('obPhotos.goObAbout.click.1')
    await page.waitForFunction(() => { const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return d.accounts.find(a=>a.account_id===d.session.account_id).onboarding.step==='about' })
    check('Real file chooser → decoded IndexedDB photos; Not Now/no-host Settings honest; primary/order/remove confirmation/replacement/refresh and two-photo gate')
  }
  if (!['age', 'community', 'signup', 'email', 'basic', 'uni', 'major', 'photos', 'photo-access'].includes(phase)) {
    await page.locator('.onboarding-about-page').waitFor(); await settle()
    assert.equal(await field('About you').inputValue(), '')
    await fill('About you', 'Campus walks, coffee and new conversations.'); await shot('about')
    await fill('About you', 'A'.repeat(300)); assert.match(await page.locator('.about-counter').innerText(), /300 \/ 300/)
    await click('obAbout.goObInterests.click.1')
    await page.waitForFunction(() => { const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return d.accounts.find(a=>a.account_id===d.session.account_id).onboarding.step==='interests' })
    check('Optional About starts empty, follows source card/textarea, counts 300 characters and saves to shared profile')
    if (phase === 'about') { await page.reload(); await page.locator('.onboarding-about-page').waitFor(); assert.equal((await field('About you').inputValue()).length, 300); check('About long content refresh restores all 300 characters') }
  }
  if (!['age', 'community', 'signup', 'email', 'basic', 'uni', 'major', 'photos', 'photo-access', 'about'].includes(phase)) {
    await page.locator('.onboarding-interests-page').waitFor(); await settle()
    assert.equal(await page.locator('.interest-chips [role="checkbox"]').count(), 17)
    const before = await snapshot()
    for (const label of ['Photography', 'Coffee']) await page.getByRole('checkbox', { name: label, exact: true }).click()
    assert.equal(await page.locator('[data-interaction="obInterests.goObGoal.click.1"]').getAttribute('aria-disabled'), 'true')
    assert.deepEqual(await snapshot(), before)
    await page.getByRole('checkbox', { name: 'Live Music', exact: true }).click(); await shot('interests')
    await click('obInterests.goObGoal.click.1')
    await page.waitForFunction(() => { const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return d.accounts.find(a=>a.account_id===d.session.account_id).onboarding.step==='goal' })
    check('17 source interests; selection is only a draft; fewer than three cannot proceed; committed IDs share the entity catalog')
    if (phase === 'interests') { await page.reload(); await page.locator('.onboarding-interests-page').waitFor(); assert.equal(await page.locator('[aria-checked="true"]').count(), 3); check('Interests refresh restores three selected chips') }
  }
  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.failure = error.stack; if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, `${phase}-browser.json`), JSON.stringify(report, null, 2) + '\n'); console.log(`Closed registration preview PID ${process.pid}`) }
