import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
import { AUTO_MATCH_GUIDE_TARGETS, auto_match_guide_layout, auto_match_guide_scrim_path } from '../src/utils/autoMatchGuideLayout.js'
import { MOTION } from '../src/config/navigation.js'

const read = name => fs.readFileSync(new URL(`../src/components/${name}.vue`, import.meta.url), 'utf8')
const ref = value => ({ value })
const computed = getter => ({ get value() { return getter() } })
const node = (name, { disabled = false, inert = false, height = 44, connected = true } = {}) => ({
  name, isConnected: connected, focused: 0,
  getAttribute: key => key === 'aria-disabled' ? String(disabled) : null,
  closest: selector => selector === '[inert]' && inert ? {} : null,
  getBoundingClientRect: () => ({ left: 20, top: 100, width: 200, height }),
  focus() { this.focused++ },
})
function fixture(change = {}) {
  const props = { open: true, step: 3, busy: false, error: '', steps: Array.from({ length: 7 }, (_, index) => ({ title: `Step ${index}`, action: 'Next' })), targets: ['', '', '', '.questions'], scopeSelector: '.actual-page', interactionPrefix: 'discoverGuide', kind: 'discover', nextDisabled: false, interactiveTarget: true, ...change }
  const emitted = [], hooks = { mounted: [], unmounted: [], hide: [], show: [] }
  const question = node('question'), unrelated = node('unrelated'), skip = node('skip'), back = node('back'), next = node('next')
  const target = { ...node('target'), querySelectorAll: () => [question], contains: value => value === question }
  const scope = { querySelectorAll: selector => selector === '.questions' ? [target] : [] }
  const card = { ...node('card'), querySelectorAll: () => [skip, back, next], contains: value => [skip, back, next].includes(value), closest: selector => selector === '.actual-page' ? scope : null }
  const document = { activeElement: next, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  const args = { computed, ref, nextTick: async () => {}, watch() {}, getCurrentInstance: () => ({ uid: 1 }), onMounted: fn => hooks.mounted.push(fn), onUnmounted: fn => hooks.unmounted.push(fn), onHide: fn => hooks.hide.push(fn), onShow: fn => hooks.show.push(fn), defineProps: () => props, defineEmits: () => (...value) => emitted.push(value), defineExpose() {}, MOTION, auto_match_guide_layout, auto_match_guide_scrim_path, window: { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }), addEventListener() {}, removeEventListener() {} }, document }
  const source = read('SpotlightGuide').match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const subject = new Function(...Object.keys(args), `${source}\nreturn { card_node, geometry, rendered, showing, layout_ready, interaction_ready, retained_step, target_node, controls, can_interact_target, allowed_focus, keydown, guard_target_input, request_action, interaction_id, release_focus, remember_focus: value => { previous_focus = value } }`)(...Object.values(args))
  subject.card_node.value = card
  subject.rendered.value = true; subject.showing.value = true; subject.layout_ready.value = true; subject.interaction_ready.value = true
  subject.retained_step.value = props.step
  subject.geometry.value = { spot: { left: 20, top: 100, width: 200, height: 100 } }
  return { props, emitted, hooks, document, subject, question, unrelated, skip, back, next, target, scope, card }
}
const event = target => ({ target, prevented: false, stopped: false, preventDefault() { this.prevented = true }, stopImmediatePropagation() { this.stopped = true } })

