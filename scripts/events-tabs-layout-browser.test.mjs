import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { create_scenario } from '../src/stores/scenarios.js'

const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || '/Users/linqian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const root = path.resolve('dist/build/h5'), origin = 'http://127.0.0.1:47913'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const locale of ['en-US', 'fr-FR']) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale, isMobile: true, hasTouch: true })
    try {
      const page = await context.newPage(), errors = []
      page.setDefaultTimeout(8000)
      page.on('pageerror', error => errors.push(error.message))
      await page.route(`${origin}/**`, async route => {
        const url = new URL(route.request().url())
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        await route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
      })
      await page.addInitScript(data => {
        if (!localStorage.getItem('cimoa_app_state_v2')) localStorage.setItem('cimoa_app_state_v2', JSON.stringify({ type: 'object', data }))
      }, create_scenario('default', Date.now()))
      await page.goto(origin + '/#/pages/events/index')
      await page.locator('.events-chip').first().waitFor()
      await page.waitForFunction(value => document.documentElement.lang === value, locale)
      for (const width of [320, 375, 393, 440]) {
        await page.setViewportSize({ width, height: 852 })
        const metrics = await page.locator('.events-tabs').evaluate(node => {
          const labels = [...node.querySelectorAll('.events-chip-label')].map(label => {
            const range = document.createRange()
            range.selectNodeContents(label)
            return { text: label.textContent, lines: [...range.getClientRects()].map(rect => rect.top), fits: label.scrollWidth <= label.parentElement.clientWidth, nowrap: getComputedStyle(label).whiteSpace }
          })
          return { labels, overflow: document.documentElement.scrollWidth > innerWidth, singleRow: new Set([...node.children].map(chip => chip.getBoundingClientRect().top)).size === 1 }
        })
        assert.equal(metrics.labels.length, 3)
        assert.ok(metrics.singleRow && !metrics.overflow, JSON.stringify(metrics))
        for (const label of metrics.labels) assert.ok(new Set(label.lines).size === 1 && label.fits && label.nowrap === 'nowrap', JSON.stringify(label))
        const last = page.locator('.events-chip').last()
        await last.scrollIntoViewIfNeeded()
        await last.click()
        await page.waitForFunction(() => document.querySelector('.events-chip:last-child').getAttribute('aria-pressed') === 'true')
        console.log(`PASS ${locale} ${width}: single-line labels, no page overflow, final category reachable`)
      }
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
} finally { await browser.close() }
