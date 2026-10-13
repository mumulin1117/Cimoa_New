import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const forbidden = [/\bconfirm\s*\(/, /uni\.navigate(To|Back|RedirectTo|ReLaunch)/, /localStorage\.(get|set)Item/]
const roots = ['src']
let errors = []
async function walk(dir) {
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, name.name)
    if (name.isDirectory()) await walk(path)
    else if (/\.(vue|js|json)$/.test(name.name)) {
      const text = await readFile(path, 'utf8')
      forbidden.forEach((rule) => { if (rule.test(text)) errors.push(`${path}: ${rule}`) })
    }
  }
}
for (const root of roots) await walk(root)
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log('Convention checks passed.')
