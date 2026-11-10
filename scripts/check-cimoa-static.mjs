// One-shot, offline checks for the standalone public website, not the uni-app runtime.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const repository = path.resolve(import.meta.dirname, '..')
const publicRoot = path.resolve(process.argv[2] || path.join(repository, 'artifacts/cimoa-static/Cimoa/public'))
const reportPath = path.join(repository, 'artifacts/cimoa-static/static-report.json')
const origin = 'https://cimoabeam.online'
const names = ['index', 'about', 'privacy', 'terms', 'support', 'safety', '404']
const expectedPages = ['', 'en/'].flatMap(prefix => names.map(name => `${prefix}${name}.html`))
const errors = []
const warnings = []
const checkedReferences = new Set()
const checkedAnchors = new Set()
const documents = new Map()
let checkCount = 0

function check(condition, message) {
  checkCount++
  if (!condition) errors.push(message)
  return condition
}

function decode(value = '') {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[entity.toLowerCase()] || match
  })
}

function attributes(source) {
  return Object.fromEntries([...source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)]
    .map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4] ?? '')]))
}

function tags(html) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1>/gi, '<$1$2></$1>')
  return [...markup.matchAll(/<([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)]
    .map(match => ({ name: match[1].toLowerCase(), attrs: attributes(match[2]) }))
}

function readable(html) {
  return decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function documentFor(relative) {
  if (documents.has(relative)) return documents.get(relative)
  const filename = path.join(publicRoot, relative)
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return null
  const html = fs.readFileSync(filename, 'utf8')
  const elements = tags(html)
  const document = { html, elements, ids: new Set(elements.flatMap(tag => tag.attrs.id ? [tag.attrs.id] : [])) }
  documents.set(relative, document)
  return document
}

function pageUrl(relative) {
  return `${origin}/${relative.replace(/(^|\/)index\.html$/, '$1')}`
}

function targetFile(url) {
  const pathname = decodeURIComponent(url.pathname)
  const filename = path.resolve(publicRoot, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`)
  if (!filename.startsWith(`${publicRoot}${path.sep}`)) return null
  return filename
}

function checkReference(raw, from, context, anchor = false) {
  if (!raw || raw === '#') return
  const value = decode(raw.trim())
  const key = `${from}|${context}|${value}`
  if (checkedReferences.has(key)) return
  checkedReferences.add(key)
  if (!check(!/^(?:file|blob|javascript):/i.test(value), `${from}: forbidden ${context} protocol`)) return
  if (!check(!/(?:localhost|127\.0\.0\.1|\[::1\]|\.local(?:[/:]|$)|preview)/i.test(value), `${from}: development or preview ${context} link`)) return
  if (!check(!/^data:/i.test(value), `${from}: inline data ${context} must be an external asset`)) return
  if (/^(?:mailto|tel):/i.test(value)) return
  let url
  try { url = new URL(value, `${origin}/${from}`) }
  catch { check(false, `${from}: malformed ${context} URL`); return }
  if (!check(['https:', 'http:'].includes(url.protocol), `${from}: unsupported ${context} protocol`)) return
  if (url.origin !== origin) {
    check(url.protocol === 'https:', `${from}: external ${context} must use HTTPS`)
    return
  }
  if (!check(!/^#\/(?:privacy|terms|support|safety)(?:\/|$)/i.test(url.hash), `${from}: legal/support/safety link uses a hash route`)) return
  let filename
  try { filename = targetFile(url) }
  catch { check(false, `${from}: malformed encoded ${context} path`); return }
  if (!check(!!filename, `${from}: ${context} escapes public root`)) return
  const exists = fs.existsSync(filename) && fs.statSync(filename).isFile()
  const relative = path.relative(publicRoot, filename).split(path.sep).join('/')
  if (!check(exists, `${from}: missing ${context} target ${relative}`)) return
  if (!check(fs.realpathSync(filename).startsWith(`${fs.realpathSync(publicRoot)}${path.sep}`), `${from}: ${context} symlink escapes public root`)) return
  if (anchor && url.hash && /\.html$/i.test(filename)) {
    const anchorKey = `${relative}|${url.hash}`
    if (checkedAnchors.has(anchorKey)) return
    checkedAnchors.add(anchorKey)
    let id
    try { id = decodeURIComponent(url.hash.slice(1)) }
    catch { check(false, `${from}: malformed fragment encoding`); return }
    check(documentFor(relative)?.ids.has(id), `${from}: missing anchor ${relative}#${id}`)
  }
}

function checkCss(css, relative) {
  check(!/data:(?:image|audio|video|font|application\/(?:font|x-font))[^,]*;base64,/i.test(css), `${relative}: base64 media is embedded`)
  for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi)) {
    checkReference(match[1] ?? match[2] ?? match[3], relative, 'CSS url')
  }
  for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi)) checkReference(match[1], relative, 'CSS import')
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      check(false, `${path.relative(publicRoot, filename)}: symbolic links are not portable deployment files`)
      return []
    }
    return entry.isDirectory() ? walk(filename) : [filename]
  })
}

