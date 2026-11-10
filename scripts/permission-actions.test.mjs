import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { notification_permission } from '../src/utils/nativePermissions.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const ref = value => ({ value })
const computed = getter => ({ get value() { return getter() } })
const script = source => source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const attr = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
const binding = (node, name, arg) => node.props?.find(prop => prop.type === 7 && prop.name === name && prop.arg?.content === arg)
const text = node => (node.children || []).map(child => child.type === 2 ? child.content : text(child)).join('').trim()
const template_nodes = path => {
  const { descriptor, errors } = parse(read(path)), nodes = []
  assert.deepEqual(errors, [], `${path} must compile without SFC parse errors`)
  const visit = node => { nodes.push(node); for (const child of node.children || []) visit(child) }
  visit(descriptor.template.ast)
  return nodes
}
const assert_action = (nodes, interaction, label, handler) => {
  const node = nodes.find(candidate => attr(candidate, 'data-interaction') === interaction)
  assert.ok(node, interaction)
  assert.equal(text(node), label)
  assert.equal(attr(node, 'role'), 'button')
  assert.equal(attr(node, 'tabindex'), '0')
  assert.ok(binding(node, 'bind', 'aria-disabled'), `${interaction} retains an actual busy presentation`)
  for (const action of node.props.filter(prop => prop.type === 7 && prop.name === 'on')) assert.equal(action.exp?.content, handler)
}

test('microphone explanation keeps its title but uses Continue and Cancel with busy-safe real events', () => {
  const nodes = template_nodes('src/components/IntroductionConfirmDialog.vue')
  assert_action(nodes, 'sheetMic.allowMic.click.1', 'Continue', "!busy && $emit('confirm')")
  assert_action(nodes, 'sheetMic.denyMic.click.1', 'Cancel', "!busy && $emit('close')")
  assert.ok(nodes.some(node => attr(node, 'class') === 'intro-sheet-title intro-sheet-center' && text(node) === 'Allow microphone access'))
})

test('shared media pre-prompt labels Continue/Cancel and retains separate request/return actions', () => {
  const nodes = template_nodes('src/components/MediaPermissionPage.vue')
  for (const [handler, label] of [['allow', 'Continue'], ['back', 'Cancel']]) {
    const node = nodes.find(candidate => attr(candidate, 'role') === 'button' && binding(candidate, 'on', 'click')?.exp.content === handler)
    assert.ok(node)
    assert.equal(text(node), label)
    assert.equal(binding(node, 'bind', 'aria-disabled').exp.content, 'requesting || navigating')
    assert.equal(binding(node, 'on', 'keydown').exp.content, handler)
  }
  assert.match(read('src/components/MediaPermissionPage.vue'), /read: permission_statuses, request: request_media_permission/)
})

