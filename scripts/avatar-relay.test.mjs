import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { create_avatar_relay, measure_avatar } from '../src/utils/avatarRelay.js'
import { MOTION, NAVIGATION } from '../src/config/navigation.js'

const identity = { user_id: 'person_chloe', conversation_id: 'conversation_chloe', auth_context: 'account:session:1', avatar_src: '/static/chloe.jpg' }
const bounds = { left: 28, top: 280, width: 78, height: 78 }
const header = { left: 88, top: 68, width: 52, height: 52 }
const fixture = () => {
  let now = 1000, hidden = false, reduced = false
  const tasks = new Set(), root = {}, chat = {}
  const home_page = { route: 'pages/home/index', $page: { id: 1, fullPath: '/pages/home/index' } }
  const chat_page = { route: 'pages/messages/chat', $page: { id: 2, fullPath: '/pages/messages/chat?conversation_id=conversation_chloe' } }
  let pages = [home_page]
  const snapshots = new Map([[root, { node: root, url: 'https://cimoa.invalid/static/chloe.jpg', bounds }], [chat, { node: chat, url: 'https://cimoa.invalid/static/chloe.jpg', bounds: header }]])
  const relay = create_avatar_relay({
    clock: () => now, hidden: () => hidden, reduced: () => reduced,
    get_pages: () => pages,
    measure: element => snapshots.get(element) || null,
    schedule: (callback, duration) => { const task = { callback, at: now + duration }; tasks.add(task); return task },
    cancel: task => tasks.delete(task),
  })
  const advance = duration => { now += duration; for (const task of [...tasks]) if (task.at <= now) { tasks.delete(task); task.callback() } }
  return { relay, root, chat, snapshots, tasks, advance, capture: () => relay.capture({ ...identity, element: root }), arrive: (extra = {}) => { pages = [home_page, chat_page]; return relay.arrive({ ...identity, element: chat, entered_at: now, ...extra }) }, return_home: () => { pages = [home_page] }, replace_home: () => { pages = [{ ...home_page, $page: { id: 3, fullPath: '/pages/home/index' } }] }, set hidden(value) { hidden = value }, set reduced(value) { reduced = value }, get now() { return now } }
}

test('capture is synchronous, visual-only, and waits for the correct mounted Header', () => {
  const f = fixture(), published = []
  const stop = f.relay.subscribe(value => published.push(value))
  assert.equal(f.capture(), true)
  assert.equal(f.relay.current, null)
  assert.equal(f.relay.pending, true)
  assert.equal(f.arrive(), true)
  assert.deepEqual(f.relay.current.from, bounds)
  assert.deepEqual(f.relay.current.to, header)
  assert.equal(f.relay.current.duration, MOTION.avatar_relay)
  f.advance(MOTION.avatar_relay)
  assert.equal(f.relay.current, null)
  assert.equal(f.relay.pending, true, 'keep only the original source association for return')
  stop()
  assert.ok(published.some(cue => cue?.direction === 'forward'))
})

test('source must already be decoded and measurable; navigation gets immediate fallback', () => {
  const f = fixture()
  f.snapshots.delete(f.root)
  assert.equal(f.capture(), false)
  assert.equal(f.relay.pending, false)
  assert.equal(f.tasks.size, 0)
})

test('late decode cannot extend the original 240ms page entrance', () => {
  const f = fixture(); f.capture()
  const entered_at = f.now
  f.advance(83)
  assert.equal(f.arrive({ entered_at }), true)
  assert.equal(f.relay.current.duration, MOTION.avatar_relay - 83)
  f.advance(MOTION.avatar_relay - 83)
  assert.equal(f.relay.current, null)
  const second = fixture(); second.capture()
  second.advance(MOTION.avatar_relay)
  assert.equal(second.arrive({ entered_at: 1000 }), false)
  assert.equal(second.relay.current, null)
})

