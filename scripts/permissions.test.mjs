import test from 'node:test'
import assert from 'node:assert/strict'
import { notification_permission, open_app_settings } from '../src/utils/nativePermissions.js'
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
