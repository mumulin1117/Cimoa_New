import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { auth_message, auth_loading_message, create_auth_notice_controller } from '../src/utils/authFeedback.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('authentication copy preserves actionable validation and real service boundaries', () => {
  for (const message of [
    'Enter a valid email and password.',
    'Passwords don’t match yet',
    'That code is incorrect. Enter the six-digit reset code.',
    'Enter a six-digit verification code.',
    'You need to be 18 or older to create an account.',
    'Please confirm all three community agreements.',
    'Support delivery is currently unavailable. Please try again later.',
    'Log in and complete account verification before profile setup.',
    'Complete the previous profile steps first.',
  ]) assert.equal(auth_message(message), message)
  assert.equal(auth_message('  Enter your email.  '), 'Enter your email.')
  assert.equal(auth_message(''), 'This action couldn’t be completed. Please try again.')
  assert.equal(auth_message(null, 'Please retry this step.'), 'Please retry this step.')
})

test('authentication copy removes environment and saved-data wording without inventing success', () => {
  assert.equal(auth_message('Saved data is unavailable.'), 'Your information is unavailable.')
  assert.equal(auth_message('Saved account data is unavailable.'), 'Your account information is unavailable.')
  assert.equal(auth_message('Saved reset data is unavailable.'), 'Your reset information is unavailable.')
  assert.equal(auth_message('Your agreement could not be saved. Please try again.'), 'Your agreement couldn’t be updated. Please try again.')
  for (const input of [
    'local demo unavailable',
    'injected persistence failure',
    'TypeError: Cannot read properties of undefined',
    'ReferenceError in localStorage',
    '/Users/developer/src/auth.vue:42',
    'node_modules/private-adapter.js failed',
    'Failed to execute setItem on Storage',
    'navigateTo:fail page not found',
  ]) {
    const result = auth_message(input)
    assert.equal(result, 'This action couldn’t be completed. Please try again.')
    assert.doesNotMatch(result, /\b(?:local|saved|demo|fixture|injected|TypeError|ReferenceError)\b/i)
    assert.doesNotMatch(result, /\b(?:success|sent|approved|verified)\b/i)
  }
  for (const input of ['QuotaExceededError', 'Device storage is full', 'There is not enough device space']) {
    assert.equal(auth_message(input), 'Your device doesn’t have enough space. Free up some space and try again.')
  }
})

test('controlled progress copy is formal and never exposes legacy Saving or demo captions', () => {
  for (const input of ['', undefined, null, 'Saving your agreement…', 'Saving profile…', 'Saved account data', 'local account', 'draft update', 'demo action', 'record update']) {
    assert.equal(auth_loading_message(input), 'Please wait…')
  }
  for (const input of ['Signing in…', 'Confirming your agreement…', 'Creating your account…', 'Updating your profile…', 'Checking code…', 'Updating your password…']) {
    assert.equal(auth_loading_message(` ${input} `), input)
  }
})

test('auth notice has one controlled owner and deduplicates identical updates', () => {
  let starts = 0
  const notice = create_auth_notice_controller({ on_start: () => { starts++ } })
  const first = Symbol('first'), second = Symbol('second')
  assert.equal(notice.current, null)
  const id = notice.show(first, 'Signing in…')
  assert.equal(notice.current.id, id)
  assert.equal(notice.current.owner, first)
  assert.equal(notice.current.message, 'Signing in…')
  assert.equal(notice.current.tone, 'progress')
  assert.equal(notice.current.busy, true)
  assert.ok(Object.isFrozen(notice.current))
  assert.equal(notice.show(first, 'Signing in…'), id)
  assert.equal(starts, 1)
  const updated = notice.show(first, 'Checking code…')
  assert.notEqual(updated, id)
  assert.equal(notice.current.message, 'Checking code…')
  assert.equal(starts, 2)
  const replaced = notice.show(second, 'Confirming your agreement…')
  assert.notEqual(replaced, updated)
  assert.equal(notice.current.owner, second)
  assert.equal(notice.dismiss(first), false)
  assert.equal(notice.current.id, replaced)
  assert.equal(notice.dismiss(second), true)
  assert.equal(notice.current, null)
  assert.equal(notice.dismiss(second), false)
})

