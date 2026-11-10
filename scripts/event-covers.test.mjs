import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { EVENT_COVERS, upgrade_event_covers } from '../src/stores/eventCovers.js'
import { upgrade_additive_data } from '../src/stores/migration.js'

test('Every catalogue event owns a unique, bundled and licensed theme cover', () => {
  const events = create_seed(0).events
  const licenses = JSON.parse(fs.readFileSync('static/assets/events/asset-licenses.json', 'utf8'))
  assert.equal(events.length, 22)
  assert.equal(new Set(events.map(event => event.image_url)).size, events.length)
  assert.equal(licenses.assets.length, events.length)
  const hashes = new Set()
  for (const event of events) {
    const asset = licenses.assets.find(row => row.event_id === event.event_id)
    assert.ok(asset?.source_url.startsWith('https://'))
    assert.ok(asset.author)
    assert.ok(['CC0-1.0', 'Pixnio License'].includes(asset.license))
    assert.ok(asset.license_url.startsWith('https://'))
    assert.equal(event.image_url, `/static/assets/events/${asset.file}`)
    const bytes = fs.readFileSync(`static/assets/events/${asset.file}`)
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8)
    assert.ok(bytes.length > 10000)
    hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'))
  }
  assert.equal(hashes.size, events.length)
})

test('Legacy cover upgrade replaces only recognized original paths and is idempotent', () => {
  const old = create_seed(0)
  for (const event of old.events) event.image_url = EVENT_COVERS[event.event_id].legacy_url
  old.events[0].title = 'An edited title'
  old.events[1].image_url = '/static/uploads/custom-sketch.jpg'
  old.events[2].image_url = ''
  old.events.push({ ...old.events[0], event_id: 'custom_event' })
  const before = clone_data(old)
  upgrade_event_covers(old)
  for (const [index, event] of old.events.entries()) {
    const expected = clone_data(before.events[index])
    if (index > 2 && index < 22 || index === 0) expected.image_url = EVENT_COVERS[event.event_id].image_url
    assert.deepEqual(event, expected)
  }
  assert.deepEqual(old.memberships, before.memberships)
  assert.deepEqual(old.messages, before.messages)
  assert.deepEqual(old.coin_transactions, before.coin_transactions)
  const once = clone_data(old)
  upgrade_event_covers(old); assert.deepEqual(old, once)
})

test('Hydration upgrade preserves edited business data, memberships, preferences and source input', () => {
  const old = create_seed(0)
  for (const event of old.events) event.image_url = EVENT_COVERS[event.event_id].legacy_url
  old.memberships.push({ membership_id: 'my_existing_spot', event_id: 'event_picnic', user_id: old.session.current_user_id, status: 'joined', joined_at: 0 })
  old.event_preferences[0].active_tab = 'My campus'
  const before = clone_data(old)
  const next = upgrade_additive_data(old)
  assert.deepEqual(old, before)
  assert.deepEqual(next.memberships, before.memberships)
  assert.deepEqual(next.event_preferences, before.event_preferences)
  assert.deepEqual(next.requests, before.requests)
  assert.deepEqual(next.session, before.session)
  assert.deepEqual(next.messages, before.messages)
  assert.deepEqual(next.coin_transactions, before.coin_transactions)
  assert.equal(next.events[0].image_url, EVENT_COVERS.event_picnic.image_url)
  assert.deepEqual(upgrade_additive_data(next), next)
})
