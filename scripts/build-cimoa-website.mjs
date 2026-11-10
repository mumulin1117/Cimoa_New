import fs from 'node:fs'
import path from 'node:path'
import { root, sha256, buildWebsite, preservedContent } from './lib/cimoa-website.mjs'

const input = path.resolve(process.argv[2] || '/Users/linqian/Downloads/Cimoa官网.html')
const directory = path.join(root, 'artifacts/cimoa-website')
const output = path.join(directory, 'Cimoa官网.html')
if (input === output) throw Error('Build from the original backup, not from generated output.')
const original = fs.readFileSync(input, 'utf8')
const generated = buildWebsite(original)
fs.mkdirSync(directory, { recursive: true })
const backup = path.join(directory, `original-${sha256(original).slice(0, 12)}.html`)
if (!fs.existsSync(backup)) fs.copyFileSync(input, backup, fs.constants.COPYFILE_EXCL)
fs.writeFileSync(output, generated)
fs.writeFileSync(path.join(directory, 'build-report.json'), JSON.stringify({
  input, output, backup, originalSha256: sha256(original), outputSha256: sha256(generated),
  preserved: preservedContent(generated),
  changes: ['English/French content', 'iOS-only store entry', 'French default language', 'Canonical URL and description'],
  cssChanged: false, embeddedResourcesChanged: false, deployed: false, legalReleaseApproved: false
}, null, 2) + '\n')
console.log(JSON.stringify({ output, backup, cssChanged: false, embeddedResourcesChanged: false, deployed: false }, null, 2))
