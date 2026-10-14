import test from 'node:test'
import assert from 'node:assert/strict'
import { notification_permission, open_app_settings, permission_statuses, request_media_permission } from '../src/utils/nativePermissions.js'
test('ordinary browser permission reads/request only real API results and reports unavailable', async () => {
  assert.equal(await notification_permission(false, {}), 'unavailable')
  const env = { isSecureContext: true, Notification: { permission: 'default', requestPermission: async () => 'denied' } }
  assert.equal(await notification_permission(false, env), 'not_requested')
  assert.equal(await notification_permission(true, env), 'denied')
  env.Notification.requestPermission = async () => 'granted'; assert.equal(await notification_permission(true, env), 'granted')
  env.Notification.requestPermission = async () => 'fake'; await assert.rejects(notification_permission(true, env), /unknown/)
  await assert.rejects(open_app_settings(), /unavailable in this browser/)
})
test('native permission uses correlated bridge whitelist and rejects unavailable host response', async () => {
  const methods = [], env = { window: { webkit: { messageHandlers: { CimoaHost: {} } }, CimoaNativeBridge: { request: async method => { methods.push(method); return { status: 'denied' } } } } }
  assert.equal(await notification_permission(false, env), 'denied'); assert.equal(await notification_permission(true, env), 'denied')
  assert.deepEqual(methods, ['getNotificationPermission', 'requestNotifications'])
  env.window.CimoaNativeBridge.request = async () => { throw Error('Host timeout') }; await assert.rejects(notification_permission(true, env), /timeout/)
})
test('permission overview reads all real native statuses and normalizes browser prompts', async () => {
  const native = { camera: 'granted', microphone: 'denied', photos: 'not_requested', notifications: 'unavailable', location: 'granted' }
  const env = { window: { webkit: { messageHandlers: { CimoaHost: {} } }, CimoaNativeBridge: { request: async method => { assert.equal(method, 'getPermissions'); return native } } } }
  assert.deepEqual(await permission_statuses(env), native)
  const browser = { navigator: { permissions: { query: async ({ name }) => ({ state: name === 'camera' ? 'granted' : name === 'microphone' ? 'denied' : 'prompt' }) } } }
  assert.deepEqual(await permission_statuses(browser), { camera: 'granted', microphone: 'denied', photos: 'not_requested', notifications: 'not_requested', location: 'not_requested' })
  env.window.CimoaNativeBridge.request = async () => ({ ...native, camera: 'pretend' })
  await assert.rejects(permission_statuses(env), /unknown/)
})
test('camera and microphone permission requests use real media tracks and always release them', async () => {
  const stopped = [], calls = []
  const env = { navigator: { mediaDevices: { getUserMedia: async constraints => { calls.push(constraints); return { getTracks: () => [{ stop: () => stopped.push(constraints) }] } } } } }
  assert.equal(await request_media_permission('camera', env), 'granted')
  assert.equal(await request_media_permission('microphone', env), 'granted')
  assert.deepEqual(calls, [{ video: true }, { audio: true }])
  assert.equal(stopped.length, 2)
  env.navigator.mediaDevices.getUserMedia = async () => { const error = new Error('Permission denied'); error.name = 'NotAllowedError'; throw error }
  await assert.rejects(request_media_permission('camera', env), /denied/i)
  await assert.rejects(request_media_permission('location', env), /unsupported/i)
})
