import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { serve_h5, set_safe_area } from './lib/pixel-acceptance.mjs'
import { create_scenario } from '../src/stores/scenarios.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { terms_document, privacy_document, community_document, eula_document } from '../src/utils/legalDocuments.js'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/welcome/eula-2026-10-20'), key = 'cimoa_app_state_v2'
const report = { result: 'failed', checks: [], errors: [], viewports: [], documents: { terms: terms_document, privacy: privacy_document, community: community_document, eula: eula_document } }
const check = text => { report.checks.push(text); console.log('PASS ' + text) }
const click = (page, id) => page.locator(`[data-interaction="${id}"]:visible`).click()
const hidden = page => page.locator('.eula-dialog:visible').waitFor({ state: 'hidden' })
async function ready(page) {
  await page.locator('.eula-dialog.event-dialog--open').waitFor()
  await page.waitForTimeout(280)
}
async function save(page) {
  await click(page, 'welcome.eula.accept.click.1'); await hidden(page)
  assert.equal(await page.locator('.welcome-consent-toggle').getAttribute('aria-checked'), 'true')
}
const read = page => page.evaluate(key => { const value = localStorage.getItem(key); return value ? JSON.parse(value).data : null }, key)
let server, browser
try {
  fs.mkdirSync(folder, { recursive: true }); server = await serve_h5(); report.server_pid = server.pid
  console.log(`Temporary EULA preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } }), page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  const goto = route => page.goto(`${server.origin}/?eula=${Date.now()}#${route}`)
  await goto('/pages/auth/splash'); await ready(page); await set_safe_area(page, 62, 34)
  assert.equal(await read(page), null); assert.equal(await page.locator('.welcome-consent-toggle').getAttribute('aria-checked'), 'false')
  await page.locator('.eula-dialog .event-dialog-mask').click({ position: { x: 1, y: 1 } }); await page.locator('.eula-dialog').press('Escape'); await ready(page)
  await page.evaluate(() => document.querySelector('.welcome-login').click()); assert.ok(page.url().includes('/pages/auth/welcome')); assert.equal(await read(page), null)
  await page.screenshot({ path: path.join(folder, 'eula-browser.png') })
  check('Fresh Splash opens EULA once over Welcome; no preselection, outside/Escape acceptance, navigation or storage writes')
  for (const kind of ['terms', 'privacy', 'community']) {
    await click(page, `welcome.eula.read.${kind}`); await page.locator('.agreement-sheet.event-dialog--open').waitFor()
    const doc = report.documents[kind]
    assert.equal(await page.locator('.agreement-sheet .legal-document-content').getAttribute('data-legal-revision'), doc.revision)
    assert.deepEqual(await page.locator('.agreement-sheet .legal-document-section').evaluateAll(rows => rows.map(row => [row.querySelector('.legal-document-heading').textContent, row.querySelector('.legal-document-copy').textContent])), doc.sections)
    assert.equal(await page.locator('.agreement-sheet .event-dialog-secondary').count(), 0)
    await page.locator('.agreement-close').click(); await page.locator('.agreement-sheet:visible').waitFor({ state: 'hidden' }); await ready(page)
    assert.equal(await read(page), null)
  }
  check('All three EULA links read canonical policies; fixed X closes only the reader, does not accept or close the underlying EULA')
  await click(page, 'welcome.eula.decline.click.1'); await hidden(page)
  for (const id of ['welcome.goLogin.click.1', 'welcome.goAge.click.1']) { await page.locator(`[data-interaction="${id}"]`).click({ force: true }); assert.ok(page.url().includes('/pages/auth/welcome')) }
  assert.equal(await read(page), null)
  await page.reload(); await ready(page); assert.equal(await read(page), null)
  check('Not Now is zero-write, both auth entries remain gated; refresh shows EULA again')
  await page.evaluate(() => { window.eulaOriginalSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === 'cimoa_app_state_v2') throw Error('Storage unavailable'); return window.eulaOriginalSet.call(this, k, v) } })
  await click(page, 'welcome.eula.accept.click.1'); await page.locator('.eula-dialog [role="alert"]').waitFor()
  assert.equal(await read(page), null); assert.equal(await page.locator('.welcome-consent-toggle').getAttribute('aria-checked'), 'false')
  await page.screenshot({ path: path.join(folder, 'eula-storage-failure-browser.png') })
  await page.evaluate(() => { Storage.prototype.setItem = window.eulaOriginalSet })
  await click(page, 'welcome.eula.accept.click.1'); await page.locator('.eula-loading').waitFor()
  const start = Date.now(); assert.equal(await read(page), null)
  await page.evaluate(() => { document.querySelector('[data-interaction="welcome.eula.accept.click.1"]').click(); document.querySelector('[data-interaction="welcome.eula.decline.click.1"]').click() })
  await hidden(page); assert.ok(Date.now() - start >= 400)
  const accepted = await read(page); assert.equal(accepted.app_consent.revision, APP_CONSENT_REVISION); assert.equal(accepted.revision, 1); assert.equal(accepted.session.current_user_id, null)
  assert.deepEqual(accepted.auth_flow.agreements, { age: false, student: false, terms: false, privacy: false, community: false })
  check('Save failure retains unaccepted state; retry shows 500ms custom Loading above EULA and commits once despite repeated clicks')
  await page.reload(); await page.locator('.welcome-page').waitFor(); assert.equal(await page.locator('.eula-dialog:visible').count(), 0)
  assert.equal(await page.locator('.welcome-consent-toggle').getAttribute('aria-checked'), 'true')
  for (const [id, target, back] of [['welcome.goAge.click.1', '.age-page', 'age.goBack.click.1'], ['welcome.goLogin.click.1', '.login-page', 'login.goBack.click.1'], ['welcome.openTerms.click.1', '.legal-terms-page', 'isLegalDoc.goBack.click.1'], ['welcome.openPrivacy.click.1', '.legal-privacy-page', 'isLegalDoc.goBack.click.1']]) {
    await click(page, id); await page.locator(target).waitFor(); await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.locator('.welcome-page').waitFor()
    assert.equal(await page.locator('.welcome-consent-toggle').getAttribute('aria-checked'), 'true'); assert.deepEqual(await read(page), accepted)
  }
  check('Successful consent survives refresh and Login/Age/Terms/Privacy return with no account, session or registration side effects')
  await click(page, 'welcome.toggleAgreement.click.1'); assert.equal(await page.locator('.welcome-consent-toggle').getAttribute('aria-checked'), 'false')
  await page.reload(); await ready(page); await click(page, 'welcome.eula.decline.click.1'); await hidden(page)
  await page.locator('.welcome-consent-toggle').press('Space'); await ready(page); await page.locator('[data-interaction="welcome.eula.accept.click.1"]').press('Enter'); await hidden(page)
  check('Unchecking revokes persisted consent; checking again reviews EULA; Space/Enter save only explicit agreement')

  const tiny = [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 393, height: 852 }, { width: 402, height: 874 }, { width: 440, height: 956 }]
  for (const viewport of tiny) {
    await page.setViewportSize(viewport); await click(page, 'welcome.toggleAgreement.click.1'); await click(page, 'welcome.toggleAgreement.click.1'); await ready(page); await set_safe_area(page, 62, 34)
    const box = await page.locator('.eula-dialog .event-dialog-panel').boundingBox(), actions = await page.locator('.eula-actions').boundingBox()
    assert.ok(box.y >= 62 - 1 && box.y + box.height <= viewport.height - 34 + 1); assert.ok(actions.y >= box.y && actions.y + actions.height <= box.y + box.height + 1)
    const scroll = page.locator('.eula-dialog .uni-scroll-view').last(); assert.ok(await scroll.evaluate(e => e.scrollHeight > e.clientHeight))
    await scroll.evaluate(e => { e.scrollTop = e.scrollHeight }); assert.ok(await scroll.evaluate(e => e.scrollTop > 0))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: path.join(folder, `eula-browser-${viewport.width}x${viewport.height}.png`) }); report.viewports.push({ ...viewport, box, actions })
    await save(page)
  }
  check('Five iPhone viewports including 320x568 fit long EULA with 62/34 safe areas, one content scroll and fixed readable actions')

  await page.setViewportSize({ width: 393, height: 852 }); await goto('/pages/auth/community'); await page.locator('.community-page').waitFor(); await set_safe_area(page, 62, 34)
  const before = await read(page)
  for (const name of ['Terms', 'Privacy', 'Guides']) {
    await click(page, `agree.read${name}.click.1`); await page.locator('.agreement-sheet.event-dialog--open').waitFor(); await page.waitForTimeout(280)
    const close = page.locator('.agreement-close'), initial = await close.boundingBox(), scroll = page.locator('.agreement-sheet .uni-scroll-view').last()
    assert.ok(Math.abs(initial.width - 44) < 1); await scroll.evaluate(e => { e.scrollTop = e.scrollHeight }); await page.waitForTimeout(50); assert.deepEqual(await close.boundingBox(), initial)
    const hit = await close.evaluate(e => { const r = e.getBoundingClientRect(), x = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e === x || e.contains(x) }); assert.equal(hit, true)
    await page.screenshot({ path: path.join(folder, `community-${name.toLowerCase()}-x-browser.png`) }); await close.press('Enter'); await page.locator('.agreement-sheet:visible').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('.community-check-area[aria-checked="true"]').count(), 0); assert.deepEqual(await read(page), before)
  }
  check('Community Terms/Privacy/Guidelines retain canonical content; 44px top-right X stays fixed and hittable after scroll; no bottom Close or implicit registration agreement')
  const authenticated = create_scenario('default', Date.now()); authenticated.app_consent = { revision: null, accepted_at: null }
  fs.writeFileSync(path.join(folder, 'native-fixture.json'), JSON.stringify({ type: 'object', data: authenticated }, null, 2) + '\n')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: authenticated })
  await goto('/pages/auth/splash'); await ready(page); const session = (await read(page)).session
  await click(page, 'welcome.eula.accept.click.1'); await page.locator('.home-header').waitFor(); assert.deepEqual((await read(page)).session, session); assert.equal(await page.locator('.main-skeleton').count(), 0)
  await goto('/pages/auth/splash'); await page.locator('.home-header').waitFor(); assert.equal(await page.locator('.eula-dialog:visible').count(), 0)
  check('Existing session without consent is preserved behind EULA; agreement resumes Home without a new login or skeleton; next launch does not reprompt')
  const cancelledContext = await browser.newContext({ viewport: { width: 393, height: 852 } }), cancelledPage = await cancelledContext.newPage()
  await cancelledPage.goto(`${server.origin}/#/pages/auth/welcome`); await ready(cancelledPage)
  await click(cancelledPage, 'welcome.eula.accept.click.1'); await cancelledPage.locator('.eula-loading').waitFor()
  await cancelledPage.goto(`${server.origin}/#/pages/auth/community`); await cancelledPage.locator('.community-page').waitFor(); await cancelledPage.waitForTimeout(650)
  assert.equal(await read(cancelledPage), null); await cancelledContext.close()
  check('Leaving during agreement Loading cancels pending persistence; no delayed acceptance is written')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
