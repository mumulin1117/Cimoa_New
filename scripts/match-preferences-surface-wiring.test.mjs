import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'

const ref = value => ({ value })
const computed = getter => ({ get value() { return getter() } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const drain = async () => { for (let index = 0; index < 8; index++) await Promise.resolve() }

function fixture(page = 'preferences', { mode = true, source_busy = false, target_busy = false, back_result = true, save_failure = false } = {}) {
  const calls = [], hooks = { load: [], hide: [], show: [], ready: [], unload: [], unmount: [] }, watchers = [], controller = {}, endpoints = {}
  const loading = ref(false), save_gate = deferred(), return_gate = deferred()
  let cancelled = false
  const presentation = { error: '', match: { status: page }, route: `/pages/auto-match/${page}?match_id=match-a`, active: null }
  const store = {
    auth_context: 'account-a', session: { account_id: 'account-a', current_user_id: 'user-a' },
    match_preferences: { owner_user_id: 'user-a', university: 'HKUST', age_min: 18, age_max: 30, interest_ids: ['hiking'] },
    match_presentation: () => presentation, tick() {},
    update_match_preferences: patch => {
      calls.push({ kind: 'write', patch: structuredClone(patch) })
      if (save_failure) return { success: false, message: 'Couldn’t update matching preferences. Please try again.' }
      Object.assign(store.match_preferences, patch)
      return { success: true }
    },
  }
  const source = { borrowed: ref(false), busy: ref(source_busy), navigate: async (user_id, dispatch) => { calls.push({ kind: 'source-surface', user_id }); return dispatch() } }
  const target = { borrowed: ref(false), busy: ref(target_busy), surface_mode: ref(mode), style: ref({}), enter: () => { calls.push({ kind: 'enter', draft_ready: !!subject.draft.value }); return mode }, back: dispatch => { calls.push({ kind: 'target-surface' }); return back_result === true ? dispatch() : back_result } }
  const args = {
    ref, computed, nextTick: callback => Promise.resolve().then(callback), watch: (source, callback) => { watchers.push({ source, callback }) },
    onLoad: fn => hooks.load.push(fn), onShow: fn => hooks.show.push(fn), onReady: fn => hooks.ready.push(fn), onHide: fn => hooks.hide.push(fn), onUnload: fn => hooks.unload.push(fn), onUnmounted: fn => hooks.unmount.push(fn),
    current_route: () => `pages/auto-match/${page}`,
    use_app_store: () => store, make_operation_id: () => 'operation-a', MOTION: {}, FEEDBACK: { preferences_updated: 'Preferences updated' }, show_toast: text => calls.push({ kind: 'toast', text }),
    use_write_loading: () => ({
      is_loading: loading,
      cancel_loading: () => { cancelled = true; loading.value = false; save_gate.resolve() },
      run_with_loading: async callback => { calls.push({ kind: 'loading' }); loading.value = true; await save_gate.promise; if (cancelled) return { success: false, reason: 'cancelled' }; try { return await callback({}) } finally { loading.value = false } },
    }),
    match_preferences_surface: controller,
    use_send_surface_source: endpoint => { endpoints.source = endpoint; return source },
    use_send_surface_target: endpoint => { endpoints.target = endpoint; return target },
  }
  const body = read('composables/useAutoMatchPage.js').replace(/^import .*$/gm, '').replace('export function use_auto_match_page', 'function use_auto_match_page')
  const subject = new Function(...Object.keys(args), `${body}\nreturn use_auto_match_page`)(...Object.values(args))(page)
  const back = fallback => { calls.push({ kind: 'back', fallback }); return return_gate.promise }
  subject.frame.value = {
    $el: { id: 'real-page-frame' },
    navigate_forward: async url => { calls.push({ kind: 'forward', url }); return return_gate.promise },
    navigate_replace: async url => { calls.push({ kind: 'replace', url }); return true },
    navigate_relaunch: async url => { calls.push({ kind: 'relaunch', url }); return true },
    navigate_back: back,
    navigate_back_with: async (present, fallback) => {
      calls.push({ kind: 'frame-return', fallback })
      const result = await present(() => back(fallback))
      return result === null ? back(fallback) : result
    },
  }
  hooks.load.forEach(fn => fn({ match_id: 'match-a' }))
  return { subject, store, source, target, controller, endpoints, calls, hooks, watchers, presentation, loading, save_gate, return_gate }
}

test('all four preference entry sources borrow their unique full real frame and lock repeat navigation immediately', async () => {
  for (const page of ['index', 'searching', 'paused', 'no-match']) {
    const h = fixture(page), trigger = page === 'no-match' ? 'adjustPrefs' : 'openPrefs'
    const pending = h.subject.action(trigger)
    assert.equal(h.subject.busy.value, true, page)
    await h.subject.action(trigger)
    assert.equal(h.subject.prefs_target, null)
    assert.equal(h.endpoints.source.controller, h.controller)
    assert.equal(h.endpoints.source.element(), h.subject.frame.value.$el)
    assert.deepEqual(h.endpoints.source.identity(), { auth_context: 'account-a', user_id: 'user-a' })
    assert.equal(h.calls.filter(call => call.kind === 'source-surface').length, 1)
    assert.deepEqual(h.calls.filter(call => call.kind === 'forward'), [{ kind: 'forward', url: '/pages/auto-match/preferences' }])
    assert.ok(!h.calls.some(call => call.kind === 'write' || call.kind === 'loading'))
    h.return_gate.resolve(true)
    assert.equal(await pending, true)
    assert.equal(h.subject.busy.value, false)
  }
})

test('preferences prepares its draft before claiming the target and leaves fields and nested pickers unchanged', async () => {
  const h = fixture(), original = structuredClone(h.store.match_preferences)
  assert.equal(h.subject.prefs_source, null)
  assert.equal(h.endpoints.target.controller, h.controller)
  assert.deepEqual(h.calls, [{ kind: 'enter', draft_ready: true }])
  await h.subject.action('openUniPicker')
  assert.equal(h.subject.modal.value, 'university')
  await h.subject.action('onUniSearch', { detail: { value: 'HK' } })
  assert.equal(h.subject.query.value, 'HK')
  await h.subject.action('pick', null, { key: 'university', value: 'HKU' })
  assert.equal(h.subject.modal.value, '')
  assert.equal(h.subject.draft.value.university, 'HKU')
  await h.subject.action('openInterestsPicker')
  assert.equal(h.subject.modal.value, 'interests')
  assert.deepEqual(h.store.match_preferences, original)
  assert.ok(!h.calls.some(call => call.kind === 'write' || call.kind === 'loading'))
})

test('X closes through a single controller-owned return and does not write the draft', async () => {
  const h = fixture()
  h.subject.draft.value.university = 'HKU'
  const pending = h.subject.action('goBack')
  assert.equal(h.subject.busy.value, true)
  await h.subject.action('goBack'); await h.subject.action('savePrefs')
  assert.equal(h.calls.filter(call => call.kind === 'frame-return').length, 1)
  assert.equal(h.calls.filter(call => call.kind === 'target-surface').length, 1)
  assert.equal(h.calls.filter(call => call.kind === 'back').length, 1)
  assert.ok(!h.calls.some(call => ['loading', 'write', 'relaunch'].includes(call.kind)))
  h.return_gate.resolve(true); assert.equal(await pending, true)
  assert.equal(h.store.match_preferences.university, 'HKUST')
})

test('Save keeps its existing write Loading, commits once, then uses the same collapse before real return', async () => {
  const h = fixture()
  h.subject.draft.value.university = 'HKU'
  const pending = h.subject.action('savePrefs')
  assert.equal(h.loading.value, true)
  await h.subject.action('savePrefs'); await h.subject.action('goBack')
  assert.ok(!h.calls.some(call => call.kind === 'write' || call.kind === 'target-surface' || call.kind === 'back'))
  assert.equal(h.store.match_preferences.university, 'HKUST')
  h.save_gate.resolve(); await drain()
  assert.equal(h.calls.filter(call => call.kind === 'write').length, 1)
  assert.equal(h.store.match_preferences.university, 'HKU')
  assert.equal(h.calls.filter(call => call.kind === 'target-surface').length, 1)
  assert.equal(h.calls.filter(call => call.kind === 'back').length, 1)
  assert.ok(!('owner_user_id' in h.calls.find(call => call.kind === 'write').patch))
  assert.equal(h.subject.busy.value, true)
  h.return_gate.resolve(true); await pending
  assert.equal(h.subject.busy.value, false)
  assert.deepEqual(h.calls.map(call => call.kind), ['enter', 'loading', 'write', 'frame-return', 'target-surface', 'back', 'toast'])
})

test('failed Save keeps all choices and the page open with a real retry error', async () => {
  const h = fixture('preferences', { save_failure: true }), original = structuredClone(h.store.match_preferences)
  h.subject.draft.value.university = 'HKU'
  const pending = h.subject.action('savePrefs'); h.save_gate.resolve(); await pending
  assert.match(h.subject.error.value, /Couldn’t update matching preferences/)
  assert.equal(h.subject.draft.value.university, 'HKU')
  assert.deepEqual(h.store.match_preferences, original)
  assert.ok(!h.calls.some(call => ['frame-return', 'back', 'toast'].includes(call.kind)))
  assert.equal(h.subject.busy.value, false)
})

test('presentation busy blocks editing, child dialogs and saves until the full page is settled', async () => {
  const h = fixture('preferences', { target_busy: true }), original = structuredClone(h.subject.draft.value)
  for (const [name, event, row] of [['openUniPicker'], ['openInterestsPicker'], ['pick', null, { key: 'university', value: 'HKU' }], ['savePrefs'], ['goBack']]) await h.subject.action(name, event, row)
  assert.deepEqual(h.subject.draft.value, original)
  assert.equal(h.subject.modal.value, '')
  assert.deepEqual(h.calls, [{ kind: 'enter', draft_ready: true }])
  h.target.busy.value = false
  await h.subject.action('openUniPicker')
  assert.equal(h.subject.modal.value, 'university')
})

test('a cancelled bottom presentation never becomes fallback navigation or a false successful update Toast', async () => {
  const back = fixture('preferences', { back_result: false })
  assert.equal(await back.subject.action('goBack'), false)
  assert.equal(back.calls.filter(call => call.kind === 'back').length, 0)
  const save = fixture('preferences', { back_result: false })
  save.subject.draft.value.university = 'HKU'
  const pending = save.subject.action('savePrefs'); save.save_gate.resolve(); await pending
  assert.equal(save.store.match_preferences.university, 'HKU', 'already committed preferences are not falsely rolled back')
  assert.equal(save.calls.filter(call => call.kind === 'back' || call.kind === 'toast').length, 0)
})

test('missing association uses one ordinary return, while refresh/direct entry retains its regular safe route', async () => {
  for (const options of [{ back_result: null }, { mode: false }]) {
    const h = fixture('preferences', options)
    const pending = h.subject.action('goBack')
    h.return_gate.resolve(true); assert.equal(await pending, true)
    assert.equal(h.calls.filter(call => call.kind === 'back').length, 1)
    assert.equal(h.calls.filter(call => call.kind === 'target-surface').length, options.mode === false ? 0 : 1)
  }
})

test('hiding during write Loading cancels pending Save without committing or returning later', async () => {
  const h = fixture(), original = structuredClone(h.store.match_preferences)
  h.subject.draft.value.university = 'HKU'
  const pending = h.subject.action('savePrefs')
  h.hooks.hide.forEach(fn => fn()); await pending
  assert.deepEqual(h.store.match_preferences, original)
  assert.ok(!h.calls.some(call => ['write', 'frame-return', 'back', 'toast'].includes(call.kind)))
})

test('matching status that changes under Preferences is followed only after the real original page resumes and is released', async () => {
  const h = fixture('searching', { source_busy: true })
  h.hooks.hide.forEach(fn => fn()); h.hooks.ready.forEach(fn => fn())
  h.presentation.match.status = 'found'; h.presentation.route = '/pages/auto-match/found?match_id=match-a'
  h.hooks.show.forEach(fn => fn()); await drain()
  assert.equal(h.calls.filter(call => call.kind === 'replace').length, 0)
  h.source.busy.value = false
  h.watchers.find(row => row.source === h.source.busy).callback(false, true)
  await drain()
  assert.deepEqual(h.calls.filter(call => call.kind === 'replace'), [{ kind: 'replace', url: '/pages/auto-match/found?match_id=match-a' }])
})

test('only real preferences/source frames gain Teleports; Home point receipt remains an independent outer owner', () => {
  for (const page of ['index', 'searching', 'paused', 'no-match', 'preferences']) {
    const { descriptor, errors } = parse(read(`pages/auto-match/${page}.vue`))
    assert.deepEqual(errors, [])
    assert.equal((descriptor.template.content.match(/<SecondaryPageFrame /g) || []).length, 1)
    const destination = page === 'preferences' ? 'target' : 'source'
    assert.match(descriptor.template.content, new RegExp(`<Teleport to="#cimoa-match-preferences-surface-${destination}"`))
    assert.doesNotMatch(descriptor.scriptSetup.content, /setTimeout|cloneNode|createElement|innerHTML|localStorage/)
    if (page === 'preferences') {
      assert.match(descriptor.template.content, /:surface-motion="prefs_target\.surface_mode\.value"/)
      assert.match(descriptor.template.content, /:inert="prefs_target\.busy\.value \? '' : undefined"/)
      assert.match(descriptor.template.content, /<AutoMatchPreferenceConfirmDialog /)
    }
    if (page === 'index') assert.match(descriptor.template.content, /<Teleport to="#cimoa-auto-match-surface-target"[\s\S]*<Teleport to="#cimoa-match-preferences-surface-source"/)
  }
})

test('Preferences X and its header consume the shared measured touch minimum without shrinking or replacing its icon', () => {
  const page = read('pages/auto-match/preferences.vue')
  const close = page.match(/\.am-1514-2\s*\{([^}]+)\}/)[1]
  const header = page.match(/\.am-1513-1\s*\{([^}]+)\}/)[1]
  const icon = page.match(/\.am-1515-3\s*\{([^}]+)\}/)[1]
  assert.match(close, /min-width:\s*var\(--app-touch-target\)/)
  assert.match(close, /min-height:\s*var\(--app-touch-target\)/)
  assert.match(header, /min-height:\s*var\(--app-touch-target\)/)
  assert.doesNotMatch(header, /overflow:\s*(?:hidden|clip)/)
  assert.match(icon, /width:\s*38\.168rpx/)
  assert.match(icon, /height:\s*38\.168rpx/)
  assert.match(read('styles/touch.css'), /--app-touch-target:\s*calc\(84rpx \* var\(--app-touch-scale,\s*1\)\)/)
  // This checks the production stylesheet contract, not rendered touch geometry;
  // browser and WKWebView runners must still measure the actual 320pt target.
})

