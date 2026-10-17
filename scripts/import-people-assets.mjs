import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { AVATAR_PROFILES } from '../src/stores/peopleCatalog.js'

const source_root = process.argv[2] || '/Users/linqian/Downloads/大学生交友素材/头像'
const files = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8 2.jpg', '8.jpg', '10.jpg', '11.jpg', '12.jpg', '上传图片进行搜索 2.jpg', '上传图片进行搜索 3.jpg', '上传图片进行搜索.jpg', '收藏到 havanna.jpg', '收藏到 Millie’s camera roll.jpg', '主页 4.jpg', '主页 5.jpg', '主页 6.jpg', '主页 7.jpg', '主页 8.jpg', fs.readdirSync(source_root).find(name => name.startsWith('Ξ '))]
if (files.length !== AVATAR_PROFILES.length || files.some(name => !name)) throw Error('The supplied portrait catalog is incomplete.')
const hashes = new Set()
const manifest = files.map((source_file, index) => {
  const bytes = fs.readFileSync(path.join(source_root, source_file))
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  if (hashes.has(sha256)) throw Error('Duplicate portrait in the catalog.')
  hashes.add(sha256)
  const person = AVATAR_PROFILES[index], target = path.resolve('.' + person.avatar_url)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(target) && !fs.readFileSync(target).equals(bytes)) throw Error(`Refusing to overwrite a changed resource: ${target}`)
  fs.copyFileSync(path.join(source_root, source_file), target)
  return { user_id: person.user_id, source_file, target: person.avatar_url, byte_size: bytes.length, sha256 }
})
console.log(JSON.stringify({ source: source_root, original_count: 26, unique_count: manifest.length, exact_duplicates: ['主页 2.jpg = 2.jpg', '主页 3.jpg = 1.jpg', '主页.jpg = 12.jpg'], assets: manifest }, null, 2))
