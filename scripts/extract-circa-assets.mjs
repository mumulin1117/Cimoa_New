import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = process.cwd()
const source = fs.readFileSync(path.join(root, 'CIRCA All Screens (interactive).html'), 'utf8')
const readScript = (html, type) => {
  const match = html.match(new RegExp(`<script type="${type}">([\\s\\S]*?)</script>`))
  if (!match) throw new Error(`Missing ${type}`)
  return JSON.parse(match[1])
}
const outerManifest = readScript(source, '__bundler/manifest')
const standalone = zlib.gunzipSync(Buffer.from(outerManifest[Object.keys(outerManifest)[0]].data, 'base64')).toString('utf8')
const innerTemplate = readScript(standalone, '__bundler/template')
const innerManifest = readScript(standalone, '__bundler/manifest')
const external = readScript(standalone, '__bundler/ext_resources')
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
for (const [assetPath, target] of Object.entries(targets)) {
  const id = assetMap[assetPath]
  const entry = externalById[id] && innerManifest[externalById[id].uuid]
  if (!entry || !entry.data) throw new Error(`Missing embedded asset ${assetPath}`)
  const outputPath = path.join(root, 'static/assets', target)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, Buffer.from(entry.data, 'base64'))
  manifest.push({ source: assetPath, id, target: `static/assets/${target}`, mime: entry.mime, bytes: Buffer.byteLength(entry.data, 'base64') })
}
fs.writeFileSync(path.join(root, 'static/assets/manifest.json'), JSON.stringify({ source: 'CIRCA All Screens (interactive).html', assets: manifest }, null, 2) + '\n')
console.log(`Extracted ${manifest.length} local assets.`)
