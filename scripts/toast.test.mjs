import test from 'node:test'
import assert from 'node:assert/strict'
import { create_toast_controller, toast_message, FEEDBACK } from '../src/utils/toast.js'

function fixture() {
  let next = 0
  const pending = new Map(), cancelled = [], messages = []
  const toast = create_toast_controller({ schedule(fn, delay) { const id = ++next; pending.set(id, { fn, delay }); return id }, cancel(id) { cancelled.push(id); pending.delete(id) } })
  const stop = toast.subscribe(value => messages.push(value))
  return { toast, pending, cancelled, messages, stop }
}
test('success, info and failure copy remain accurate and contain no implementation terms', () => {
  for (const value of Object.values(FEEDBACK)) assert.doesNotMatch(toast_message(value), /\b(?:local|saved|record|demo)\b/i)
  assert.equal(toast_message('Saved data is unavailable. Please retry.'), 'Your data is unavailable. Please retry.')
  assert.equal(toast_message('Local storage is full.', 'error'), 'Your device doesn’t have enough space. Free up some space and try again.')
  assert.equal(toast_message('Your daily matching quota has been reached.', 'error'), 'Your daily matching quota has been reached.')
  assert.equal(toast_message('This introduction draft is unavailable. No coins were deducted.', 'error'), 'This introduction is unavailable. No coins were deducted.')
  assert.equal(toast_message('Your support draft is unavailable. Your message has not been sent.', 'error'), 'Your support message is unavailable. Your message has not been sent.')
  assert.equal(toast_message('Record a voice message before continuing.', 'warning'), 'Record a voice message before continuing.')
  assert.equal(toast_message('This introduction could not be saved.', 'error'), FEEDBACK.introduction_failed)
  assert.equal(toast_message('Microphone permission was denied.', 'error'), 'Microphone permission was denied.')
  assert.equal(toast_message('Purchases are currently unavailable.', 'error'), 'Purchases are currently unavailable.')
  assert.equal(toast_message('Support delivery is currently unavailable. Your message has not been sent.', 'warning'), 'Support delivery is currently unavailable. Your message has not been sent.')
  assert.equal(toast_message('unsafe local debug mode', 'error'), 'This action couldn’t be completed. Please try again.')
  assert.equal(toast_message('unsafe saved result'), 'Please check the latest details.')
})
test('one notification, correct status and default auto-dismiss with no business persistence', () => {
  const f = fixture(), reasons = []
  const id = f.toast.show(FEEDBACK.profile_updated, { tone: 'success', on_dismiss: reason => reasons.push(reason) })
  assert.equal(f.toast.current.id, id); assert.equal(f.toast.current.tone, 'success')
  assert.equal([...f.pending.values()][0].delay, 3500)
  ;[...f.pending.values()][0].fn()
  assert.equal(f.toast.current, null); assert.equal(f.pending.size, 0); assert.deepEqual(reasons, ['timeout'])
  assert.equal(f.messages.length, 3)
})
test('latest notification replaces previous; an old callback/close cannot dismiss it', () => {
  const f = fixture(), reasons = []
  const first = f.toast.show('First', { on_dismiss: reason => reasons.push(reason) })
  const oldTimer = [...f.pending.values()][0].fn
  const next = f.toast.show('Next', { tone: 'error' })
  assert.equal(f.pending.size, 1); assert.equal(f.toast.current.id, next); assert.equal([...f.pending.values()][0].delay, 5000)
  oldTimer(); assert.equal(f.toast.current.id, next)
  assert.equal(f.toast.dismiss(first), false); assert.equal(f.toast.current.message, 'Next')
  assert.deepEqual(reasons, ['replaced'])
  assert.equal(f.toast.dismiss(next), true); assert.equal(f.toast.current, null)
})
test('manual close, background/route cleanup and unsubscribe leave no scheduled work', () => {
  const f = fixture(), reasons = []
  f.toast.show('Message', { on_dismiss: reason => reasons.push(reason) }); f.toast.dismiss()
  f.toast.show('Next', { duration: 1 }); assert.equal([...f.pending.values()][0].delay, 2000)
  f.toast.clear(); assert.equal(f.pending.size, 0); assert.equal(f.toast.current, null)
  assert.deepEqual(reasons, ['close'])
  f.stop(); const count = f.messages.length
  f.toast.show('Later', { duration: 60000 }); assert.equal([...f.pending.values()][0].delay, 10000)
  f.toast.clear(); assert.equal(f.messages.length, count)
  assert.equal(f.toast.show('  '), null); assert.equal(f.pending.size, 0)
})
