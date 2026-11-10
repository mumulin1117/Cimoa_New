import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { computed, effectScope, nextTick, ref, watch } from 'vue'

function fixture(t, page = 'searching') {
  const hooks = { load: [], show: [], ready: [], hide: [], unload: [], unmount: [] }, calls = []
  const clock = ref(0), state = ref({ match_id: 'one', status: page })
  let route = `pages/auto-match/${page}`
  const store = {
    session: { account_id: 'account', current_user_id: 'person' },
    tick: () => clock.value++,
    match_presentation: () => { void clock.value; return { match: state.value, route: `/pages/auto-match/${state.value.status}?match_id=one` } },
  }
  const args = {
    computed, nextTick, ref, watch, onUnmounted: hook => hooks.unmount.push(hook),
    ...Object.fromEntries(['Load', 'Show', 'Ready', 'Hide', 'Unload'].map(name => [`on${name}`, hook => hooks[name.toLowerCase()].push(hook)])),
    use_app_store: () => store, make_operation_id: () => 'operation',
    use_write_loading: () => ({ is_loading: ref(false), cancel_loading() {}, run_with_loading: async action => ({ success: true, data: await action({}) }) }),
    MOTION: {}, FEEDBACK: {}, show_toast() {}, current_route: () => route,
    match_preferences_surface: {},
    use_send_surface_source: () => ({ busy: ref(false) }),
    use_send_surface_target: () => ({ busy: ref(false), surface_mode: ref(false), enter() {} }),
  }
  const source = fs.readFileSync(new URL('../src/composables/useAutoMatchPage.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace('export function', 'function')
  const create = new Function(...Object.keys(args), source + '\nreturn use_auto_match_page')(...Object.values(args))
  const scope = effectScope(), model = scope.run(() => create(page))
  t.after(() => { hooks.unmount.forEach(hook => hook()); scope.stop() })
  model.frame.value = Object.fromEntries(['forward', 'replace', 'relaunch', 'back'].map(kind => [`navigate_${kind}`, async url => { calls.push({ kind, url }); route = url.replace(/^\//, '').split('?')[0]; return true }]))
  hooks.load.forEach(hook => hook({ match_id: 'one' }))
  hooks.show.forEach(hook => hook())
  hooks.ready.forEach(hook => hook())
  return { model, hooks, calls, store, state, route: value => { route = value } }
}

test('unloaded Searching cannot pull Home back into an active request before Vue unmount', async t => {
  const f = fixture(t)
  await nextTick()
  f.hooks.unload.forEach(hook => hook()) // reLaunch/redirectTo need not send onHide.
  f.route('pages/home/index')
  f.state.value = { match_id: 'one', status: 'waiting' }
  f.store.tick()
  await nextTick(); await nextTick()
  assert.deepEqual(f.calls, [], 'An unloaded page no longer owns automatic navigation')
})

test('a delayed match watcher cannot navigate when another real route owns the screen', async t => {
  const f = fixture(t)
  await nextTick()
  f.route('pages/home/index')
  f.state.value = { match_id: 'one', status: 'waiting' }
  await nextTick(); await nextTick()
  assert.deepEqual(f.calls, [])
})

test('late show/ready and taps on an unloaded Waiting frame cannot dispatch a route', async t => {
  const f = fixture(t, 'waiting')
  await nextTick()
  f.hooks.unload.forEach(hook => hook())
  f.hooks.show.forEach(hook => hook())
  f.hooks.ready.forEach(hook => hook())
  await f.model.action('returnHome')
  await f.model.action('goBack')
  assert.deepEqual(f.calls, [])
})

for (const action of ['returnHome', 'goBack']) test(`visible Waiting ${action} goes to Home once without a business write`, async t => {
  const f = fixture(t, 'waiting')
  await nextTick()
  await Promise.all([f.model.action(action), f.model.action(action)])
  assert.deepEqual(f.calls, [{ kind: 'relaunch', url: '/pages/home/index' }])
  assert.deepEqual(f.state.value, { match_id: 'one', status: 'waiting' })
})

test('hidden pages resume following only after their real show, not while another page is active', async t => {
  const f = fixture(t)
  await nextTick()
  f.hooks.hide.forEach(hook => hook())
  f.state.value = { match_id: 'one', status: 'waiting' }
  await nextTick()
  assert.deepEqual(f.calls, [])
  f.hooks.show.forEach(hook => hook())
  await nextTick(); await nextTick()
  assert.deepEqual(f.calls, [{ kind: 'replace', url: '/pages/auto-match/waiting?match_id=one' }])
})
