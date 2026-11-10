import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { MOTION } from '../src/config/navigation.js'
import { create_auth_step_motion } from '../src/utils/authStepMotion.js'

const input = (step = 'basic', index = 0, progress = 14, context = 'account-a') => ({ context, step, index, progress })

test('registration progress begins at its real value and joins actual adjacent pages within existing 240ms', () => {
  let clock = 0
  const motion = create_auth_step_motion({ now: () => clock })
  assert.deepEqual(motion.present(input()), { from: 14, to: 14, animate: false, revision: 1 })
  const second = motion.present(input('uni', 1, 26))
  assert.equal(second.from, 14)
  assert.equal(second.to, 26)
  assert.equal(second.animate, true)
  clock = MOTION.page / 2
  assert.equal(motion.sample(), 20)
  clock = MOTION.page
  assert.equal(motion.sample(), 26)
  assert.equal(MOTION.page, 240)
})

test('fast forward and reverse continue from the sampled fill without changing source-authored targets', () => {
  let clock = 0
  const motion = create_auth_step_motion({ now: () => clock })
  motion.present(input()); motion.present(input('uni', 1, 26))
  clock = 120
  assert.equal(motion.present(input('major', 2, 39)).from, 20)
  clock = 360
  const photos = motion.present(input('photos', 3, 38))
  assert.equal(photos.from, 39)
  assert.equal(photos.to, 38, 'do not rewrite the source progress or create a second business counter')
  clock = 600
  const back = motion.present(input('major', 2, 39))
  assert.equal(back.from, 38)
  assert.equal(back.to, 39)
})

test('failed navigation does not anticipate a target; repeated step and jump restore the real current value', async () => {
  const motion = create_auth_step_motion()
  const data = input()
  motion.present(data)
  await assert.rejects(Promise.reject(new Error('route blocked')), /route blocked/)
  assert.equal(motion.sample(), 14)
  assert.equal(motion.present(data).animate, false)
  const jumped = motion.present(input('ice', 7, 82))
  assert.equal(jumped.from, 82)
  assert.equal(jumped.to, 82)
  assert.equal(jumped.animate, false)
  assert.deepEqual(data, input(), 'presentation never mutates caller or registration state')
})

test('account boundaries, background clear, completed and invalid access never borrow another fill', () => {
  const motion = create_auth_step_motion()
  motion.present(input())
  assert.equal(motion.present(input('uni', 1, 26, 'account-b')).animate, false)
  motion.clear()
  assert.equal(motion.sample(), null)
  assert.equal(motion.present(input('major', 2, 39, 'account-b')).animate, false)
  assert.equal(motion.present({ ...input('photos', 3, 38, 'account-b'), allowed: false }).animate, false)
  assert.equal(motion.sample(), null)
  assert.equal(motion.present({ ...input(), progress: Infinity }).to, 0)
  assert.equal(motion.sample(), null)
})

test('reduced motion uses target immediately and no visual timer, storage or business action is introduced', () => {
  const motion = create_auth_step_motion()
  motion.present(input())
  const next = motion.present({ ...input('uni', 1, 26), reduced: true })
  assert.deepEqual({ from: next.from, to: next.to, animate: next.animate }, { from: 26, to: 26, animate: false })
  const source = fs.readFileSync(new URL('../src/utils/authStepMotion.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /localStorage|sessionStorage|setStorage|setTimeout|setInterval|save_onboarding|navigate_/)
})

const ref = value => ({ value })
const computed = getter => ({ get value() { return getter() } })
const source_for = name => fs.readFileSync(new URL(`../src/components/${name}.vue`, import.meta.url), 'utf8')
const fixture = (name) => {
  const source = source_for(name)
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const hooks = { show: [], hide: [], mounted: [], unmounted: [] }, exposed = {}, props = { step: 'basic', busy: false, sourceProgress: 14 }, store = { auth_context: 'account-a', onboarding_catalog: { steps: ['basic', 'uni', 'major'] }, onboarding: { completed: false } }
  const args = { ref, computed, watch() {}, onMounted: callback => hooks.mounted.push(callback), onUnmounted: callback => hooks.unmounted.push(callback), onShow: callback => hooks.show.push(callback), onHide: callback => hooks.hide.push(callback), defineProps: () => props, defineEmits: () => () => {}, defineExpose: value => Object.assign(exposed, value), MOTION, use_app_store: () => store, use_visual_viewport: () => ({ height: ref('100vh'), keyboard_open: ref(false) }), present_auth_step_motion: create_auth_step_motion().present, clear_auth_step_motion() {}, window: {}, document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } }
  const subject = new Function(...Object.keys(args), `${script}\nreturn { frame, navigation_busy, locked }`)(...Object.values(args))
  hooks.mounted.forEach(callback => callback())
  hooks.show.forEach(callback => callback())
  return { subject, exposed, props, hooks, source }
}
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve() }