test('entity, conversation, account, or logical avatar mismatch clears the relay', () => {
  for (const extra of [{ user_id: 'other' }, { conversation_id: 'other' }, { auth_context: 'other' }, { avatar_src: '/static/other.jpg' }]) {
    const f = fixture(); f.capture()
    assert.equal(f.arrive(extra), false)
    assert.equal(f.relay.pending, false)
    assert.equal(f.relay.current, null)
  }
})

test('nested same-person Profile keeps source without replaying the forward relay', () => {
  const f = fixture(); f.capture(); f.arrive(); f.advance(MOTION.avatar_relay)
  assert.equal(f.relay.route_changed('/pages/discover/profile?user_id=person_chloe&origin_conversation_id=conversation_chloe'), true)
  assert.equal(f.arrive(), false)
  assert.equal(f.relay.current, null)
  assert.equal(f.relay.pending, true)
  assert.equal(f.relay.route_changed('/pages/discover/profile?user_id=other&origin_conversation_id=conversation_chloe'), false)
  assert.equal(f.relay.pending, false)
})

test('return uses the real preserved Home avatar and completes within existing back timing', () => {
  const f = fixture(); f.capture(); f.arrive(); f.advance(MOTION.avatar_relay)
  assert.equal(f.relay.prepare_return({ ...identity, element: f.chat }), true)
  assert.equal(f.relay.route_changed('/pages/home/index'), true)
  const shifted = { ...bounds, top: 310 }
  f.snapshots.get(f.root).bounds = shifted
  f.return_home()
  assert.equal(f.relay.resume_home({ auth_context: identity.auth_context, resolve: id => id === identity.user_id ? f.root : null }), true)
  assert.equal(f.relay.current.direction, 'back')
  assert.deepEqual(f.relay.current.to, shifted, 'do not use stale scroll coordinates')
  assert.equal(f.relay.current.duration, MOTION.back)
  const first = f.relay.current
  assert.equal(f.relay.resume_home({ auth_context: identity.auth_context, resolve: () => f.root }), false)
  assert.equal(f.relay.current, first, 'duplicate Home onShow must not replay or clear the return')
  f.advance(MOTION.back)
  assert.equal(f.relay.current, null)
  assert.equal(f.relay.pending, false)
})

test('cached detached source is allowed; removed source page or missing card is not', () => {
  const f = fixture(); f.capture(); f.root.isConnected = false
  assert.equal(f.arrive(), true, 'uni-app KeepAlive may detach Home DOM without removing its page')
  f.advance(MOTION.avatar_relay); f.return_home()
  const new_root = {}
  f.snapshots.set(new_root, { ...f.snapshots.get(f.root), node: new_root })
  assert.equal(f.relay.resume_home({ auth_context: identity.auth_context, resolve: () => new_root }), true, 'same real Home page may remount its stable card')
  const absent = fixture(); absent.capture(); absent.arrive(); absent.return_home()
  assert.equal(absent.relay.resume_home({ auth_context: identity.auth_context, resolve: () => null }), false)
  const replaced = fixture(); replaced.capture(); replaced.arrive(); replaced.replace_home()
  assert.equal(replaced.relay.resume_home({ auth_context: identity.auth_context, resolve: () => replaced.root }), false)
  assert.equal(replaced.relay.pending, false)
})

test('background, route failure/clear, unrelated route, and deadline cancel all transient work', () => {
  const f = fixture(); f.capture(); f.hidden = true
  assert.equal(f.arrive(), false)
  assert.equal(f.tasks.size, 0)
  for (const path of ['/pages/events/index', '/pages/messages/chat?conversation_id=other', '/pages/messages/call/waiting?conversation_id=conversation_chloe']) {
    const row = fixture(); row.capture(); assert.equal(row.relay.route_changed(path), false); assert.equal(row.relay.pending, false); assert.equal(row.tasks.size, 0)
  }
  const deadline = fixture(); deadline.capture(); deadline.advance(NAVIGATION.callback_timeout_ms)
  assert.equal(deadline.relay.pending, false)
  const clear = fixture(); clear.capture(); clear.arrive(); clear.relay.clear(); clear.advance(MOTION.avatar_relay)
  assert.equal(clear.relay.pending, false); assert.equal(clear.relay.current, null)
})

