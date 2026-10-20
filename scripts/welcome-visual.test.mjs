// One-shot Welcome pixel evidence and browser behavior test. The source HTML
// is parsed as evidence but never served or loaded by the application.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { read_circa_source } from './lib/circa-source.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const root = path.resolve('dist/build/h5')
const output = path.resolve('docs/ui-restoration/welcome/copy-visibility-2026-10-20')
const source_folder = path.resolve('docs/ui-restoration/welcome/consent-2026-10-19')
const contract = JSON.parse(fs.readFileSync('docs/ui-restoration/welcome/source-contract.json', 'utf8'))
const revision = JSON.parse(fs.readFileSync(path.join(source_folder, 'source-contract.json'), 'utf8'))
const photo = fs.readFileSync(contract.photo.local_path)
const photo_data = `data:image/png;base64,${photo.toString('base64')}`
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'))
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(response)
})
const report = { phase: 'welcome-copy-visibility', result: 'failed', server_pid: process.pid, reference: {}, geometry: {}, comparison: {}, checks: [], errors: [], viewport_matrix: [] }
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const close = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance

function verify_source_lock() {
  const source = read_circa_source()
  const lines = source.template.split('\n')
  const visual = lines.slice(2511, 2525).join('\n')
  const behavior = contract.source.behavior_lines.map(line => lines[line - 1]).join('\n')
  assert.equal(source.source_hash, contract.source.file_sha256)
  assert.equal(hash(visual), contract.source.visual_fragment_sha256)
  assert.equal(hash(behavior), contract.source.behavior_fragment_sha256)
  assert.equal(hash(photo), contract.photo.sha256)
  assert.equal(hash(fs.readFileSync(path.join(source_folder, 'source.png'))), revision.primary_increment_source.sha256)
  report.reference = {
    kind: 'source-derived locked reference with approved brand and safe-area deltas',
    source_file_sha256: source.source_hash,
    visual_fragment_sha256: hash(visual),
    photo_sha256: hash(photo),
    entry_animation: 'finished',
  }
}

