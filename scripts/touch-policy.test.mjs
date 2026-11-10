import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { install_touch_policy, is_editable_target } from '../src/utils/touchPolicy.js'

class Node {
  nodeType = 1
  isConnected = true
  constructor(tag = 'view', attributes = {}, parentElement = null) { this.tag = tag; this.attributes = new Map(Object.entries(attributes)); this.parentElement = parentElement }
  getAttribute(key) { return this.attributes.get(key) ?? null }
  setAttribute(key, value) { this.attributes.set(key, value) }
  removeAttribute(key) { this.attributes.delete(key) }
  hasAttribute(key) { return this.attributes.has(key) }
  matches(selector) { return selector.split(',').some(part => { const s = part.trim(); if (s === '[contenteditable]') return this.hasAttribute('contenteditable'); const role = s.match(/^\[role="(.+)"\]$/); if (role) return this.getAttribute('role') === role[1]; if (s === 'a[href]') return this.tag === 'a' && this.hasAttribute('href'); return this.tag === s }) }
  closest(selector) { for (let item = this; item; item = item.parentElement) if (item.matches(selector)) return item; return null }
  contains(node) { for (let item = node; item; item = item.parentElement) if (item === this) return true; return false }
}
const fixture = (width = 393) => {
  const doc = new EventTarget(), win = new EventTarget(), tasks = new Map(), style = new Map()
  doc.visibilityState = 'visible'
  doc.documentElement = { clientWidth: width, style: { getPropertyValue: key => style.get(key) || '', setProperty: (key, value) => style.set(key, value), removeProperty: key => style.delete(key) } }
  doc.querySelectorAll = () => []
  win.innerWidth = width
  let id = 0
  const timers = { setTimeout(fn) { tasks.set(++id, fn); return id }, clearTimeout(key) { tasks.delete(key) } }
  const policy = install_touch_policy({ document: doc, window: win, timers })
  const fire = (type, node, properties = {}) => {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, { composedPath: () => [node], pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20, detail: 1, ...properties })
    doc.dispatchEvent(event)
    return event
  }
  return { doc, win, policy, fire, tasks, style, tick() { const current = [...tasks.values()]; tasks.clear(); current.forEach(fn => fn()) } }
}

