// Read-only implementation inspection; never executes the HTML prototype.
import fs from 'node:fs'
import path from 'node:path'
import { read_circa_source } from './lib/circa-source.mjs'
const inventory = JSON.parse(fs.readFileSync('docs/cimoa-page-inventory.json', 'utf8'))
const audit = JSON.parse(fs.readFileSync('docs/circa-source-audit.json', 'utf8'))
const registered = JSON.parse(fs.readFileSync('src/pages.json', 'utf8')).pages.map(row => `/${row.path}`)
const source = read_circa_source()
if (source.source_hash !== audit.source_sha256) throw Error('Prototype changed; repeat source analysis before implementation.')
const routes = [...new Set(inventory.map(row => row.route).filter(route => route?.startsWith('/pages/')))]
const pages = inventory.map(row => ({
  source_screen: row.source_screen, source_query: row.source_query,
  route: row.route, component: row.component, return_owner: row.return_owner,
  interaction_ids: row.interaction_ids, entities: row.entities,
  registered: registered.includes(row.route),
  file_exists: fs.existsSync(row.component || path.join('src', `${row.route || ''}.vue`)),
  local_acceptance: row.local_acceptance || 'pending', full_acceptance: row.full_acceptance || 'pending',
  status: row.status, // Never promote based on existence or successful compilation.
}))
const report = {
  source_sha256: source.source_hash,
  meaning: '154 source states are not 154 pages. Registration/file existence does not establish fidelity or runtime acceptance.',
  source_states: inventory.length, planned_routes: routes.length, registered_routes: registered.length,
  registered_planned_routes: routes.filter(route => registered.includes(route)).length,
  missing_routes: routes.filter(route => !registered.includes(route)),
  extra_registered_routes: registered.filter(route => !routes.includes(route)),
  fully_verified_states: pages.filter(row => row.status === 'verified' && row.full_acceptance === 'passed').length,
  production_acceptance: 'pending', pages,
}
fs.writeFileSync('docs/cimoa-implementation-audit.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ states: report.source_states, planned_routes: report.planned_routes, registered: report.registered_routes, matched: report.registered_planned_routes, missing: report.missing_routes.length, fully_verified: report.fully_verified_states }))
