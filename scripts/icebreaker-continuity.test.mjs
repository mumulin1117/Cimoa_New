import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { NAVIGATION, MOTION } from '../src/config/navigation.js'
import { create_icebreaker_motion_receipt } from '../src/utils/icebreakerMotion.js'

const identity = (target_kind = 'select', change = {}) => ({ auth_context: 'account-a', user_id: 'person-a', question_id: target_kind === 'select' ? '' : 'question-a', target_kind, ...change })
test('a forward visual receipt can be consumed once by its exact entity, account, question and mode', () => {
  const receipt = create_icebreaker_motion_receipt()
  for (const kind of ['select', 'text', 'voice']) {
    assert.equal(typeof receipt.arm(identity(kind)), 'number')
    assert.equal(receipt.consume(identity(kind)), true)
    assert.equal(receipt.consume(identity(kind)), false, 'warm return has no receipt to replay')
  }
})
test('wrong account, person, question or target consumes no visual cue and cannot leak to another page', () => {
  for (const change of [{ auth_context: 'account-b' }, { user_id: 'person-b' }, { question_id: 'question-b' }, { target_kind: 'voice' }]) {
    const receipt = create_icebreaker_motion_receipt()
    receipt.arm(identity('text'))
    assert.equal(receipt.consume(identity('text', change)), false)
    assert.equal(receipt.consume(identity('text')), false)
  }
})
test('expired, clock-reversed and malformed receipts fail closed without creating timers', () => {
  let clock = 100
  const receipt = create_icebreaker_motion_receipt({ now: () => clock })
  receipt.arm(identity()); clock += NAVIGATION.callback_timeout_ms + 1
  assert.equal(receipt.consume(identity()), false)
  receipt.arm(identity()); clock--
  assert.equal(receipt.consume(identity()), false)
  for (const data of [null, {}, identity('preview'), identity('text', { question_id: '' }), identity('text', { auth_context: '' }), identity('text', { user_id: null })]) assert.equal(receipt.arm(data), null)
})
test('late failure clears only its own pending receipt; background/route cancellation can clear all', () => {
  const receipt = create_icebreaker_motion_receipt()
  const old = receipt.arm(identity())
  receipt.arm(identity('text'))
  receipt.clear(old)
  assert.equal(receipt.consume(identity('text')), true)
  const current = receipt.arm(identity('voice'))
  receipt.clear(current)
  assert.equal(receipt.consume(identity('voice')), false)
  receipt.arm(identity()); receipt.clear()
  assert.equal(receipt.consume(identity()), false)
})
test('presentation holds no business data, persistent state, navigation or additional wait', () => {
  const source = fs.readFileSync(new URL('../src/utils/icebreakerMotion.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /localStorage|sessionStorage|setStorage|setTimeout|setInterval|navigate_|store\./)
  const receipt = create_icebreaker_motion_receipt()
  const person = identity('text', { text: 'Private answer', profile: { age: 21 } })
  const previous = structuredClone(person)
  receipt.arm(person)
  assert.equal(receipt.consume(identity('text')), true)
  assert.deepEqual(person, previous)
})

const ref = value => ({ value })
const computed = getter => ({ get value() { return getter() } })
const source_for = page => fs.readFileSync(new URL(`../src/pages/discover/icebreaker/${page}.vue`, import.meta.url), 'utf8')
const fixture = page => {
  const source = source_for(page), hooks = { load: [], show: [], hide: [], ready: [], unmounted: [] }
  const calls = [], media = { draft: ref(null), recording: ref(false), busy: ref(false), seconds: ref(0), clear: () => calls.push('clear'), start: () => calls.push('start'), stop: () => calls.push('stop') }
  const data = { user: { user_id: 'person-a', user_name: 'Chloe', university: 'HKUST' }, questions: [{ question_id: 'question-a', text: 'Your ideal weekend?' }], question: { question_id: 'question-a', text: 'Your ideal weekend?' }, draft: { payload: { question_id: 'question-a', text: 'Hello', mode: 'text' } }, balance: 60 }
  const store = { auth_context: 'account-a', current_user: { university: 'HKUST' }, introduction_context: () => data, stage_introduction_form: () => { calls.push('stage'); return { success: true, data: 'draft-a' } }, edit_introduction_form: () => ({ success: true }) }
  const motion = { cue: ref(true), style: {}, enter: () => calls.push('enter'), finish() {}, arm: kind => { calls.push(`arm:${kind}`); return 7 }, cancel: token => calls.push(`cancel:${token}`) }
  const loading = ref(false)
  const args = { ref, computed, onLoad: fn => hooks.load.push(fn), onShow: fn => hooks.show.push(fn), onHide: fn => hooks.hide.push(fn), onReady: fn => hooks.ready.push(fn), onUnmounted: fn => hooks.unmounted.push(fn), use_app_store: () => store, use_write_loading: () => ({ is_loading: loading, run_with_loading: async () => ({ success: false }), cancel_loading() {} }), use_visual_viewport: () => ({ height: ref('100vh'), keyboard_open: ref(false) }), use_event_media: () => media, use_icebreaker_motion: () => motion, use_send_surface_target: () => ({ surface_mode: ref(false), busy: ref(false), enter() {} }) }
  args.use_discover_guide = () => ({ open: ref(false), busy: ref(false) })
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const names = page === 'select' ? 'frame, navigating, answer, back, pick_question, pick_mode, question_id, mode' : page === 'text' ? 'frame, navigating, switch_voice, back' : 'frame, navigating, back_now, back, record, switch_text'
  const subject = new Function(...Object.keys(args), `${script}\nreturn { ${names} }`)(...Object.values(args))
  hooks.load.forEach(fn => fn({ user_id: 'person-a', draft_id: 'draft-a' })); hooks.show.forEach(fn => fn())
  return { subject, calls, hooks, data, media }
}

test('question selection locks before navigation, never shows Saving, and clears a failed visual receipt', async () => {
  const f = fixture('select'), { subject } = f
  let complete
  subject.frame.value = { navigate_forward: () => new Promise(resolve => { complete = resolve }) }
  const first = subject.answer()
  assert.equal(subject.navigating.value, true)
  subject.pick_question('question-b'); subject.pick_mode('voice')
  await subject.answer()
  assert.equal(subject.question_id.value, 'question-a')
  assert.equal(subject.mode.value, 'text')
  assert.equal(f.calls.filter(call => call === 'stage').length, 1)
  assert.equal(f.calls.filter(call => call === 'arm:text').length, 1)
  complete(false); await first
  assert.equal(subject.navigating.value, false)
  assert.ok(f.calls.includes('cancel:7'))
  assert.doesNotMatch(source_for('select'), /run_with_loading|Saving/)
  assert.match(source_for('select'), /EventActionLoading :visible="guide\.is_loading\.value"/)
})
test('selection and voice Back lock synchronously and do not perform multiple returns', async () => {
  for (const page of ['select', 'voice']) {
    const f = fixture(page), { subject } = f
    let resolve, count = 0
    subject.frame.value = { navigate_back: () => { count++; return new Promise(yes => { resolve = yes }) } }
    const back = page === 'voice' ? subject.back_now : subject.back
    const first = back()
    assert.equal(subject.navigating.value, true)
    await back()
    assert.equal(count, 1)
    if (page === 'voice') { subject.record(); assert.ok(!f.calls.includes('start')) }
    resolve(true); await first
    assert.equal(subject.navigating.value, false)
  }
})
test('mode changes bind the current question and preserve false/failure navigation semantics', async () => {
  for (const [page, method, kind] of [['text', 'switch_voice', 'voice'], ['voice', 'switch_text', 'text']]) {
    const f = fixture(page), { subject } = f
    let reject
    subject.frame.value = { navigate_replace: () => new Promise((_, no) => { reject = no }) }
    const pending = subject[method]()
    assert.equal(subject.navigating.value, true)
    await subject[method]()
    assert.equal(f.calls.filter(call => call === `arm:${kind}`).length, 1)
    reject(new Error('Couldn’t open this page.')); await pending
    assert.equal(subject.navigating.value, false)
    assert.ok(f.calls.includes('cancel:7'))
  }
})
test('answer pages keep body-only 240ms motion and select scopes its point-surface exception without new sheets or automatic focus', () => {
  assert.equal(MOTION.page, 240)
  for (const page of ['select', 'text', 'voice']) {
    const source = source_for(page), { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [])
    assert.match(descriptor.template.content, /<SecondaryPageFrame[^>]*\bcontent-motion\b/)
    assert.match(descriptor.template.content, /:aria-busy=/)
    if (page === 'select') {
      assert.match(descriptor.template.content, /:content-motion="!surface\.surface_mode\.value"/)
      assert.match(descriptor.template.content, /:surface-motion="surface\.surface_mode\.value"/)
      assert.match(descriptor.template.content, /:inert="navigating \|\| surface\.busy\.value \? '' : undefined"/)
    } else assert.match(descriptor.template.content, /:inert="navigating \|\| guide_open \? '' : undefined"/)
    assert.doesNotMatch(source, /setTimeout|setInterval|autofocus|\.focus\(|<PageTransition|<scroll-view/)
    assert.match(source, /motion\.enter\(\)/)
  }
  const css = fs.readFileSync(new URL('../src/pages/discover/icebreaker/icebreaker.css', import.meta.url), 'utf8')
  assert.match(css, /pointer-events: none/)
  assert.match(css, /var\(--cimoa-gradient-primary\)/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(css, /:hover|\b(?:rgb|rgba|hsl)\(|#[0-9a-f]{3,8}\b/i)
  const composable = fs.readFileSync(new URL('../src/composables/useIcebreakerMotion.js', import.meta.url), 'utf8')
  for (const event of ['visibilitychange', 'pointercancel', 'lostpointercapture', 'pagehide']) {
    assert.match(composable, new RegExp(`addEventListener\\?\\.\\('\\b${event}'`))
    assert.match(composable, new RegExp(`removeEventListener\\?\\.\\('\\b${event}'`))
  }
  assert.match(composable, /onHide\(finish\)/)
})
