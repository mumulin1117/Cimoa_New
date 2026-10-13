import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'static')
const destination = path.join(root, 'dist/build/h5/static')
fs.rmSync(destination, { recursive: true, force: true })
fs.cpSync(source, destination, { recursive: true })
console.log('Copied static assets to dist/build/h5/static.')
