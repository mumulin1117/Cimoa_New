import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bind_card_pointer_events, create_pointer_gesture } from '../src/utils/discoverSwipe.js'
import { DISCOVER_DECK } from '../src/config/discoverDeck.js'
import { MOTION } from '../src/config/navigation.js'

const point = (pointerId = 1, clientX = 100, clientY = 100, extra = {}) => ({ pointerId, clientX, clientY, button: 0, isPrimary: true, preventDefault() { this.prevented = true }, ...extra })
const fixture = (options = {}) => {
  const calls = [], captures = new Set()
  const element = { getBoundingClientRect: () => ({ width: 353, height: 500 }), setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) }
  const gesture = create_pointer_gesture({ element: () => element, start: row => calls.push(['start', row]), move: row => calls.push(['move', row]), end: row => calls.push(['end', row]), cancel: row => calls.push(['cancel', row]), ...options })
  return { gesture, calls, captures }
}
test('one finger tap is clickable, but a moved or cancelled contact cannot synthesize a click', () => {
  const { gesture, calls, captures } = fixture()
  gesture.start(point()); gesture.end(point(1, 102)); assert.equal(gesture.can_click(), true)
  gesture.start(point()); gesture.move(point(1, 200)); gesture.end(point(1, 230))
  assert.equal(calls.filter(([kind]) => kind === 'end').length, 2); assert.equal(gesture.can_click(), false); assert.equal(captures.size, 0)
  gesture.start(point()); gesture.cancel(point()); assert.equal(gesture.can_click(), false)
  gesture.start(point()); gesture.end(point()); assert.equal(gesture.can_click(), true, 'A fresh deliberate tap remains available')
})
test('pointercancel and lost capture emit only cancel, release capture, and ignore late up/move', () => {
  for (const phase of ['pointercancel', 'lostpointercapture']) {
    const { gesture, calls, captures } = fixture()
    gesture.start(point()); gesture.move(point(1, 260)); gesture.cancel({ pointerId: 1, type: phase })
    gesture.end(point(1, 300)); gesture.move(point(1, 330))
    assert.equal(calls.filter(([kind]) => kind === 'cancel').length, 1)
    assert.equal(calls.filter(([kind]) => kind === 'end').length, 0); assert.equal(captures.size, 0)
  }
})
test('a second finger anywhere cancels the original swipe instead of allowing its final commit', () => {
  const { gesture, calls } = fixture()
  gesture.start(point()); gesture.move(point(1, 260)); gesture.additional(point(2, 280, 100, { isPrimary: false }))
  gesture.start(point(2, 280, 100, { isPrimary: false })); gesture.end(point(1, 300)); gesture.end(point(2, 330))
  assert.equal(calls.filter(([kind]) => kind === 'start').length, 1)
  assert.equal(calls.filter(([kind]) => kind === 'cancel').length, 1)
  assert.equal(calls.filter(([kind]) => kind === 'end').length, 0); assert.equal(gesture.can_click(), false)
})
test('unrelated pointer up/cancel cannot release or finish an owned contact', () => {
  const { gesture, calls, captures } = fixture()
  gesture.start(point()); gesture.cancel(point(2)); gesture.end(point(2))
  assert.equal(captures.has(1), true); assert.equal(calls.length, 1)
  gesture.end(point()); assert.equal(calls.filter(([kind]) => kind === 'end').length, 1)
})
test('secondary, right-button, disabled and invalid-coordinate input never starts a gesture', () => {
  const { gesture, calls } = fixture({ can_start: event => !event.disabled })
  for (const extra of [{ isPrimary: false }, { button: 2 }, { disabled: true }, { clientX: NaN }, { clientY: Infinity }]) gesture.start(point(1, 100, 100, extra))
  assert.deepEqual(calls, [])
})
test('becoming disabled mid-contact cancels synchronously before a delayed Vue watcher can run', () => {
  let enabled = true
  const { gesture, calls } = fixture({ can_start: () => enabled })
  gesture.start(point()); gesture.move(point(1, 250)); enabled = false; gesture.end(point(1, 290))
  assert.equal(calls.filter(([kind]) => kind === 'cancel').length, 1)
  assert.equal(calls.filter(([kind]) => kind === 'end').length, 0); assert.equal(gesture.can_click(), false)
})
test('vertical scrolling wins over profile-question or audio-seek horizontal gestures', () => {
  const { gesture, calls, captures } = fixture({ capture: 'horizontal', cancel_vertical: true })
  const vertical = point(1, 102, 140)
  gesture.start(point()); assert.equal(captures.size, 0); gesture.move(vertical); gesture.end(point(1, 300, 160))
  assert.equal(vertical.prevented, undefined); assert.equal(captures.size, 0)
  assert.equal(calls.filter(([kind]) => kind === 'cancel').length, 1); assert.equal(calls.filter(([kind]) => kind === 'end').length, 0)
})
test('horizontal ownership captures only after intent, flushes final coordinate and never depends on hover', () => {
  const { gesture, calls, captures } = fixture({ capture: 'horizontal', cancel_vertical: true })
  gesture.start(point()); assert.equal(captures.size, 0)
  const horizontal = point(1, 125, 101); gesture.move(horizontal)
  assert.equal(horizontal.prevented, true); assert.equal(captures.has(1), true)
  gesture.end(point(1, 180, 103))
  const final = calls.find(([kind]) => kind === 'end')[1]
  assert.equal(final.clientX, 180); assert.equal(final.startX, 100); assert.equal(final.axis, 'horizontal'); assert.equal(captures.size, 0)
})
test('range sensitivity can recognize a short diagonal drag without stealing a clear vertical scroll', () => {
  const responsive = fixture({ capture: 'horizontal', cancel_vertical: true, slop: () => 2, horizontal_bias: .7 })
  responsive.gesture.start(point()); const diagonal = point(1, 103, 104); responsive.gesture.move(diagonal)
  assert.equal(diagonal.prevented, true); assert.equal(responsive.captures.has(1), true)
  const scrolling = fixture({ capture: 'horizontal', cancel_vertical: true, slop: () => 2, horizontal_bias: .7 })
  scrolling.gesture.start(point()); const vertical = point(1, 102, 105); scrolling.gesture.move(vertical)
  assert.equal(vertical.prevented, undefined); assert.equal(scrolling.calls.filter(([kind]) => kind === 'cancel').length, 1)
})
test('a scrolling refresher does not prevent native vertical movement or capture the pointer', () => {
  const { gesture, captures } = fixture({ capture: false, prevent_move: false })
  gesture.start(point()); const event = point(1, 102, 180); gesture.move(event); gesture.end(event)
  assert.equal(event.prevented, undefined); assert.equal(captures.size, 0)
})
test('background, pagehide and unbind remove every local/document/window pointer listener', () => {
  const document = new EventTarget(), window = new EventTarget(), element = new EventTarget()
  document.defaultView = window; document.hidden = false; element.ownerDocument = document
  let cancelled = 0, suspended = 0, additional = 0, ended = 0
  const unbind = bind_card_pointer_events(element, { start() {}, move() {}, end() { ended++ }, cancel() { cancelled++ }, additional() { additional++ }, suspend() { suspended++ } })
  document.dispatchEvent(new Event('visibilitychange')); assert.equal(cancelled, 0)
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'))
  document.dispatchEvent(new Event('pointerdown')); document.dispatchEvent(new Event('pointerup'))
  assert.deepEqual([cancelled, suspended, additional, ended], [2, 2, 1, 1])
  unbind(); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); document.dispatchEvent(new Event('pointerdown')); document.dispatchEvent(new Event('pointerup')); element.dispatchEvent(new Event('pointercancel'))
  assert.deepEqual([cancelled, suspended, additional, ended], [2, 2, 1, 1])
})