test('University picker exposes one top-right Dismiss X and leaves the Interests header unchanged', () => {
  const source = read('components/AutoMatchPreferenceConfirmDialog.vue')
  const { descriptor, errors } = parse(source)
  assert.deepEqual(errors, [])
  assert.match(descriptor.scriptSetup.content, /import SourceIcon from '\.\/SourceIcon\.vue'/)
  assert.match(descriptor.template.content, /v-else-if="modal === 'university'" class="match-picker-dismiss"/)
  assert.match(descriptor.template.content, /aria-label="Dismiss"/)
  assert.match(descriptor.template.content, /data-interaction="sheetUniPicker\.closeSheet\.click\.2"/)
  assert.match(descriptor.template.content, /@click\.stop="!busy && \$emit\('action','closeSheet'\)"/)
  assert.doesNotMatch(descriptor.template.content, /v-if="modal === 'interests'" class="match-picker-dismiss"/)
  const style = descriptor.styles.map(row => row.content).join('\n')
  const dismiss = style.match(/\.match-picker-dismiss\s*\{([^}]+)\}/)[1]
  assert.match(dismiss, /min-width:\s*var\(--app-touch-target\)/)
  assert.match(dismiss, /min-height:\s*var\(--app-touch-target\)/)
  assert.match(dismiss, /background:\s*var\(--cimoa-surface-tinted\)/)
})
