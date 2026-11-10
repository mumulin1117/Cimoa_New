import test from 'node:test'
import assert from 'node:assert/strict'
import { chat_near_bottom } from '../src/utils/chatScroll.js'

test('chat proximity uses the actual scroll viewport and includes its threshold boundary', () => {
  const metrics = { scrollTop: 536, scrollHeight: 1200, height: 600 }
  assert.equal(chat_near_bottom(metrics, 64), true)
  assert.equal(chat_near_bottom({ ...metrics, scrollTop: 535.5 }, 64), false)
  assert.equal(chat_near_bottom({ ...metrics, scrollTop: 600 }, 64), true)
  assert.equal(chat_near_bottom({ ...metrics, height: 300 }, 64), false)
})

test('short content and bounce overscroll do not manufacture a distance to the bottom', () => {
  assert.equal(chat_near_bottom({ scrollTop: 0, scrollHeight: 300, height: 600 }, 64), true)
  assert.equal(chat_near_bottom({ scrollTop: -50, scrollHeight: 650, height: 600 }, 64), true)
  assert.equal(chat_near_bottom({ scrollTop: -50, scrollHeight: 700, height: 600 }, 64), false)
  assert.equal(chat_near_bottom({ scrollTop: 700, scrollHeight: 1200, height: 600 }, 64), true)
})

test('missing or invalid layout measurements preserve the caller reading decision', () => {
  for (const metrics of [null, undefined, {}, { scrollTop: 0, scrollHeight: 100 }, { scrollTop: '0', scrollHeight: 100, height: 50 }, { scrollTop: NaN, scrollHeight: 100, height: 50 }, { scrollTop: 0, scrollHeight: Infinity, height: 50 }, { scrollTop: 0, scrollHeight: 100, height: 0 }, { scrollTop: 0, scrollHeight: 100, height: -1 }]) {
    assert.equal(chat_near_bottom(metrics, 64), null)
  }
})
