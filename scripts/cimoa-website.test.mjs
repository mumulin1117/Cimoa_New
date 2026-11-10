import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { root, inspect, content, preservedContent, sha256 } from './lib/cimoa-website.mjs'

const directory = path.join(root, 'artifacts/cimoa-website')
const report = JSON.parse(fs.readFileSync(path.join(directory, 'build-report.json'), 'utf8'))
const original = fs.readFileSync(report.backup, 'utf8')
const output = fs.readFileSync(report.output, 'utf8')
const generated = inspect(output)
const results = { static: [], browser: [], errors: [], completed: false }
const check = (section, label) => { results[section].push(label); console.log(`PASS ${label}`) }
const flatten = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(flatten) : []
const forbidden = /\b(?:demo|local\s+(?:data|demo|social)|draft)\b|本地数据|模拟数据|草稿|PAS ENCORE EN VIGUEUR/i

assert.equal(sha256(original), report.originalSha256)
assert.equal(sha256(output), report.outputSha256)
assert.deepEqual(preservedContent(output), preservedContent(original))
check('static', 'All original CSS, embedded images/fonts, favicon and license blocks are byte-identical')
assert.deepEqual(generated.data.gn, content.contact)
assert.match(output, /<html lang="fr">/)
assert.match(output, /rel="canonical" href="https:\/\/cimoabeam\.online\/"/)
check('static', 'Confirmed contact, canonical domain and French default are configured')
for (const lang of ['en', 'fr']) {
  const marketing = generated.data.Hm[lang]
  const legal = generated.data.Xy[lang]
  assert.equal(legal.terms.length, 9)
  assert.equal(legal.privacy.length, 10)
  assert.ok(marketing.freeText.includes('10'))
  assert.ok(legal.terms[3][1].includes('00:00 UTC') || legal.terms[3][1].includes('00 h 00 UTC'))
  assert.equal(forbidden.test(flatten({ marketing, legal }).join('\n')), false)
  assert.equal(/Google Play|video calls|appels vidéo|Student verification|Vérification étudiante/i.test(flatten({ marketing, legal }).join('\n')), false)
  assert.ok(legal.privacy.some(section => section[1].includes('www.cnil.fr/fr/plaintes')))
  check('static', `${lang}: formal content, adult eligibility, coin prices, privacy rights and no unsupported provider claims`)
}

let browser
try {
  if (process.argv.includes('--browser')) {
    const require = createRequire(import.meta.url)
    const { chromium } = require(process.env.CIMOA_BROWSER_MODULE || 'playwright')
    browser = await chromium.launch({ headless: true, channel: 'chrome' })
    console.log(`One-shot browser test PID ${process.pid}; file URL only, no preview server`)
    const deadline = setTimeout(() => { console.error('Browser verification exceeded 90 seconds'); process.exitCode = 1; void browser.close() }, 90000)
    try {
      for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 1440, height: 900 }]) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
        const page = await context.newPage()
        page.setDefaultTimeout(6000)
        page.on('pageerror', error => results.errors.push(error.message))
        const requests = []
        page.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()) })
        await page.goto(pathToFileURL(report.output).href)
        await page.locator('h1').waitFor()
        await page.evaluate(() => document.fonts.ready)
        assert.equal(await page.locator('html').getAttribute('lang'), 'fr')
        for (const lang of ['fr', 'en']) {
          await page.locator(`.language button[lang="${lang}"]`).first().click()
          assert.equal(await page.locator('html').getAttribute('lang'), lang)
          for (const route of ['home', 'about', 'terms', 'privacy']) {
            await page.evaluate(route => { location.hash = route === 'home' ? '#home' : `#/${route}` }, route)
            await page.locator(route === 'home' ? '.hero' : '.info-page').waitFor({ state: 'visible' })
            if (route !== 'home') {
              const title = { en: { about: 'About us', terms: 'Terms of service', privacy: 'Privacy policy' }, fr: { about: 'À propos de nous', terms: 'Conditions d’utilisation', privacy: 'Politique de confidentialité' } }[lang][route]
              await page.waitForFunction(title => document.querySelector('.info-page h1')?.textContent === title, title)
              assert.equal(await page.locator('.info-page h1').innerText(), title)
              assert.equal(await page.locator('a[href="mailto:CimoaTeam@gmail.com"]').count(), 1)
              assert.equal(await page.locator('.contact-card a[href="https://cimoabeam.online"]').count(), 1)
            }
            if (['terms', 'privacy'].includes(route)) {
              const total = route === 'terms' ? 9 : 10
              assert.equal(await page.locator('.legal-body > section[id^="legal-section-"]').count(), total)
              await page.locator(`.legal-contents a[href="#/${route}/section-${total}"]`).click()
              assert.equal(await page.locator(`#legal-section-${total}`).count(), 1)
              await page.waitForFunction(id => location.hash.endsWith(`/section-${id}`), total)
            }
            const text = await page.locator('body').innerText()
            assert.equal(forbidden.test(text), false, `${lang}/${route}: forbidden display copy`)
            assert.equal(/Google Play/.test(text), false)
            const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
            assert.ok(dimensions.scroll <= dimensions.width + 1, `${viewport.width}/${lang}/${route}: horizontal overflow`)
            if (viewport.width === 393 || (viewport.width === 1440 && lang === 'fr')) {
              await page.screenshot({ path: path.join(directory, `${lang}-${route}-${viewport.width}.png`) })
            }
            check('browser', `${viewport.width}px ${lang}/${route}: navigation, readable copy, links and no horizontal overflow`)
          }
          await page.evaluate(() => { location.hash = '#home' })
          await page.locator('.store-button').first().waitFor()
          assert.equal(await page.locator('.store-button strong').evaluateAll(elements => elements.every(element => element.textContent === 'App Store')), true)
          await page.locator('.store-button').first().click()
          await page.locator('dialog[open]').waitFor()
          assert.match(await page.locator('#dialog-description').innerText(), /CimoaTeam@gmail.com/)
          await page.locator('dialog .primary-button').click()
          await page.reload()
          await page.waitForFunction(lang => document.documentElement.lang === lang, lang)
          check('browser', `${viewport.width}px ${lang}: iOS availability dialog and saved language restore`)
        }
        assert.deepEqual(requests, [], 'Unexpected third-party network request')
        await context.close()
      }
      // A denied browser preference must not prevent first render.
      const context = await browser.newContext()
      await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw Error('Preference unavailable') } }) })
      const page = await context.newPage()
      await page.goto(pathToFileURL(report.output).href)
      await page.locator('h1').waitFor()
      assert.equal(await page.locator('html').getAttribute('lang'), 'fr')
      await context.close()
      check('browser', 'Unavailable browser preference falls back to French without blocking render')
      assert.deepEqual(results.errors, [])
    } finally { clearTimeout(deadline) }
  }
  results.completed = true
} finally {
  await browser?.close()
  fs.writeFileSync(path.join(directory, process.argv.includes('--browser') ? 'verification.json' : 'static-verification.json'), JSON.stringify(results, null, 2) + '\n')
}
