import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { MOTION } from '../src/config/navigation.js'

const source = fs.readFileSync(new URL('../src/components/ConnectionGoalsPopover.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const ref = value => ({ value })
const computed = getter => ({ get value() { return getter() } })
const flush = async () => { for (let index = 0; index < 6; index++) await Promise.resolve() }
const events = () => {
  const listeners = new Map()
  return {
    listeners,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type) },
    dispatch: type => listeners.get(type)?.(),
  }
}
const instantiate = new Function('computed', 'ref', 'watch', 'nextTick', 'getCurrentInstance', 'onMounted', 'onUnmounted', 'onHide', 'defineProps', 'defineEmits', 'use_app_store', 'MOTION', 'uni', 'window', 'document', 'setTimeout', 'clearTimeout', `${script}\nreturn { rendered, showing, placement, retained_id, goals, interrupt }`)
const fixture = ({ width = 393, height = 852, panel = { width: 232, height: 224 } } = {}) => {
  const props = { userId: '', anchor: null }, hooks = { mount: [], unmount: [], hide: [] }, calls = [], measurements = []
  const frames = new Map(), timers = new Map(), win = events(), doc = { ...events(), visibilityState: 'visible' }
  let handle = 0, changed, measured = panel
  win.requestAnimationFrame = callback => { const id = ++handle; frames.set(id, callback); return id }
  win.cancelAnimationFrame = id => frames.delete(id)
  const uni = {
    getWindowInfo: () => ({ windowWidth: width, windowHeight: height }),
    createSelectorQuery: () => {
      let callback
      const query = { in: () => query, select: () => query, boundingClientRect: next => { callback = next; return query }, exec: () => { measurements.push({ ...subject.placement.value }); callback(measured) } }
      return query
    },
  }
  const subject = instantiate(computed, ref, (_, callback, options) => { changed = callback; if (options?.immediate) callback() }, callback => Promise.resolve().then(callback), () => ({ proxy: {} }), callback => hooks.mount.push(callback), callback => hooks.unmount.push(callback), callback => hooks.hide.push(callback), () => props, () => event => calls.push(event), () => ({ goals_for_user: user => user ? [{ item_id: `${user}-goal`, label: user }] : [] }), MOTION, uni, win, doc, (callback, duration) => { const id = ++handle; timers.set(id, { callback, duration }); return id }, id => timers.delete(id))
  hooks.mount.forEach(callback => callback())
  return {
    subject, props, calls, frames, timers, win, doc, measurements,
    update: async (userId, anchor) => { Object.assign(props, { userId, anchor }); changed(); await flush() },
    frame: () => { const pending = [...frames]; frames.clear(); pending.forEach(([, callback]) => callback()) },
    finish: () => { const pending = [...timers]; timers.clear(); pending.forEach(([, timer]) => timer.callback()) },
    hide: () => hooks.hide.forEach(callback => callback()),
    unmount: () => hooks.unmount.forEach(callback => callback()),
    panel: rect => { measured = rect },
  }
}
const anchor = { left: 20, right: 373, top: 300, bottom: 440, limit_top: 240, limit_bottom: 720, trigger: { left: 264, right: 350, top: 365, bottom: 403, width: 86, height: 38 } }
const number = value => Number.parseFloat(value)

test('measured tag center remains the transform origin after panel boundary correction', async () => {
  const f = fixture(), scale = 750 / 393
  await f.update('user_chloe', anchor)
  const style = f.subject.placement.value, [x, y] = style.transformOrigin.split(' ').map(number)
  assert.equal(f.subject.rendered.value, true)
  assert.equal(f.subject.showing.value, false)
  assert.deepEqual(f.measurements, [{ transform: 'none' }])
  assert.ok(Math.abs(number(style.left) + x - (anchor.trigger.left + anchor.trigger.width / 2) * scale) < 1e-8)
  assert.ok(Math.abs(number(style.top) + y - (anchor.trigger.top + anchor.trigger.height / 2) * scale) < 1e-8)
  assert.ok(number(style.top) >= anchor.limit_top * scale)
  assert.ok(number(style.top) + 224 * scale <= anchor.limit_bottom * scale)
  f.frame(); assert.equal(f.subject.showing.value, false)
  f.frame(); assert.equal(f.subject.showing.value, true)
  assert.equal(f.timers.size, 0, 'opening has no artificial wait or business timer')
  f.unmount()
})