test('editing boundaries include text nodes, uni inputs and editable descendants, not nested false regions', () => {
  for (const tag of ['input', 'textarea', 'uni-input', 'uni-textarea']) assert.equal(is_editable_target(new Node(tag)), true)
  for (const value of ['true', '', 'plaintext-only', 'TRUE']) {
    const editor = new Node('view', { contenteditable: value }), child = new Node('text', {}, editor)
    assert.equal(is_editable_target(child), true)
    assert.equal(is_editable_target({ nodeType: 3, parentElement: child }), true)
    assert.equal(is_editable_target(new Node('view', { contenteditable: 'false' }, child)), false)
  }
  assert.equal(is_editable_target(new Node()), false)
})
test('only noneditable context menus, drag and selection are prevented; editor input/copy/paste/IME events are untouched', () => {
  const f = fixture()
  for (const type of ['contextmenu', 'dragstart', 'selectstart']) {
    assert.equal(f.fire(type, new Node('img')).defaultPrevented, true)
    for (const node of [new Node('input'), new Node('textarea'), new Node('text', {}, new Node('view', { contenteditable: 'true' }))]) assert.equal(f.fire(type, node).defaultPrevented, false)
  }
  for (const type of ['pointerdown', 'touchstart', 'touchmove', 'wheel', 'copy', 'paste', 'beforeinput', 'input', 'compositionstart', 'compositionend']) assert.equal(f.fire(type, new Node('input')).defaultPrevented, false)
  f.policy.dispose()
})
test('press, hold and release are presentation states and never synthesize a business click', () => {
  const f = fixture(), button = new Node('view', { role: 'button' })
  let clicks = 0; f.doc.addEventListener('click', () => clicks++)
  f.fire('pointerdown', button); assert.equal(button.getAttribute('data-touch-state'), 'pressed')
  f.tick(); assert.equal(button.getAttribute('data-touch-state'), 'held'); assert.equal(clicks, 0)
  f.fire('pointerup', button); assert.equal(button.hasAttribute('data-touch-state'), false); assert.equal(f.tasks.size, 0)
  f.fire('click', button); assert.equal(clicks, 1)
  f.policy.dispose()
})
for (const type of ['pointercancel', 'lostpointercapture']) test(`${type} clears a press and blocks its ghost click, while the next touch works`, () => {
  const f = fixture(), button = new Node('view', { role: 'button' })
  f.fire('pointerdown', button); f.fire(type, button); f.tick()
  assert.equal(button.hasAttribute('data-touch-state'), false); assert.equal(f.fire('click', button).defaultPrevented, true)
  f.fire('pointerdown', button); f.fire('pointerup', button); assert.equal(f.fire('click', button).defaultPrevented, false)
  f.policy.dispose()
})
test('secondary touches, movement and hidden/route lifecycle cancel without preventing native scrolling', () => {
  const f = fixture(), button = new Node('view', { role: 'button' })
  const cancelled = () => { f.tick(); assert.equal(button.hasAttribute('data-touch-state'), false); assert.equal(f.tasks.size, 0) }
  f.fire('pointerdown', button); f.fire('pointerdown', button, { pointerId: 2, isPrimary: false }); cancelled()
  f.fire('pointerdown', button); assert.equal(f.fire('pointermove', button, { clientY: 60 }).defaultPrevented, false); cancelled()
  for (const type of ['pagehide', 'blur', 'hashchange', 'popstate']) { f.fire('pointerdown', button); f.win.dispatchEvent(new Event(type)); cancelled() }
  f.fire('pointerdown', button); f.doc.visibilityState = 'hidden'; f.doc.dispatchEvent(new Event('visibilitychange')); cancelled()
  f.policy.dispose()
})
test('disabled semantics block actual clicks, including nested icons, without changing editor input', () => {
  const f = fixture(), button = new Node('view', { role: 'button', 'aria-disabled': 'true' }), icon = new Node('svg', {}, button)
  assert.equal(f.fire('click', icon).defaultPrevented, true)
  f.fire('pointerdown', icon); assert.equal(button.hasAttribute('data-touch-state'), false)
  button.setAttribute('aria-disabled', 'false'); assert.equal(f.fire('click', icon).defaultPrevented, false)
  f.policy.dispose()
})
test('the minimum target remains 44 logical points from 320 to 440 width; install/dispose are idempotent', () => {
  for (const width of [320, 375, 393, 402, 430, 440]) {
    const f = fixture(width), scale = Number(f.style.get('--app-touch-scale'))
    assert.ok(84 * width / 750 * scale >= 44 && 84 * width / 750 * scale < 44.05)
    assert.equal(install_touch_policy({ document: f.doc, window: f.win }), f.policy)
    f.policy.dispose(); f.policy.dispose(); assert.equal(f.style.has('--app-touch-scale'), false)
    assert.equal(f.fire('contextmenu', new Node()).defaultPrevented, false)
  }
})
test('the shared CSS keeps editable controls selectable, avoids hover/scroll interception, and uses nonoverlapping real targets', () => {
  const css = fs.readFileSync(new URL('../src/styles/touch.css', import.meta.url), 'utf8')
  assert.match(css, /-webkit-touch-callout: none/); assert.match(css, /-webkit-user-drag: none/)
  assert.match(css, /input, textarea, uni-input, uni-textarea[\s\S]*user-select: text/)
  assert.match(css, /min-width: var\(--app-touch-target\)/); assert.match(css, /min-height: var\(--app-touch-target\)/)
  assert.doesNotMatch(css, /:hover|touch-action:\s*none|::after|::before/)
})
