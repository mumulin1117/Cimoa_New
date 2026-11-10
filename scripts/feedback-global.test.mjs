import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { feedback_style_violations } from './lib/feedback-style-contract.mjs'

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')

test('media loading uses the shared brand mark without replacing its local read state with a global blocker', () => {
  for (const name of ['ProfilePhoto', 'EventAudio', 'IcebreakerAudio', 'RequestAudioPlayer', 'ProfileVoiceIntro']) {
    const source = read(`src/components/${name}.vue`)
    assert.match(source, /import BrandProgressMark from '\.\/BrandProgressMark\.vue'/)
    assert.match(source, /<BrandProgressMark(?:\s|\/|>)/)
    assert.doesNotMatch(source, /action_notice|<ActionLoading|(?:uni|wx)\.(?:showToast|showLoading)\(/)
    if (name !== 'ProfilePhoto') {
      assert.match(source, /:aria-busy="pending"/)
      assert.match(source, name === 'EventAudio' ? /:aria-disabled="pending \|\| disabled"/ : /:aria-disabled="pending"/)
    } else {
      assert.match(source, /v-if="status === 'loading'" class="profile-photo-loading"/)
      assert.match(source, /!portrait \|\| status !== 'loading'/)
    }
  }
  assert.match(read('src/components/EventAudio.vue'), /if \(pending\.value\) return/)
  assert.match(read('src/components/RequestAudioPlayer.vue'), /if \(pending\.value \|\| !page_visible \|\| suspended\) return/)
  assert.match(read('src/components/IcebreakerAudio.vue'), /if \(pending\.value\) return/)
})

test('system loading uses an accessible shared brand mark, while non-loading states retain their own icon', () => {
  const panel = read('src/components/FlowStatePanel.vue')
  assert.match(panel, /loading: Boolean/)
  assert.match(panel, /:role="loading \? 'status' : undefined"/)
  assert.match(panel, /:aria-busy="loading \|\| undefined"/)
  assert.match(panel, /<BrandProgressMark v-if="loading" \/><SourceIcon v-else/)
  assert.match(read('src/components/SystemStatePage.vue'), /:loading="state === 'loading'"/)
  const received = read('src/pages/connections/received.vue')
  assert.equal((received.match(/<FeedbackToast\b/g) || []).length, 1)
  assert.match(received, /<FeedbackToast v-if="error && !sheet"/)
})

test('feedback contract rejects native HUDs and obsolete component skins', () => {
  for (const source of [
    'uni.showToast({title: message})', "uni['showLoading']({})", 'wx.hideToast()',
    'plus.nativeUI.toast(message)', 'plus.nativeUI.showWaiting()', '<uni-toast />', '<u-loading-icon />',
    '<view class="loading-mask" />', '.event-loading-ring { animation: spin 1s linear infinite; }',
    '<view class="foo toast-container bar" />', '.chat-action-loading__ring { border: 2px solid; }',
  ]) assert.ok(feedback_style_violations(source).length, source)
})

test('feedback contract allows branded progress, dedicated skeletons/refresh and persistent errors', () => {
  for (const source of [
    '<BrandToastHost /><ActionLoading :visible="is_loading" /><BrandProgressMark />',
    'uni.getLocation({showToast: false})', '<ContentSkeleton kind="discover" /><BrandRefresh />',
    '<text role="alert" class="form-error">{{ error }}</text>',
    '.brand-toast { background: var(--cimoa-gradient-toast-border); }',
    '<FlowStatePanel :loading="state === \'loading\'" />',
  ]) assert.deepEqual(feedback_style_violations(source), [], source)
})

test('native driver transfer strips only export declarations and preserves explicit arguments', () => {
  const swift = read('ios/cimoaNeapo/Tests/EventCoverTests.swift').split('private func stateDriverSource')[1].split('private func ')[0]
  assert.ok(swift.includes('(?m)^export'))
  assert.ok(swift.includes('options: .regularExpression'))
  assert.ok(!swift.includes('replacingOccurrences(of: "export "'))
  const source = read('scripts/lib/feedback-global-regression.mjs')
  const transferred = source.replace(/^export[\t ]+(?=(?:async[\t ]+)?function\b)/gm, '')
  const driver = Function(`${transferred}; return feedback_global_regression`)()
  assert.equal(typeof driver, 'function')
  assert.match(driver.toString(), /toast_export = ''/)
  assert.match(driver.toString(), /module\[toast_export\]/)
})