test('close keeps the same goals, anchor and mask through the existing 180ms exit', async () => {
  const f = fixture()
  await f.update('user_chloe', anchor); f.frame(); f.frame()
  const placement = f.subject.placement.value
  await f.update('', null)
  assert.equal(f.subject.showing.value, false)
  assert.equal(f.subject.rendered.value, true)
  assert.equal(f.subject.retained_id.value, 'user_chloe')
  assert.equal(f.subject.goals.value[0].label, 'user_chloe')
  assert.strictEqual(f.subject.placement.value, placement)
  assert.equal([...f.timers.values()][0].duration, 180)
  assert.equal(MOTION.popover, 180)
  f.finish()
  assert.equal(f.subject.rendered.value, false)
  assert.equal(f.subject.retained_id.value, '')
  assert.deepEqual(f.subject.placement.value, {})
  f.unmount()
})

test('repeated opening and changing users cancel stale exit callbacks and use the new tag', async () => {
  const f = fixture()
  await f.update('user_chloe', anchor); f.frame(); f.frame()
  await f.update('', null)
  const next = { ...anchor, trigger: { ...anchor.trigger, left: 200 } }
  await f.update('user_grace', next)
  assert.equal(f.timers.size, 0)
  assert.equal(f.subject.showing.value, false)
  f.frame(); f.frame(); f.finish()
  assert.equal(f.subject.showing.value, true)
  assert.equal(f.subject.retained_id.value, 'user_grace')
  assert.equal(f.subject.goals.value[0].label, 'user_grace')
  f.unmount()
})

test('an interrupt during either opening frame cannot resurrect the popover', async () => {
  for (const stage of [0, 1]) {
    const f = fixture()
    await f.update('user_chloe', anchor)
    if (stage) f.frame()
    f.hide(); f.frame(); f.frame(); f.finish()
    assert.equal(f.subject.rendered.value, false)
    assert.equal(f.subject.showing.value, false)
    assert.equal(f.frames.size, 0)
    assert.equal(f.timers.size, 0)
    assert.deepEqual(f.calls, ['close'])
    f.unmount()
  }
})

test('background, size change, unavailable measurement and unmount clear transient state and listeners', async () => {
  for (const mode of ['background', 'resize', 'measurement', 'unmount']) {
    const f = fixture()
    if (mode === 'measurement') f.panel(null)
    await f.update('user_chloe', anchor)
    if (mode === 'background') { f.doc.visibilityState = 'hidden'; f.doc.dispatch('visibilitychange') }
    if (mode === 'resize') f.win.dispatch('resize')
    if (mode === 'unmount') f.unmount()
    f.frame(); f.frame(); f.finish()
    assert.equal(f.subject.rendered.value, false, mode)
    assert.equal(f.subject.retained_id.value, '', mode)
    assert.equal(f.frames.size, 0, mode)
    assert.equal(f.timers.size, 0, mode)
    if (mode !== 'unmount') { assert.deepEqual(f.calls, ['close'], mode); f.unmount() }
    assert.equal(f.win.listeners.size, 0)
    assert.equal(f.doc.listeners.size, 0)
  }
})

test('missing tag measurements retain a safe centered origin without changing anchored placement', async () => {
  const f = fixture()
  await f.update('user_chloe', { ...anchor, trigger: null })
  const [x, y] = f.subject.placement.value.transformOrigin.split(' ').map(number)
  assert.ok(Math.abs(x - 232 / 2 * 750 / 393) < 1e-8)
  assert.equal(y, 0)
  f.frame(); f.frame(); assert.equal(f.subject.showing.value, true)
  f.unmount()
})

test('template preserves external-close/inside isolation and reduced motion removes spatial effects only', () => {
  const { descriptor, errors } = parse(source)
  assert.deepEqual(errors, [])
  assert.match(descriptor.template.content, /class="goals-mask"[^>]*@click="emit\('close'\)"[^>]*@touchmove="emit\('close'\)"/)
  assert.match(descriptor.template.content, /class="goals-panel"[^>]*@click\.stop/)
  assert.match(descriptor.template.content, /v-show="rendered"/)
  assert.match(source, /translateY\(7\.634rpx\) scale\(0\.94\)/)
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.goals-panel, \.goals-panel--open \{ transform: none; transition-property: opacity; \}/)
  assert.doesNotMatch(source, /\.goal-row[^}]*\b(?:transition|animation)\s*:/)
  assert.doesNotMatch(script, /localStorage|setStorage|navigate_|push_route|write|MOTION\.skeleton/)
})
