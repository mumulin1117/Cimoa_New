// Bounded built-H5 integration test; isolated browser storage and ephemeral server.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { create_local_credential } from '../src/utils/localAuth.js'
import { ensure_account_defaults, session_for } from '../src/stores/accountDefaults.js'
import { ONBOARDING_FLOW } from '../src/utils/onboardingFlow.js'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5'), output = path.resolve('docs/evidence/social-entities')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res)
})
const data = create_seed(), now = Date.now()
for (const slug of ['noah', 'sophie']) {
  const user_id = `user_${slug}`
  data.accounts.push({ account_id: `account_browser_${slug}`, user_id, email: `${slug}@campus.edu`, status: 'active', ...await create_local_credential('campus123'), local_verification: { method: 'fixed_code', status: 'verified', verified_at: now }, onboarding: { step: 'complete', completed_steps: [...ONBOARDING_FLOW], completed_at: now } })
  Object.assign(data.users.find(row => row.user_id === user_id), { onboarding_status: 'complete', verification_status: 'pending' })
  ensure_account_defaults(data, user_id)
}
data.session = session_for(data.accounts.find(row => row.user_id === 'user_noah'), now)
data.users.find(row => row.user_id === 'user_sophie').gender = 'Non-binary'
Object.assign(data.match_preferences.find(row => row.owner_user_id === 'user_noah'), { university: 'HKU', major: 'Psychology', gender: 'Non-binary', language: 'All' })
const report = { result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = message => { report.checks.push(message); console.log(`PASS ${message}`) }
let browser, page
try {
  fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary social-entity preview PID ${process.pid}, ${origin}`)
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })
  page = await browser.newPage({ viewport: { width: 393, height: 852 } }); page.setDefaultTimeout(12000)
  page.on('pageerror', error => report.errors.push(error.message))
  const open = route => page.goto(`${origin}/?social=${Date.now()}#${route}`)
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  const seed = async () => { await page.goto(origin); await page.evaluate(snapshot => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data: snapshot })), data); await open('/pages/home/index'); await page.locator('.home-header').waitFor() }
  const click = id => page.locator(`[data-interaction="${id}"]:visible`).click()
  const shot = async filename => { await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))); await page.screenshot({ path: path.join(output, filename) }) }
  const field = label => page.locator(`uni-input[aria-label="${label}"] input, uni-textarea[aria-label="${label}"] textarea`)
  const switch_account = async email => {
    await open('/pages/settings/index'); await click('settings.openLogoutConfirm.click.1')
    await page.getByRole('dialog').getByRole('button', { name: 'Log Out', exact: true }).click()
    await page.locator('.welcome-page').waitFor(); await page.getByRole('checkbox').click(); await page.getByRole('button', { name: 'Log In', exact: true }).click()
    await field('Email').fill(email); await field('Password').fill('campus123'); await click('login.loginNow.click.1'); await page.locator('.home-header').waitFor()
  }
  await seed()
  await open('/pages/discover/profile?user_id=user_sophie'); await page.locator('.expanded-photo .profile-photo[data-media-status="ready"]').waitFor()
  assert.match(await page.locator('.expanded-heading').innerText(), /Sophie Bennett/)
  assert.equal(await page.locator('.expanded-question-list text, .expanded-question-list uni-text').count(), 3)
  await shot('portrait-profile.png')
  await click('expanded.sayHi.click.1'); await page.locator('[data-interaction="ibSelect.q.pick.click.1"]').first().click(); await click('ibSelect.answerGo.click.1')
  await field('Your introduction').fill('A coffee walk after lectures sounds perfect.'); await click('ibText.continueText.click.1')
  await page.locator('[data-interaction="reqSent.doneSent.click.1"]').waitFor()
  const sent = (await snapshot()).requests.find(row => row.sender_id === 'user_noah')
  assert.equal(sent.status, 'pending'); assert.equal(sent.recipient_id, 'user_sophie')
  assert.equal((await snapshot()).coin_transactions.filter(row => row.owner_user_id === 'user_noah').length, 0)
  await open('/pages/home/index'); await page.locator('[data-interaction="home.openSentRequest.click.1"]').waitFor()
  await shot('sent-on-home.png')
  await switch_account('sophie@campus.edu')
  await page.locator(`[data-target="/pages/connections/received?request_id=${sent.request_id}"]`).click()
  await click('reqReceived.accept.click.1'); await page.getByRole('dialog').getByRole('button', { name: 'Accept', exact: true }).click()
  await click('reqAccepted.startChat.click.1'); await page.locator('.chat-composer').waitFor()
  await field('Message').fill('Let’s go after the afternoon seminar.'); await click('chat.send.click.1')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data.messages.some(row => row.body === 'Let’s go after the afternoon seminar.'))
  const connected = await snapshot(), conversation = connected.conversations.find(row => row.kind === 'direct' && row.participant_ids.includes('user_noah') && row.participant_ids.includes('user_sophie'))
  assert.equal(connected.messages.filter(row => row.conversation_id === conversation.conversation_id).length, 2)
  await page.reload(); await page.locator('.chat-composer').waitFor(); await click('chat.viewProfile.click.1')
  assert.equal(await page.locator('[data-interaction="expanded.sayHi.click.1"]:visible').innerText(), 'Chat')
  await click('expanded.sayHi.click.1'); await page.locator('.chat-composer').waitFor()
  assert.ok(page.url().includes(conversation.conversation_id)); await shot('connected-chat.png')
  check('Avatar profile → free introduction → sent Home card → real account switch → accept → one conversation; Chat CTA and messages survive refresh')
  await open('/pages/discover/profile?user_id=user_noah'); await click('expanded.openSafetyMini.click.1'); await click('sheetSafetyMini.openBlock.click.1'); await click('sheetBlock.confirmBlock.click.1')
  await page.locator('.discover-header:visible').waitFor()
  const blocked = await snapshot(); assert.equal(blocked.relationships.some(row => [row.from_user_id, row.to_user_id].includes('user_noah')), false)
  assert.equal(blocked.conversations.some(row => row.conversation_id === conversation.conversation_id), false)
  check('Blocking the same user removes both friendship directions and the private conversation across Home and Discover')
  await seed(); await open('/pages/auto-match/index'); await click('amEntry.joinPool.click.1')
  await page.locator('[data-interaction="amSearching.pauseQueue.click.1"]').waitFor()
  await page.locator('[data-interaction="amFound.connectAsk.click.1"]').waitFor({ timeout: 14000 })
  await click('amFound.connectAsk.click.1'); await click('sheetAccepting.confirmConnect.click.1')
  await page.locator('[data-interaction="amWaiting.returnHome.click.1"]').waitFor()
  const matching = (await snapshot()).match_sessions.find(row => row.owner_user_id === 'user_noah')
  assert.equal(matching.candidate_id, 'user_sophie'); assert.equal(matching.status, 'waiting'); assert.equal(matching.peer_accepted, false)
  await open('/pages/discover/profile?user_id=user_sophie')
  assert.equal(await page.locator('[data-interaction="expanded.sayHi.click.1"]:visible').innerText(), 'View match')
  await click('expanded.sayHi.click.1'); await page.locator('[data-interaction="amWaiting.returnHome.click.1"]').waitFor()
  assert.ok(page.url().includes(matching.match_id))
  await switch_account('sophie@campus.edu'); await click('home.openMatchInvitation.click.1')
  assert.equal(await page.getByText('You both found a match. Choose whether you would like to connect.').count(), 1)
  assert.equal(await page.getByText('This voice recording is unavailable. Please try again.').count(), 0)
  await click('reqReceived.accept.click.1'); await page.getByRole('dialog').getByRole('button', { name: 'Accept', exact: true }).click()
  await click('reqAccepted.startChat.click.1'); await page.locator('.chat-composer').waitFor()
  assert.equal((await snapshot()).match_sessions.find(row => row.match_id === matching.match_id).status, 'connected')
  check('Saved preferences → device search → found → waiting and same-profile View match → peer Home invitation → explicit acceptance → shared chat')
  // A genuine encoded recording through the production recorder; only the
  // microphone stream is controlled by this isolated test, never by the app.
  const voice_fixture = structuredClone(data)
  voice_fixture.coin_transactions.push({ transaction_id: 'test_voice_opening', owner_user_id: 'user_noah', business_key: 'test_voice_opening', amount: 10, kind: 'opening', status: 'completed', created_at: now, related_id: null, fixture: true })
  await page.evaluate(initial => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data: initial })), voice_fixture)
  await open('/pages/discover/profile?user_id=user_sophie'); await click('expanded.sayHi.click.1'); await page.locator('[data-interaction="ibSelect.q.pick.click.1"]').first().click(); await click('ibSelect.pickVoice.click.1'); await click('ibSelect.answerGo.click.1')
  await page.evaluate(async () => { window.originalGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); window.audioProbe = new AudioContext(); await window.audioProbe.resume(); const destination = window.audioProbe.createMediaStreamDestination(); window.tone = window.audioProbe.createOscillator(); window.tone.connect(destination); window.tone.start(); navigator.mediaDevices.getUserMedia = async () => destination.stream })
  await click('ibVoice.record.click.1'); await click('sheetMic.allowMic.click.1'); await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor(); await page.waitForTimeout(3000); await click('ibVoice.record.click.1'); await page.getByRole('button', { name: 'Play voice message', exact: true }).waitFor(); await click('ibVoice.sendVoiceRequest.click.1'); await page.locator('[data-interaction="ibPreview.continueVoice.click.1"]').waitFor()
  await click('ibPreview.continueVoice.click.1'); await click('sheetVoiceCoin.spendVoice.click.1'); await page.locator('.connection-sent-page').waitFor()
  const voice_state = await snapshot(), voice_request = voice_state.requests.find(row => row.sender_id === 'user_noah' && row.recipient_id === 'user_sophie')
  assert.equal(voice_request.kind, 'voice'); assert.equal(voice_request.status, 'pending'); assert.equal(voice_state.coin_transactions.filter(row => row.owner_user_id === 'user_noah').reduce((sum,row) => sum + row.amount, 0), 0)
  assert.equal(voice_state.coin_transactions.filter(row => row.business_key === `voice:${voice_request.request_id}`).length, 1)
  await page.evaluate(async () => { navigator.mediaDevices.getUserMedia = window.originalGUM; window.tone.stop(); await window.audioProbe.close() })
  await switch_account('sophie@campus.edu'); await click('home.openJordan.click.1')
  await page.locator('[data-interaction="reqReceived.togglePlay.click.1"]').click(); await page.getByRole('button', { name: 'Pause voice introduction', exact: true }).waitFor()
  const pause_geometry = await page.locator('.request-audio-pause').evaluate(element => ({ gap: parseFloat(getComputedStyle(element).gap), width: element.firstElementChild.getBoundingClientRect().width, height: element.firstElementChild.getBoundingClientRect().height }))
  assert.ok(Math.abs(pause_geometry.width - 4) < .1 && Math.abs(pause_geometry.height - 14) < .1 && Math.abs(pause_geometry.gap - 3) < .1, JSON.stringify(pause_geometry))
  // Fractional real time is visible in the waveform before the rounded whole-second aria label.
  await page.waitForFunction(() => document.querySelectorAll('.request-audio-wave > .played').length > 0)
  await page.getByRole('button', { name: 'Pause voice introduction', exact: true }).click(); assert.notEqual(await page.locator('.request-audio-duration').innerText(), '0:18')
  await page.reload(); await page.locator('.request-audio-play').waitFor(); await page.getByRole('button', { name: 'Play voice introduction', exact: true }).click(); await page.getByRole('button', { name: 'Pause voice introduction', exact: true }).waitFor()
  await shot('voice-request-restored.png'); await click('reqReceived.accept.click.1'); await page.locator('.dialog__confirm').click(); await click('reqAccepted.startChat.click.1'); await page.locator('.chat-composer').waitFor(); await page.locator('.event-loading:visible').waitFor({ state: 'hidden' })
  const voice_connected = await snapshot(), original_message = voice_connected.messages.find(row => row.message_id === `introduction_${voice_request.request_id}`)
  assert.equal(original_message.kind, 'audio'); assert.equal(original_message.media_id, voice_request.audio_id); assert.equal(original_message.sender_id, 'user_noah')
  await page.reload(); await page.getByRole('button', { name: 'Play voice message', exact: true }).click(); await page.getByRole('button', { name: 'Pause voice message', exact: true }).waitFor(); await shot('voice-conversation-restored.png')
  check('Real voice recording → one 10-coin debit/request → peer audio playback/seek/refresh → explicit acceptance → same original audio in the unique conversation after refresh')
  // Close through the real request menu, never through Not Now.
  await seed(); await open('/pages/discover/profile?user_id=user_sophie'); await click('expanded.sayHi.click.1'); await page.locator('[data-interaction="ibSelect.q.pick.click.1"]').first().click(); await click('ibSelect.answerGo.click.1'); await field('Your introduction').fill('Would you like a coffee walk?'); await click('ibText.continueText.click.1'); await page.locator('.connection-sent-page').waitFor()
  const to_decline = (await snapshot()).requests.find(row => row.sender_id === 'user_noah')
  await switch_account('sophie@campus.edu'); await click('home.openJordan.click.1'); await click('reqReceived.notNow.click.1'); await page.locator('.home-header').waitFor(); assert.equal((await snapshot()).requests.find(row => row.request_id === to_decline.request_id).status, 'pending')
  await click('home.openJordan.click.1'); await click('reqReceived.openReqMenu.click.1'); await click('reqReceived.openDecline.click.1'); await page.locator('.dialog__confirm').click(); await page.locator('.connection-declined-page').waitFor()
  assert.equal((await snapshot()).requests.find(row => row.request_id === to_decline.request_id).status, 'declined'); assert.equal((await snapshot()).conversations.some(row => row.kind === 'direct' && row.participant_ids.includes('user_noah')), false)
  check('Peer Not Now keeps the invitation; explicit menu decline closes the same request without consent or a conversation')
  assert.deepEqual(report.errors, []); report.result = 'passed'
} catch (error) { report.errors.push(error.stack || error.message); if(page)report.failure={url:page.url(),text:await page.locator('body').innerText().catch(()=>''),state:await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data;return{session:d.session,requests:d.requests,media:d.media_files.map(r=>({id:r.media_id,owner:r.owner_user_id,kind:r.kind}))}}).catch(()=>null)}; throw error }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
