import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { use_account_scope } from '../src/composables/useAccountScope.js'

test('page scope cancels synchronously on logout and never revives after same-account relogin at the same clock', async () => {
  const now = Date.UTC(2026, 9, 17), store = use_app_store(createPinia())
  let disk = create_seed(now), invalidations = 0
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(disk), write: (_, value) => { disk = clone_data(value) } } }); store.hydrate()
  const scope = effectScope(), page = scope.run(() => use_account_scope(store, () => invalidations++))
  assert.equal(page.is_current(), true)
  store.update_settings('privacy', { show_online: false }); assert.equal(page.is_current(), true)
  store.logout(); assert.equal(page.is_current(), false); assert.equal(invalidations, 1)
  await store.login('cimoa@connect.edu', '12341234'); assert.equal(store.session.account_id, page.account_id); assert.equal(page.is_current(), false)
  assert.notEqual(store.auth_context, page.auth_context); scope.stop()
})
