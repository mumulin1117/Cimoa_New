import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_auth_notice_controller } from '../src/utils/authFeedback.js'
import { action_notice, auth_notice } from '../src/utils/authNotice.js'
import { create_write_operation } from '../src/utils/writeOperation.js'
import { MOTION } from '../src/config/navigation.js'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('business and authentication progress share one owner-aware singleton', () => {
  assert.equal(action_notice, auth_notice)
  let starts = 0
  const notice = create_auth_notice_controller({ on_start: () => { starts++ } }), events = []
  const first = Symbol('group'), second = Symbol('profile'), unsubscribe = notice.subscribe(value => events.push(value))
  const id = notice.show(first, 'Sending your message…', { scope: 'event' })
  assert.equal(notice.current.scope, 'event')
  assert.equal(notice.current.tone, 'progress'); assert.equal(notice.current.busy, true)
  assert.ok(Object.isFrozen(notice.current))
  assert.equal(notice.show(first, 'Sending your message…', { scope: 'event' }), id)
  assert.equal(starts, 1)
  assert.notEqual(notice.show(first, 'Sending your message…', { scope: 'app' }), id)
  assert.equal(starts, 2)
  notice.show(second, 'Updating your profile…', { scope: 'profile' })
  assert.equal(notice.dismiss(first), false)
  assert.equal(notice.current.owner, second)
  assert.equal(notice.current.scope, 'profile')
  assert.equal(notice.dismiss(second), true)
  assert.equal(notice.current, null)
  assert.equal(events.at(-1), null)
  unsubscribe(); const count = events.length
  notice.show(first, 'Please wait…', { scope: 'unknown' })
  assert.equal(notice.current.scope, 'app'); notice.clear()
  assert.equal(events.length, count)
})

test('cancelled write resolves and cannot write or dismiss a newer loading owner', async () => {
  const timers = { pending: new Map(), setTimeout(fn, ms) { const id = Symbol(); this.pending.set(id, { fn, ms }); return id }, clearTimeout(id) { this.pending.delete(id) } }
  const notice = create_auth_notice_controller(), old = Symbol('old'), current = Symbol('current')
  let writes = 0
  const operation = create_write_operation({ timers, set_loading: value => value ? notice.show(old, 'Sending your message…', { scope: 'event' }) : notice.dismiss(old) })
  const pending = operation.run(() => { writes++; return { success: true } })
  assert.equal([...timers.pending.values()][0].ms, 500)
  assert.equal(writes, 0)
  assert.equal((await operation.run(() => { writes++ })).reason, 'busy')
  notice.show(current, 'Updating your profile…', { scope: 'profile' })
  operation.cancel()
  assert.deepEqual(await pending, { success: false, reason: 'cancelled' })
  assert.equal(timers.pending.size, 0); assert.equal(writes, 0)
  assert.equal(notice.current.owner, current)
  assert.equal(notice.current.scope, 'profile')
})

test('all blocking loading wrappers delegate presentation and lifecycle to one connector', () => {
  for (const [file, scope] of [['AppLoading', 'app'], ['AuthActionLoading', 'auth'], ['EventActionLoading', 'event'], ['ProfileActionLoading', 'profile'], ['CoinActionLoading', 'coin']]) {
    const source = read(`src/components/${file}.vue`)
    assert.match(source, /import ActionLoading from/)
    assert.ok(source.includes(`scope="${scope}"`))
    assert.match(source, /:visible="visible" :label="label"/)
    assert.doesNotMatch(source, /position:\s*fixed|<svg|loading-ring|\b(?:setTimeout|setInterval|localStorage|indexedDB)\b/)
  }
  const connector = read('src/components/ActionLoading.vue')
  assert.match(connector, /action_notice\.show\(owner, props\.label, \{ scope: props\.scope \}\)/)
  assert.match(connector, /action_notice\.dismiss\(owner\)/)
  assert.match(connector, /props\.visible, props\.label, props\.scope/)
  assert.match(connector, /onHide\(\(\) => \{ active = false; release\(\) \}\)/)
  assert.match(connector, /onShow\(\(\) => \{ active = true; sync\(\) \}\)/)
  assert.match(connector, /onUnmounted\(release\)/)
  assert.match(connector, /flush: 'sync'/)
})

test('brand SVG has semantic theme colors, central motion and reduced/background motion handling', () => {
  const source = read('src/components/BrandProgressMark.vue')
  assert.match(source, /<svg\b/); assert.match(source, /<linearGradient/)
  for (const color of ['cyan', 'blue', 'purple', 'pink']) assert.ok(source.includes(`var(--cimoa-brand-${color})`))
  assert.doesNotMatch(source, /#[\da-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/)
  for (const name of ['action_orbit', 'action_breathe']) { assert.ok(Number.isFinite(MOTION[name]) && MOTION[name] > 0); assert.ok(source.includes(`MOTION.${name}`)) }
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/)
  assert.match(source, /visibilitychange/); assert.match(source, /animation-play-state: paused/)
  assert.match(source, /removeEventListener\('visibilitychange', visibility\)/)
  assert.doesNotMatch(source, /\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(/)
})

test('global busy presentation preserves brand card, safety markers and non-dismissible semantics', () => {
  const source = read('src/components/BrandToastHost.vue')
  assert.match(source, /<BrandProgressMark v-if="current\.busy"/)
  assert.match(source, /brand-action-loading loading/)
  assert.match(source, /:data-loading-scope="current\.busy \? current\.scope : (?:null|undefined)"/)
  assert.match(source, /:aria-busy="!!current\.busy"/)
  assert.match(source, /v-if="!current\.busy" class="brand-toast-close"/)
  assert.match(source, /auth-notice-blocker brand-action-blocker/)
  assert.match(source, /top: calc\(var\(--app-safe-top\)/)
  assert.match(source, /var\(--cimoa-gradient-toast-border\)/)
  assert.match(source, /var\(--cimoa-surface-toast\)/)
  assert.doesNotMatch(source, /<ConnectionIcon[^>]*name="clock"|\b(?:setTimeout|setInterval)\s*\(/)
})

test('private chat stays inline with the same SVG and group sends have operation-specific copy', () => {
  const inline = read('src/components/ChatActionLoading.vue')
  assert.match(inline, /<BrandProgressMark\s*\/>/)
  assert.match(inline, /display: inline-flex/)
  assert.match(inline, /v-show="visible"/)
  assert.doesNotMatch(inline, /ActionLoading|action_notice|position:\s*fixed|loading__ring/)
  const group = read('src/pages/events/group.vue')
  assert.match(group, /<ChatVoiceConfirmDialog[^>]*:sending="is_loading && sheet === 'voice'"/)
  assert.match(group, /<EventActionLoading[^>]*:visible="is_loading && sheet !== 'voice'"/)
  for (const label of ['Sending your message…', 'Sending your photo…', 'Sending your voice message…']) assert.ok(group.includes(label), `Missing ${label}`)
  assert.doesNotMatch(group, /Saving event group/)
  const match = read('src/composables/useAutoMatchPage.js')
  for (const label of ['Pausing your search…', 'Resuming your search…']) assert.ok(match.includes(label), `Missing ${label}`)
  assert.match(read('src/components/ProfileActionLoading.vue'), /Updating your profile…/)
})
