import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

function fixture(result) {
  const feedback = [], store = { profile_editor: { account_id: 'a' } }, calls = { back: 0 }
  const args = {
    computed: getter => ({ get value() { return getter() } }), ref: value => ({ value }), watch() {}, onHide() {},
    use_app_store: () => store,
    use_write_loading: () => ({ is_loading: { value: false }, cancel_loading() {}, run_with_loading: async action => action({}) }),
    use_account_scope: () => ({ access_error: { value: '' }, auth_context: 'session_a' }),
    relaunch_route: async () => true, startup_destination: () => '/pages/auth/welcome', require_profile_destination_ready: value => value,
    FEEDBACK: { profile_updated: 'Profile updated' }, show_toast: message => feedback.push(message), auth_message: message => message,
  }
  const source = fs.readFileSync(new URL('../src/composables/useProfileEditor.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace('export function', 'function')
  const create = new Function(...Object.keys(args), source + '\nreturn use_profile_editor')(...Object.values(args))
  const editor = create({ value: { navigate_back: async () => { calls.back++; if (result instanceof Error) throw result; return result } } })
  return { editor, feedback, calls }
}

test('cancelled Profile Pop does not become a successful return or emit a late success Toast', async () => {
  const f = fixture(false)
  assert.equal(await f.editor.back(), false)
  assert.equal(await f.editor.submit(() => ({ success: true })), true, 'a completed write is not rolled back by presentation cancellation')
  assert.deepEqual(f.feedback, [])
})
test('actual Profile return emits its existing result feedback once and failures release the guard', async () => {
  const completed = fixture(true)
  assert.equal(await completed.editor.submit(() => ({ success: true })), true)
  assert.deepEqual(completed.feedback, ['Profile updated'])
  const failed = fixture(Error('Route unavailable'))
  assert.equal(await failed.editor.back(), false)
  assert.equal(await failed.editor.back(), false)
  assert.equal(failed.calls.back, 2, 'a failed return releases its navigation guard for retry')
  assert.equal(failed.editor.error.value, 'Route unavailable')
})
