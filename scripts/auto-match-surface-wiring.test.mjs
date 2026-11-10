import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { home_destination, require_home_destination_ready } from '../src/utils/homeNavigation.js'

const ref = value => ({ value })
const computed = getter => ({ get value() { return getter() } })
const read = file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const script = file => parse(read(file)).descriptor.scriptSetup.content.replace(/^import .*$/gm, '')
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function home_fixture() {
  const calls = [], gate = defer(), controller = {}, endpoints = {}
  const store = { auth_context: 'account-a', session: { current_user_id: 'user-a' }, home_feed: { status: 'ready', cards: [], match_card: null, destinations: { match: '/pages/auto-match/index', profile: '/pages/profile/index', discover: '/pages/discover/index' } } }
  const surface = { borrowed: ref(false), navigate: async (user_id, dispatch) => { calls.push({ kind: 'surface', user_id, anchor: endpoints.source.anchor(), identity: endpoints.source.identity() }); return dispatch() } }
  const args = {
    ref, computed, watch() {}, getCurrentInstance: () => ({ proxy: {} }), onUnmounted() {}, nextTick: async () => {}, onHide() {}, onShow() {}, onResize() {},
    use_app_store: () => store, home_destination, require_home_destination_ready,
    switch_tab_route: async url => { calls.push({ kind: 'tab', url }); return true },
    create_content_refresh: () => ({ cancel() {}, start: async () => ({ success: true }) }), MOTION: {},
    clear_match_ignition: () => calls.push({ kind: 'clear-ignition' }), auto_match_surface: controller,
    use_send_surface_source: endpoint => { endpoints.source = endpoint; return surface },
    connection_visual_revision: {}, take_connection_visuals: () => [], capture_avatar_relay() {}, resume_home_avatar_relay() {}, clear_avatar_relay() {},
    use_auto_match_guide: (_page, options) => { endpoints.guide = options; return {} },
  }
  const subject = new Function(...Object.keys(args), `${script('pages/home/index.vue')}\nreturn { navigate, navigating, frame, match_header, match_cta }`)(...Object.values(args))
  subject.frame.value = { navigate_forward: url => { calls.push({ kind: 'forward', url }); return gate.promise } }
  return { subject, calls, gate, controller, endpoints, store }
}

test('Home lightning and either rendered Start Auto Match CTA bind the actual clicked anchor and one real entry navigation', async () => {
  for (const clicked of ['header', 'cta']) {
    const h = home_fixture(), header = { id: 'lightning' }, cta = { id: 'list-tail-or-empty-cta' }
    h.subject.match_header.value = { $el: header }; h.subject.match_cta.value = { $el: cta }
    const pending = h.subject.navigate('match', clicked)
    assert.equal(h.subject.navigating.value, true)
    assert.equal(await h.subject.navigate('match', clicked === 'header' ? 'cta' : 'header'), false)
    const cue = h.calls.filter(call => call.kind === 'surface')
    assert.equal(cue.length, 1)
    assert.equal(cue[0].anchor, clicked === 'header' ? header : cta)
    assert.deepEqual(cue[0].identity, { auth_context: 'account-a', user_id: 'user-a' })
    assert.equal(cue[0].user_id, 'user-a')
    assert.equal(h.endpoints.source.controller, h.controller)
    assert.deepEqual(h.calls.filter(call => call.kind === 'forward'), [{ kind: 'forward', url: '/pages/auto-match/index' }])
    assert.equal(h.calls.filter(call => call.kind === 'clear-ignition').length, 1)
    h.gate.resolve(true)
    assert.equal(await pending, true)
    assert.equal(h.subject.navigating.value, false)
  }
})

test('Home first-use teaching entry anchors to the real lightning without joining or changing quota', async () => {
  const h = home_fixture(), anchor = { id: 'lightning' }, before = structuredClone(h.store)
  h.subject.match_header.value = anchor
  const pending = h.endpoints.guide.open_entry()
  assert.equal(h.calls.find(call => call.kind === 'surface').anchor, anchor)
  assert.deepEqual(h.store, before)
  h.gate.resolve(true); assert.equal(await pending, true)
})

test('Home status card continues its real active match route and does not borrow the entry point transition', async () => {
  const h = home_fixture()
  h.store.home_feed.match_card = { destination: '/pages/auto-match/paused?match_id=match-a' }
  const pending = h.subject.navigate('status')
  assert.equal(h.calls.filter(call => call.kind === 'surface').length, 0)
  assert.deepEqual(h.calls.filter(call => call.kind === 'forward'), [{ kind: 'forward', url: '/pages/auto-match/paused?match_id=match-a' }])
  h.gate.resolve(true); assert.equal(await pending, true)
})

