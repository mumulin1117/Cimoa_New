import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { clone_data } from '../src/stores/seed.js'
function fixture(saved = null) {
  const store = use_app_store(createPinia()), disk = new Map(saved ? [['cimoa_app_state_v2', saved]] : [])
  const persistence = { read: key => clone_data(disk.get(key) ?? null), write: (key, data) => disk.set(key, clone_data(data)) }
  configure_store_runtime(store, { persistence, clock: () => Date.UTC(2026, 9, 14) }); store.hydrate()
  return { store, disk, persistence }
}
test('age/agreements reject underage and invalid dates without writes and restore adult draft', () => {
  const { store, disk, persistence } = fixture(), initial = clone_data(store.data)
  for (const dob of ['', '2008-10-15', '2004-02-30', '2099-01-01']) assert.equal(store.save_registration_age(dob).success, false)
  assert.deepEqual(clone_data(store.data), initial); assert.equal(disk.size, 0)
  assert.equal(store.save_registration_agreements({ terms: true, privacy: true, community: true }).success, false)
  assert.equal(store.save_registration_age('2008-10-14').success, true)
  assert.equal(fixture(disk.get('cimoa_app_state_v2')).store.auth_draft.profile_draft.date_of_birth, '2008-10-14')
  assert.equal(store.save_registration_agreements({ terms: true }).success, false)
  const before = clone_data(store.data)
  configure_store_runtime(store, { persistence: { ...persistence, write() { throw Error('Full') } } })
  assert.equal(store.save_registration_agreements({ terms: true, privacy: true, community: true }).success, false)
  assert.deepEqual(clone_data(store.data), before)
})
