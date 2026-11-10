import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'

const source = fs.readFileSync(new URL('../src/composables/useDiscoverGuide.js', import.meta.url), 'utf8')
const factory = source.replace(/^import .*$/gm, '').replace('export function', 'function') + '\nreturn use_discover_guide'
const settle = async () => { for (let i = 0; i < 8; i++) await nextTick() }
function setup(page, initial = {}) {
  const hooks = { show: [], hide: [], unmount: [] }, calls = [], loading = ref(false), active = ref(true), ready = ref(true)
  const store = reactive({ auth_context: 'account-a', discover_guide: { eligible: true, receipt: null, started: false, target_available: true, target_user_id: 'person-a', step: 0, ...initial } })
  store.begin_discover_guide = id => { calls.push(['begin', id]); store.discover_guide.started = true; return { success: true } }
  store.move_discover_guide = value => { calls.push(['step', value]); store.discover_guide.step = value; return { success: true } }
  store.finish_discover_guide = (outcome, context) => { calls.push(['finish', outcome, context]); store.discover_guide.receipt = { outcome }; store.discover_guide.started = false; store.discover_guide.eligible = false; return { success: true } }
  const dependencies = { computed, nextTick, ref, watch, onUnmounted: fn => hooks.unmount.push(fn), onHide: fn => hooks.hide.push(fn), onShow: fn => hooks.show.push(fn), use_app_store: () => store, use_write_loading: () => ({ is_loading: loading, cancel_loading: () => { loading.value = false }, run_with_loading: async fn => { loading.value = true; const result = fn({ is_current: () => active.value }); loading.value = false; return result } }) }
  const callbacks = Object.fromEntries(['open_profile', 'return_discover', 'open_intro', 'open_answer', 'return_select'].map(name => [name, async () => { calls.push([name]); return true }]))
  const selected = ref(false), scope = effectScope()
  let guide
  scope.run(() => { guide = new Function(...Object.keys(dependencies), factory)(...Object.values(dependencies))(page, { ready, available: () => active.value, user_id: () => 'person-a', mode: () => 'text', can_next: () => selected.value, element: () => ({ getAnimations: () => [], querySelector: selector => ({ scrollIntoView: () => calls.push(['scroll', selector]) }) }), ...callbacks }) })
  const show = () => hooks.show.forEach(fn => fn()), hide = () => hooks.hide.forEach(fn => fn())
  const dispose = () => { hooks.unmount.forEach(fn => fn()); scope.stop() }
  return { guide, calls, callbacks, ready, active, store, selected, show, hide, dispose }
}
test('Discover waits readiness, begins the exact current person, then opens the actual profile once', async () => {
  const f = setup('discover'); f.ready.value = false; f.show(); await settle()
  assert.equal(f.guide.open.value, false); assert.equal(f.calls.length, 0)
  f.ready.value = true; await settle(); assert.equal(f.guide.open.value, true)
  await f.guide.next(); await settle()
  assert.equal(f.store.discover_guide.step, 1)
  assert.deepEqual(f.calls.filter(row => row[0] === 'open_profile'), [['open_profile']])
  f.dispose()
})
test('actual Back from profile resumes Send on Discover without a synthetic forward route', async () => {
  const f = setup('discover', { started: true, step: 1 }); f.show(); await settle()
  assert.equal(f.store.discover_guide.step, 2); assert.equal(f.guide.open.value, true)
  assert.ok(!f.calls.some(row => row[0] === 'open_profile' || row[0] === 'open_intro'))
  f.dispose()
})
test('real question selection is mandatory and mode moves only to the actual answer route', async () => {
  const f = setup('select', { started: true, step: 3 }); f.show(); await settle()
  assert.equal(f.guide.next_disabled.value, true); await f.guide.next()
  assert.equal(f.store.discover_guide.step, 3)
  f.selected.value = true; await f.guide.next(); await settle()
  assert.equal(f.store.discover_guide.step, 4); assert.equal(f.guide.open.value, true)
  assert.ok(f.calls.some(row => row[0] === 'scroll' && row[1] === '.ice-modes'))
  await f.guide.next(); assert.equal(f.store.discover_guide.step, 5)
  assert.deepEqual(f.calls.filter(row => row[0] === 'open_answer'), [['open_answer']])
  f.dispose()
})
test('answer explanations never call media or introduction actions and finish only at the last step', async () => {
  const f = setup('voice', { started: true, step: 5 }); f.show(); await settle()
  await f.guide.next(); assert.equal(f.store.discover_guide.step, 6)
  await f.guide.next(); await settle()
  assert.deepEqual(f.calls.filter(row => row[0] === 'finish'), [['finish', 'completed', 'account-a']])
  assert.equal(f.guide.open.value, false)
  f.dispose()
})
test('hidden and unavailable pages cannot respond to Next, Back or Skip', async () => {
  const f = setup('select', { started: true, step: 4 }); f.show(); await settle(); f.hide(); await settle()
  const before = f.calls.length
  await f.guide.next(); await f.guide.back(); await f.guide.skip()
  assert.equal(f.calls.length, before); assert.equal(f.guide.open.value, false)
  f.dispose()
})
test('the orchestration uses only guide actions and existing navigation callbacks, not business or storage APIs', () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|setStorage|send_introduction|purchase|request_permission|getUserMedia|setTimeout|setInterval|uni\.navigate/)
  for (const file of ['index.vue', 'profile.vue', 'icebreaker/select.vue', 'icebreaker/text.vue', 'icebreaker/voice.vue']) {
    const page = fs.readFileSync(new URL('../src/pages/discover/' + file, import.meta.url), 'utf8')
    assert.match(page, /use_discover_guide\(/)
    assert.match(page, /<DiscoverGuide/)
    assert.match(page, /Updating your preferences…/)
  }
})
