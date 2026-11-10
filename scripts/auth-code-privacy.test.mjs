import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'
import { LOCAL_VERIFICATION_CODE } from '../src/config/local-auth.js'
import { valid_local_code } from '../src/utils/localVerification.js'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const collect = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? collect(`${directory}/${entry.name}`)
  : entry.name.endsWith('.vue') ? [`${directory}/${entry.name}`] : [])
const template = source => source.slice(source.indexOf('<template>'), source.lastIndexOf('</template>') + '</template>'.length)

test('all authentication pages keep the fixed code and its getter out of markup, labels, placeholders and handlers', () => {
  const pages = collect(fileURLToPath(new URL('../src/pages/auth', import.meta.url)))
  assert.ok(pages.length > 0)
  for (const file of pages) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /009789|\b(?:LOCAL_VERIFICATION_CODE|local_verification_code)\b/, file)
    assert.doesNotMatch(template(source), /show code again|your reset code is|code shown on the next screen|(?:verification|reset) code\s*:/i, file)
    assert.doesNotMatch(template(source), /(?:email|code|message) (?:has been |was |is )?sent|we(?:'ve| have) sent|check your (?:inbox|email)/i, file)
  }
})

test('verification and reset keep manual input/error/success controls but remove reveal and explanatory help UI', () => {
  const verification = read('src/pages/auth/verification/code.vue'), reset = read('src/pages/auth/reset/code.vue')
  assert.doesNotMatch(verification, /verification-code-hint|verification-info|Account confirmation and student verification are separate steps/)
  assert.doesNotMatch(reset, /fpCode\.resend\.click\.1|reset-resend|reset-code-notice|const resend\b|notice\.value|<FeedbackToast/)
  assert.doesNotMatch(template(reset), /class="auth-description"/)
  assert.match(verification, /aria-label="Six-digit account verification code"/)
  assert.match(verification, /data-interaction="verCode.goVerSuccess.click.1"/)
  assert.match(verification, /Enter a six-digit verification code\./)
  assert.match(verification, /store\.apply_verification\(value, account_id\)/)
  assert.match(reset, /aria-label="Reset code"[^>]*placeholder="6-digit code"[^>]*:maxlength="6"/)
  assert.match(reset, /data-interaction="fpCode.onCode.change.1"/)
  assert.match(reset, /data-interaction="fpCode.goFpNew.click.1"/)
  assert.match(reset, /store\.verify_password_reset_code\(code\.value, reset_id\.value\)/)
  for (const source of [verification, reset]) {
    assert.match(source, /AuthActionLoading[^>]*label="Checking code…"/)
    assert.match(source, /auth_message\(error\)/)
    assert.doesNotMatch(source, /\b(?:localStorage|indexedDB|setTimeout|setInterval)\b/)
  }
  const email = read('src/pages/auth/verification/email.vue')
  assert.match(email, /Use your university email to continue\./)
  assert.doesNotMatch(email, /code shown on the next screen/)
})

test('the internal verification primitive alone preserves exact string matching and leading zeroes', () => {
  assert.equal(LOCAL_VERIFICATION_CODE, '009789')
  assert.equal(valid_local_code('009789'), true)
  for (const value of [null, undefined, 9789, '9789', '000000', '111111', '0097890', ' 009789', '009789 ', '００９７８９', {}, ['009789']]) assert.equal(valid_local_code(value), false)
  assert.match(read('src/utils/localVerification.js'), /typeof value === 'string' && value === LOCAL_VERIFICATION_CODE/)
  const store = read('src/stores/store.js')
  assert.doesNotMatch(store, /\b(?:LOCAL_VERIFICATION_CODE|local_verification_code)\b/)
  assert.match(store, /apply_verification\(code, expected_account_id\)/)
  assert.match(store, /verify_password_reset_code\(code, expected_reset_id\)/)
})

function guestFixture() {
  const now = Date.UTC(2026, 9, 23, 1)
  let disk = create_seed(now), writes = 0
  disk.session = { account_id: null, current_user_id: null, expires_at: null }
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { persistence: { read: () => clone_data(disk), write: (_, value) => { writes++; disk = clone_data(value) } }, clock: () => now })
  assert.equal(store.hydrate().success, true)
  return { store, writes: () => writes }
}

test('a reset still requires manual exact input and cannot update credentials before successful code confirmation', async () => {
  const { store, writes } = guestFixture()
  assert.equal('local_verification_code' in store, false)
  const start = store.begin_password_reset('cimoa@connect.edu')
  assert.equal(start.success, true)
  const resetID = start.data.reset_id, before = clone_data(store.data), count = writes()
  for (const value of [undefined, 9789, '9789', '000000', '111111', ' 009789', '009789 ', '００９７８９']) {
    const result = store.verify_password_reset_code(value, resetID)
    assert.equal(result.success, false)
    assert.doesNotMatch(result.message, /009789/)
    assert.deepEqual(clone_data(store.data), before)
  }
  assert.equal((await store.finish_password_reset('PrivacyPass123', 'PrivacyPass123', resetID)).success, false)
  assert.equal(writes(), count)
  assert.deepEqual(clone_data(store.data), before)
  assert.equal(store.verify_password_reset_code('009789', 'another-reset').success, false)
  assert.deepEqual(clone_data(store.data), before)
  assert.equal(store.verify_password_reset_code('009789', resetID).success, true)
  assert.ok(Number.isFinite(store.data.auth_flow.password_reset.verified_at))
  assert.deepEqual(store.data.accounts, before.accounts)
  assert.deepEqual(store.data.users, before.users)
  assert.equal(store.session.is_authenticated, false)
  const verified = clone_data(store.data), verifiedWrites = writes()
  assert.equal((await store.finish_password_reset('PrivacyPass123', 'PrivacyPass123', resetID, { is_current: () => false })).reason, 'cancelled')
  assert.deepEqual(clone_data(store.data), verified)
  assert.equal(writes(), verifiedWrites)
  assert.equal((await store.finish_password_reset('PrivacyPass123', 'PrivacyPass123', resetID)).success, true)
  assert.equal(store.data.auth_flow.password_reset, null)
  assert.deepEqual(store.data.users, before.users)
  assert.deepEqual(store.data.coin_transactions, before.coin_transactions)
  assert.equal(store.session.is_authenticated, false)
  assert.equal((await store.login('cimoa@connect.edu', '12341234')).success, false)
  assert.equal((await store.login('cimoa@connect.edu', 'PrivacyPass123')).success, true)
})
