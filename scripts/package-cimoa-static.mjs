// Conversion of a supplied standalone website, not the Vue / uni-app runtime.
// Resource extraction and DOM serialization are mechanical exports of the source.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { inspect, parseScript, visit, sha256 } from './lib/cimoa-website.mjs'

const input = path.resolve(process.argv[2] || '/Users/linqian/Downloads/Cimoa/index.html')
const output = path.resolve('artifacts/cimoa-static'), bundle = path.join(output, 'Cimoa'), publicDir = path.join(bundle, 'public')
const source = fs.readFileSync(input, 'utf8'), parsed = inspect(source), sourceHash = sha256(source)
const { chromium } = createRequire(import.meta.url)(process.env.CIMOA_BROWSER_MODULE || 'playwright')
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value) }
const save = (file, value) => write(path.join(publicDir, file), value)
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const domain = 'https://cimoabeam.online', pages = ['index', 'about', 'privacy', 'terms', 'support', 'safety', '404']
const languages = ['fr', 'en'], assetRecords = [], fontRecords = []
let assetNode
visit(parseScript(parsed.scripts[0][2]), node => { if (node.type === 'AssignmentExpression' && node.left?.object?.name === 'window' && node.left?.property?.name === 'CIMOA_ASSETS') assetNode = node.right })
assert.equal(assetNode?.type, 'ObjectExpression')
const assets = Object.fromEntries(assetNode.properties.map(property => {
  assert.equal(property.type, 'ObjectProperty'); assert.equal(property.value.type, 'StringLiteral')
  return [property.key.value, property.value.value]
}))
const decode = uri => { const match = uri.match(/^data:([^;,]+);base64,([\s\S]+)$/); assert.ok(match); return { mime: match[1], bytes: Buffer.from(match[2], 'base64') } }
fs.mkdirSync(output, { recursive: true })
const backup = path.join(output, `original-${sourceHash.slice(0, 12)}.html`)
if (!fs.existsSync(backup)) fs.copyFileSync(input, backup, fs.constants.COPYFILE_EXCL)
for (const [name, uri] of Object.entries(assets)) {
  assert.match(name, /^[\w.-]+\.(?:png|jpg|jpeg|webp)$/)
  const { mime, bytes } = decode(uri), file = 'assets/images/' + name
  save(file, bytes); assetRecords.push({ file, mime, bytes: bytes.length, sha256: sha256(bytes) })
}
let styles = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n')
styles = styles.replace(/data:([^;,"'\s)]+);base64,([A-Za-z\d+/=]+)/g, (uri, mime) => {
  assert.match(mime, /(?:font|woff|truetype|octet-stream)/)
  const { bytes } = decode(uri), ext = /woff2/.test(mime) ? 'woff2' : 'ttf', file = `assets/fonts/font-${sha256(bytes).slice(0, 16)}.${ext}`
  save(file, bytes)
  if (!fontRecords.some(row => row.file === file)) fontRecords.push({ file, mime, bytes: bytes.length, sha256: sha256(bytes) })
  return '../fonts/' + path.basename(file)
})
const fontFaces = [...styles.matchAll(/@font-face\s*\{[^}]+\}/g)].map(match => match[0])
save('assets/css/fonts.css', fontFaces.join('\n') + '\n')
save('assets/css/style.css', styles.replace(/@font-face\s*\{[^}]+\}/g, '') + '\n')
save('assets/css/assets.css', ':root{\n' + Object.keys(assets).map(name => `  --cimoa-${name.replaceAll('.', '-')}:url("../images/${name}");`).join('\n') + '\n}\n')
fs.copyFileSync('website/cimoa-static-source/static.css', path.join(publicDir, 'assets/css/static.css'))
fs.mkdirSync(path.join(publicDir, 'assets/js'), { recursive: true })
fs.copyFileSync('website/cimoa-static-source/main.js', path.join(publicDir, 'assets/js/main.js'))
const licenses = JSON.parse(parsed.scripts[2][2])
for (const [name, text] of Object.entries(licenses)) { assert.match(name, /^[\w.-]+\.txt$/); save('assets/licenses/' + name, text.replaceAll('\\r\\n', '\n').replaceAll('\\n', '\n')) }