for (const name of ['AuthPageFrame', 'OnboardingFrame']) {
  test(`${name} locks synchronously, merges duplicate navigation and preserves false/cancel/failure`, async () => {
    const f = fixture(name), calls = []
    let resolve, reject
    const target = '/pages/auth/login'
    f.subject.frame.value = Object.fromEntries(['forward', 'back', 'replace', 'relaunch'].map(method => [`navigate_${method}`, value => { calls.push([method, value]); return new Promise((yes, no) => { resolve = yes; reject = no }) }]))
    const first = f.exposed.navigate_forward(target)
    assert.equal(f.subject.navigation_busy.value, true)
    assert.equal(f.subject.locked.value, true)
    assert.strictEqual(f.exposed.navigate_forward(target), first)
    assert.equal(await f.exposed.navigate_back(), false)
    await flush()
    assert.deepEqual(calls, [['forward', target]])
    resolve(false)
    assert.equal(await first, false)
    assert.equal(f.subject.navigation_busy.value, false)
    const failed = f.exposed.navigate_replace(target)
    await flush(); reject(new Error('blocked'))
    await assert.rejects(failed, /blocked/)
    assert.equal(f.subject.navigation_busy.value, false)
    const retry = f.exposed.navigate_relaunch(target)
    await flush(); resolve(true)
    assert.equal(await retry, true)
    f.props.busy = true
    assert.equal(f.subject.locked.value, true)
    const hidden = f.exposed.navigate_forward(target)
    f.hooks.hide.forEach(callback => callback())
    f.hooks.show.forEach(callback => callback())
    assert.equal(await hidden, false, 'hide revokes the previous task even if this frame becomes visible again')
    assert.equal(f.subject.navigation_busy.value, false)
    assert.equal(calls.length, 3)
    f.hooks.unmounted.forEach(callback => callback())
  })
}

test('both frames opt into content-only motion and keep one scroll owner and accessible busy controls', () => {
  for (const name of ['AuthPageFrame', 'OnboardingFrame']) {
    const source = source_for(name), { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [])
    assert.match(descriptor.template.content, /<SecondaryPageFrame[^>]*\bcontent-motion\b/)
    assert.match(descriptor.template.content, /:aria-busy="locked"/)
    assert.match(descriptor.template.content, /:aria-disabled="locked"/)
    assert.equal((descriptor.template.content.match(/:inert="navigation_busy \? '' : undefined"/g) || []).length, 2)
    assert.doesNotMatch(descriptor.template.content, /<scroll-view|<PageTransition/)
  }
  const onboarding = source_for('OnboardingFrame')
  assert.match(onboarding, /props\.sourceIndex \?\? index\.value/)
  assert.match(onboarding, /props\.sourceTotal \?\? steps\.value\.length/)
  assert.match(onboarding, /props\.sourceProgress \?\? display_index\.value/)
  assert.match(onboarding, /MOTION\.page/)
  const css = fs.readFileSync(new URL('../src/pages/auth/auth.css', import.meta.url), 'utf8')
  assert.match(css, /data-touch-state='pressed'/)
  assert.match(css, /data-touch-state='held'/)
  assert.match(css, /scale\(\.985\)/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(css, /:hover/)
})
