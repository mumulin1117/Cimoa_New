import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { AUTHENTICATED_MAIN_ROUTE, authenticated_destination, auth_destination, startup_destination } from '../src/utils/authNavigation.js'
import { ONBOARDING_FLOW, onboarding_route } from '../src/utils/onboardingFlow.js'

const ready = patch => ({ hydration_status: 'ready', session: { is_authenticated: true }, requires_local_verification: false, onboarding: null, ...patch })
const source = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('completed login and cold session restoration share the approved Home default without state writes', () => {
  assert.equal(AUTHENTICATED_MAIN_ROUTE, '/pages/home/index')
  assert.equal(auth_destination(AUTHENTICATED_MAIN_ROUTE), AUTHENTICATED_MAIN_ROUTE)
  assert.equal(auth_destination('/pages/discover/index'), '/pages/discover/index')
  for (const onboarding of [null, { step: 'complete', completed: true }]) {
    const store = ready({ onboarding }), before = structuredClone(store)
    assert.equal(authenticated_destination(store), AUTHENTICATED_MAIN_ROUTE)
    assert.equal(startup_destination(store), AUTHENTICATED_MAIN_ROUTE)
    assert.deepEqual(store, before)
  }
})

test('pending verification and every unfinished profile step remain ahead of the Home default', () => {
  assert.equal(startup_destination(ready({ requires_local_verification: true, onboarding: { completed: true } })), '/pages/auth/verification/code')
  for (const step of ONBOARDING_FLOW) {
    const store = ready({ onboarding: { step, completed: false } })
    assert.equal(authenticated_destination(store), onboarding_route(step))
    assert.equal(startup_destination(store), onboarding_route(step))
  }
})

test('guests, signed-out registration and hydration errors retain their existing safe entry points', () => {
  const guest = ready({ session: { is_authenticated: false } })
  assert.equal(startup_destination(guest), '/pages/auth/welcome')
  assert.equal(startup_destination({ ...guest, local_verification: { verified: false } }), '/pages/auth/verification/code')
  assert.equal(startup_destination({ ...guest, local_verification: { verified: true } }), '/pages/auth/verification/success')
  assert.throws(() => startup_destination({ ...guest, hydration_status: 'error', hydration_error: 'Please retry.' }), /Please retry/)
  assert.throws(() => auth_destination('/pages/not-registered'), /currently unavailable/)
})

test('all completed authentication page exits reuse the same main route while preserving skeleton preparation', () => {
  for (const file of ['src/composables/useOnboarding.js', 'src/pages/onboarding/complete.vue', 'src/pages/auth/verification/success.vue']) {
    const text = source(file)
    assert.match(text, /import\s*\{[^}]*AUTHENTICATED_MAIN_ROUTE[^}]*\}\s*from\s*'@\/utils\/authNavigation\.js'/)
    assert.doesNotMatch(text, /['"]\/pages\/(home|discover)\/index['"]/)
  }
  const login = source('src/pages/auth/login.vue'), complete = source('src/pages/onboarding/complete.vue')
  assert.match(login, /prepare_main_tab_skeleton\(store\.auth_context\)/)
  assert.match(login, /frame\.value\.navigate_relaunch\(authenticated_destination\(store\)\)/)
  assert.match(complete, /prepare_main_tab_skeleton\(store\.auth_context\)/)
  assert.match(complete, /frame\.value\.navigate_relaunch\(AUTHENTICATED_MAIN_ROUTE\)/)
  assert.doesNotMatch(login, /\brelaunch_route\(/)
  assert.doesNotMatch(complete, /\brelaunch_route\(/)
})
