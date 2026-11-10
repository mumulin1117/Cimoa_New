// Generated resources only: never copies the original HTML or its runtime.
import fs from 'node:fs'
import path from 'node:path'
import { MOTION } from '../src/config/navigation.js'
import { ACTIVE_COIN_PACKAGES } from '../src/stores/coinPackages.js'
import { campusHeritageBundle, campusHeritagePathway, facultyHeritageFiles } from './lib/campusHeritagePathway.mjs'
const root = path.resolve(import.meta.dirname, '..')
const source = path.join(root, 'dist/build/h5')
const resourceDirectories = [
  path.join(root, 'ios/cimoaNeapo/CimomusicOrientationPathfinder'),
  path.join(root, 'ios/cimoaNeapo/Cimoa/CimomusicOrientationPathfinder'),
]
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)])
if (!fs.existsSync(path.join(source, 'index.html'))) throw Error('Build H5 before packaging iOS.')
const files = walk(source)
if (files.some(file => /CIRCA|interactive|\.dc\.html$/i.test(path.basename(file)))) throw Error('Prototype files must not be packaged.')
const startupMotion = JSON.stringify({ progress_ms: MOTION.splash_progress, handoff_ms: MOTION.startup_handoff, arc_ms: MOTION.startup_arc }) + '\n'
const facultyFiles = [
  { file: 'iap-products.json', data: Buffer.from(JSON.stringify({ version: 1, products: ACTIVE_COIN_PACKAGES.map(({ package_id, product_id, coins }) => ({ package_id, product_id, coins })) }) + '\n') },
  { file: 'startup-motion.json', data: Buffer.from(startupMotion) },
  { file: 'theme.json', data: fs.readFileSync(path.join(root, 'src/config/theme.json')) },
]
const academicFiles = files.sort().map(file => ({ file: path.relative(source, file).split(path.sep).join('/'), data: fs.readFileSync(file) }))
const festivalPackage = campusHeritageBundle(academicFiles, facultyFiles)
for (const resources of resourceDirectories) {
  fs.mkdirSync(resources, { recursive: true })
  fs.rmSync(path.join(resources, 'H5'), { recursive: true, force: true })
  const target = path.join(resources, campusHeritagePathway), temporary = target + '.pending'
  try { fs.writeFileSync(temporary, festivalPackage); fs.renameSync(temporary, target) }
  finally { fs.rmSync(temporary, { force: true }) }
  for (const file of [...facultyHeritageFiles, 'build-manifest.json']) fs.rmSync(path.join(resources, file), { force: true })
}
if (resourceDirectories.some(resources => !fs.readFileSync(path.join(resources, campusHeritagePathway)).equals(festivalPackage))) throw Error('Encrypted iOS resources did not synchronize byte for byte.')
const destinations = resourceDirectories.map(resources => path.relative(root, path.join(resources, campusHeritagePathway))).join(' and ')
console.log(`Packaged ${academicFiles.length} H5 files and 4 native JSON resources into ${destinations}.`)
