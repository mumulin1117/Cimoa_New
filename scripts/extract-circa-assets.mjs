import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { read_circa_source } from './lib/circa-source.mjs'

const root = process.cwd()
const source = read_circa_source(root)
const { template: innerTemplate, manifest: innerManifest, external } = source
const assetMap = JSON.parse(innerTemplate.match(/window\.__AMAP=(\{[\s\S]*?\});window\.__A/)[1])
const externalById = Object.fromEntries(external.map((entry) => [entry.id, entry]))
const targets = {
  'assets/jordan-av.png': 'head/jordan-av.png',
  'assets/maya-full.png': 'head/maya-full.png',
  'assets/maya-card.png': 'head/maya-card.png',
  'assets/maya-av.png': 'head/maya-av.png',
  'assets/liam-av.png': 'head/liam-av.png',
  'assets/me.png': 'head/me.png',
  'assets/g1.png': 'head/g1.png',
  'assets/event-picnic.png': 'img/event-picnic.png',
  'assets/ev-forest.jpg': 'img/ev-forest.jpg',
  'assets/ev-boat.jpg': 'img/ev-boat.jpg',
  'assets/ev-camp.jpg': 'img/ev-camp.jpg',
  'assets/ev-bike.jpg': 'img/ev-bike.jpg',
  'assets/ev-hike.jpg': 'img/ev-hike.png',
  'assets/ic-connect.png': 'icons/ic-connect.png',
  'assets/ic-boost.png': 'icons/ic-boost.png',
  'assets/ic-rewind.png': 'icons/ic-rewind.png',
  'assets/coins-60.png': 'coins/coins-60.png',
  'assets/coins-300.png': 'coins/coins-300.png',
  'assets/coins-680.png': 'coins/coins-680.png',
}
for (const [assetPath, id] of Object.entries(assetMap)) {
  if (!targets[assetPath] && assetPath.startsWith('assets/songs/')) targets[assetPath] = `songs/${path.basename(assetPath)}`
  if (!targets[assetPath] && assetPath.startsWith('assets/coins/')) targets[assetPath] = `coins/${path.basename(assetPath)}`
}
const manifest = []
const extracted = new Set()
// Media only: never emit the source component HTML, prototype logic or runtimes.
const writeAsset = (uuid, target, assetSource, id = uuid) => {
  const entry = innerManifest[uuid]
  if (!entry?.data || !/^(image\/(png|jpeg)|font\/woff2)$/.test(entry.mime)) {
    throw new Error(`Not an extractable media resource: ${uuid}`)
  }
  const encoded = Buffer.from(entry.data, 'base64')
  const bytes = entry.compressed ? zlib.gunzipSync(encoded) : encoded
  const outputPath = path.join(root, 'static/assets', target)
  // Preserve original resources. A mismatched existing file requires review,
  // never an automatic overwrite of user-modified assets.
  if (fs.existsSync(outputPath) && !fs.readFileSync(outputPath).equals(bytes)) {
    throw new Error(`Existing asset differs from source: ${outputPath}`)
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  if (!fs.existsSync(outputPath)) fs.writeFileSync(outputPath, bytes)
  extracted.add(uuid)
  manifest.push({ source: assetSource, id, bundle_id: uuid, target: `static/assets/${target}`,
    mime: entry.mime, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') })
}
for (const [assetPath, target] of Object.entries(targets)) {
  const id = assetMap[assetPath]
  const uuid = externalById[id]?.uuid
  if (!uuid) throw new Error(`Missing embedded asset ${assetPath}`)
  writeAsset(uuid, target, assetPath, id)
}

const directTargets = {
  'a9831494-dfeb-464f-8617-1e3468ad74f0': 'coins/home-coin-badge.png',
  'e8bd8155-5a13-4ecb-a022-bcadf12ae5f6': 'head/participant-e8bd8155.jpg',
  '38b22b41-ac8f-43cc-8bf0-37a8b75c93b4': 'head/participant-38b22b41.png',
  '501d6dc6-cd53-4ee4-b9ae-e49c37deca54': 'coins/store-coin-hero.png',
  '92ddcb8c-721c-4960-a8e8-51926692ee27': 'head/participant-92ddcb8c.png',
  'd94783de-a46b-442f-9163-27afd548eacd': 'img/welcome-campus.png',
}
for (const [uuid, entry] of Object.entries(innerManifest)) {
  if (extracted.has(uuid) || !/^(image\/|font\/woff2)/.test(entry.mime)) continue
  const target = entry.mime === 'font/woff2' ? `fonts/${uuid}.woff2` : directTargets[uuid]
  if (!target) throw new Error(`Media resource requires an explicit target: ${uuid}`)
  const extension = path.extname(target)
  const expected = { 'image/png': '.png', 'image/jpeg': '.jpg', 'font/woff2': '.woff2' }[entry.mime]
  if (extension !== expected) throw new Error(`Media extension mismatch for ${uuid}: ${entry.mime}`)
  writeAsset(uuid, target, `bundle:${uuid}`)
}
const fontFaces = [...innerTemplate.matchAll(/@font-face\s*\{[^}]+\}/g)].map(([rule]) => {
  return rule.replace(/url\("([a-f0-9-]+)"\)/g, (_, uuid) => {
    if (!extracted.has(uuid)) throw new Error(`Unextracted font: ${uuid}`)
    return `url("./${uuid}.woff2")`
  })
})
fs.writeFileSync(path.join(root, 'static/assets/fonts/source-fonts.css'), `${fontFaces.join('\n\n')}\n`)
fs.writeFileSync(path.join(root, 'static/assets/manifest.json'), JSON.stringify({
  source: source.filename, source_sha256: source.source_hash, assets: manifest,
  font_stylesheet: 'static/assets/fonts/source-fonts.css',
}, null, 2) + '\n')
console.log(`Extracted ${manifest.filter((entry) => entry.mime.startsWith('image/')).length} images and ${manifest.filter((entry) => entry.mime === 'font/woff2').length} fonts. No HTML or runtime scripts emitted.`)
