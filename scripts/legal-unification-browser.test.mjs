import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { serve_h5, set_safe_area } from './lib/pixel-acceptance.mjs'
import { create_scenario } from '../src/stores/scenarios.js'
import { terms_document, privacy_document, community_document } from '../src/utils/legalDocuments.js'

const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const folder = path.resolve('docs/ui-restoration/community/legal-unification-2026-10-19'), key = 'cimoa_app_state_v2'
const documents = { terms: terms_document, privacy: privacy_document, community: community_document }
const report = { result: 'failed', checks: [], errors: [], documents: {}, routes: [] }
const check = message => { report.checks.push(message); console.log('PASS ' + message) }
let server, browser
async function read_document(page) {
  return page.locator('.legal-document-content:visible').evaluate(element => ({
    id: element.dataset.legalDocument, revision: element.dataset.legalRevision,
    updated: element.querySelector('.legal-document-updated').textContent,
    intro: element.querySelector('.legal-document-intro').textContent,
    sections: [...element.querySelectorAll('.legal-document-section')].map(section => [section.querySelector('.legal-document-heading').textContent, section.querySelector('.legal-document-copy').textContent]),
    footer: element.querySelector('.legal-document-footer').textContent,
  }))
}
const expected = kind => { const { id, revision, updated, intro, sections, footer } = documents[kind]; return { id, revision, updated, intro, sections, footer } }
const click = (page, id) => page.locator(`[data-interaction="${id}"]:visible`).click()
async function sheet_ready(page, kind) {
  await page.locator('.agreement-sheet.event-dialog--open').waitFor()
  await page.getByRole('dialog', { name: documents[kind].title, exact: true }).waitFor()
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish() })
}
async function close_sheet(page, by_mask = false) {
  if (by_mask) await page.locator('[data-interaction="sheetAgreement.closeSheet.click.1"]:visible').click({ position: { x: 4, y: 4 } })
  else await click(page, 'sheetAgreement.closeSheet.click.2')
  await page.locator('.agreement-sheet:visible').waitFor({ state: 'hidden' })
}
try {
  fs.mkdirSync(folder, { recursive: true }); server = await serve_h5(); report.server_pid = server.pid
  console.log(`Temporary legal preview PID ${server.pid}: ${server.origin}`)
  browser = await chromium.launch({ channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } }), page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  const stored = () => page.evaluate(key => localStorage.getItem(key), key)
  let document_index = 0
  const goto = route => page.goto(`${server.origin}/?legalDocument=${++document_index}#${route}`)
  await goto('/pages/auth/community'); await page.locator('.community-page').waitFor(); await set_safe_area(page, 54, 0)
  await click(page, 'agree.tTerms.click.1'); const before = await stored()
  for (const [kind, id] of [['terms', 'Terms'], ['privacy', 'Privacy'], ['community', 'Guides']]) {
    await click(page, `agree.read${id}.click.1`); await sheet_ready(page, kind)
    const actual = await read_document(page); assert.deepEqual(actual, expected(kind)); report.documents[kind] = actual
    assert.equal(await page.getByRole('dialog').getAttribute('aria-label'), documents[kind].title)
    const scroll = page.locator('.agreement-sheet .uni-scroll-view').last()
    assert.ok(await scroll.evaluate(element => element.scrollHeight > element.clientHeight))
    assert.equal(await scroll.evaluate(element => element.scrollTop), 0)
    await page.screenshot({ path: path.join(folder, `${kind}-sheet-browser.png`) })
    await scroll.evaluate(element => { element.scrollTop = element.scrollHeight })
    await page.screenshot({ path: path.join(folder, `${kind}-sheet-browser-end.png`) })
    await close_sheet(page)
    assert.deepEqual(await page.locator('.community-check-area').evaluateAll(rows => rows.map(row => row.getAttribute('aria-checked'))), ['true', 'false', 'false'])
    assert.equal(await stored(), before)
    check(`Community ${documents[kind].title}: complete canonical text, scroll to Close, no consent/storage side effects`)
  }
  await click(page, 'agree.readGuides.click.1'); await sheet_ready(page, 'community'); assert.deepEqual(await read_document(page), expected('community')); assert.equal(await page.locator('.agreement-sheet .uni-scroll-view').last().evaluate(element => element.scrollTop), 0); await close_sheet(page, true)
  await page.reload(); await page.locator('.community-page').waitFor(); assert.equal(await page.locator('[aria-checked="true"]').count(), 0); assert.equal(await stored(), before)
  check('Repeated Guidelines open starts at the top; mask close and refresh do not silently accept')

  await goto('/pages/auth/welcome'); await page.locator('.welcome-page').waitFor()
  for (const [kind, label] of [['terms', 'Terms'], ['privacy', 'Privacy']]) for (const prefix of ['welcome.', 'welcome.consent.']) {
    await click(page, `${prefix}open${label}.click.1`); await page.locator(`.legal-${kind}-page`).waitFor()
    assert.deepEqual(await read_document(page), report.documents[kind]); assert.equal(await page.locator('.event-page-header-title:visible').innerText(), documents[kind].title)
    await click(page, 'isLegalDoc.goBack.click.1'); await page.locator('.welcome-page').waitFor()
    assert.equal(await page.locator('.welcome-consent-toggle').getAttribute('aria-checked'), 'false'); assert.equal(await stored(), before)
    report.routes.push(`${prefix}open${label}.click.1`)
  }
  check('Both Welcome link pairs match Community word for word; Back preserves the unaccepted gate')

  const authenticated = create_scenario('default', Date.now())
  fs.writeFileSync(path.join(folder, 'native-fixture.json'), JSON.stringify({ type: 'object', data: authenticated }, null, 2) + '\n')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify({ type: 'object', data })), { key, data: authenticated })
  await goto('/pages/settings/legal'); await page.locator('.settings-legal-page').waitFor(); const signed_before = await stored()
  for (const [kind, label] of [['terms', 'Terms'], ['privacy', 'Privacy']]) {
    await click(page, `setLegal.open${label}.click.1`); await page.locator(`.legal-${kind}-page`).waitFor(); assert.deepEqual(await read_document(page), report.documents[kind])
    await page.reload(); await page.locator(`.legal-${kind}-page`).waitFor(); assert.deepEqual(await read_document(page), report.documents[kind])
    await click(page, 'isLegalDoc.goBack.click.1'); await page.locator('.settings-legal-page').waitFor(); assert.equal(await stored(), signed_before)
  }
  await click(page, 'setLegal.openAgreeInfo.click.1'); await sheet_ready(page, 'community'); assert.deepEqual(await read_document(page), report.documents.community); await close_sheet(page)
  check('Settings Legal reads the same three documents; full-page refresh/Back preserves session and remains zero-write')

  await goto('/pages/settings/index'); await page.locator('.settings-page').waitFor(); await click(page, 'settings.openAgreeInfo.click.1'); await sheet_ready(page, 'community'); assert.deepEqual(await read_document(page), report.documents.community); await close_sheet(page)
  check('Direct Settings Guidelines entry matches registration and Legal without leaving Settings')

  await goto('/pages/coins/help'); await page.locator('.coin-help-page').waitFor()
  for (const [kind, label] of [['terms', 'Terms'], ['privacy', 'Privacy']]) {
    await click(page, `coinHelp.open${label}.click.1`); await page.locator(`.legal-${kind}-page`).waitFor(); assert.deepEqual(await read_document(page), report.documents[kind]); assert.ok(page.url().includes('origin=coins'))
    await page.reload(); await page.locator(`.legal-${kind}-page`).waitFor(); await click(page, 'isLegalDoc.goBack.click.1'); await page.locator('.coin-help-page').waitFor(); assert.equal(await stored(), signed_before)
  }
  check('Coin Help policies match the canonical documents; named return context survives refresh without ledger writes')

  await goto('/pages/settings/legal'); await page.locator('.settings-legal-page').waitFor(); await page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(page, 62, 34)
  await click(page, 'setLegal.openAgreeInfo.click.1'); await sheet_ready(page, 'community')
  const bounds = await page.getByRole('dialog').boundingBox(); assert.ok(bounds.y >= 62 - 1); assert.ok(bounds.y + bounds.height <= 568 + 1)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: path.join(folder, 'guidelines-browser-small.png') }); await page.locator('.agreement-sheet .uni-scroll-view').last().evaluate(element => { element.scrollTop = element.scrollHeight })
  const close_bounds = await page.locator('[data-interaction="sheetAgreement.closeSheet.click.2"]:visible').boundingBox(); assert.ok(close_bounds.y + close_bounds.height <= 568 - 34 + 1)
  await page.locator('[data-interaction="sheetAgreement.closeSheet.click.2"]:visible').press('Escape'); await page.locator('.agreement-sheet:visible').waitFor({ state: 'hidden' }); assert.equal(await stored(), signed_before)
  check('Long Guidelines fit 320x568 with 62/34 safe areas, one Sheet scroll owner, readable last section and Escape close')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(folder, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