const titles = {
  fr: { index: parsed.data.Hm.fr.pageTitle, about: 'À propos', privacy: 'Politique de confidentialité', terms: 'Conditions d’utilisation', support: 'Assistance', safety: 'Sécurité de la communauté', '404': 'Page introuvable' },
  en: { index: parsed.data.Hm.en.pageTitle, about: 'About Cimoa', privacy: 'Privacy Policy', terms: 'Terms of Use', support: 'Support', safety: 'Community Safety', '404': 'Page not found' }
}
const descriptions = {
  fr: { index: parsed.data.Hm.fr.description, about: 'Découvrez Cimoa, ses valeurs et ses contacts.', privacy: 'Consultez la politique de confidentialité de Cimoa et vos choix concernant les données personnelles.', terms: 'Consultez les conditions d’utilisation de Cimoa, les règles du service et les modalités de contact.', support: 'Obtenez de l’aide pour votre compte Cimoa, les présentations, la confidentialité et la sécurité.', safety: 'Découvrez les règles et les outils de sécurité de la communauté Cimoa.', '404': 'Cette page Cimoa est introuvable. Retrouvez l’accueil ou contactez l’assistance.' },
  en: { index: parsed.data.Hm.en.description, about: 'Learn about Cimoa, its values and contact details.', privacy: 'Read the Cimoa Privacy Policy and your choices about personal information.', terms: 'Read the Cimoa Terms of Use, service rules and contact options.', support: 'Get help with your Cimoa account, introductions, privacy and safety.', safety: 'Explore Cimoa community rules and safety tools.', '404': 'This Cimoa page could not be found. Return home or contact support.' }
}
const url = (lang, page) => `${domain}/${lang === 'en' ? 'en/' : ''}${page === 'index' ? '' : page + '.html'}`
const article = (lang, page) => {
  const g = parsed.data.Hm[lang], t = parsed.data.Xy[lang], french = lang === 'fr'
  let sections = []
  if (page === 'support') sections = [
    [french ? 'Nous contacter' : 'Contact us', t.contactText],
    ...g.faqs,
    [french ? 'Compte et confidentialité' : 'Account and privacy', french ? 'Dans l’application, ouvrez les paramètres pour gérer la confidentialité, les comptes bloqués ou la suppression de votre compte. Pour une demande relative à vos informations ou à l’accès au compte, contactez CimoaTeam@gmail.com. Ne transmettez jamais votre mot de passe ni de code de connexion.' : 'Open Settings in the app to manage privacy, blocked accounts or account deletion. For a request about your information or account access, contact CimoaTeam@gmail.com. Never share your password or sign-in code.']
  ]
  if (page === 'safety') sections = [
    ...g.safetyItems.map(row => [row.title, row.body]),
    [french ? 'Respect et consentement' : 'Respect and consent', french ? 'Cimoa s’adresse aux étudiants de 18 ans et plus. Le harcèlement, les menaces, la haine, l’exploitation sexuelle, l’usurpation d’identité et les contenus illégaux n’ont pas leur place ici. Une demande, une participation à un événement ou l’achat de pièces ne donne aucun droit sur une autre personne.' : 'Cimoa is for university students aged 18 and over. Harassment, threats, hate, sexual exploitation, impersonation and illegal content do not belong here. A request, event attendance or purchase of coins never creates an entitlement to another person.'],
    [french ? 'Signaler et bloquer' : 'Report and block', french ? 'Utilisez le signalement du profil, de la conversation ou de l’événement concerné et indiquez le contexte utile. Bloquez les comptes indésirables dans l’application. Vous pouvez aussi contacter CimoaTeam@gmail.com sans inclure d’informations privées inutiles. Un signalement ne garantit pas un résultat ni un délai précis.' : 'Use the reporting option for the relevant profile, conversation or event and include useful context. Block unwanted accounts in the app. You can also contact CimoaTeam@gmail.com without including unnecessary private information. Reporting does not guarantee a particular outcome or response time.'],
    [french ? 'Rencontres et événements' : 'Meeting and events', french ? 'Choisissez un lieu public, organisez votre propre transport et prévenez une personne de confiance. Un profil ou un badge ne garantit pas l’identité ni la sécurité d’une personne. Cimoa n’est pas un service d’urgence ; en cas de danger immédiat, contactez les services d’urgence de votre région.' : 'Choose a public place, arrange your own transport and let someone you trust know your plans. A profile or badge is not a guarantee of identity or personal safety. Cimoa is not an emergency service; if there is immediate danger, contact emergency services in your area.']
  ]
  if (page === '404') sections = [[french ? 'Retrouvez votre chemin' : 'Find your way back', descriptions[lang]['404']]]
  return `<article class="info-page legal-page"><a class="info-back" href="index.html">← ${esc(t.back)}</a><div class="info-heading"><p class="eyebrow">CIMOA</p><h1>${esc(titles[lang][page])}</h1><p class="info-intro">${esc(descriptions[lang][page])}</p></div><div class="legal-body">${sections.map(([title, body], index) => `<section id="section-${index + 1}"><h2><span>${String(index + 1).padStart(2, '0')}</span>${esc(title)}</h2><p>${esc(body)}</p></section>`).join('')}<section class="contact-card"><h2>${esc(t.contact)}</h2><p>${esc(t.contactText)}</p><div class="support-actions"><a href="mailto:CimoaTeam@gmail.com">CimoaTeam@gmail.com</a><a href="privacy.html">${esc(titles[lang].privacy)}</a><a href="terms.html">${esc(titles[lang].terms)}</a><a href="support.html">${esc(titles[lang].support)}</a><a href="safety.html">${esc(titles[lang].safety)}</a></div></section></div></article>`
}
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://cimoa-source.invalid') return route.abort()
    if (url.pathname === '/' || url.pathname === '/index.html') return route.fulfill({ contentType: 'text/html', body: source })
    const file = path.resolve(publicDir, '.' + url.pathname)
    if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2' }
    return route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  await page.goto('http://cimoa-source.invalid/')
  await page.locator('.meet-section').waitFor(); await page.evaluate(() => document.fonts.ready)
  for (const lang of languages) {
    await page.locator(`.header-actions .language [lang="${lang}"]`).click()
    await page.waitForFunction(lang => document.documentElement.lang === lang, lang)
    const home = async () => { await page.evaluate(() => { location.hash = '#home' }); await page.locator('.info-page').waitFor({ state: 'detached' }) }
    const panels = []
    await home()
    for (let i = 0; i < 3; i++) { await page.locator(`#tab-${i}`).click(); panels.push(await page.locator(`#panel-${i}`).evaluate(node => node.outerHTML)) }
    await page.locator('#tab-0').click()
    for (const name of pages) {
      if (['about', 'privacy', 'terms'].includes(name)) {
        await page.evaluate(name => { location.hash = '#/' + name }, name)
        await page.waitForFunction(name => {
          const current = document.querySelector('.info-page h1')?.textContent
          const link = [...document.querySelectorAll('footer a')].find(link => link.getAttribute('href') === '#/' + name)
          return !!current && current === link?.textContent
        }, name)
      }
      else await home()
      const html = await page.evaluate(({ lang, name, panels, custom, g, titleMap }) => {
        const root = document.querySelector('#root').cloneNode(true), main = root.querySelector('#main')
        const prefix = lang === 'en' ? '../' : ''
        if (['about', 'privacy', 'terms'].includes(name)) main.querySelector(':scope>div[hidden]')?.remove()
        else if (name !== 'index') main.innerHTML = custom
        else {
          const panel = main.querySelector('.feature-panel')
          panel.outerHTML = panels.join('')
          main.querySelectorAll('.feature-panel').forEach((node, index) => { node.hidden = index !== 0 })
        }
        const reverse = new Map(Object.entries(window.CIMOA_ASSETS).map(([name, src]) => [src, name]))
        root.querySelectorAll('img').forEach(image => {
          const asset = reverse.get(image.getAttribute('src')); if (!asset) throw Error('Unknown image in source export')
          image.setAttribute('src', prefix + 'assets/images/' + asset)
        })
        root.querySelectorAll('.scroll-reveal,.is-revealed').forEach(node => node.classList.remove('scroll-reveal', 'is-revealed'))
        root.querySelectorAll('a').forEach(link => {
          const href = link.getAttribute('href')
          if (/^#\/(about|privacy|terms)$/.test(href)) link.setAttribute('href', href.slice(2) + '.html')
          else if (/^#\/(privacy|terms)\/section-\d+$/.test(href)) link.setAttribute('href', '#legal-section-' + href.split('-').at(-1))
          else if (['#home', '#safety', '#students', '#faq', '#download', '#about'].includes(href)) {
            if (link.closest('.footer-bottom') && href === '#safety') link.setAttribute('href', 'safety.html')
            else if (name !== 'index') link.setAttribute('href', 'index.html' + href)
            if (link.closest('#main-nav')) { link.classList.toggle('active', name === 'index' && href === '#home'); if (name === 'index') link.dataset.section = href.slice(1) }
          }
          if (link.closest('#main-nav') && link.getAttribute('href') === 'about.html') link.classList.toggle('active', name === 'about')
        })
        const extra = document.createElement('a'); extra.href = 'support.html'; extra.textContent = titleMap.support
        root.querySelector('.footer-bottom .preview-note')?.before(extra)
        root.querySelectorAll('.language button').forEach(button => {
          button.dataset.languageUrl = button.lang === lang ? name + '.html' : (lang === 'en' ? '../' : 'en/') + name + '.html'
        })
        const menu = root.querySelector('.menu-toggle'); menu.dataset.openLabel = g.menu; menu.dataset.closeLabel = g.closeMenu
        const pause = root.querySelector('.meet-motion')
        if (pause) { pause.dataset.pauseLabel = lang === 'fr' ? 'Mettre l’animation en pause' : 'Pause animation'; pause.dataset.resumeLabel = lang === 'fr' ? 'Reprendre l’animation' : 'Resume animation' }
        root.querySelectorAll('.store-button').forEach(button => { button.dataset.openDownload = 'true' })
        const dialog = root.querySelector('dialog')
        if (dialog) {
          dialog.querySelector('.eyebrow').textContent = 'App Store'
          dialog.querySelector('#dialog-description').textContent = g.modalText.replace('{store}', 'App Store')
          dialog.querySelectorAll('.dialog-close,.primary-button').forEach(button => { button.dataset.closeDownload = 'true' })
        }
        return root.innerHTML
      }, { lang, name, panels, custom: ['support', 'safety', '404'].includes(name) ? article(lang, name) : '', g: parsed.data.Hm[lang], titleMap: titles[lang] })
      const prefix = lang === 'en' ? '../' : '', title = name === 'index' ? titles[lang][name] : titles[lang][name] + ' — Cimoa', canonical = url(lang, name)
      save((lang === 'en' ? 'en/' : '') + name + '.html', `<!doctype html>\n<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(descriptions[lang][name])}"><meta name="theme-color" content="#8250f2">${name === '404' ? '<meta name="robots" content="noindex,follow">' : `<link rel="canonical" href="${canonical}">`}<link rel="alternate" hreflang="fr" href="${url('fr', name)}"><link rel="alternate" hreflang="en" href="${url('en', name)}"><link rel="alternate" hreflang="x-default" href="${url('fr', name)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(descriptions[lang][name])}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${domain}/assets/images/logo.png"><meta property="og:locale" content="${lang === 'fr' ? 'fr_FR' : 'en_GB'}"><meta name="twitter:card" content="summary"><link rel="icon" type="image/png" href="${prefix}assets/images/logo.png"><link rel="apple-touch-icon" href="${prefix}assets/images/logo.png">${['fonts', 'style', 'assets', 'static'].map(file => `<link rel="stylesheet" href="${prefix}assets/css/${file}.css">`).join('')}<script src="${prefix}assets/js/main.js" defer></script></head><body data-page="${name}">${html}</body></html>\n`)
      console.log(`Exported ${lang}/${name}.html`)
    }
  }
  assert.deepEqual(errors, [], 'Source website runtime errors')
} finally { await browser?.close() }
save('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml\n`)
save('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${languages.flatMap(lang => pages.filter(name => name !== '404').map(name => `  <url><loc>${url(lang, name)}</loc></url>`)).join('\n')}\n</urlset>\n`)
fs.cpSync('website/cimoa-deploy', bundle, { recursive: true })
write(path.join(bundle, 'ASSET-MANIFEST.json'), JSON.stringify({ inputSha256: sourceHash, images: assetRecords, fonts: fontRecords, licenses: Object.keys(licenses), originalDesignPreserved: true, deployed: false }, null, 2) + '\n')
write(path.join(output, 'build-report.json'), JSON.stringify({ input, sourceHash, backup, bundle, publicDir, pages: 14, images: assetRecords.length, fonts: fontRecords.length, inlineMediaRemoved: true, serverStarted: false, appCodeChanged: false, deployed: false, legalReleaseApproved: false }, null, 2) + '\n')
console.log(JSON.stringify({ publicDir, pages: 14, images: assetRecords.length, fonts: fontRecords.length, deployed: false }))
