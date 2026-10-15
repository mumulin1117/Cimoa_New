// One-shot Splash pixel evidence and browser behavior test. The source HTML is
// parsed as evidence but never served or used by the application at runtime.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'
import { read_circa_source } from './lib/circa-source.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/ui-restoration/splash')
const contract = JSON.parse(fs.readFileSync(path.join(output, 'source-contract.json'), 'utf8'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})
const report = { phase: 'splash-pixel-restoration', result: 'failed', server_pid: process.pid, reference: {}, geometry: {}, comparison: {}, checks: [], errors: [] }
const check = (name) => { report.checks.push(name); console.log(`PASS ${name}`) }
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const close = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

function verify_source_lock() {
  const source = read_circa_source()
  const lines = source.template.split('\n')
  const visual = lines.slice(2498, 2508).join('\n')
  const behavior = [lines[4854], lines[5559]].join('\n')
  assert.equal(source.source_hash, contract.source.file_sha256)
  assert.equal(hash(visual), contract.source.visual_fragment_sha256)
  assert.equal(hash(behavior), contract.source.behavior_fragment_sha256)
  report.reference = { kind: 'source-derived locked reference', source_file_sha256: source.source_hash, visual_fragment_sha256: hash(visual), animation_phase_ms: 750 }
}

function source_reference_markup() {
  const { brand, progress, background } = contract
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,sans-serif;background:${background};color:${brand.typography.color}}
.screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${contract.structure.gap_css_px}px}
.brand{display:flex;flex-direction:column;align-items:center;gap:${brand.group_gap_css_px}px}.arc{width:${brand.arc.width_css_px}px;height:${brand.arc.height_css_px}px;flex:none}
.name{font-size:${brand.typography.font_size_css_px}px;font-weight:${brand.typography.font_weight};letter-spacing:${brand.typography.letter_spacing};padding-left:${brand.typography.padding_left};color:${brand.typography.color};line-height:${brand.typography.line_height}}
.track{width:${progress.track.width_css_px}px;height:${progress.track.height_css_px}px;border-radius:${progress.track.border_radius_css_px}px;background:${progress.track.background};overflow:hidden}
.fill{width:${progress.fill.width_css_px}px;height:${progress.fill.height_css_px}px;border-radius:${progress.fill.border_radius_css_px}px;background:${progress.fill.background};transform:scale(1.04);opacity:.3}
</style></head><body><div class="screen"><div class="brand"><svg class="arc" viewBox="${brand.arc.view_box}" fill="none"><defs><linearGradient id="locked-arc" x1="0" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#1ec8f5"/><stop offset=".5" stop-color="#6366f1"/><stop offset="1" stop-color="#f81ce5"/></linearGradient></defs><path d="${brand.arc.path}" stroke="url(#locked-arc)" stroke-width="${brand.arc.stroke_width}" stroke-linecap="${brand.arc.stroke_linecap}"/></svg><div class="name">${brand.approved_copy}</div></div><div class="track"><div class="fill"></div></div></div></body></html>`
}

async function freeze_splash(page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getComputedTiming()
      if (timing?.iterations === Infinity) { animation.pause(); animation.currentTime = 750 }
      else animation.finish()
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, center_x: rect.x + rect.width / 2, center_y: rect.y + rect.height / 2 }
    }
    const root = box('.splash-page'), content = box('.splash-content'), brand = box('.brand--splash'), arc = box('.brand-arc'), track = box('.splash-track')
    const fillStyle = getComputedStyle(document.querySelector('.splash-progress'))
    const safe = [...document.querySelectorAll('.splash-page > .safe-area')].map(element => element.getBoundingClientRect().height)
    return { viewport: { width: innerWidth, height: innerHeight }, root, content, brand, arc, track,
      fill_css: { width: Number.parseFloat(fillStyle.width), height: Number.parseFloat(fillStyle.height), border_radius: Number.parseFloat(fillStyle.borderRadius) }, safe,
      role: document.querySelector('.splash-page').getAttribute('role'), interaction: document.querySelector('.splash-page').dataset.interaction,
      content_padding: getComputedStyle(document.querySelector('.splash-content')).padding }
  })
}

async function write_comparison(browser, reference_path, actual_path) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  const encoded = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
  const result = await page.evaluate(async ({ reference, actual }) => {
    const load = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src })
    const [a, b] = await Promise.all([load(reference), load(actual)])
    const canvas = document.createElement('canvas'); canvas.width = a.width; canvas.height = a.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(a, 0, 0); const first = context.getImageData(0, 0, a.width, a.height)
    context.clearRect(0, 0, a.width, a.height); context.drawImage(b, 0, 0); const second = context.getImageData(0, 0, a.width, a.height)
    context.clearRect(0, 0, a.width, a.height); context.drawImage(a, 0, 0); context.globalAlpha = .5; context.drawImage(b, 0, 0); context.globalAlpha = 1
    const overlay = canvas.toDataURL('image/png')
    const diff = context.createImageData(a.width, a.height); let exact = 0, above8 = 0, sum = 0, max = 0
    for (let i = 0; i < first.data.length; i += 4) {
      const dr = Math.abs(first.data[i] - second.data[i]), dg = Math.abs(first.data[i + 1] - second.data[i + 1]), db = Math.abs(first.data[i + 2] - second.data[i + 2]), da = Math.abs(first.data[i + 3] - second.data[i + 3])
      const delta = Math.max(dr, dg, db, da); if (delta > 0) exact += 1; if (delta > 8) above8 += 1; sum += dr + dg + db + da; max = Math.max(max, delta)
      diff.data[i] = Math.min(255, dr * 4); diff.data[i + 1] = Math.min(255, dg * 4); diff.data[i + 2] = Math.min(255, db * 4); diff.data[i + 3] = 255
    }
    context.putImageData(diff, 0, 0)
    return { overlay, diff: canvas.toDataURL('image/png'), width: a.width, height: a.height, pixels_different: exact, pixels_above_channel_delta_8: above8, mean_absolute_channel_delta: sum / first.data.length, max_channel_delta: max }
  }, { reference: encoded(reference_path), actual: encoded(actual_path) })
  const decode = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64')
  fs.writeFileSync(path.join(output, 'overlay.png'), decode(result.overlay))
  fs.writeFileSync(path.join(output, 'diff.png'), decode(result.diff))
  await page.close()
  delete result.overlay; delete result.diff
  return result
}