function entry_fixture({ mode = true, presentation_busy = false, page_busy = false } = {}) {
  const calls = [], hooks = {}, controller = {}, endpoints = {}, gate = defer()
  const surface = { surface_mode: ref(mode), busy: ref(presentation_busy), borrowed: ref(false), style: ref({}), enter: () => { calls.push('enter'); return mode }, back: dispatch => { calls.push('surface-back'); return dispatch() } }
  const page = { store: { auth_context: 'account-a', session: { current_user_id: 'user-a' } }, frame: ref(null), c: ref({}), error: ref(''), modal: ref(''), query: ref(''), busy: ref(page_busy), is_loading: ref(false), loading_label: ref(''), guard: ref(''), action: async name => { calls.push(`page:${name}`); return true } }
  const args = {
    ref, computed, onLoad: callback => { hooks.load = callback }, onReady: callback => { hooks.ready = callback }, onHide: callback => { hooks.hide = callback },
    land_match_ignition_for_entry: () => calls.push('old-ignition'), use_auto_match_page: () => page,
    auto_match_surface: controller, use_send_surface_target: endpoint => { endpoints.target = endpoint; return surface },
    use_auto_match_guide: (_page, options) => { endpoints.guide = options; return {} },
  }
  const subject = new Function(...Object.keys(args), `${script('pages/auto-match/index.vue')}\nreturn { action, returning, busy, guide_ready }`)(...Object.values(args))
  page.frame.value = { navigate_back_with: (present, fallback) => { calls.push(`frame-back:${fallback}`); return present(() => { calls.push('real-back'); return gate.promise }) } }
  return { subject, calls, hooks, controller, endpoints, surface, page, gate }
}

test('Auto Match entry and guard Return Home share one 180ms-capable surface return and immediately block repeats', async () => {
  for (const name of ['goBack', 'returnHome']) {
    const h = entry_fixture()
    h.hooks.load(); h.hooks.ready()
    assert.equal(h.endpoints.target.controller, h.controller)
    assert.deepEqual(h.endpoints.target.identity(), { auth_context: 'account-a', user_id: 'user-a' })
    const pending = h.subject.action(name)
    assert.equal(h.subject.busy.value, true)
    assert.equal(await h.subject.action(name), false)
    assert.equal(await h.subject.action('joinPool'), false)
    assert.equal(h.calls.filter(call => call === 'surface-back').length, 1)
    assert.equal(h.calls.filter(call => call === 'real-back').length, 1)
    assert.equal(h.calls.includes('old-ignition'), false)
    assert.equal(h.calls.some(call => call.startsWith('page:')), false)
    h.gate.resolve(true); assert.equal(await pending, true)
    assert.equal(h.subject.returning.value, false)
  }
})

test('entry guide waits for presentation to finish, and teaching Back uses the same real source return', async () => {
  const h = entry_fixture({ presentation_busy: true })
  h.subject.guide_ready.value = true
  assert.equal(h.endpoints.guide.ready.value, false)
  h.surface.busy.value = false
  assert.equal(h.endpoints.guide.ready.value, true)
  h.page.guard.value = 'Session ended'
  assert.equal(h.endpoints.guide.ready.value, false)
  h.page.guard.value = ''
  const pending = h.endpoints.guide.return_home()
  assert.ok(h.calls.includes('surface-back'))
  h.gate.resolve(true); assert.equal(await pending, true)
})

test('direct/non-Home entry retains ordinary navigation, and joining/history/preferences still delegate their existing business handlers', async () => {
  const plain = entry_fixture({ mode: false })
  plain.hooks.load(); plain.hooks.ready()
  assert.ok(plain.calls.includes('old-ignition'))
  await plain.subject.action('goBack')
  assert.ok(plain.calls.includes('page:goBack'))
  assert.ok(!plain.calls.includes('surface-back'))
  const point = entry_fixture()
  for (const action of ['openPrefs', 'openHistory', 'joinPool']) await point.subject.action(action)
  assert.deepEqual(point.calls, ['page:openPrefs', 'page:openHistory', 'page:joinPool'])
  point.surface.busy.value = true
  assert.equal(await point.subject.action('openPrefs'), false)
  point.surface.busy.value = false; point.page.busy.value = true
  assert.equal(await point.subject.action('joinPool'), false)
})

test('pages reuse the real frames and independent Teleport destinations, with no copied business tree or additional timing', () => {
  const home = parse(read('pages/home/index.vue')), entry = parse(read('pages/auto-match/index.vue'))
  assert.deepEqual(home.errors, []); assert.deepEqual(entry.errors, [])
  assert.match(home.descriptor.template.content, /<Teleport to="#cimoa-auto-match-surface-source" :disabled="!surface\.borrowed\.value">/)
  assert.match(entry.descriptor.template.content, /<Teleport to="#cimoa-auto-match-surface-target" :disabled="!surface\.borrowed\.value">/)
  assert.equal((home.descriptor.template.content.match(/ref="match_cta"/g) || []).length, 2, 'only one of the empty/populated source CTAs is rendered')
  assert.match(entry.descriptor.template.content, /:surface-motion="surface\.surface_mode\.value"/)
  assert.match(entry.descriptor.template.content, /:inert="surface\.busy\.value \|\| returning \? '' : undefined"/)
  assert.match(entry.descriptor.template.content, /:aria-busy="busy"/)
  assert.doesNotMatch(entry.descriptor.scriptSetup.content, /setTimeout|setInterval|cloneNode|canvas|innerHTML|createElement/)
  assert.doesNotMatch(home.descriptor.scriptSetup.content, /begin_match_ignition|localStorage|sessionStorage|cloneNode|innerHTML/)
})
