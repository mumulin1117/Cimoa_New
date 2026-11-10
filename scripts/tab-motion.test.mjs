import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { create_tab_motion_controller } from '../src/utils/tabMotion.js'
import { MOTION } from '../src/config/navigation.js'

const home = 'pages/home/index', discover = 'pages/discover/index', events = 'pages/events/index'
const fixture = () => {
  let now = 0, resolve, reject, calls = 0
  const pending = new Promise((yes, no) => { resolve = yes; reject = no })
  const controller = create_tab_motion_controller({ now: () => now })
  return { controller, resolve, reject, time: value => { now = value }, navigate: () => { calls++; return pending }, calls: () => calls }
}

test('the replacement page resumes the same timeline instead of restarting its CSS animation', async () => {
  const f = fixture(), promise = f.controller.run(home, discover, f.navigate)
  assert.equal(f.controller.sample(home).position, 0)
  f.time(MOTION.tab_slide / 2)
  const before = f.controller.sample(home)
  assert.ok(before.position > 0 && before.position < 1)
  assert.equal(f.controller.sample(discover).position, before.position)
  assert.equal(f.controller.sample(discover).revision, before.revision)
  assert.ok(f.controller.sample(discover).icon_scale > 1)
  f.resolve({ ok: true }); await promise
  assert.equal(f.controller.sample(discover).busy, false)
  f.time(MOTION.tab_slide)
  assert.equal(f.controller.sample(discover).position, 1)
  assert.equal(f.controller.sample(discover).moving, false)
  assert.equal(f.controller.sample(discover).icon_scale, 1)
})
test('same-target repeated clicks share one navigation; competing clicks do not submit another route', async () => {
  const f = fixture(), first = f.controller.run(home, discover, f.navigate)
  assert.equal(f.controller.run(home, discover, f.navigate), first)
  await assert.rejects(f.controller.run(home, events, f.navigate), /progress/)
  assert.equal(f.calls(), 1)
  f.resolve(); await first
})
test('a second successful Tab navigation at 50ms continues the in-flight light without jumping to the route slot', async () => {
  const f = fixture(), first = f.controller.run(home, discover, f.navigate)
  f.resolve(); await first
  f.time(50)
  const before = f.controller.sample(discover)
  assert.ok(before.position > 0 && before.position < 1)
  const second = f.controller.run(discover, events, () => Promise.resolve({ ok: true }))
  const resumed = f.controller.sample(discover)
  assert.equal(resumed.position, before.position)
  assert.equal(f.controller.sample(events).position, before.position)
  assert.notEqual(resumed.revision, before.revision)
  await second
  f.time(100)
  const progress = f.controller.sample(events)
  assert.ok(progress.position > before.position && progress.position < 2)
  f.time(50 + MOTION.tab_slide)
  assert.equal(f.controller.sample(events).position, 2)
  assert.equal(f.controller.sample(events).moving, false)
})
test('a quick reverse navigation also starts from the current light rather than snapping to the actual source slot', async () => {
  const f = fixture(), first = f.controller.run(home, events, f.navigate)
  f.resolve(); await first
  f.time(50)
  const before = f.controller.sample(events).position
  assert.ok(before > 0 && before < 2)
  const second = f.controller.run(events, home, () => Promise.resolve())
  assert.equal(f.controller.sample(home).position, before)
  await second
  f.time(100)
  assert.ok(f.controller.sample(home).position < before)
  f.time(50 + MOTION.tab_slide)
  assert.equal(f.controller.sample(home).position, 0)
})
test('same-tab is a no-op and does not start an animation or invoke navigation', async () => {
  const f = fixture()
  assert.deepEqual(await f.controller.run(home, `/${home}`, f.navigate), { unchanged: true })
  assert.equal(f.calls(), 0); assert.equal(f.controller.sample(home).moving, false)
})
test('failed navigation restores the real source position and unlocks the bar', async () => {
  const f = fixture(), promise = f.controller.run(home, events, f.navigate)
  f.time(120); assert.ok(f.controller.sample(home).position > 0)
  f.reject(new Error('Navigation failed'))
  await assert.rejects(promise, /Navigation failed/)
  assert.deepEqual(f.controller.sample(home), { position: 0, moving: false, busy: false, target: null, icon_scale: 1, revision: 1 })
})
test('a synchronous navigation error has the same rollback and never remains pending', async () => {
  const f = fixture()
  await assert.rejects(f.controller.run(home, discover, () => { throw new Error('Rejected') }), /Rejected/)
  assert.equal(f.controller.sample(home).busy, false)
  assert.equal(f.controller.sample(home).position, 0)
})
test('reduced motion remains at the actual route without sliding or pulsing icons', async () => {
  const f = fixture(), promise = f.controller.run(home, events, f.navigate)
  f.time(90)
  assert.deepEqual(f.controller.sample(home, { reduced: true }), { position: 0, moving: false, busy: true, target: null, icon_scale: 1, revision: 1 })
  assert.equal(f.controller.sample(events, { reduced: true }).position, 2)
  f.resolve(); await promise
})
test('external unrelated pages never render a stale shared Tab position', async () => {
  const f = fixture(), promise = f.controller.run(home, discover, f.navigate)
  f.time(100)
  assert.equal(f.controller.sample(events).position, 2)
  assert.equal(f.controller.sample(events).moving, false)
  f.resolve(); await promise
})
test('background/account cleanup cancels the timeline and late completion cannot revive it', async () => {
  const f = fixture(), promise = f.controller.run(home, discover, f.navigate)
  f.controller.clear()
  assert.equal(f.controller.sample(home).moving, false); assert.equal(f.controller.sample(home).busy, false)
  f.resolve(); await promise
  assert.equal(f.controller.sample(discover).moving, false)
  assert.equal(f.controller.sample(discover).position, 1)
})
test('late failure after cleanup cannot erase a newer navigation timeline', async () => {
  const f = fixture(), first = f.controller.run(home, discover, f.navigate)
  f.controller.clear()
  let finish
  const second = f.controller.run(discover, events, () => new Promise(resolve => { finish = resolve }))
  f.time(100); const revision = f.controller.sample(discover).revision
  f.reject(new Error('Old navigation rejected')); await assert.rejects(first)
  assert.equal(f.controller.sample(discover).revision, revision)
  assert.equal(f.controller.sample(discover).busy, true)
  finish(); await second
})
test('subscribers may mount/unmount across replacement and failures in presentation cannot block navigation', async () => {
  const f = fixture(); let changes = 0
  const remove = f.controller.subscribe(() => { changes++ })
  f.controller.subscribe(() => { throw new Error('Detached view') })
  const promise = f.controller.run(home, discover, f.navigate)
  assert.equal(changes, 1); remove()
  const after = []; f.controller.subscribe(() => after.push(f.controller.sample(discover)))
  f.resolve(); await promise
  assert.equal(changes, 1); assert.equal(after.length, 1)
  assert.equal(after[0].busy, false)
})
test('the bar preserves the source capsule and safe area; the light is separate and aria-current follows the route', () => {
  const source = fs.readFileSync(new URL('../src/components/CustomTabBar.vue', import.meta.url), 'utf8')
  assert.match(source, /height: 118\.321rpx/)
  assert.match(source, /53\.435rpx \+ var\(--app-safe-bottom\)/)
  assert.match(source, /width: 99\.237rpx; height: 99\.237rpx/)
  assert.match(source, /class="tab__light-track" aria-hidden="true"/)
  assert.match(source, /:aria-current="active === tab\.path \? 'page' : undefined"/)
  assert.match(source, /active\.value = current_route\(\)/)
  assert.match(source, /onHide\(\(\) => \{ shown = false; stop_frame\(\) \}\)/)
  assert.doesNotMatch(source, /:hover|localStorage|sessionStorage|setTimeout/)
})