let browser
try {
  verify_source_lock()
  fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })

  const reference_context = await browser.newContext({ viewport: { width: 393, height: 852 } })
  const reference_page = await reference_context.newPage()
  await reference_page.setContent(source_reference_markup())
  await reference_page.screenshot({ path: path.join(output, 'reference.png') })
  await reference_context.close()

  const visual_context = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await visual_context.addInitScript(() => {
    const schedule = window.setTimeout.bind(window)
    window.setTimeout = (callback, delay, ...args) => delay === 1800 ? schedule(() => {}, 60_000) : schedule(callback, delay, ...args)
  })
  const visual_page = await visual_context.newPage()
  visual_page.on('pageerror', error => report.errors.push(error.message))
  await visual_page.goto(`${origin}/?pixelEvidence=default#/pages/auth/splash`)
  await visual_page.locator('.brand--splash').waitFor()
  report.geometry = await freeze_splash(visual_page)
  assert.deepEqual(report.geometry.viewport, { width: 393, height: 852 })
  assert.equal(report.geometry.role, 'button')
  assert.equal(report.geometry.interaction, 'splash.goWelcome.click.1')
  assert.equal(report.geometry.content_padding, '0px')
  assert.ok(close(report.geometry.root.width, 393) && close(report.geometry.root.height, 852))
  assert.ok(close(report.geometry.arc.width, 81) && close(report.geometry.arc.height, 22.8))
  assert.ok(close(report.geometry.track.width, 150) && close(report.geometry.track.height, 4))
  assert.ok(close(report.geometry.fill_css.width, 64) && close(report.geometry.fill_css.height, 4) && close(report.geometry.fill_css.border_radius, 2))
  await visual_page.screenshot({ path: path.join(output, 'actual-browser.png') })
  await visual_page.evaluate(() => { document.documentElement.style.setProperty('--native-safe-area-top', '62px'); document.documentElement.style.setProperty('--native-safe-area-bottom', '34px') })
  const safe = await freeze_splash(visual_page)
  const safe_center = safe.safe[0] + (safe.root.height - safe.safe[0] - safe.safe[1]) / 2
  assert.ok(close(safe.content.center_y, safe_center))
  assert.ok(close(safe.brand.center_x, safe.root.center_x))
  assert.ok(close(safe.root.width, 393) && close(safe.root.height, 852))
  await visual_page.screenshot({ path: path.join(output, 'actual-browser-safe-area.png') })
  await visual_context.close()
  check('393x852 actual uses locked geometry, zero source padding, full-screen interaction, and deterministic motion')
  check('62/34 safe areas keep the source group centered inside the measured content region')

  report.comparison = await write_comparison(browser, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  assert.equal(report.comparison.width, 393); assert.equal(report.comparison.height, 852)
  check('reference, actual, overlay, and absolute diff were generated from one deterministic animation phase')

  const functional_context = await browser.newContext({ viewport: { width: 393, height: 852 } })
  const page = await functional_context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  const saved = () => page.evaluate(() => localStorage.getItem('cimoa_app_state_v2'))
  const write = data => page.evaluate(data => localStorage.setItem('cimoa_app_state_v2', typeof data === 'string' ? data : JSON.stringify({ type: 'object', data })), data)
  await page.goto(`${origin}/?splashFlow=guest#/pages/auth/splash`)
  await page.locator('.splash-page').waitFor(); await page.locator('.welcome-page').waitFor()
  assert.equal(await saved(), null)
  check('guest automatically reaches Welcome without writing a session')

  await write(create_scenario('default'))
  await page.goto(`${origin}/?splashFlow=valid#/pages/auth/splash`)
  await page.locator('.splash-page').waitFor()
  await page.locator('.splash-page').dblclick({ position: { x: 5, y: 5 } })
  await page.locator('.home-header').waitFor(); await page.waitForTimeout(1900)
  assert.match(page.url(), /pages\/home\/index$/)
  assert.equal(await page.locator('.main-tab-frame').getAttribute('data-page-depth'), '1')
  assert.equal(await page.locator('.main-skeleton').count(), 0)
  check('saved session restores Home once; top-safe-area double click and timer cannot duplicate navigation or skeletons')

  await write('{corrupt')
  await page.goto(`${origin}/?splashFlow=corrupt#/pages/auth/splash`)
  await page.getByRole('alert').waitFor()
  assert.equal(await saved(), '{corrupt')
  await write(create_scenario('default'))
  await page.locator('.splash-page').click({ position: { x: 5, y: 847 } })
  await page.locator('.home-header').waitFor()
  check('corrupt storage shows Retry, preserves bytes, and bottom-safe-area retry recovers after repair')
  assert.deepEqual(report.errors, [])
  await functional_context.close()
  report.result = 'passed'
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  report.cleaned_up = true
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  console.log('Splash visual preview and browser contexts closed.')
}