const refresh_fixture = () => {
  const source = readFileSync(new URL('../src/components/MainTabFrame.vue', import.meta.url), 'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const ref = value => ({ value }), computed = read => ({ get value() { return read() } }), hooks = {}, events = []
  const props = { pullToRefresh: true, refreshEnabled: true, refreshing: false, scrollLocked: false, route: 'pages/home/index' }
  const bindings = { computed, ref, watch() {}, getCurrentInstance: () => ({ proxy: {} }), nextTick: fn => Promise.resolve().then(fn), onUnmounted: fn => { hooks.unmount = fn }, onShow: fn => { hooks.show = fn }, onHide: fn => { (hooks.hide ||= []).push(fn) }, use_app_store: () => ({ hydration_status: 'ready', session: { is_authenticated: true } }), use_main_tab_skeleton: () => ref(false), route_depth: () => 1, relaunch_route() {}, startup_destination() {}, MOTION: {}, defineProps: () => props, defineEmits: () => (...args) => events.push(args), defineExpose() {}, uni: { upx2px: value => value / (750 / 393) }, bind_card_pointer_events, create_pointer_gesture }
  bindings.defineOptions = () => {}
  bindings.frame_scope_attributes = () => ({})
  bindings.use_stack_surface = () => ({ forward: (_url, dispatch) => dispatch() })
  const state = new Function(...Object.keys(bindings), source + '\nreturn { refresh, cancel_pull, stop_pull, pull_gesture, pull_progress, refresher_triggered }')(...Object.values(bindings))
  return { state, props, hooks, events }
}
test('refresher emits once even before the parent async busy prop has rendered', () => {
  const { state, events } = refresh_fixture()
  state.refresh(); state.refresh(); state.refresh()
  assert.deepEqual(events, [['refresh']]); assert.equal(state.refresher_triggered.value, true)
})
test('cancelled refresh ignores a late scroll-view refresh event until a fresh deliberate contact', async () => {
  const { state, events } = refresh_fixture()
  await state.cancel_pull(); state.refresh(); assert.deepEqual(events, [])
  state.pull_gesture.start(point()); state.refresh(); state.refresh()
  assert.deepEqual(events, [['refresh']])
})
test('page hide/unmount suppresses stale refresher completion and returns to rest', async () => {
  const { state, hooks, events } = refresh_fixture()
  const cancellation = state.cancel_pull(); for (const hide of hooks.hide) hide(); await cancellation
  state.refresh(); assert.deepEqual(events, []); assert.equal(state.refresher_triggered.value, false); assert.equal(state.pull_progress.value, 0)
  hooks.unmount(); state.refresh(); assert.deepEqual(events, [])
})

const audio_fixture = async () => {
  const source = readFileSync(new URL('../src/components/RequestAudioPlayer.vue', import.meta.url), 'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const ref = value => ({ value }), computed = read => ({ get value() { return read() } }), hooks = {}, seeks = []
  let destroyed = 0, play_count = 0
  const player = { duration: 20, seek: seconds => seeks.push(seconds), destroy: () => { destroyed++ }, pause() {}, play: async () => { play_count++ } }
  const bindings = { computed, ref, watch(source, fn, options) { if (options?.immediate) fn() }, onShow: fn => { hooks.show = fn }, onHide: fn => { hooks.hide = fn }, onUnmounted: fn => { hooks.unmount = fn }, defineProps: () => ({ src: '/voice.m4a', duration: 20000 }), create_audio_playback: async () => player, bind_card_pointer_events, create_pointer_gesture }
  const state = new Function(...Object.keys(bindings), source + '\nreturn { seek_gesture, seek_position, waveform, pending, toggle }')(...Object.values(bindings))
  state.waveform.value = { getBoundingClientRect: () => ({ left: 50, width: 200, height: 44 }), setPointerCapture() {}, hasPointerCapture: () => false }
  await Promise.resolve(); await Promise.resolve()
  return { state, hooks, seeks, destroyed: () => destroyed, play_count: () => play_count }
}
test('voice slider previews a touch in place and seeks the real player once, only on release', async () => {
  const { state, seeks } = await audio_fixture()
  state.seek_gesture.start(point(1, 100)); assert.equal(state.seek_position.value, 5)
  state.seek_gesture.move(point(1, 250)); assert.equal(state.seek_position.value, 20); assert.deepEqual(seeks, [])
  state.seek_gesture.end(point(1, 200)); assert.deepEqual(seeks, [15]); assert.equal(state.seek_position.value, null)
  state.seek_gesture.end(point(1, 230)); assert.deepEqual(seeks, [15])
})
test('cancel, vertical scroll, second finger and page hide never commit an unfinished audio seek', async () => {
  for (const interrupt of ['cancel', 'vertical', 'additional', 'hide', 'unmount']) {
    const { state, hooks, seeks, destroyed } = await audio_fixture()
    state.seek_gesture.start(point(1, 100))
    if (interrupt === 'cancel') state.seek_gesture.cancel(point())
    if (interrupt === 'vertical') state.seek_gesture.move(point(1, 102, 150))
    if (interrupt === 'additional') state.seek_gesture.additional(point(2, 120, 100, { isPrimary: false }))
    if (interrupt === 'hide') hooks.hide()
    if (interrupt === 'unmount') hooks.unmount()
    state.seek_gesture.end(point(1, 230))
    assert.deepEqual(seeks, [], interrupt); assert.equal(state.seek_position.value, null, interrupt)
    if (interrupt === 'hide' || interrupt === 'unmount') assert.equal(destroyed(), 1)
  }
})
test('voice control ignores repeated play taps and cannot start seeking while busy', async () => {
  const { state, seeks, play_count } = await audio_fixture()
  const first = state.toggle(); const duplicate = state.toggle(); await Promise.all([first, duplicate])
  assert.equal(play_count(), 1)
  state.pending.value = true; state.seek_gesture.start(point()); state.seek_gesture.end(point(1, 200))
  assert.deepEqual(seeks, []); assert.equal(state.seek_position.value, null)
})

// Execute the real parent gesture callbacks and the real card setup together:
// a utility-only fake would miss disabled becoming true because of its own drag.
const discover_parent_card_fixture = () => {
  const page = readFileSync(new URL('../src/pages/discover/index.vue', import.meta.url), 'utf8')
  assert.match(page, /:disabled="!ready \|\| navigating \|\| dragging \|\| settling \|\| resetting"/)
  assert.match(page, /:gesture-disabled="!ready \|\| navigating \|\| settling \|\| resetting \|\| guide\.open\.value"/)
  const source = page.slice(page.indexOf('let pointer_id = null'), page.indexOf('const styles = computed'))
  const ref = value => ({ value }), computed = read => ({ get value() { return read() } }), jobs = new Map(), watchers = []
  let serial = 0
  const state = Object.fromEntries(['drag_x', 'drag_y', 'card_width', 'card_height', 'dragging', 'settling', 'resetting', 'navigating', 'card_index', 'content_loading', 'navigation_error'].map(key => [key, ref(['card_width', 'card_height'].includes(key) ? 1 : key === 'card_index' || key.startsWith('drag_') ? 0 : false)]))
  state.people = ref([{ user_id: 'one' }, { user_id: 'two' }]); state.person = ref(state.people.value[0])
  const bindings = { ...state, ref, computed, watch() {}, onMounted() {}, onShow() {}, onHide() {}, onUnmounted() {}, nextTick: () => Promise.resolve(), setTimeout: fn => { jobs.set(++serial, fn); return serial }, clearTimeout: id => jobs.delete(id), requestAnimationFrame: fn => { jobs.set(++serial, fn); return serial }, cancelAnimationFrame: id => jobs.delete(id), DISCOVER_DECK, swipe_commits: (distance, width) => Math.abs(distance) >= width / 3, entrance: { interrupt() {}, dispose() {} }, store: { auth_context: 'account', remember_discover_card: id => { state.card_index.value = state.people.value.findIndex(person => person.user_id === id) } } }
  bindings.guide = { open: ref(false) }
  const parent = new Function(...Object.keys(bindings), source + '\nreturn { begin_drag, move_drag, finish_drag, guard_until: () => ignore_click_until }')(...Object.values(bindings))
  const props = { front: true, skeleton: false, person: { user_id: 'one' }, depth: 0 }
  Object.defineProperties(props, { disabled: { get: () => state.navigating.value || state.dragging.value || state.settling.value || state.resetting.value }, gestureDisabled: { get: () => state.navigating.value || state.settling.value || state.resetting.value } })
  const calls = []
  const card_source = readFileSync(new URL('../src/components/DiscoverProfileCard.vue', import.meta.url), 'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const card_bindings = { computed, ref, defineProps: () => props, defineEmits: () => (kind, row) => { calls.push(kind); if (kind === 'drag-start') parent.begin_drag(row); if (kind === 'drag-move') parent.move_drag(row); if (kind === 'drag-end') parent.finish_drag(row); if (kind === 'drag-cancel') parent.finish_drag(row, true) }, watch(read, callback, options) { const current = read(); watchers.push({ read, callback, previous: current }); if (options?.immediate) callback(current) }, onHide() {}, onMounted() {}, onUnmounted() {}, bind_card_pointer_events, create_pointer_gesture, DISCOVER_DECK, MOTION }
  const card = new Function(...Object.keys(card_bindings), card_source + '\nreturn { gesture, card }')(...Object.values(card_bindings))
  card.card.value = { getBoundingClientRect: () => ({ width: 353, height: 500 }), setPointerCapture() {}, hasPointerCapture: () => false }
  const flush = () => { for (const watcher of watchers) { const current = watcher.read(); if (JSON.stringify(current) !== JSON.stringify(watcher.previous)) { const previous = watcher.previous; watcher.previous = current; watcher.callback(current, previous) } } }
  const drain = async () => { for (let round = 0; jobs.size && round < 10; round++) { const tasks = [...jobs.values()]; jobs.clear(); for (const task of tasks) await task(); flush() } }
  return { gesture: card.gesture, parent, state, props, calls, flush, drain }
}
test('real Discover parent/card interaction keeps an owned drag alive while its click surface is disabled', async () => {
  const { gesture, state, props, calls, flush, drain } = discover_parent_card_fixture()
  gesture.start(point()); gesture.move(point(1, 130)); flush()
  assert.equal(props.disabled, true, 'Parent blocks duplicate click during its owned drag')
  assert.equal(props.gestureDisabled, false, 'Owned drag is not an external interruption')
  assert.equal(state.dragging.value, true); assert.equal(state.settling.value, false); assert.equal(calls.includes('drag-cancel'), false)
  gesture.move(point(1, 210)); flush(); gesture.end(point(1, 260)); flush()
  assert.equal(calls.filter(kind => kind === 'drag-end').length, 1); assert.equal(calls.includes('drag-cancel'), false)
  await drain(); assert.equal(state.card_index.value, 1, 'One-third release advances exactly once')
})
test('real Discover external navigation/busy lock still cancels an owned drag without advancing', async () => {
  const { gesture, state, calls, flush, drain } = discover_parent_card_fixture()
  gesture.start(point()); gesture.move(point(1, 260)); state.navigating.value = true; flush(); gesture.end(point(1, 300))
  await drain(); assert.equal(calls.filter(kind => kind === 'drag-cancel').length, 1)
  assert.equal(calls.includes('drag-end'), false); assert.equal(state.card_index.value, 0)
})
test('after a swipe the old compatibility click stays guarded, but a fresh deliberate tap is immediately available', async () => {
  const { gesture, parent, flush, drain } = discover_parent_card_fixture()
  gesture.start(point()); gesture.move(point(1, 260)); gesture.end(point(1, 270)); flush()
  assert.ok(parent.guard_until() > Date.now())
  assert.equal(gesture.can_click(), false)
  await drain()
  gesture.start(point(3)); assert.equal(parent.guard_until(), 0)
  gesture.end(point(3)); assert.equal(gesture.can_click(), true)
})
