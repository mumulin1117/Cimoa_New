import test from 'node:test'
import assert from 'node:assert/strict'
import { create_host_bridge } from '../src/utils/hostBridge.js'
test('native bridge validates version, request correlation and method whitelist', async () => {
  const bridge = create_host_bridge({ send: p => Promise.resolve({ ...p, success: true, result: { platform: 'ios' } }) })
  assert.deepEqual(await bridge.request('getEnvironment'), { platform: 'ios' })
  await assert.rejects(bridge.request('executeAnything'), /Unsupported/)
  const bad = create_host_bridge({ send: p => Promise.resolve({ ...p, request_id: 'wrong', success: true, result: {} }) })
  await assert.rejects(bad.request('getSafeArea'), /Invalid/)
})
test('absent host, real rejection and full timeout never fabricate a result', async () => {
  await assert.rejects(create_host_bridge({ send: () => undefined }).request('getEnvironment'), /unavailable/)
  await assert.rejects(create_host_bridge({ send: () => Promise.reject(Error('Native denied')) }).request('getEnvironment'), /Native denied/)
  let callback, duration
  const pending = create_host_bridge({ send: () => new Promise(() => {}), timers: { setTimeout(fn, ms) { callback=fn; duration=ms; return 1 }, clearTimeout() {} } }).request('getEnvironment')
  assert.equal(duration, 8000); callback(); await assert.rejects(pending, /did not respond/)
})
