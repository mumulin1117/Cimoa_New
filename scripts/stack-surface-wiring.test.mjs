import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { MOTION, NAVIGATION, STACK_SURFACE_MOTION } from '../src/config/navigation.js'

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const drain = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture() {
  const hooks = {}, calls = [], props = { contentMotion: false, surfaceMotion: false, nativeMotion: true }
  let api, keyboard_ready = true, keyboard_gate
  const args = {
    ref: value => ({ value }), defineProps: () => props, defineEmits: () => () => {}, defineExpose: value => { api = value },
    onMounted() {}, onShow: fn => { hooks.show = fn }, onHide: fn => { hooks.hide = fn }, onUnmounted: fn => { hooks.unmount = fn },
    MOTION, NAVIGATION, push_route: async url => { calls.push(['push', url]); return true }, back_route: async () => true, relaunch_route: async url => { calls.push(['relaunch', url]); return true }, replace_route: async url => { calls.push(['replace', url]); return true }, notify_route_ready() {},
    create_startup_handoff: () => ({ start: async () => ({ reason: 'complete' }), cancel() {} }),
    create_auth_keyboard_handoff: () => ({ prepare: async () => { calls.push(['keyboard']); if (keyboard_gate) await keyboard_gate.promise; return { ready: keyboard_ready, reason: keyboard_ready ? 'stable' : 'cancelled' } }, cancel() {}, dispose() {} }),
    create_page_return: () => ({ run: async () => { calls.push(['fallback-return']); return true }, cancel() {}, dispose() {} }),
  }
  const source = read('src/components/PageTransition.vue').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  new Function(...Object.keys(args), source)(...Object.values(args))
  return { api, hooks, calls, props, keyboard: value => { keyboard_ready = value }, gate: value => { keyboard_gate = value } }
}
test('the scoped native presenter runs after actual keyboard readiness with no extra return delay', async () => {
  const f = fixture(), gate = deferred(); f.gate(gate)
  const pending = f.api.navigate_forward('/pages/events/report?event_id=a', dispatch => { f.calls.push(['present']); return dispatch() })
  await drain(); assert.deepEqual(f.calls, [['keyboard']])
  gate.resolve(); assert.equal(await pending, true)
  assert.deepEqual(f.calls, [['keyboard'], ['present'], ['push', '/pages/events/report?event_id=a']])
})
test('duplicate requests share one route promise and a different button cannot double-push', async () => {
  const f = fixture(), gate = deferred(); let presented = 0
  const show = async dispatch => { presented++; await gate.promise; return dispatch() }
  const first = f.api.navigate_forward('/pages/auth/login', show)
  assert.equal(f.api.navigate_forward('/pages/auth/login', show), first)
  assert.equal(await f.api.navigate_forward('/pages/auth/age', show), false)
  await drain(); assert.equal(presented, 1); gate.resolve(); await first
  assert.equal(f.calls.filter(row => row[0] === 'push').length, 1)
})
test('hide and unmount reject a presenter’s delayed dispatch rather than navigating from a hidden source', async () => {
  for (const event of ['hide', 'unmount']) {
    const f = fixture(), gate = deferred()
    const pending = f.api.navigate_forward('/pages/auth/login', async dispatch => { await gate.promise; return dispatch() })
    await drain(); f.hooks[event](); gate.resolve(); assert.equal(await pending, false)
    assert.ok(!f.calls.some(row => row[0] === 'push'))
  }
})
test('keyboard cancellation and presenter rejection release the lock for a real retry', async () => {
  const f = fixture(); f.keyboard(false)
  assert.equal(await f.api.navigate_forward('/pages/auth/login', dispatch => dispatch()), false)
  f.keyboard(true)
  await assert.rejects(f.api.navigate_forward('/pages/auth/login', () => { throw Error('Cannot present') }), /Cannot present/)
  assert.equal(await f.api.navigate_forward('/pages/auth/login', dispatch => dispatch()), true)
})
test('replace and relaunch keep their exact semantics, and unrelated pages do not get keyboard coordination', async () => {
  const f = fixture(); f.props.nativeMotion = false
  await f.api.navigate_replace('/pages/events/upcoming'); await f.api.navigate_relaunch('/pages/home/index')
  assert.deepEqual(f.calls, [['replace', '/pages/events/upcoming'], ['relaunch', '/pages/home/index']])
})
test('whole-frame Teleports preserve actual root attributes, safety regions and legacy point-surface API', () => {
  for (const file of ['src/components/SecondaryPageFrame.vue', 'src/components/MainTabFrame.vue']) {
    const source = read(file), result = parse(source)
    assert.deepEqual(result.errors, [])
    assert.match(source, /defineOptions\(\{ inheritAttrs: false \}\)/)
    assert.match(source, /get \$el\(\) \{ return root\.value\?\.\$el \|\| root\.value \}/)
    assert.match(source, /<Teleport :to="stack\.destination\.value" :disabled="!stack\.borrowed\.value">/)
    assert.match(source, /v-bind="\{ \.\.\.\$attrs, \.\.\.frame_scopes \}"/)
    assert.match(source, /frame_scope_attributes\(instance\)/)
    assert.match(source, /stack\.busy\.value \? '' : \$attrs\.inert/)
    assert.match(source, /dispatch => stack\.forward\(url, dispatch\)/)
  }
  const source = read('src/components/SecondaryPageFrame.vue')
  assert.match(source, /navigate_back_with\(dispatch => stack\.back\(dispatch\)\)/)
  assert.match(source, /navigate_back_with: \(present,/)
  assert.match(source, /:surface-motion="surfaceMotion \|\| stack\.suppress\.value"/)
  assert.match(source, /:native-motion="stack\.eligible\.value"/)
  assert.match(source, /<TopSafeArea/); assert.match(source, /<BottomSafeArea/)
})
test('app installs one reused host and clears visual associations on auth, background and destruction', () => {
  const source = read('src/App.vue')
  assert.match(source, /install_send_surface_host\(\{ controller: stack_surface \}\)/)
  for (const reason of ['identity-changed', 'background', 'host-removed']) assert.ok(source.includes(`stack_surface.clear('${reason}')`))
  assert.equal(MOTION.page, 240); assert.equal(MOTION.back, 180)
  assert.match(STACK_SURFACE_MOTION.enter_easing, /^cubic-bezier/)
  assert.equal(STACK_SURFACE_MOTION.parallax, 0.3)
})
test('ordinary group navigation retains unsent text while media, pending writes and invalid access still clear', () => {
  const source = read('src/pages/events/group.vue')
  const declaration = source.split('\n').find(line => line.startsWith('const clear_transient = '))
  const draft = { value: 'A message I have not sent' }, preview_id = { value: 'preview-a' }, calls = []
  const clear_transient = new Function('draft', 'preview_id', 'clear', 'cancel', declaration + '; return clear_transient')(draft, preview_id, () => calls.push('media'), () => calls.push('write'))
  clear_transient({ discard_text: false })
  assert.equal(draft.value, 'A message I have not sent'); assert.equal(preview_id.value, '')
  assert.deepEqual(calls, ['media', 'write'])
  clear_transient(); assert.equal(draft.value, '')
  assert.match(source, /watch\(group_error, value => \{ if \(value\) \{ clear_transient\(\)/)
  assert.match(source, /onUnmounted\(clear_transient\)/)
})
