import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { compile } from 'vue'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const source = read('src/components/SettingsSwitch.vue')
const template = source.match(/<template>([\s\S]*?)<\/template>/)[1]
const render = compile(template)
const switch_view = (disabled = false, checked = false) => {
  const events = []
  const node = render({ disabled, checked, label: 'Messages', interaction: 'notification.messages.toggle.1', emit: event => events.push(event) }, [])
  return { node, events }
}
const dispatch = (node, name, event) => {
  for (const handler of [node.props[name]].flat()) handler(event)
}

test('switch keeps one semantic touch target and an unchanged visual track inside it', () => {
  const { node } = switch_view(false, true)
  assert.equal(node.props.role, 'switch')
  assert.equal(node.props['aria-label'], 'Messages')
  assert.equal(node.props['aria-checked'], true)
  assert.equal(node.props['data-interaction'], 'notification.messages.toggle.1')
  const [track] = node.children
  assert.equal(track.props.class, 'settings-switch-track')
  assert.equal(track.children[0].props.class, 'settings-switch-dot')
  assert.doesNotMatch(track.props.class, /role|button/)
  const hit_rule = source.match(/\.settings-switch\s*\{([^}]+)\}/)[1]
  assert.match(hit_rule, /min-width:\s*var\(--app-touch-target,\s*83\.969rpx\)/)
  assert.match(hit_rule, /min-height:\s*var\(--app-touch-target,\s*83\.969rpx\)/)
  const track_rule = source.match(/\.settings-switch-track\s*\{([^}]+)\}/)[1]
  assert.match(track_rule, /width:\s*95\.42rpx/)
  assert.match(track_rule, /height:\s*57\.252rpx/)
  assert.doesNotMatch(hit_rule, /background:|::(?:before|after)/)
})

test('switch touch and keyboard handlers emit once when enabled and never when disabled', () => {
  for (const disabled of [false, true]) {
    const { node, events } = switch_view(disabled)
    assert.equal(node.props['aria-disabled'], disabled)
    dispatch(node, 'onClick', { type: 'click' })
    dispatch(node, 'onKeydown', { key: 'Enter', preventDefault() {} })
    dispatch(node, 'onKeydown', { key: ' ', preventDefault() {} })
    assert.deepEqual(events, disabled ? [] : ['toggle', 'toggle', 'toggle'])
    // A press/release/long press has no separate business handler that could
    // double-toggle before iPhone's normal click dispatch.
    for (const name of ['onPointerdown', 'onPointerup', 'onTouchstart', 'onTouchend', 'onContextmenu']) assert.equal(node.props[name], undefined)
  }
})

test('native host suppresses link previews without disabling editable text interaction', () => {
  const host = read('ios/cimoaNeapo/Sources/WebViewController.swift')
  assert.match(host, /webView\.allowsLinkPreview\s*=\s*false/)
  assert.doesNotMatch(host, /isTextInteractionEnabled\s*=\s*false|gestureRecognizers\??\.forEach|canPerformAction\(/)
  const native_test = read('ios/cimoaNeapo/Tests/HostTests.swift')
  assert.match(native_test, /XCTAssertFalse\(host\.webView\.allowsLinkPreview\)/)
  assert.match(native_test, /XCTAssertTrue\(host\.webView\.configuration\.preferences\.isTextInteractionEnabled\)/)
})
