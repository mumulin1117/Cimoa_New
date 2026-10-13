import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { read_circa_source, read_catalog } from './lib/circa-source.mjs'

const source = read_circa_source()
const audit = JSON.parse(fs.readFileSync('docs/circa-source-audit.json', 'utf8'))
const inventory = JSON.parse(fs.readFileSync('docs/cimoa-page-inventory.json', 'utf8'))

test('audit refers to the unchanged user prototype, never evaluates its scripts', () => {
  assert.equal(source.source_hash, '6c49411c6868b476ff46cedaa9828ee2ccbfe89d5eaa7ea1f739feb2c8018060')
  assert.equal(audit.source_sha256, source.source_hash)
  assert.equal(read_catalog(source.catalog).flatMap((group) => group.screens).length, 154)
})

test('all source event bindings have unique IDs and located definitions', () => {
  assert.equal(audit.interactions.length, 539)
  assert.equal(new Set(audit.interactions.map((item) => item.interaction_id)).size, 539)
  assert.deepEqual(audit.interactions.filter((item) => item.source_status === 'needs_scope_resolution'), [])
  assert.equal(audit.interactions.filter((item) => item.route === 'home').length, 15)
})

test('inventory keeps all source states, full planned routes and no false verification', () => {
  assert.equal(inventory.length, 154)
  for (const entry of inventory) {
    for (const field of ['source_screen', 'page_level', 'route', 'entry_points', 'return_owner',
      'fixed_regions', 'scroll_region', 'interaction_ids', 'entities', 'assets', 'states',
      'top_safe_area_owner', 'bottom_safe_area_owner', 'status']) {
      assert.ok(Object.hasOwn(entry, field), `${entry.source_screen}: missing ${field}`)
    }
    assert.equal(entry.status, 'pending')
    assert.match(entry.route, /^(\/pages\/[a-z0-9/-]+|component)$/)
  }
  assert.deepEqual([...new Set(inventory.filter((entry) => entry.page_level === '主 Tab').map((entry) => entry.route))].sort(),
    ['/pages/discover/index', '/pages/events/index', '/pages/home/index'])
  assert.ok(inventory.filter((entry) => entry.source_screen.includes('Expanded')).every((entry) => entry.page_level !== '主 Tab'))
})

test('asset audit includes previously missed images and fonts', () => {
  assert.equal(audit.resources.filter((resource) => resource.mime.startsWith('image/')).length, 35)
  assert.equal(audit.resources.filter((resource) => resource.mime === 'font/woff2').length, 12)
  assert.equal(audit.resources.filter((resource) => resource.mime.startsWith('image/') && !resource.extracted).length, 6)
  assert.ok(audit.resources.some((resource) => resource.source_id === './TabBar.dc.html'))
  assert.equal(audit.svg_resources.length, 356)
})
