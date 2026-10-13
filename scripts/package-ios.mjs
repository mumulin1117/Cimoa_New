// Generated resources only: never copies the original HTML or its runtime.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const root = path.resolve(import.meta.dirname, '..')
const source = path.join(root, 'dist/build/h5')
const resources = path.join(root, 'ios/cimoaNeapo/Resources')
const target = path.join(resources, 'H5')
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)])
if (!fs.existsSync(path.join(source, 'index.html'))) throw Error('Build H5 before packaging iOS.')
const files = walk(source)
if (files.some(file => /CIRCA|interactive|\.dc\.html$/i.test(path.basename(file)))) throw Error('Prototype files must not be packaged.')
fs.mkdirSync(resources, { recursive: true })
// Fixed task-owned generated output, not a repository or user data directory.
fs.rmSync(target, { recursive: true, force: true })
fs.cpSync(source, target, { recursive: true, errorOnExist: true })
fs.copyFileSync(path.join(root, 'src/config/theme.json'), path.join(resources, 'theme.json'))
const entries = files.sort().map(file => ({ file: path.relative(source, file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }))
fs.writeFileSync(path.join(resources, 'build-manifest.json'), JSON.stringify({ project: 'cimoaNeapo', source: 'dist/build/h5', files: entries }, null, 2) + '\n')
console.log(`Packaged ${entries.length} H5 files into ios/cimoaNeapo/Resources/H5; no preview server required.`)
