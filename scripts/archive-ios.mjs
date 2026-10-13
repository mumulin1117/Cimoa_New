import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
const root = path.resolve(import.meta.dirname, '..')
const project = path.join(root, 'ios/cimoaNeapo')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cimoa-ios-export-'))
const copy = path.join(temporary, 'cimoaNeapo')
const destination = path.join(root, 'artifacts/cimoaNeapo-ios.zip')
try {
  if (!fs.existsSync(path.join(project, 'Resources/H5/index.html'))) throw Error('Run corepack pnpm build:h5 first.')
  fs.mkdirSync(copy)
  for (const name of ['Config', 'Sources', 'Tests', 'Resources', 'cimoaNeapo.xcodeproj', 'README.md']) fs.cpSync(path.join(project, name), path.join(copy, name), { recursive: true, filter: source => !source.includes('/xcuserdata/') && !source.endsWith('/xcuserdata') })
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  execFileSync('/usr/bin/ditto', ['-c', '-k', '--norsrc', '--noextattr', '--keepParent', copy, destination])
  console.log(`Standalone Xcode project archive: ${destination}`)
} finally {
  // Only the exact mkdtemp directory created above, never an environment root.
  fs.rmSync(temporary, { recursive: true, force: true })
}
