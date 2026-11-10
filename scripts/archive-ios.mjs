import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { exportStandalone } from './lib/iosStandalone.mjs'
const root = path.resolve(import.meta.dirname, '..')
const project = path.join(root, 'ios/cimoaNeapo')
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--output-dir' || !args[1])) throw Error('Usage: corepack pnpm archive:ios [--output-dir <new-directory>]')
const output = args.length ? path.resolve(args[1]) : path.join(root, 'artifacts/cimoaNeapo-standalone')
if (fs.lstatSync(output, { throwIfNoEntry: false })) throw Error(`Output already exists; use --output-dir with a new directory: ${output}`)
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cimoa-ios-export-'))
const copy = path.join(temporary, 'cimoaNeapo')
const destination = path.join(root, 'artifacts/cimoaNeapo-ios.zip')
try {
  const report = exportStandalone(project, copy)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  execFileSync('/usr/bin/ditto', ['-c', '-k', '--norsrc', '--noextattr', '--keepParent', copy, destination])
  // No force/merge: an existing exported project may contain the user's signing edits.
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.mkdirSync(output)
  fs.cpSync(copy, output, { recursive: true, errorOnExist: true, force: false })
  console.log(`Standalone Xcode project folder: ${output}`)
  console.log(`Standalone Xcode project archive: ${destination}`)
  console.log(`Validated ${report.file_references} project files and ${report.h5_files} H5 manifest hashes; production app target only.`)
} finally {
  // Only the exact mkdtemp directory created above, never an environment root.
  fs.rmSync(temporary, { recursive: true, force: true })
}