test('clear and stale-owner cleanup cannot dismiss later work; subscriptions release cleanly', () => {
  const notice = create_auth_notice_controller(), first = Symbol('first'), second = Symbol('second'), events = []
  const unsubscribe = notice.subscribe(value => events.push(value))
  assert.deepEqual(events, [null])
  notice.show(first, 'Saving your agreement…')
  assert.equal(events.at(-1).message, 'Please wait…')
  notice.clear(); assert.equal(notice.current, null)
  const count = events.length
  notice.clear(); assert.equal(events.length, count)
  notice.show(second, 'Updating profile…')
  assert.equal(notice.dismiss(first), false)
  assert.equal(notice.current.owner, second)
  unsubscribe(); unsubscribe()
  const released_count = events.length
  notice.clear(); notice.show(first, 'Signing in…'); notice.dismiss(first)
  assert.equal(events.length, released_count)
  assert.doesNotMatch(read('src/utils/authFeedback.js'), /\b(?:setTimeout|setInterval|requestAnimationFrame|Date|performance|schedule|cancelTimeout|clearTimeout)\b/)
})

test('authentication loading is a lifecycle connector, not the old page-level AppLoading', () => {
  const wrapper = read('src/components/AuthActionLoading.vue'), connector = read('src/components/ActionLoading.vue')
  assert.match(wrapper, /<ActionLoading :visible="visible" :label="label" scope="auth"/)
  assert.doesNotMatch(connector, /AppLoading|<view|\b(?:setTimeout|setInterval|localStorage|indexedDB)\b/)
  assert.match(connector, /const owner = Symbol\('action-loading'\)/)
  assert.match(connector, /action_notice\.show\(owner, props\.label, \{ scope: props\.scope \}\)/)
  assert.match(connector, /action_notice\.dismiss\(owner\)/)
  assert.match(connector, /onHide\(\(\) => \{ active = false; release\(\) \}\)/)
  assert.match(connector, /onShow\(\(\) => \{ active = true; sync\(\) \}\)/)
  assert.match(connector, /onUnmounted\(release\)/)
  assert.match(connector, /flush: 'sync'/)
  assert.match(read('src/utils/authNotice.js'), /create_auth_notice_controller\(\{ on_start: clear_toast \}\)/)
})

test('busy notices share the single global brand card and keep normal Toast dismissal separate', () => {
  const host = read('src/components/BrandToastHost.vue'), mount = read('src/utils/toastHost.js')
  assert.match(host, /pending\.value\s*\|\|\s*notification\.value/)
  assert.match(host, /auth_notice\.subscribe/)
  assert.match(host, /onUnmounted\(\(\) => \{ stop\(\); stop_pending\(\) \}\)/)
  assert.match(host, /v-if="pending" class="auth-notice-blocker brand-action-blocker"/)
  assert.match(host, /:aria-busy="!!current\.busy"/)
  assert.match(host, /<BrandProgressMark v-if="current\.busy"/)
  assert.match(host, /v-if="!current\.busy" class="brand-toast-close"/)
  assert.match(host, /top: calc\(var\(--app-safe-top\)/)
  assert.match(host, /z-index: 10000/)
  assert.match(host, /var\(--cimoa-gradient-toast-border\)/)
  assert.match(host, /var\(--cimoa-surface-toast\)/)
  assert.match(host, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(host, /AppLoading|\b(?:setTimeout|setInterval)\s*\(/)
  assert.match(mount, /document\.getElementById\('cimoa-toast-root'\)/)
  assert.match(mount, /document\.body\.appendChild\(root\)/)
  const toast = read('src/utils/toast.js')
  assert.match(toast, /tone === 'error' \|\| tone === 'warning' \? 5000 : 3500/)
  assert.match(toast, /schedule\(\(\) => dismiss\(id, 'timeout'\), duration\)/)
})

test('agreement and profile copy changed without altering the original 500ms write contract', () => {
  const welcome = read('src/pages/auth/welcome.vue')
  assert.match(welcome, /await run_with_loading\(\(\) => store\.set_app_consent\(true\)\)/)
  assert.match(welcome, /label="Confirming your agreement…"/)
  assert.doesNotMatch(welcome, /Saving your agreement|eula-loading/)
  assert.match(read('src/components/OnboardingFrame.vue'), /AuthActionLoading[^>]*label="Updating your profile…"/)
  const operation = read('src/utils/writeOperation.js')
  assert.match(operation, /run\(action, duration = 500\)/)
  assert.match(operation, /requested_duration = Number\.isFinite\(duration\) \? duration : 500/)
  assert.match(operation, /Math\.max\(400, Math\.min\(600, requested_duration\)\)/)
  assert.match(operation, /cancelled = \(\) => \(\{ success: false, reason: 'cancelled' \}\)/)
  assert.match(operation, /task\.resolve\(cancelled\(\)\)/)
})