test('all guide components compile as Vue 3 script-setup with one shared visual renderer', () => {
  for (const name of ['AutoMatchGuide', 'DiscoverGuide', 'SpotlightGuide']) {
    const source = read(name), { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [], name)
    const script = compileScript(descriptor, { id: name })
    const template = compileTemplate({ id: name, source: descriptor.template.content, filename: `${name}.vue`, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [], name)
    if (name !== 'SpotlightGuide') {
      assert.equal(descriptor.styles.length, 0, 'wrappers never fork the glass-card styles')
      assert.match(descriptor.template.content, /<SpotlightGuide/)
    }
  }
})

test('Auto Match preserves its four teaching steps, target mapping and default interaction IDs', () => {
  const source = read('AutoMatchGuide')
  assert.equal((source.match(/title: '/g) || []).length, 4)
  assert.match(source, /Meet your campus, one person at a time/)
  assert.match(source, /Nothing starts during this guide/)
  assert.match(source, /:targets="AUTO_MATCH_GUIDE_TARGETS"/)
  assert.deepEqual(AUTO_MATCH_GUIDE_TARGETS, ['.home-match', '.am-1505-49', '.am-1504-45', ''])
  const f = fixture({ interactionPrefix: 'autoMatchGuide', interactiveTarget: false })
  assert.equal(f.subject.interaction_id('finish'), 'autoMatchGuide.finish.click.1')
  assert.deepEqual(f.subject.controls().map(value => value.name), ['skip', 'back', 'next'])
  assert.equal(f.subject.can_interact_target.value, false)
})

test('Discover has seven steps, exposes only question/mode controls and describes actual cost and consent', () => {
  const source = read('DiscoverGuide')
  assert.equal((source.match(/\{ title:/g) || []).length, 7)
  assert.match(source, /:interactive-target="step === 3 \|\| step === 4"/)
  assert.match(source, /confirm the 10-coin cost before sending/)
  assert.match(source, /Chat opens only when you connect/)
  assert.match(source, /Waiting for reply/)
  assert.match(source, /\.ice-reply-card/)
  assert.match(source, /\.ice-record-card/)
  assert.doesNotMatch(source, /\b(?:local data|local demo|demo account|saved)\b/i)
})

test('the spotlight reads only its owning frame, never a cached global page target', () => {
  const f = fixture()
  assert.equal(f.subject.target_node(), f.target)
  f.card.closest = () => null
  assert.equal(f.subject.target_node(), null)
  f.card.closest = selector => selector === '.actual-page' ? f.scope : null
  f.target.isConnected = false
  assert.equal(f.subject.target_node(), null)
})

test('ready interactive holes allow real target touches and block neighbouring business controls', () => {
  const f = fixture()
  for (const target of [f.question, f.next]) {
    const touch = event(target); f.subject.guard_target_input(touch)
    assert.equal(touch.prevented, false, target.name)
  }
  const outside = event(f.unrelated); f.subject.guard_target_input(outside)
  assert.equal(outside.prevented, true); assert.equal(outside.stopped, true)
  f.subject.interaction_ready.value = false
  const moving = event(f.question); f.subject.guard_target_input(moving)
  assert.equal(moving.prevented, true, 'moving highlight cannot expose a target before geometry settles')
  f.subject.interaction_ready.value = true; f.subject.geometry.value.spot = null
  const missing = event(f.question); f.subject.guard_target_input(missing)
  assert.equal(missing.prevented, true, 'a missing anchor never exposes unrelated content')
})

test('next requires manual selection while back and skip stay available; busy locks all controls', () => {
  const f = fixture({ nextDisabled: true })
  f.subject.request_action('next'); assert.deepEqual(f.emitted, [])
  f.subject.request_action('back'); f.subject.request_action('skip')
  assert.deepEqual(f.emitted, [['back'], ['skip']])
  f.props.busy = true
  for (const action of ['next', 'back', 'skip']) f.subject.request_action(action)
  assert.equal(f.emitted.length, 2)
  f.props.busy = false; f.props.nextDisabled = false
  f.subject.request_action('next'); assert.deepEqual(f.emitted.at(-1), ['next'])
})

test('focus loops through only highlighted question/mode controls and the guide, never an editor or fee button', () => {
  const f = fixture()
  assert.deepEqual(f.subject.controls().map(value => value.name), ['question', 'skip', 'back', 'next'])
  const forward = { key: 'Tab', preventDefault() {}, shiftKey: false }
  f.document.activeElement = f.next; f.subject.keydown(forward)
  assert.equal(f.question.focused, 1)
  f.document.activeElement = f.question; f.subject.keydown({ ...forward, shiftKey: true })
  assert.equal(f.next.focused, 1)
  assert.equal(f.subject.allowed_focus(f.question), true)
  assert.equal(f.subject.allowed_focus(f.unrelated), false)
  f.props.interactiveTarget = false
  assert.deepEqual(f.subject.controls().map(value => value.name), ['skip', 'back', 'next'])
  assert.equal(f.subject.allowed_focus(f.question), false)
  assert.equal(f.unrelated.focused, 0)
})

test('disabled, inert, detached and zero-sized controls never join the focus loop', () => {
  const f = fixture()
  f.card.querySelectorAll = () => [node('disabled', { disabled: true }), node('inert', { inert: true }), node('hidden', { height: 0 }), node('detached', { connected: false }), f.next]
  assert.deepEqual(f.subject.controls().map(value => value.name), ['question', 'next'])
  assert.deepEqual(f.subject.controls(true).map(value => value.name), ['question', 'disabled', 'next'])
})

test('hiding or unmounting immediately cancels presentation and all subsequent actions', () => {
  for (const hook of ['hide', 'unmounted']) {
    const f = fixture()
    f.hooks[hook].forEach(callback => callback())
    assert.equal(f.subject.rendered.value, false)
    assert.equal(f.subject.showing.value, false)
    assert.equal(f.subject.interaction_ready.value, false)
    f.subject.request_action('next')
    assert.deepEqual(f.emitted, [])
  }
})

test('closing never restores focus into a hidden, inert or retained different-page underlay', () => {
  for (const kind of ['hidden', 'inert', 'different-page', 'detached', 'valid']) {
    const f = fixture(), previous = node('previous')
    f.scope.contains = value => value === previous && kind !== 'different-page'
    previous.checkVisibility = () => kind !== 'hidden'
    previous.closest = () => kind === 'inert' ? {} : null
    previous.isConnected = kind !== 'detached'
    f.subject.remember_focus(previous)
    f.subject.release_focus()
    assert.equal(previous.focused, kind === 'valid' ? 1 : 0, kind)
  }
})

test('compact interactive cards retain a real question hole on a short iPhone viewport', () => {
  // Actual 320x568 route: questions begin around 211pt after scrollIntoView.
  // Compact single-row controls remove the redundant 44pt header Skip row.
  const geometry = auto_match_guide_layout({ width: 320, height: 568, safe_top: 62, safe_bottom: 34, anchor: { left: 16, top: 211, width: 288, height: 230 }, card_height: 190, chrome_height: 82, interactive_target: true })
  assert.ok(geometry.spot, 'manual selection must not be hidden behind an unanchored modal')
  assert.equal(geometry.placement, 'above')
  assert.ok(geometry.body_height >= 35, 'explanation remains scrollable and legible, not reduced to a 1-line sliver')
  assert.ok(geometry.card.top + geometry.card.height < geometry.spot.top)
  assert.ok(geometry.card.top >= 20)
  assert.ok(geometry.card.top + geometry.card.height < 568)
  assert.match(auto_match_guide_scrim_path(geometry), /A/)
  const previous = auto_match_guide_layout({ width: 320, height: 568, safe_top: 20, anchor: { left: 20, top: 210, width: 280, height: 200 }, card_height: 250, chrome_height: 125 })
  assert.equal(previous.spot, null, 'the original noninteractive fallback remains unchanged')
})

test('shared visual layer retains safe areas, 44pt controls, reduction and correct interactive semantics', () => {
  const source = read('SpotlightGuide')
  assert.match(source, /:aria-modal="interactiveTarget \? undefined : 'true'"/)
  assert.match(source, /\.spotlight-guide--interactive \{ pointer-events: none; \}/)
  assert.match(source, /\.guide-scrim path \{ pointer-events: fill; \}/)
  assert.match(source, /v-if="!interactiveTarget" class="guide-skip"/)
  assert.match(source, /v-if="interactiveTarget" class="guide-skip guide-skip--inline"/)
  assert.match(source, /min-height: calc\(84rpx \* var\(--app-touch-scale, 1\)\)/)
  assert.match(source, /var\(--app-safe-top, 0px\)/)
  assert.match(source, /var\(--app-safe-bottom, 0px\)/)
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|setStorage|start_match|send_introduction|\.focus\(.*(?:input|textarea)|:hover|#[0-9a-f]{3,8}\b/i)
})

test('profile teaching return forwards the real result and locks repeated Back until navigation settles', async () => {
  const source = fs.readFileSync(new URL('../src/pages/discover/profile.vue', import.meta.url), 'utf8')
  const implementation = source.slice(source.indexOf('const back = async'), source.indexOf('const change_photo'))
  const state = { is_loading: ref(false), sheet: ref(''), navigating: ref(false), error: ref(''), frame: ref(null) }
  let calls = 0, finish
  state.frame.value = { navigate_back: () => { calls++; return new Promise(resolve => { finish = resolve }) } }
  const back = new Function(...Object.keys(state), 'back_fallback', `${implementation}\nreturn back`)(...Object.values(state), () => '/pages/discover/index')
  const first = back()
  assert.equal(state.navigating.value, true)
  assert.equal(await back(), false)
  assert.equal(calls, 1)
  finish(false); assert.equal(await first, false)
  assert.equal(state.navigating.value, false)
  state.frame.value.navigate_back = async () => { throw Error('Couldn’t open this page.') }
  assert.equal(await back(), false)
  assert.equal(state.error.value, 'Couldn’t open this page.')
  assert.equal(state.navigating.value, false)
  assert.match(source, /ready: computed\(\(\) => guide_presented\.value && !skeleton\.value\)/)
  assert.match(source, /return_discover: \(\) => back\(\)/)
  assert.match(source, /:scroll-locked="!!sheet \|\| is_loading \|\| guide_open"/)
})
