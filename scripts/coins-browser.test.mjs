import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'center'
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/evidence/coins')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, `.${new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html')}`)
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase, result: 'failed', server_pid: process.pid, checks: [], errors: [] }
const check = message => { report.checks.push(message); console.log(`PASS ${message}`) }
let browser
try {
  fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  console.log(`Temporary coin preview PID ${process.pid}: ${origin}`)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(origin)
  await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', Date.now()))
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('cimoa_app_state_v2')).data)
  if (phase === 'center') {
    await page.goto(`${origin}/?phase=coin-center#/pages/profile/index`)
    const before = await state()
    await page.locator('[data-interaction="profile.openStore.click.1"]').click()
    await page.locator('.coin-center-page').waitFor()
    assert.equal(await page.locator('.coin-balance').innerText(), '260')
    assert.equal(await page.getByRole('radio').count(), 6)
    assert.equal(await page.getByRole('radio', { name: /300 Coins/ }).getAttribute('aria-checked'), 'true')
    await page.locator('.secondary-page-scroll').evaluate(element => { element.scrollTop = 0 })
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(output, 'center-default.png') })
    check('Profile opens Coin Center with Store-derived balance and all six source packages')

    await page.getByRole('radio', { name: /60 Coins/ }).click()
    assert.equal(await page.getByRole('radio', { name: /60 Coins/ }).getAttribute('aria-checked'), 'true')
    assert.deepEqual(await state(), before)
    check('Package selection is transient UI state and does not change the ledger or purchase requests')

    await page.locator('[data-interaction="coinStore.openHistory2.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /still being restored/)
    assert.deepEqual(await state(), before)
    check('Unrestored History dependency fails visibly without changing the balance or ledger')

    await page.setViewportSize({ width: 320, height: 568 })
    const scroll_metrics = await page.locator('.coin-center-page').evaluate(root => [...root.querySelectorAll('.secondary-page-scroll .uni-scroll-view')].map(element => [element.clientHeight, element.scrollHeight]))
    assert.ok(scroll_metrics.some(([height, scroll_height]) => scroll_height > height))
    await page.screenshot({ path: path.join(output, 'center-small.png') })
    await page.setViewportSize({ width: 393, height: 852 })
    await page.locator('[data-interaction="coinStore.goBack.click.1"]').click()
    await page.locator('.profile-content').waitFor()
    check('Coin Center scrolls in a small viewport and Back restores the Profile instance')
  }

  if (phase === 'purchasing') {
    page.setDefaultTimeout(15000)
    await page.goto(`${origin}/?phase=coin-purchasing#/pages/coins/index`)
    const before = await state()
    await page.locator('[data-interaction="coinStore.continuePurchase.click.1"]').click()
    await page.locator('.loading').waitFor()
    assert.equal((await state()).purchase_requests.length, 0)
    await page.locator('.coin-purchasing-page').waitFor()
    assert.equal((await state()).purchase_requests.length, 1)
    assert.equal((await state()).purchase_requests[0].status, 'pending')
    assert.equal(await page.locator('.coin-balance').count(), 0)
    assert.equal((await state()).coin_transactions.reduce((sum, row) => sum + row.amount, 0), 260)
    check('Get Coins waits for custom Loading, creates exactly one pending request and opens Purchasing')

    await page.screenshot({ path: path.join(output, 'purchasing-browser-waiting.png') })
    await page.locator('.purchase-status').getByText('The App Store did not respond in time. No coins were added.', { exact: true }).waitFor()
    const timed_out = await state()
    assert.equal(timed_out.purchase_requests[0].status, 'timeout')
    assert.equal(timed_out.coin_transactions.reduce((sum, row) => sum + row.amount, 0), 260)
    assert.equal(timed_out.coin_transactions.length, before.coin_transactions.length)
    assert.match(await page.getByRole('alert').innerText(), /still being restored/)
    await page.screenshot({ path: path.join(output, 'purchasing-browser-timeout.png') })
    check('Browser without a native handler waits the full callback deadline, records timeout and adds no coins')

    const timeout_url = page.url()
    await page.reload()
    await page.locator('.coin-purchasing-page').waitFor()
    assert.equal(page.url(), timeout_url)
    assert.equal((await state()).purchase_requests.length, 1)
    assert.equal((await state()).purchase_requests[0].status, 'timeout')
    assert.equal(await page.locator('.purchase-pulse').count(), 0)
    check('Refreshing a finished request restores its terminal state and never submits it again')

    await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), create_scenario('default', Date.now()))
    await page.goto(`${origin}/?phase=coin-cancel#/pages/coins/index`)
    await page.locator('[data-interaction="coinStore.continuePurchase.click.1"]').click()
    await page.locator('.coin-purchasing-page').waitFor()
    await page.locator('[data-interaction="coinPurchasing.backToStore.click.1"]').click()
    await page.locator('.loading').waitFor()
    await page.locator('.coin-cancelled-page').waitFor()
    const cancelled = await state()
    assert.equal(cancelled.purchase_requests.length, 1)
    assert.equal(cancelled.purchase_requests[0].status, 'cancelled')
    assert.equal(cancelled.coin_transactions.reduce((sum, row) => sum + row.amount, 0), 260)
    check('Cancel resolves the bridge once, persists cancelled status and leaves the ledger unchanged')
  }

  if (phase === 'cancelled') {
    await page.goto(`${origin}/?phase=coin-cancelled#/pages/coins/index`)
    const before = await state()
    await page.locator('[data-interaction="coinStore.continuePurchase.click.1"]').click()
    await page.locator('.coin-purchasing-page').waitFor()
    await page.locator('[data-interaction="coinPurchasing.backToStore.click.1"]').click()
    await page.locator('.loading').waitFor()
    await page.locator('.coin-cancelled-page').waitFor()
    const cancelled = await state()
    assert.equal(cancelled.purchase_requests.length, 1)
    assert.equal(cancelled.purchase_requests[0].status, 'cancelled')
    assert.equal(cancelled.coin_transactions.length, before.coin_transactions.length)
    assert.equal(cancelled.coin_transactions.reduce((sum, row) => sum + row.amount, 0), 260)
    assert.equal(await page.locator('.cancelled-copy').innerText(), 'Nothing was charged and your balance is unchanged.')
    await page.screenshot({ path: path.join(output, 'cancelled-default.png') })
    check('Cancelling Purchasing opens the owned Cancelled result and leaves the ledger unchanged')

    const result_url = page.url()
    await page.reload()
    await page.locator('.coin-cancelled-page').waitFor()
    assert.equal(page.url(), result_url)
    assert.equal((await state()).purchase_requests.length, 1)
    check('Cancelled restores the terminal request after refresh without replaying cancellation')

    await page.locator('.cancelled-footer [data-interaction="coinCancelled.goBack.click.1"]').click()
    await page.locator('.coin-center-page').waitFor()
    assert.equal((await state()).purchase_requests[0].status, 'cancelled')
    check('Close pops the purchase flow back to the existing Coin Center instance')

    await page.goto(result_url)
    await page.locator('.coin-cancelled-page').waitFor()
    await page.locator('[data-interaction="coinCancelled.backToStore.click.1"]').click()
    await page.locator('.coin-center-page').waitFor()
    assert.equal((await state()).coin_transactions.reduce((sum, row) => sum + row.amount, 0), 260)
    check('Back to Coin Store replaces direct-entry Cancelled without changing balance')

    await page.goto(`${origin}/?phase=coin-cancelled-invalid#/pages/coins/cancelled`)
    assert.match(await page.getByRole('alert').innerText(), /unavailable/)
    assert.equal((await state()).purchase_requests.length, 1)
    check('Cancelled rejects a missing request ID and performs no fallback mutation')
  }

  if (phase === 'failed') {
    page.setDefaultTimeout(15000)
    await page.goto(`${origin}/?phase=coin-failed#/pages/coins/index`)
    const before = await state()
    await page.locator('[data-interaction="coinStore.continuePurchase.click.1"]').click()
    await page.locator('.coin-failed-page').waitFor()
    const failed = await state()
    assert.equal(failed.purchase_requests.length, 1)
    assert.equal(failed.purchase_requests[0].status, 'timeout')
    assert.equal(failed.coin_transactions.length, before.coin_transactions.length)
    assert.equal(failed.coin_transactions.reduce((sum, row) => sum + row.amount, 0), 260)
    assert.match(await page.locator('.failed-copy').innerText(), /did not respond in time/)
    await page.screenshot({ path: path.join(output, 'failed-timeout.png') })
    check('Purchasing routes a real browser timeout to Failed with unchanged balance and timeout-specific copy')

    const failed_url = page.url()
    await page.reload()
    await page.locator('.coin-failed-page').waitFor()
    assert.equal(page.url(), failed_url)
    assert.equal((await state()).purchase_requests.length, 1)
    check('Failed restores the owned terminal request after refresh without resubmitting it')

    const before_help = await state()
    await page.locator('[data-interaction="coinFailed.openCoinHelp.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /still being restored/)
    assert.deepEqual(await state(), before_help)
    check('Unrestored Coin Help fails visibly without writing purchase or ledger state')

    await page.locator('.failed-footer [data-interaction="coinFailed.backToStore.click.1"]').click()
    await page.locator('.coin-center-page').waitFor()
    assert.equal((await state()).purchase_requests.length, 1)
    check('Cancel replaces Failed with Coin Center and preserves its terminal request')

    await page.goto(failed_url)
    await page.locator('.coin-failed-page').waitFor()
    await page.locator('[data-interaction="coinFailed.tryAgainPurchase.click.1"]').click()
    await page.locator('.loading').waitFor()
    assert.equal((await state()).purchase_requests.length, 1)
    await page.locator('.coin-purchasing-page').waitFor()
    const retried = await state()
    assert.equal(retried.purchase_requests.length, 2)
    assert.equal(retried.purchase_requests[0].status, 'timeout')
    assert.equal(retried.purchase_requests[1].status, 'pending')
    assert.notEqual(retried.purchase_requests[0].request_id, retried.purchase_requests[1].request_id)
    assert.equal(retried.coin_transactions.reduce((sum, row) => sum + row.amount, 0), 260)
    check('Try Again waits for custom Loading and creates a distinct pending request without adding coins')
  }

  if (phase === 'history') {
    await page.goto(`${origin}/?phase=coin-history#/pages/coins/index`)
    await page.locator('[data-interaction="coinStore.continuePurchase.click.1"]').click()
    await page.locator('.coin-purchasing-page').waitFor()
    await page.locator('[data-interaction="coinPurchasing.backToStore.click.1"]').click()
    await page.locator('.coin-cancelled-page').waitFor()
    await page.locator('[data-interaction="coinCancelled.backToStore.click.1"]').click()
    await page.locator('.coin-center-page').waitFor()
    const before_history = await state()
    await page.locator('[data-interaction="coinStore.openHistory2.click.1"]').click()
    await page.locator('.coin-history-page').waitFor()
    assert.match(await page.locator('.history-balance').innerText(), /Current balance\s*260/)
    assert.equal(await page.locator('.history-row').count(), 5)
    assert.equal(await page.locator('[data-record-type="purchase_request"]').count(), 1)
    assert.match(await page.locator('[data-record-type="purchase_request"]').innerText(), /Purchase cancelled/)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(output, 'history-default.png') })
    check('History combines four ledger entries with one terminal request without changing the 260 balance')

    await page.locator('[data-filter="purchases"]').click()
    assert.equal(await page.locator('.history-row').count(), 2)
    await page.locator('[data-filter="used"]').click()
    assert.equal(await page.locator('.history-row').count(), 3)
    await page.locator('[data-filter="all"]').click()
    assert.equal(await page.locator('.history-row').count(), 5)
    check('All, Purchases and Used filters derive from canonical ledger and request entities')

    await page.locator('[data-record-type="transaction"]').filter({ hasText: 'Coin purchase' }).click()
    await page.locator('.coin-purchase-detail-page').waitFor()
    assert.deepEqual(await state(), before_history)
    await page.locator('[data-interaction="coinPurchaseDetail.goBack.click.1"]').click()
    await page.locator('.coin-history-page').waitFor()
    check('Purchase rows open their owned ledger detail and Back restores History without a write')

    await page.locator('[data-record-type="purchase_request"]').click()
    await page.locator('.coin-cancelled-page').waitFor()
    await page.locator('.cancelled-footer [data-interaction="coinCancelled.goBack.click.1"]').click()
    await page.locator('.coin-history-page').waitFor()
    assert.equal((await state()).coin_transactions.reduce((sum, row) => sum + row.amount, 0), 260)
    check('Terminal request rows open their real result entity and Close restores History')

    await page.reload()
    await page.locator('.coin-history-page').waitFor()
    assert.equal(await page.locator('.history-row').count(), 5)
    check('History refresh restores persisted ledger and terminal requests')

    await page.locator('[data-interaction="coinHistory.goBack.click.1"]').click()
    await page.locator('.coin-center-page').waitFor()
    check('History Back restores the existing Coin Center instance')

    const empty = await state()
    empty.coin_transactions = []
    empty.purchase_requests = []
    await page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data })), empty)
    await page.goto(`${origin}/?phase=coin-history-empty#/pages/coins/history`)
    await page.locator('.history-empty').waitFor()
    assert.match(await page.locator('.history-balance').innerText(), /Current balance\s*0/)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(output, 'history-empty.png') })
    check('History renders the zero-balance empty state from Store data')
  }

  if (phase === 'purchase-detail') {
    await page.goto(`${origin}/?phase=coin-purchase-detail#/pages/coins/history`)
    const before = await state()
    await page.locator('[data-record-type="transaction"]').filter({ hasText: 'Coin purchase' }).click()
    await page.locator('.coin-purchase-detail-page').waitFor()
    assert.match(await page.locator('.detail-hero').innerText(), /300 Coins\s*Local demo ledger entry/)
    assert.match(await page.locator('.detail-card').innerText(), /Amount paid\s*Unavailable for local demo data/)
    assert.match(await page.locator('.detail-card').innerText(), /Transaction ID\s*txn_seed_0/)
    assert.match(await page.locator('.detail-note').innerText(), /does not represent an Apple charge/)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(output, 'purchase-detail-fixture.png') })
    check('Purchase Detail discloses fixture provenance and never fabricates price or StoreKit receipt data')

    await page.locator('[data-interaction="coinPurchaseDetail.openSupport.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /still being restored/)
    assert.deepEqual(await state(), before)
    check('Unrestored Coin Help fails visibly without mutating the ledger')

    const detail_url = page.url()
    await page.reload()
    await page.locator('.coin-purchase-detail-page').waitFor()
    assert.equal(page.url(), detail_url)
    assert.match(await page.locator('.detail-card').innerText(), /txn_seed_0/)
    check('Purchase Detail refresh restores the canonical transaction')

    await page.locator('[data-interaction="coinPurchaseDetail.goBack.click.1"]').click()
    await page.locator('.coin-history-page').waitFor()
    assert.equal(await page.locator('.history-row').count(), 4)
    check('Purchase Detail Back restores History')

    await page.goto(`${origin}/?phase=coin-purchase-detail-invalid#/pages/coins/purchase-detail?transaction_id=missing`)
    assert.match(await page.getByRole('alert').innerText(), /unavailable/)
    assert.deepEqual(await state(), before)
    check('Purchase Detail rejects an unknown transaction ID without fallback data or writes')
  }

  if (phase === 'spend-detail') {
    await page.goto(`${origin}/?phase=coin-spend-detail#/pages/coins/history`)
    const before = await state()
    await page.locator('[data-record-type="transaction"]').filter({ hasText: 'Coins used' }).first().click()
    await page.locator('.coin-spend-detail-page').waitFor()
    assert.match(await page.locator('.spend-hero').innerText(), /−10 Coins\s*Local demo ledger entry/)
    assert.match(await page.locator('.spend-card').innerText(), /Feature\s*Unavailable in demo ledger/)
    assert.match(await page.locator('.spend-note').innerText(), /not evidence that a named feature was used/)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(output, 'spend-detail-fixture.png') })
    check('Spending Detail discloses fixture provenance and does not invent a linked feature')

    await page.locator('[data-interaction="coinSpendDetail.openSupport.click.1"]').click()
    assert.match(await page.getByRole('alert').innerText(), /still being restored/)
    assert.deepEqual(await state(), before)
    check('Unrestored Coin Help fails visibly without mutating coin activity')

    const detail_url = page.url()
    await page.reload()
    await page.locator('.coin-spend-detail-page').waitFor()
    assert.equal(page.url(), detail_url)
    assert.match(await page.locator('.spend-card').innerText(), /Completed · Local demo/)
    check('Spending Detail refresh restores the canonical transaction')

    await page.locator('[data-interaction="coinSpendDetail.goBack.click.1"]').click()
    await page.locator('.coin-history-page').waitFor()
    assert.equal(await page.locator('.history-row').count(), 4)
    check('Spending Detail Back restores History')

    await page.goto(`${origin}/?phase=coin-spend-detail-invalid#/pages/coins/spend-detail?transaction_id=txn_seed_0`)
    assert.match(await page.getByRole('alert').innerText(), /not a completed coin spend/)
    assert.deepEqual(await state(), before)
    check('Spending Detail rejects a purchase transaction without fallback data or writes')
  }

  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message)
  throw error
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  fs.writeFileSync(path.join(output, `${phase}-acceptance.json`), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Temporary coin preview PID ${process.pid} stopped`)
}