for (const [page, prefix, primary, secondary] of [
  ['src/pages/onboarding/notif.vue', 'obNotif', 'enableNotifs', 'skipNotifs'],
  ['src/pages/permissions/notif.vue', 'permNotif', 'allowNotifs', 'denyNotifs'],
]) test(`${page} delegates both buttons to the same real notification flow`, () => {
  const source = read(page), nodes = template_nodes(page)
  assert_action(nodes, `${prefix}.${primary}.click.1`, 'Continue', 'allow')
  assert_action(nodes, `${prefix}.${secondary}.click.1`, 'Cancel', 'decline')
  assert.match(source, /use_notification_permission\(frame\)/)
  assert.doesNotMatch(source, /notification_permission\(true\)|save\(\{\s*notification_permission:\s*'denied'/)
})

const notification_source = read('src/composables/useNotificationPermission.js')
// Execute the checked-in composable, replacing imports only with observable boundaries.
const instantiate_notification = new Function('onUnmounted', 'ref', 'onHide', 'onShow', 'use_onboarding', 'notification_permission', 'open_app_settings', `${notification_source.replace(/^import .*$/gm, '').replace('export function use_notification_permission', 'function use_notification_permission')}\nreturn use_notification_permission(null)`)
const notification_subject = ({ initial = 'not_requested', answer = 'granted', fail } = {}) => {
  const hooks = { show: [], hide: [], unmount: [] }, calls = { methods: [], saves: [], settings: 0 }
  const setup = { error: ref(''), access_error: ref(''), allowed: ref(true), context: ref({ account_id: 'account-a' }), is_loading: ref(false), save: async patch => { calls.saves.push(patch) } }
  const env = { window: { webkit: { messageHandlers: { CimoaHost: {} } }, CimoaNativeBridge: { request: async method => {
    calls.methods.push(method)
    if (method === 'getNotificationPermission') return { status: initial }
    assert.equal(method, 'requestNotifications')
    if (fail) throw fail
    return { status: await answer }
  } } } }
  const flow = instantiate_notification(handler => hooks.unmount.push(handler), ref, handler => hooks.hide.push(handler), handler => hooks.show.push(handler), () => setup, request => notification_permission(request, env), async () => { calls.settings++ })
  return { flow, setup, calls, show: () => Promise.all(hooks.show.map(handler => handler())), hide: () => hooks.hide.forEach(handler => handler()), unmount: () => hooks.unmount.forEach(handler => handler()) }
}

test('Continue calls the real native notification adapter exactly once under rapid repeated taps', async () => {
  const response = deferred(), subject = notification_subject({ answer: response.promise })
  await subject.show()
  assert.deepEqual(subject.calls.methods, ['getNotificationPermission'])
  const first = subject.flow.allow()
  assert.equal(subject.flow.requesting.value, true)
  for (let index = 0; index < 10; index++) { await subject.flow.allow(); await subject.flow.decline() }
  assert.deepEqual(subject.calls.methods, ['getNotificationPermission', 'requestNotifications'])
  assert.deepEqual(subject.calls.saves, [])
  response.resolve('granted'); await first
  assert.deepEqual(subject.calls.saves, [{ notification_permission: 'granted' }])
  assert.equal(subject.flow.requesting.value, false)
})

test('Cancel skips setup without a system request and never fabricates a denied status', async () => {
  for (const initial of ['not_requested', 'granted']) {
    const subject = notification_subject({ initial })
    await subject.show(); await subject.flow.decline()
    assert.deepEqual(subject.calls.methods, ['getNotificationPermission'])
    assert.deepEqual(subject.calls.saves, [{ notification_permission: 'skipped' }])
    assert.equal(subject.flow.status.value, initial)
  }
})

test('Cancel can preserve an already-read OS denial or unavailability without requesting again', async () => {
  for (const initial of ['denied', 'unavailable']) {
    const subject = notification_subject({ initial })
    await subject.show(); await subject.flow.decline()
    assert.deepEqual(subject.calls.methods, ['getNotificationPermission'])
    assert.deepEqual(subject.calls.saves, [{ notification_permission: initial }])
  }
})

test('denied, unavailable, not-requested and unknown system results never advance profile setup', async () => {
  for (const answer of ['denied', 'unavailable', 'not_requested', 'pretend']) {
    const subject = notification_subject({ answer })
    await subject.show(); await subject.flow.allow()
    assert.deepEqual(subject.calls.saves, [])
    assert.ok(subject.flow.error.value, answer)
    assert.equal(subject.flow.requesting.value, false)
  }
})

test('system request failure preserves a retryable error and writes no permission preference', async () => {
  const subject = notification_subject({ fail: Error('Notification access could not be requested. Please try again.') })
  await subject.show(); await subject.flow.allow()
  assert.match(subject.flow.error.value, /could not be requested/)
  assert.deepEqual(subject.calls.saves, [])
  assert.equal(subject.flow.requesting.value, false)
})

test('page hide and unmount invalidate late permission grants and prevent all setup writes', async () => {
  for (const leave of ['hide', 'unmount']) {
    const response = deferred(), subject = notification_subject({ answer: response.promise })
    await subject.show()
    const pending = subject.flow.allow()
    subject[leave]()
    response.resolve('granted'); await pending
    assert.deepEqual(subject.calls.saves, [])
    assert.equal(subject.flow.requesting.value, false)
    assert.equal(subject.flow.status.value, 'not_requested')
    await subject.flow.allow(); await subject.flow.decline()
    assert.equal(subject.calls.methods.filter(method => method === 'requestNotifications').length, 1)
  }
})

test('account switch invalidates a pending grant before any new-account preference can be written', async () => {
  const response = deferred(), subject = notification_subject({ answer: response.promise })
  await subject.show()
  const pending = subject.flow.allow()
  subject.setup.context.value = { account_id: 'account-b' }
  response.resolve('granted'); await pending
  assert.deepEqual(subject.calls.saves, [])
  assert.equal(subject.flow.status.value, 'not_requested')
  assert.equal(subject.flow.requesting.value, false)
})

test('late system rejection after leaving or account switching cannot show another account an error', async () => {
  for (const mode of ['hide', 'account']) {
    const response = deferred(), subject = notification_subject({ answer: response.promise })
    await subject.show()
    const pending = subject.flow.allow()
    if (mode === 'hide') subject.hide(); else subject.setup.context.value = { account_id: 'account-b' }
    response.reject(Error('Old permission request failed.')); await pending
    assert.deepEqual(subject.calls.saves, [])
    assert.equal(subject.flow.error.value, '')
  }
})

test('inactive, unavailable profile context and existing writes block both permission actions', async () => {
  for (const mode of ['inactive', 'not-allowed', 'loading']) {
    const subject = notification_subject()
    await subject.show()
    if (mode === 'inactive') subject.hide()
    else if (mode === 'not-allowed') subject.setup.allowed.value = false
    else subject.setup.is_loading.value = true
    await subject.flow.allow(); await subject.flow.decline()
    assert.deepEqual(subject.calls.methods, ['getNotificationPermission'])
    assert.deepEqual(subject.calls.saves, [])
  }
})

const photo_subject = page => {
  const selected = deferred(), calls = { choose: 0, save: 0, back: [] }, hooks = { hide: [], unmount: [] }
  const store = { onboarding: { account_id: 'account-a', step: 'photos', completed: false }, onboarding_catalog: { steps: ['basic', 'photos'] }, current_photos: [], add_onboarding_photos: () => { calls.save++; return { success: true } } }
  const body = script(read(page))
  const instantiate = new Function('computed', 'onUnmounted', 'ref', 'onHide', 'onLoad', 'onShow', 'use_app_store', 'choose_camera_image', 'choose_images', 'open_app_settings', 'use_write_loading', 'auth_message', `${body}\nreturn { frame, choose, cancel, error, selecting, navigating }`)
  const flow = instantiate(computed, handler => hooks.unmount.push(handler), ref, handler => hooks.hide.push(handler), () => {}, () => {}, () => store, () => { calls.choose++; return selected.promise }, () => { calls.choose++; return selected.promise }, async () => {}, () => ({ is_loading: ref(false), run_with_loading: action => action({ is_current: () => true }), cancel_loading: () => {} }), message => message)
  flow.frame.value = { navigate_back: async fallback => { calls.back.push(fallback) } }
  return { flow, calls, selected, hide: () => hooks.hide.forEach(handler => handler()) }
}

for (const [page, prefix, fallback] of [
  ['src/pages/permissions/camera.vue', 'permCamera', '/pages/onboarding/photos'],
  ['src/pages/permissions/photos.vue', 'permPhotos', '/pages/onboarding/photos'],
]) {
  test(`${page} binds Continue to actual media selection and Cancel to a guarded return`, () => {
    const nodes = template_nodes(page)
    assert_action(nodes, `${prefix}.allowPhotos.click.1`, 'Continue', 'choose')
    assert_action(nodes, `${prefix}.denyPhotos.click.1`, 'Cancel', 'cancel')
  })
  test(`${page} Cancel performs one return with zero camera/library or persistence requests`, async () => {
    const subject = photo_subject(page)
    const first = subject.flow.cancel(), repeat = subject.flow.cancel()
    await Promise.all([first, repeat])
    assert.deepEqual(subject.calls, { choose: 0, save: 0, back: [fallback] })
    assert.equal(subject.flow.navigating.value, false)
  })
  test(`${page} Continue is touch-locked and a late picker result after hiding cannot write photos`, async () => {
    const subject = photo_subject(page), pending = subject.flow.choose()
    assert.equal(subject.flow.selecting.value, true)
    await subject.flow.choose(); await subject.flow.cancel()
    assert.deepEqual(subject.calls, { choose: 1, save: 0, back: [] })
    subject.hide(); subject.selected.resolve([]); await pending
    assert.deepEqual(subject.calls, { choose: 1, save: 0, back: [] })
    assert.equal(subject.flow.selecting.value, false)
  })
}
