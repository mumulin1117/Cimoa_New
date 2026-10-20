import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { clone_data, create_seed } from '../src/stores/seed.js'
import { STATE_KEY } from '../src/utils/statePersistence.js'
import { APP_CONSENT_REVISION } from '../src/utils/appConsent.js'
import { eula_document } from '../src/utils/legalDocuments.js'

const now = Date.UTC(2026, 9, 20)
function fixture(saved = null) {
  const disk = new Map(saved ? [[STATE_KEY, clone_data(saved)]] : []), store = use_app_store(createPinia())
  let writes = 0, fail = false
  configure_store_runtime(store, { clock: () => now, persistence: { read: key => clone_data(disk.get(key) ?? null), write(key, value) { if (fail) throw Error('Unable to save your agreement. Please try again.'); writes++; disk.set(key, clone_data(value)) } } })
  return { store, disk, writes: () => writes, fail: value => { fail = value } }
}
test('fresh hydration and old-state migration do not infer or write agreement', () => {
  const fresh = fixture(); assert.equal(fresh.store.hydrate().success, true); assert.equal(fresh.store.has_app_consent, false); assert.equal(fresh.writes(), 0)
  const old = create_seed(now); delete old.app_consent
  const migrated = fixture(old); assert.equal(migrated.store.hydrate().success, true); assert.equal(migrated.store.has_app_consent, false); assert.equal(migrated.writes(), 0)
  const { app_consent, ...rest } = clone_data(migrated.store.data)
  assert.deepEqual(app_consent, { revision: null, accepted_at: null }); assert.deepEqual(rest, old)
})
test('explicit acceptance is versioned, persisted and idempotent without changing account or registration agreements', () => {
  const f = fixture(); f.store.hydrate(); const before = clone_data(f.store.data)
  assert.equal(f.store.set_app_consent(true).success, true); assert.equal(f.store.has_app_consent, true); assert.equal(f.writes(), 1)
  assert.deepEqual(f.store.data.app_consent, { revision: APP_CONSENT_REVISION, accepted_at: now })
  for (const key of Object.keys(before).filter(key => !['app_consent', 'revision', 'updated_at'].includes(key))) assert.deepEqual(clone_data(f.store.data[key]), before[key], key)
  assert.equal(f.store.set_app_consent(true).repeated, true); assert.equal(f.writes(), 1)
  const next = fixture(f.disk.get(STATE_KEY)); next.store.hydrate(); assert.equal(next.store.has_app_consent, true); assert.equal(next.writes(), 0)
})
test('decline is zero-write; revoke persists and does not terminate an existing session', () => {
  const f = fixture(create_seed(now)); f.store.hydrate(); const session = clone_data(f.store.data.session)
  f.store.set_app_consent(false); assert.equal(f.writes(), 0)
  f.store.set_app_consent(true); f.store.set_app_consent(false)
  assert.equal(f.store.has_app_consent, false); assert.deepEqual(clone_data(f.store.data.session), session)
  const next = fixture(f.disk.get(STATE_KEY)); next.store.hydrate(); assert.equal(next.store.has_app_consent, false)
})
test('stale revision, malformed consent and unavailable storage never silently accept', () => {
  const f = fixture(); f.store.hydrate(); f.fail(true); const before = clone_data(f.store.data)
  assert.equal(f.store.set_app_consent(true).success, false); assert.deepEqual(clone_data(f.store.data), before)
  f.fail(false); assert.equal(f.store.set_app_consent(true, 'older').success, false); assert.equal(f.writes(), 0)
  assert.equal(f.store.set_app_consent('true').success, false)
  f.store.set_app_consent(true); f.fail(true); const accepted = clone_data(f.store.data)
  assert.equal(f.store.set_app_consent(false).success, false); assert.equal(f.store.has_app_consent, true); assert.deepEqual(clone_data(f.store.data), accepted)
  const stale = create_seed(now); stale.app_consent = { revision: 'eula:previous', accepted_at: now }
  const outdated = fixture(stale); outdated.store.hydrate(); assert.equal(outdated.store.has_app_consent, false)
  for (const invalid of [null, {}, { revision: APP_CONSENT_REVISION, accepted_at: null }, { revision: null, accepted_at: now }]) {
    const broken = create_seed(now); broken.app_consent = invalid; const check = fixture(broken)
    assert.equal(check.store.hydrate().success, false); assert.equal(check.writes(), 0)
  }
})
test('EULA covers campus safety and voluntary permission without demo labels or fictional moderation promises', () => {
  const text = JSON.stringify(eula_document)
  for (const phrase of ['18 or older', 'Zero tolerance', 'child sexual abuse', 'mutual connection', 'Report and Block', 'Privacy Policy', 'consumer rights', 'permission', 'event', 'failed']) assert.ok(text.includes(phrase), phrase)
  assert.doesNotMatch(text, /demo|local data|local social|local build|within 24 hours|@cimoa|Apple.approved/i)
})