test('reduced motion uses a short target fade, with no second route or business write', () => {
  const f = fixture(); f.reduced = true; f.capture(); f.arrive()
  assert.equal(f.relay.current.reduced, true)
  const source = fs.readFileSync(new URL('../src/utils/avatarRelay.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /localStorage|indexedDB\.|navigateTo|navigateBack|setItem|dispatchEvent/)
})

test('real image measurement rejects unloaded, detached, empty, or offscreen media', () => {
  const image = { complete: true, naturalWidth: 400, naturalHeight: 400, currentSrc: 'blob:owned-avatar' }
  const node = { isConnected: true, matches: selector => selector === '.user-avatar', querySelector: () => image, getBoundingClientRect: () => bounds, closest: () => ({}) }
  const win = { innerWidth: 393, innerHeight: 852, getComputedStyle: () => ({ transform: 'matrix(1, 0, 0, 1, 0, 14)' }) }
  assert.equal(measure_avatar(node, { window: win }).url, image.currentSrc)
  assert.equal(measure_avatar(node, { window: win, final_position: true }).bounds.top, bounds.top - 14)
  image.complete = false; assert.equal(measure_avatar(node, { window: win }), null)
  image.complete = true; node.isConnected = false; assert.equal(measure_avatar(node, { window: win }), null)
  node.isConnected = true; image.naturalWidth = 0; assert.equal(measure_avatar(node, { window: win }), null)
  image.naturalWidth = 400; node.getBoundingClientRect = () => ({ ...bounds, top: -20 }); assert.equal(measure_avatar(node, { window: win }), null)
})

test('host is aria-hidden, transparent to touch, and never snapshots or hides real pages', () => {
  const host = fs.readFileSync(new URL('../src/components/AvatarRelayHost.vue', import.meta.url), 'utf8')
  assert.match(host, /aria-hidden="true"/)
  assert.match(host, /pointer-events: none/)
  assert.match(host, /prefers-reduced-motion/)
  assert.doesNotMatch(host, /canvas|\.style\.opacity|\.style\.display/)
  assert.match(host, /value\.duration - Math\.max\(0, Date\.now\(\) - value\.started_at\)/)
  const installer = fs.readFileSync(new URL('../src/utils/avatarRelayHost.js', import.meta.url), 'utf8')
  assert.match(installer, /pointerdown', take_over, \{ capture: true, passive: true \}/)
  assert.doesNotMatch(installer, /preventDefault|stopPropagation|stopImmediatePropagation/)
})

test('target avatar is temporarily concealed with exact restoration on finish and every cancel path', () => {
  for (const finish of ['finish', 'clear', 'unrelated']) {
    const f = fixture(), values = new Map([['visibility', ['visible', '']]])
    f.chat.style = { getPropertyValue: key => values.get(key)?.[0] || '', getPropertyPriority: key => values.get(key)?.[1] || '', setProperty: (key, value, priority = '') => values.set(key, [value, priority]), removeProperty: key => values.delete(key) }
    f.capture(); f.arrive()
    assert.deepEqual(values.get('visibility'), ['hidden', 'important'])
    if (finish === 'finish') f.advance(MOTION.avatar_relay)
    else if (finish === 'clear') f.relay.clear()
    else f.relay.route_changed('/pages/events/index')
    assert.deepEqual(values.get('visibility'), ['visible', ''])
  }
})

test('presentation subscriber or measure failure never leaks into navigation', () => {
  const f = fixture()
  f.relay.subscribe(() => {})
  assert.equal(f.capture(), true)
  // Controller subscriptions are optional visual observers, not navigation gates.
  f.relay.subscribe(value => { if (value) throw new Error('presentation unavailable') })
  assert.doesNotThrow(() => f.arrive())
  f.relay.clear()
  const broken = create_avatar_relay({ get_pages: () => [{ route: 'pages/home/index' }], measure: () => { throw new Error('detached element') } })
  assert.equal(broken.capture({ ...identity, element: {} }), false)
})
