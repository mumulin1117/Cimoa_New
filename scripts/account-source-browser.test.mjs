// References use only the locked HTML AST, never production component markup/CSS.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { create_seed } from '../src/stores/seed.js'
import { read_circa_source, walk_html, attribute, binding } from './lib/circa-source.mjs'
import { serve_h5, context_for, set_safe_area, write_comparison } from './lib/pixel-acceptance.mjs'
const require = createRequire(import.meta.url), { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const key = process.argv.find(a => a.startsWith('--page='))?.slice(7) || 'profile'
const specs = {
  profile: ['isProfile', '/pages/profile/index', '.profile-name', 'account-profile'],
  settings: ['isSettings', '/pages/settings/index', '.settings-row', 'account-settings'],
  verification: ['isVerified', '/pages/profile/verification', '.verification-summary', 'account-verification'],
  reverify: ['isReverify', '/pages/profile/reverify', '.reverify-body', 'account-reverify'],
  coins: ['isCoinStore', '/pages/coins/index', '.coin-hero', 'account-coins'],
}
assert.ok(specs[key], 'Unknown source page')
const [condition, route, ready, slug] = specs[key], output = path.resolve('docs/ui-restoration', slug)
const source = read_circa_source(), contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json')))
assert.equal(contract.source.file_sha256, source.source_hash)
const epoch = Date.UTC(2026, 9, 17, 1), data = create_seed(epoch), user = data.users[0]
const images = { '6cba2be3-a0e0-4813-b4ab-4aa65ed6aa30': user.avatar_url, 'a9831494-dfeb-464f-8617-1e3468ad74f0': '/static/assets/coins/home-coin-badge.png', '501d6dc6-cd53-4ee4-b9ae-e49c37deca54': '/static/assets/coins/store-coin-hero.png' }
const report = { result: 'failed', source_sha256: source.source_hash, checks: [], errors: [], visual_acceptance: 'pending', approved_deltas: ['Canonical user data and actual ledger balance', 'Real safe areas instead of simulated system bars', 'No invented university verification, purchase or moderation success'] }
const check = value => { report.checks.push(value); console.log('PASS ' + value) }
function reference(origin) {
  const vars = { obName: user.user_name, obField: user.major, obBio: user.bio, balanceText: '260 coins', coinsNum: '260', language: 'English', selectedInterests: user.interest_ids.map(id => { const i = data.interests.find(i => i.item_id === id); return { ...i, icon: i.emoji } }) }
  const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  const resolve = (key, scope) => key.split('.').reduce((v, k) => v?.[k], scope)
  const fill = (value, scope) => value.replace(/{{\s*([\w.]+)\s*}}/g, (_, k) => escape(resolve(k, scope)))
  const render = (node, scope = vars) => {
    if (node.type === 2 || node.type === 5) return fill(node.type === 2 ? node.content : node.loc.source, scope)
    if (node.type !== 1) return ''
    if (node.tag === 'sc-if') return resolve(binding(attribute(node, 'value')), scope) ? node.children.map(n => render(n, scope)).join('') : ''
    if (node.tag === 'sc-for') return (resolve(binding(attribute(node, 'list')), scope) || []).map(row => node.children.map(n => render(n, { ...scope, [attribute(node, 'as')]: row })).join('')).join('')
    const attrs = node.props.filter(p => p.type === 6 && !p.name.startsWith('sc-camel-on-') && !p.name.startsWith('hint-')).map(p => {
      let value = p.value?.content || ''
      if (p.name === 'src') { value = images[value] || fill(value, scope); if (value.startsWith('/static/')) value = origin + value }
      return ' ' + p.name.replace('sc-camel-view-box', 'viewBox') + '="' + fill(value, scope) + '"'
    }).join('')
    return '<' + node.tag + attrs + '>' + node.children.map(n => render(n, scope)).join('') + (['img', 'input'].includes(node.tag) ? '' : '</' + node.tag + '>')
  }
  let root; walk_html(source.html, n => { if (n.tag === 'sc-if' && binding(attribute(n, 'value')) === condition) root = n.children.find(n => n.type === 1) })
  return '<!doctype html><html><head><link rel="stylesheet" href="' + origin + '/static/assets/fonts/source-fonts.css"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;color:#0b1b3a;background:linear-gradient(168deg,#e4f4fb 0%,#eaf0fd 44%,#f2ecfb 100%);-webkit-font-smoothing:antialiased}::-webkit-scrollbar{display:none}</style></head><body>' + render(root) + '</body></html>'
}
let browser, server
try {
  fs.mkdirSync(output, { recursive: true }); server = await serve_h5(); console.log('Temporary account source preview PID ' + server.pid + ': ' + server.origin)
  browser = await chromium.launch({ headless: true, channel: process.env.CIMOA_BROWSER_CHANNEL || 'chrome' })
  const ref = await browser.newPage({ viewport: { width: 393, height: 852 } }); await ref.goto(server.origin); await ref.setContent(reference(server.origin)); await ref.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())) }); await ref.screenshot({ path: path.join(output, 'reference.png') }); await ref.close()
  const context = await context_for(browser, 'cimoa_app_state_v2', data), page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => report.errors.push(e.message)); await page.clock.setFixedTime(new Date(epoch))
  await page.goto(server.origin + '/#' + route); await page.locator(ready).first().waitFor(); await set_safe_area(page, 54, 0)
  await page.evaluate(async () => { for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) })
  await page.screenshot({ path: path.join(output, 'actual-browser.png') }); report.comparison = await write_comparison(browser, output, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  check('Independent HTML source and deterministic 393×852 actual, overlay and diff captured; visual approval is separate')
  const saved = await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')); await page.reload(); await page.locator(ready).first().waitFor(); assert.equal(await page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), saved)
  await page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(page, 62, 34); await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth)
  check('Read-only refresh retains entities and narrow layout avoids horizontal page scrolling')
  assert.deepEqual(report.errors, []); report.result = 'passed'; await context.close()
} catch (error) { report.failure = String(error.stack || error); throw error }
finally { await browser?.close(); await server?.close(); report.cleaned_up = true; fs.writeFileSync(path.join(output, 'source-browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n') }
