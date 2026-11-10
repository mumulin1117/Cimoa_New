import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { startup_destination, authenticated_destination } from '../src/utils/authNavigation.js'

const epoch = Date.UTC(2026, 9, 23, 1)
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
function fixture(transform = () => {}) {
  let now = epoch, disk = create_seed(now), writes = 0
  transform(disk)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, data) => { writes++; disk = clone_data(data) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  return { store, writes: () => writes, advance: duration => { now += duration; store.tick() } }
}

test('an expired session with retained account IDs resolves to Welcome and exposes no Home entities', () => {
  const f = fixture(data => { data.session.expires_at = epoch }), { store } = f
  const before = clone_data(store.data)
  assert.equal(store.session.account_id, 'account_cimoa')
  assert.equal(store.session.current_user_id, 'user_cimoa')
  assert.equal(store.session.is_authenticated, false)
  assert.equal(store.local_verification, null)
  assert.equal(startup_destination(store), '/pages/auth/welcome')
  assert.equal(store.current_user.user_name, '')
  assert.equal(store.home_feed.status, 'session_expired')
  assert.deepEqual(store.home_feed.cards, [])
  assert.equal(store.home_feed.match_card, null)
  assert.equal(f.writes(), 0)
  assert.deepEqual(clone_data(store.data), before)
})

test('clock ticks revoke a session at its exact deadline without waiting for a new page or rewriting business data', () => {
  const f = fixture(data => { data.session.expires_at = epoch + 1000 }), { store } = f
  const before = clone_data(store.data)
  assert.equal(store.session.is_authenticated, true)
  assert.equal(startup_destination(store), '/pages/home/index')
  assert.ok(store.home_feed.cards.length > 0)
  f.advance(999)
  assert.equal(store.session.is_authenticated, true)
  f.advance(1)
  for (let read = 0; read < 3; read++) {
    assert.equal(store.session.is_authenticated, false)
    assert.equal(startup_destination(store), '/pages/auth/welcome')
    assert.equal(store.home_feed.status, 'session_expired')
    assert.deepEqual(store.home_feed.cards, [])
    assert.equal(store.home_feed.owner_user_id, null)
    assert.equal(store.home_feed.match_card, null)
    f.advance(1000)
  }
  assert.equal(f.writes(), 0)
  assert.deepEqual(clone_data(store.data), before)
})

test('verified incomplete registration resumes its real Basic/About step and draft reads or cancelled submissions do not publish', async () => {
  const f = fixture(data => { data.session = { account_id: null, current_user_id: null, expires_at: null } }), { store } = f
  const registration = await store.register_local_account({ email: 'entry.flow@campus.edu', password: 'EntryFlow123', confirmation: 'EntryFlow123', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
  assert.equal(registration.success, true)
  const id = registration.data.account_id
  assert.equal(startup_destination(store), '/pages/auth/verification/code')
  assert.equal(store.apply_verification('009789', id).success, true)
  assert.equal(store.begin_onboarding(id).success, true)
  assert.equal(store.onboarding.completed, false)
  assert.equal(authenticated_destination(store), '/pages/onboarding/basic')
  let before = clone_data(store.data), writes = f.writes()
  assert.equal((await store.save_onboarding_step('basic', { user_name: '', date_of_birth: '2000-01-01', gender: 'Man', pronouns: '' }, id)).success, false)
  assert.deepEqual(clone_data(store.data), before)
  assert.equal(f.writes(), writes)
  for (const [step, patch] of [
    ['basic', { user_name: 'Flow Member', date_of_birth: '2000-01-01', gender: 'Man', pronouns: 'he / him' }],
    ['uni', { university: 'HKUST', year: 'Year 3', major: 'Computer Science', graduation_year: '2027' }],
    ['major', { major: 'Computer Science' }],
  ]) assert.equal((await store.save_onboarding_step(step, patch, id)).success, true)
  // Existing About visual-fixture convention: scaffold the completed Photos prerequisite in QA only.
  store.data.accounts.find(account => account.account_id === id).onboarding = { step: 'about', completed_steps: ['basic', 'uni', 'major', 'photos'] }
  before = clone_data(store.data); writes = f.writes()
  assert.equal(startup_destination(store), '/pages/onboarding/about')
  assert.equal(store.onboarding.profile.bio, '')
  assert.equal((await store.save_onboarding_step('about', { bio: 'A draft that must not be published.' }, id, { is_current: () => false })).reason, 'cancelled')
  assert.equal(store.onboarding.profile.bio, '')
  assert.equal(f.writes(), writes)
  assert.deepEqual(clone_data(store.data), before)
})

test('shared frames retain keyboard navigation and guard expired sessions while the Tab remains shown', () => {
  const onboarding = read('src/components/OnboardingFrame.vue'), main = read('src/components/MainTabFrame.vue')
  assert.match(onboarding, /height:\s*viewport_height/)
  assert.match(onboarding, /'--app-safe-bottom':\s*keyboard_open\s*\?\s*'0px'/)
  assert.doesNotMatch(onboarding, /onboarding-page--keyboard[^}]*display:\s*none/)
  assert.match(onboarding, /onboarding-page--keyboard\s+\.onboarding-footer\s*\{\s*padding-bottom:\s*15\.267rpx/)
  assert.match(main, /!store\.session\.is_authenticated\s*\|\|\s*store\.requires_local_verification/)
  assert.match(main, /watch\(setup_required,\s*value\s*=>\s*\{\s*if\s*\(value\)\s*continue_setup\(\)/)
  assert.match(main, /if\s*\(!visible\s*\|\|\s*redirecting\)\s*return/)
  assert.match(main, /relaunch_route\(startup_destination\(store\)\)/)
  assert.match(main, /onHide\(\(\)\s*=>\s*\{\s*visible\s*=\s*false;\s*stop_clock\(\)/)
  assert.match(main, /v-if="setup_required"/)
  assert.match(main, /CustomTabBar\s+v-if="!setup_required"/)
})