const pageSummaries = []
if (check(fs.existsSync(publicRoot) && fs.statSync(publicRoot).isDirectory(), 'The public website directory does not exist')) {
  for (const relative of expectedPages) {
    const document = documentFor(relative)
    if (!check(!!document, `Missing standalone HTML page ${relative}`)) continue
    const { html, elements } = document
    const is404 = /(?:^|\/)404\.html$/.test(relative)
    const language = relative.startsWith('en/') ? 'en' : 'fr'
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || ''
    const headTags = tags(head)
    const metas = Object.fromEntries(headTags.filter(tag => tag.name === 'meta')
      .map(tag => [tag.attrs.name || tag.attrs.property, tag.attrs.content || '']))
    const links = headTags.filter(tag => tag.name === 'link')
    const canonical = links.filter(tag => tag.attrs.rel?.split(/\s+/).includes('canonical'))
    const title = readable(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ''
    const bodyText = readable(body)
    check(/^\s*<!doctype html>/i.test(html), `${relative}: missing HTML5 doctype`)
    check(elements.find(tag => tag.name === 'html')?.attrs.lang?.toLowerCase().split('-')[0] === language, `${relative}: incorrect html language`)
    check(!!head && !!body && /<\/html>\s*$/i.test(html), `${relative}: document structure is incomplete`)
    check(title.length >= 5 && /Cimoa/i.test(title), `${relative}: title must identify Cimoa`)
    check(metas.description?.trim().length >= 30, `${relative}: description is missing or too short`)
    check(h1s.length === 1 && readable(h1s[0][1]).length > 0, `${relative}: expected exactly one readable H1`)
    check(bodyText.length >= (is404 ? 40 : 200), `${relative}: readable content is missing from raw HTML`)
    check(/<main\b/i.test(body), `${relative}: static main content is missing`)
    check(!/<(?:div|main)\b[^>]*\bid=["']root["'][^>]*>\s*<\/(?:div|main)>/i.test(body), `${relative}: empty client-rendered root`)
    check(!/data:(?:image|audio|video|font|application\/(?:font|x-font))[^,]*;base64,/i.test(html), `${relative}: base64 media is embedded`)
    check(!/<base\b/i.test(head), `${relative}: base tag may hide broken relative deployment links`)
    if (is404) {
      check(/(?:^|[,\s])noindex(?:$|[,\s])/i.test(metas.robots || ''), `${relative}: 404 must have noindex`)
      if (canonical.length) check(canonical.length === 1 && canonical[0].attrs.href === pageUrl(relative), `${relative}: unexpected 404 canonical`)
    } else check(canonical.length === 1 && canonical[0].attrs.href === pageUrl(relative), `${relative}: incorrect canonical URL`)
    for (const locale of ['fr', 'en']) {
      const counterpart = locale === 'fr' ? relative.replace(/^en\//, '') : `en/${relative.replace(/^en\//, '')}`
      const alternate = links.filter(tag => tag.attrs.rel === 'alternate' && tag.attrs.hreflang === locale)
      check(alternate.length === 1 && alternate[0].attrs.href === pageUrl(counterpart), `${relative}: incorrect ${locale} hreflang`)
    }
    for (const property of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']) {
      check(!!metas[property]?.trim(), `${relative}: missing ${property}`)
    }
    check(metas['og:url'] === pageUrl(relative), `${relative}: og:url does not match page URL`)
    if (metas['og:image']) checkReference(metas['og:image'], relative, 'OG image')
    for (const tag of elements) {
      for (const name of Object.keys(tag.attrs)) check(!/^on[a-z]+$/i.test(name), `${relative}: inline event handler ${name}`)
      if (tag.attrs.href) checkReference(tag.attrs.href, relative, `${tag.name} href`, tag.name === 'a')
      if (tag.attrs.src) checkReference(tag.attrs.src, relative, `${tag.name} src`)
      if (tag.attrs.poster) checkReference(tag.attrs.poster, relative, `${tag.name} poster`)
      if (tag.attrs.srcset) for (const source of tag.attrs.srcset.split(',')) checkReference(source.trim().split(/\s+/)[0], relative, `${tag.name} srcset`)
      if (tag.attrs.style) checkCss(tag.attrs.style, relative)
    }
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = attributes(match[1])
      const inert = /^(?:application\/(?:ld\+json|json)|importmap)$/i.test(attrs.type || '')
      check(inert || match[2].trim().length <= 1024, `${relative}: large inline executable JavaScript`)
      check(!/ReactDOM|react\.production|react-dom|__REACT|createRoot\s*\(/.test(match[2]), `${relative}: React runtime is embedded`)
    }
    for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) checkCss(match[1], relative)
    pageSummaries.push({ path: relative, language, title, readable_characters: bodyText.length, bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex') })
  }

  const files = walk(publicRoot)
  for (const filename of files) {
    const relative = path.relative(publicRoot, filename).split(path.sep).join('/')
    if (/\.css$/i.test(filename)) checkCss(fs.readFileSync(filename, 'utf8'), relative)
    if (/\.(?:js|mjs)$/i.test(filename)) {
      const code = fs.readFileSync(filename, 'utf8')
      check(!/ReactDOM|react\.production|react-dom|__REACT|createRoot\s*\(/.test(code), `${relative}: React runtime is included`)
      check(!/data:(?:image|audio|video|font)[^,]*;base64,/i.test(code), `${relative}: base64 media is embedded`)
    }
  }
  const sitemapPath = path.join(publicRoot, 'sitemap.xml')
  if (check(fs.existsSync(sitemapPath), 'Missing sitemap.xml')) {
    const xml = fs.readFileSync(sitemapPath, 'utf8')
    check(/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(xml), 'Sitemap namespace is missing')
    const locations = [...xml.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(match => decode(match[1].trim()))
    check(locations.length === new Set(locations).size, 'Sitemap contains duplicate URLs')
    for (const relative of expectedPages.filter(name => !/(?:^|\/)404\.html$/.test(name))) check(locations.includes(pageUrl(relative)), `Sitemap is missing ${relative}`)
    for (const location of locations) {
      check(location.startsWith(`${origin}/`), 'Sitemap includes an incorrect domain or non-HTTPS URL')
      check(!/\/404(?:\.html)?(?:[?#]|$)/i.test(location), '404 page must not appear in sitemap')
      checkReference(location, 'sitemap.xml', 'sitemap loc')
    }
  }
  const robotsPath = path.join(publicRoot, 'robots.txt')
  if (check(fs.existsSync(robotsPath), 'Missing robots.txt')) {
    const robots = fs.readFileSync(robotsPath, 'utf8')
    check(/^User-agent:\s*\*\s*$/im.test(robots), 'robots.txt is missing the general user-agent group')
    check(new RegExp(`^Sitemap:\\s*${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml\\s*$`, 'im').test(robots), 'robots.txt must reference the official HTTPS sitemap')
    check(!/^Disallow:\s*\/\s*$/im.test(robots), 'robots.txt blocks the entire production website')
    check(!/(?:localhost|127\.0\.0\.1|preview|file:)/i.test(robots), 'robots.txt includes a development URL')
  }
  const licenseFiles = files.filter(filename => /(?:license|licence|third.party)/i.test(filename))
  const licenseText = licenseFiles.filter(filename => /\.(?:txt|md|json|html)$/i.test(filename)).map(filename => fs.readFileSync(filename, 'utf8')).join('\n')
  check(/DM Sans/i.test(licenseText) && /Outfit/i.test(licenseText) && /SIL OPEN FONT LICENSE/i.test(licenseText), 'Font licenses must include DM Sans, Outfit and the OFL')
  check(/Phosphor/i.test(licenseText) && /MIT License/i.test(licenseText), 'Phosphor icon license is missing')
}

const report = {
  status: errors.length ? 'failed' : 'passed',
  generated_at: new Date().toISOString(),
  scope: 'Offline static deployment structure and reference checks; not a legal, hosting or email-delivery approval.',
  public_directory: publicRoot,
  origin,
  checks: checkCount,
  expected_pages: expectedPages.length,
  checked_pages: pageSummaries.length,
  checked_references: checkedReferences.size,
  checked_anchors: checkedAnchors.size,
  pages: pageSummaries,
  errors,
  warnings
}
fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(`Cimoa static: ${report.status}; ${report.checked_pages}/${report.expected_pages} pages, ${checkCount} checks, ${checkedReferences.size} references, ${checkedAnchors.size} anchors.`)
if (errors.length) console.error(errors.slice(0, 30).map(message => `- ${message}`).join('\n'))
console.log(`Report: ${reportPath}`)
process.exitCode = errors.length ? 1 : 0