function source_reference_markup() {
  const { copy, footer, structure } = contract
  const markup = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,sans-serif;background:${structure.background};color:#0b1b3a}
.screen{position:absolute;inset:0}.photo{position:absolute;top:44px;left:4px;width:385px;height:360px;object-fit:cover;object-position:center top;border-radius:30px 30px 0 0;display:block;-webkit-mask-image:${contract.photo.mask};mask-image:${contract.photo.mask}}
.copy{position:absolute;top:448px;left:24px;right:24px;display:flex;flex-direction:column;align-items:center;text-align:center}.brand{font-size:${copy.brand.font_size_css_px}px;font-weight:${copy.brand.font_weight};letter-spacing:${copy.brand.letter_spacing};padding-left:${copy.brand.padding_left};color:${copy.brand.color};line-height:${copy.brand.line_height}}.title{font-size:${copy.title.font_size_css_px}px;font-weight:${copy.title.font_weight};letter-spacing:${copy.title.letter_spacing};line-height:${copy.title.line_height};color:${copy.title.color};margin-top:${copy.title.margin_top_css_px}px}.description{font-size:${copy.description.font_size_css_px}px;color:${copy.description.color};margin-top:${copy.description.margin_top_css_px}px;line-height:${copy.description.line_height};max-width:${copy.description.max_width_css_px}px;text-wrap:${copy.description.text_wrap}}
.footer{position:absolute;left:20px;right:20px;bottom:30px;display:flex;flex-direction:column;gap:12px;z-index:20}.create{height:${footer.create_account.height_css_px}px;border-radius:${footer.create_account.border_radius_css_px}px;background:${footer.create_account.gradient};display:flex;align-items:center;justify-content:center;gap:${footer.create_account.gap_css_px}px;box-shadow:${footer.create_account.shadow};font-size:${footer.create_account.font_size_css_px}px;font-weight:${footer.create_account.font_weight};color:#fff}.create svg{width:18px;height:18px}.login{height:${footer.login.height_css_px}px;border-radius:${footer.login.border_radius_css_px}px;background:${footer.login.background};box-shadow:${footer.login.shadow};display:flex;align-items:center;justify-content:center;font-size:${footer.login.font_size_css_px}px;font-weight:${footer.login.font_weight};color:${footer.login.color}}.legal{text-align:center;margin-top:${footer.legal.margin_top_css_px}px;font-size:${footer.legal.font_size_css_px}px;color:${footer.legal.color};line-height:${footer.legal.line_height}}.legal span{color:${footer.legal.link_color};font-weight:${footer.legal.link_weight};text-decoration:underline}
</style></head><body><div class="screen"><img class="photo" src="${photo_data}" alt="${contract.photo.alt}"><div class="copy"><div class="brand">${copy.brand.approved_copy}</div><div class="title">${copy.title.copy}</div><div class="description">${copy.description.copy}</div></div><div class="footer"><div class="create">${footer.create_account.copy}<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></div><div class="login">${footer.login.copy}</div><div class="legal">By continuing, you agree to our <span>Terms</span> and <span>Privacy Policy</span>.</div></div></div></body></html>`
  return markup.replace('</style>', '.consent{display:flex;align-items:center;gap:12px}.consent-check{display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;border:1px solid #0b1b3a;border-radius:2px;background:#0b1b3a;color:#fff}.consent-check svg{width:20px;height:20px}.consent-copy{min-width:0;font-size:12.25px;line-height:1.4;letter-spacing:-.005em;color:#7478a8}.consent-copy span{color:#0b1b3a}</style>').replace('<div class="legal">', '<div class="consent"><div class="consent-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6" /></svg></div><div class="consent-copy">I agree to the <span>Terms</span> and <span>Privacy Policy</span>.</div></div><div class="legal">')
}

async function set_safe_area(page, top, bottom) {
  await page.evaluate(({ top, bottom }) => {
    document.documentElement.style.setProperty('--native-safe-area-top', `${top}px`)
    document.documentElement.style.setProperty('--native-safe-area-bottom', `${bottom}px`)
  }, { top, bottom })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function freeze_welcome(page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    for (const animation of document.getAnimations()) animation.finish()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom, center_x: rect.x + rect.width / 2 }
    }
    const image = document.querySelector('.welcome-photo .uni-image-element, .welcome-photo img') || document.querySelector('.welcome-photo')
    const copy_visibility = ['.welcome-brand', '.welcome-title', '.welcome-description'].map(selector => {
      const element = document.querySelector(selector), rect = element.getBoundingClientRect(), clips = []
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect()
        if (/(hidden|auto|scroll|clip)/.test(style.overflowY) && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) clips.push(parent.className)
      }
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return { selector, clips, above_create: rect.bottom <= document.querySelector('.welcome-create').getBoundingClientRect().top, inside_viewport: rect.top >= 0 && rect.bottom <= innerHeight, hit_visible: hit === element || element.contains(hit), font_size: getComputedStyle(element).fontSize }
    })
    return {
      viewport: { width: innerWidth, height: innerHeight },
      root: box('.welcome-page'), photo: box('.welcome-photo-region'), copy: box('.welcome-copy'),
      brand: box('.welcome-brand'), title: box('.welcome-title'), description: box('.welcome-description'),
      create: box('.welcome-create'), login: box('.welcome-login'), legal: box('.welcome-legal'),
      consent: box('.welcome-consent'), checkbox: box('.welcome-consent-toggle'), consent_copy: box('.welcome-consent-copy'),
      consent_text: document.querySelector('.welcome-consent-copy').textContent,
      consent_font: getComputedStyle(document.querySelector('.welcome-consent-copy')).fontSize,
      safe: [...document.querySelectorAll('.welcome-page > .safe-area')].map(element => element.getBoundingClientRect().height),
      image_object_position: image ? getComputedStyle(image).objectPosition : null,
      image_style_target: image ? `${image.tagName.toLowerCase()}.${image.className}` : null,
      image_status_visible: !!document.querySelector('.welcome-photo-status'),
      copy_visibility,
      copy_text: {
        brand: document.querySelector('.welcome-brand').textContent,
        title: document.querySelector('.welcome-title').textContent,
        description: document.querySelector('.welcome-description').textContent,
        create: document.querySelector('.welcome-create').textContent.trim(),
        login: document.querySelector('.welcome-login').textContent.trim(),
        legal: document.querySelector('.welcome-legal').textContent.replace(/\s+/g, ' ').trim(),
      },
    }
  })
}

async function write_comparison(browser, reference_path, actual_path, prefix = '') {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  const encoded = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
  const result = await page.evaluate(async ({ reference, actual }) => {
    const load = source => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source })
    const [firstImage, secondImage] = await Promise.all([load(reference), load(actual)])
    const canvas = document.createElement('canvas'); canvas.width = firstImage.width; canvas.height = firstImage.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(firstImage, 0, 0); const first = context.getImageData(0, 0, canvas.width, canvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(secondImage, 0, 0); const second = context.getImageData(0, 0, canvas.width, canvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(firstImage, 0, 0); context.globalAlpha = .5; context.drawImage(secondImage, 0, 0); context.globalAlpha = 1
    const overlay = canvas.toDataURL('image/png')
    const diff = context.createImageData(canvas.width, canvas.height); let exact = 0, above8 = 0, sum = 0, max = 0
    for (let index = 0; index < first.data.length; index += 4) {
      const channels = [0, 1, 2, 3].map(offset => Math.abs(first.data[index + offset] - second.data[index + offset]))
      const delta = Math.max(...channels); if (delta > 0) exact += 1; if (delta > 8) above8 += 1; sum += channels.reduce((total, value) => total + value, 0); max = Math.max(max, delta)
      diff.data[index] = Math.min(255, channels[0] * 4); diff.data[index + 1] = Math.min(255, channels[1] * 4); diff.data[index + 2] = Math.min(255, channels[2] * 4); diff.data[index + 3] = 255
    }
    context.putImageData(diff, 0, 0)
    return { overlay, diff: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, pixels_different: exact, pixels_above_channel_delta_8: above8, mean_absolute_channel_delta: sum / first.data.length, max_channel_delta: max }
  }, { reference: encoded(reference_path), actual: encoded(actual_path) })
  const decode = value => Buffer.from(value.slice(value.indexOf(',') + 1), 'base64')
  fs.writeFileSync(path.join(output, prefix + 'overlay.png'), decode(result.overlay))
  fs.writeFileSync(path.join(output, prefix + 'diff.png'), decode(result.diff))
  await page.close(); delete result.overlay; delete result.diff
  return result
}

let browser
try {
  verify_source_lock()
  fs.mkdirSync(output, { recursive: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.CIMOA_BROWSER_CHANNEL ? { channel: process.env.CIMOA_BROWSER_CHANNEL } : {}) })

  const reference = await browser.newContext({ viewport: { width: 393, height: 852 } })
  const reference_page = await reference.newPage(); await reference_page.setContent(source_reference_markup()); await reference_page.locator('.photo').waitFor()
  await reference_page.screenshot({ path: path.join(output, 'reference.png') }); await reference.close()

  const visual = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await visual.addInitScript(() => { localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state') })
  const page = await visual.newPage(); page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(`${origin}/?welcomePixel=default#/pages/auth/welcome`); await page.locator('.welcome-photo-status').waitFor({ state: 'detached' }); await set_safe_area(page, 44, 0)
  assert.equal(await page.getByRole('checkbox').getAttribute('aria-checked'), 'false')
  await page.getByRole('checkbox').click()
  report.geometry = await freeze_welcome(page)
  assert.deepEqual(report.geometry.viewport, { width: 393, height: 852 }); assert.deepEqual(report.geometry.safe, [44, 0])
  assert.ok(close(report.geometry.photo.x, 4)); assert.ok(close(report.geometry.photo.y, 44)); assert.ok(close(report.geometry.photo.width, 385)); assert.ok(close(report.geometry.photo.height, 360))
  assert.ok(close(report.geometry.copy.y, 448)); assert.ok(close(report.geometry.create.x, 20)); assert.ok(close(report.geometry.create.height, 60)); assert.ok(close(report.geometry.login.height, 56)); assert.ok(close(report.geometry.legal.bottom, 822, 2))
  assert.ok(close(report.geometry.checkbox.width, 24)); assert.ok(close(report.geometry.checkbox.height, 24)); assert.ok(close(report.geometry.consent.y - report.geometry.login.bottom, 12)); assert.ok(close(report.geometry.consent_copy.x - report.geometry.checkbox.right, 12)); assert.ok(close(parseFloat(report.geometry.consent_font), revision.geometry_css_px.consent_font, .1)); assert.equal(report.geometry.consent_text, revision.copy.consent)
  assert.ok(['50% 0%', 'center top'].includes(report.geometry.image_object_position)); assert.equal(report.geometry.image_status_visible, false)
  for (const row of report.geometry.copy_visibility) { assert.deepEqual(row.clips, []); assert.equal(row.above_create && row.inside_viewport && row.hit_visible, true) }
  assert.deepEqual(report.geometry.copy_text, {
    brand: 'Cimoa', title: contract.copy.title.copy, description: contract.copy.description.copy,
    create: contract.footer.create_account.copy, login: contract.footer.login.copy, legal: contract.footer.legal.copy,
  })
  await page.screenshot({ path: path.join(output, 'actual-browser.png') }); await visual.close()
  check('393x852 actual restores source geometry, copy, local media, center-top crop and finished cRise frame')

  report.comparison = await write_comparison(browser, path.join(output, 'reference.png'), path.join(output, 'actual-browser.png'))
  assert.equal(report.comparison.width, 393); assert.equal(report.comparison.height, 852)
  check('reference, actual, overlay and absolute diff were generated from one locked source state')
  const provided_page = await browser.newPage()
  const provided = await provided_page.evaluate(async data => { const image = new Image(); image.src = data; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = 393; canvas.height = 852; canvas.getContext('2d').drawImage(image, 0, 0, 786, 1704, 0, 0, 393, 852); return { width: image.width, height: image.height, png: canvas.toDataURL('image/png') } }, `data:image/png;base64,${fs.readFileSync(path.join(source_folder, 'source.png')).toString('base64')}`)
  assert.equal(provided.width, 786); assert.ok(provided.height >= 1704); fs.writeFileSync(path.join(output, 'provided-reference.png'), Buffer.from(provided.png.split(',')[1], 'base64')); await provided_page.close()
  report.provided_comparison = await write_comparison(browser, path.join(output, 'provided-reference.png'), path.join(output, 'actual-browser.png'), 'provided-')
  report.provided_comparison.exclusions = 'Source CIRCA versus approved Cimoa brand; screenshot status bar/EUL/home indicator versus measured app safe areas; original PNG raster/font rendering. No claim of whole-screen pixel equality.'

  const safe_context = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await safe_context.addInitScript(() => { localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state') })
  const safe_page = await safe_context.newPage(); await safe_page.goto(`${origin}/?welcomePixel=safe#/pages/auth/welcome`); await safe_page.locator('.welcome-photo-status').waitFor({ state: 'detached' }); await set_safe_area(safe_page, 62, 34); const initial_safe = await freeze_welcome(safe_page)
  const safe_scroller = safe_page.locator('.secondary-page-scroll .uni-scroll-view').last()
  const safe_scroll_before = await safe_scroller.evaluate(element => ({ client_height: element.clientHeight, scroll_height: element.scrollHeight, scroll_top: element.scrollTop }))
  const safe_footer_before = await safe_page.locator('.welcome-footer').boundingBox()
  for (const row of initial_safe.copy_visibility) { assert.deepEqual(row.clips, []); assert.equal(row.above_create && row.inside_viewport && row.hit_visible, true) }
  assert.equal(safe_scroll_before.scroll_top, 0); assert.ok(initial_safe.photo.height > 0 && initial_safe.photo.height < 360)
  await safe_page.screenshot({ path: path.join(output, 'actual-browser-safe-area.png') })
  await safe_scroller.evaluate(element => { element.scrollTop = element.scrollHeight })
  const safe_scrolled = await freeze_welcome(safe_page)
  const safe_scroll_after = await safe_scroller.evaluate(element => ({ scroll_top: element.scrollTop }))
  const safe_footer_after = await safe_page.locator('.welcome-footer').boundingBox()
  assert.ok(safe_scroll_after.scroll_top <= 1); assert.deepEqual(safe_footer_after, safe_footer_before)
  assert.ok(safe_scrolled.description.bottom <= safe_footer_after.y + 1)
  await safe_page.screenshot({ path: path.join(output, 'actual-browser-safe-area-scrolled.png') }); await safe_context.close()
  check('62/34 safe areas show all original copy above Create Account on first entry without scrolling or changing font sizes')

  const matrix_context = await browser.newContext(), matrix_page = await matrix_context.newPage()
  for (const [width, height, top, bottom] of [[320,568,20,0],[320,568,62,34],[375,667,20,0],[375,812,44,34],[390,844,47,34],[402,874,62,34],[414,896,48,34],[430,932,59,34],[440,956,62,34]]) {
    await matrix_page.setViewportSize({ width, height }); await matrix_page.goto(`${origin}/?welcomeViewport=${width}-${height}-${top}#/pages/auth/welcome`); await matrix_page.locator('.welcome-photo-status').waitFor({ state: 'detached' }); await set_safe_area(matrix_page, top, bottom)
    const geometry = await freeze_welcome(matrix_page)
    for (const row of geometry.copy_visibility) { assert.deepEqual(row.clips, [], `${width}x${height} ${row.selector}`); assert.equal(row.above_create && row.inside_viewport && row.hit_visible, true) }
    assert.ok(geometry.photo.height > 0); assert.ok(geometry.legal.bottom <= height - bottom); assert.equal(await matrix_page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    report.viewport_matrix.push({ width, height, safe: [top, bottom], photo_height: geometry.photo.height, visibility: geometry.copy_visibility })
    await matrix_page.screenshot({ path: path.join(output, `actual-${width}x${height}-${top}-${bottom}.png`) })
  }
  await matrix_context.close(); check('Nine iPhone viewport/safe-area combinations keep brand, heading and full description initially visible with no clipping or overlap')

  const flow = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await flow.addInitScript(() => { localStorage.removeItem('cimoa_app_state_v2'); localStorage.removeItem('cimoa_app_state') })
  const flow_page = await flow.newPage(); await flow_page.goto(`${origin}/?welcomePixel=flows#/pages/auth/welcome`); await flow_page.locator('.welcome-photo-status').waitFor({ state: 'detached' })
  const checkbox = flow_page.getByRole('checkbox'), auth_entries = ['welcome.goAge.click.1', 'welcome.goLogin.click.1']
  assert.equal(await checkbox.getAttribute('aria-checked'), 'false')
  for (const id of auth_entries) { const entry = flow_page.locator(`[data-interaction="${id}"]`); assert.equal(await entry.getAttribute('aria-disabled'), 'true'); await entry.evaluate(e => e.click()); await flow_page.getByRole('alert').waitFor(); assert.match(flow_page.url(), /#\/pages\/auth\/welcome$/) }
  assert.equal(await flow_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null)
  check('Unchecked Welcome blocks both auth entries with explicit validation and no business writes')
  for (const [id, destination] of [['welcome.consent.openTerms.click.1', '.legal-terms-page'], ['welcome.consent.openPrivacy.click.1', '.legal-privacy-page'], ['welcome.openTerms.click.1', '.legal-terms-page'], ['welcome.openPrivacy.click.1', '.legal-privacy-page']]) {
    await flow_page.locator(`[data-interaction="${id}"]`).click(); await flow_page.locator(destination).waitFor(); await flow_page.getByRole('button', { name: 'Back', exact: true }).click(); await flow_page.locator('.welcome-page').waitFor(); assert.equal(await checkbox.getAttribute('aria-checked'), 'false')
  }
  check('All four policy links work while unchecked and never infer or toggle consent')
  await checkbox.focus(); await checkbox.press('Space'); assert.equal(await checkbox.getAttribute('aria-checked'), 'true'); assert.equal(await flow_page.getByRole('alert').count(), 0)
  await checkbox.press('Enter'); assert.equal(await checkbox.getAttribute('aria-checked'), 'false'); await checkbox.press('Space')
  check('Space and Enter toggle one shared consent choice immediately and clear validation without Loading')
  const routes = [
    ['welcome.goAge.click.1', '.age-page', true], ['welcome.goLogin.click.1', '.login-page', false],
    ['welcome.openTerms.click.1', '.legal-terms-page', false], ['welcome.openPrivacy.click.1', '.legal-privacy-page', false],
  ]
  for (const [interaction, destination, double] of routes) {
    const entry = flow_page.locator(`[data-interaction="${interaction}"]`)
    if (double) await entry.dblclick(); else await entry.click()
    await flow_page.locator(destination).waitFor(); assert.equal(await flow_page.locator(destination).getAttribute('data-page-depth'), '2')
    await flow_page.getByRole('button', { name: 'Back', exact: true }).click(); await flow_page.locator('.welcome-page').waitFor()
    assert.equal(await checkbox.getAttribute('aria-checked'), 'true')
  }
  assert.equal(await flow_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null)
  check('Create Account double click and the other three source entries navigate once, return to Welcome and write no account data')
  await checkbox.click(); for (const id of auth_entries) { await flow_page.locator(`[data-interaction="${id}"]`).evaluate(e => e.click()); await flow_page.getByRole('alert').waitFor(); assert.match(flow_page.url(), /#\/pages\/auth\/welcome$/) }
  check('Unchecking again closes both auth paths after returning from Login or Age')

  await flow_page.route('**/*welcome-campus*.png', route => route.fulfill({ status: 404 }))
  await flow_page.reload(); await flow_page.getByRole('button', { name: 'Retry photo' }).waitFor(); await flow_page.getByRole('button', { name: 'Retry photo' }).click(); await flow_page.getByRole('button', { name: 'Retry photo' }).waitFor()
  await flow_page.unroute('**/*welcome-campus*.png'); await flow_page.getByRole('button', { name: 'Retry photo' }).click(); await flow_page.locator('.welcome-photo-status').waitFor({ state: 'detached' })
  assert.equal(await flow_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null)
  check('local campus-image failure is explicit and Retry reloads the original extracted asset without fake success')

  await flow_page.setViewportSize({ width: 320, height: 568 }); await set_safe_area(flow_page, 62, 34)
  const footer_before = await flow_page.locator('.welcome-footer').boundingBox()
  await flow_page.locator('.secondary-page-scroll .uni-scroll-view').last().evaluate(element => { element.scrollTop = element.scrollHeight })
  const footer_after = await flow_page.locator('.welcome-footer').boundingBox(); assert.deepEqual(footer_after, footer_before); assert.ok(footer_after.y >= 0 && footer_after.y + footer_after.height <= 568)
  await flow_page.screenshot({ path: path.join(output, 'actual-browser-small.png') })
  await flow_page.reload(); await flow_page.locator('.welcome-photo-status').waitFor({ state: 'detached' }); assert.equal(await flow_page.evaluate(() => localStorage.getItem('cimoa_app_state_v2')), null)
  assert.equal(await checkbox.getAttribute('aria-checked'), 'false'); assert.equal(await flow_page.locator('[data-interaction="welcome.goLogin.click.1"]').getAttribute('aria-disabled'), 'true'); assert.equal(await flow_page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  check('320x568 scroll, fixed footer, safe areas and refresh recovery preserve the guest state')
  await flow.close()

  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} catch (error) {
  report.errors.push(error.stack || error.message); throw error
} finally {
  await browser?.close().catch(() => {})
  await new Promise(resolve => server.close(resolve)); report.cleaned_up = true
  fs.writeFileSync(path.join(output, 'browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
}
