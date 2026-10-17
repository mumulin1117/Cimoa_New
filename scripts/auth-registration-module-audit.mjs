import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const inventoryPath = path.resolve('docs/cimoa-page-inventory.json')
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))
const inScope = row => (
  /^\/pages\/(auth|onboarding|legal)\//.test(row.route || '')
  || /^\/pages\/permissions\/(photos|camera|notif)$/.test(row.route || '')
)
const pages = inventory.filter(inScope)

assert.equal(pages.length, 30, 'The authentication and registration scope must contain exactly 30 source-screen entries.')

for (const page of pages) {
  assert.equal(page.source_lock, 'locked', `${page.source_screen}: source lock is incomplete.`)
  assert.equal(page.status, 'verified', `${page.source_screen}: page is not verified.`)
  assert.equal(page.visual_acceptance, 'passed', `${page.source_screen}: visual acceptance is incomplete.`)
  assert.equal(page.local_acceptance, 'passed', `${page.source_screen}: local acceptance is incomplete.`)
  assert.equal(page.full_acceptance, 'passed', `${page.source_screen}: full acceptance is incomplete.`)
  const components = (page.component || '').split(';').map(value => value.trim()).filter(Boolean)
  assert.ok(components.length > 0, `${page.source_screen}: component list is missing.`)
  assert.ok(components.every(component => fs.existsSync(path.resolve(component))), `${page.source_screen}: a listed component is missing.`)
  const restorationArtifacts = page.restoration_artifacts || []
  const sourceContracts = [page.source_lock_artifact, ...restorationArtifacts.filter(value => value.endsWith('/source-contract.json'))].filter(Boolean)
  const visualAudits = [page.visual_audit_artifact, ...restorationArtifacts.filter(value => value.endsWith('/difference-audit.md'))].filter(Boolean)
  assert.ok(sourceContracts.length > 0 && sourceContracts.every(value => fs.existsSync(path.resolve(value))), `${page.source_screen}: source contract is missing.`)
  assert.ok(visualAudits.length > 0 && visualAudits.every(value => fs.existsSync(path.resolve(value))), `${page.source_screen}: visual audit is missing.`)
}

const result = {
  result: 'passed',
  inventory: path.relative(process.cwd(), inventoryPath),
  source_screen_entries: pages.length,
  unique_routes: new Set(pages.map(page => page.route)).size,
  verified: pages.filter(page => page.status === 'verified').length,
  visual_acceptance_passed: pages.filter(page => page.visual_acceptance === 'passed').length,
  full_acceptance_passed: pages.filter(page => page.full_acceptance === 'passed').length,
  routes: [...new Set(pages.map(page => page.route))],
}

console.log(JSON.stringify(result, null, 2))
