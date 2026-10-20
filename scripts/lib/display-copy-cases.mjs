import assert from 'node:assert/strict'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../../src/stores/store.js'
import { create_scenario } from '../../src/stores/scenarios.js'
import { clone_data } from '../../src/stores/seed.js'
import { APP_CONSENT_REVISION } from '../../src/utils/appConsent.js'

export async function display_copy_fixtures() {
  const now = Date.now(), data = create_scenario('default', now)
  data.app_consent = { revision: APP_CONSENT_REVISION, accepted_at: now }
  const guest = clone_data(data); guest.session = { account_id: null, current_user_id: null, expires_at: null }
  const make = snapshot => {
    const store = use_app_store(createPinia()); configure_store_runtime(store, { persistence: { read: () => clone_data(snapshot), write() {} }, clock: () => Date.now() }); assert.ok(store.hydrate().success); return store
  }
  const auth = make(guest), created = await auth.register_local_account({ email: 'display.check@campus.edu', password: 'campus1234', confirmation: 'campus1234', date_of_birth: '2000-01-01', agreements: { terms: true, privacy: true, community: true } })
  assert.ok(created.success); const pending = clone_data(auth.data); assert.ok(auth.apply_verification('009789', created.data.account_id).success); const verified = clone_data(auth.data)
  const reset_store = make(guest), reset = reset_store.begin_password_reset('cimoa@gmail.com'); assert.ok(reset.success); const reset_pending = clone_data(reset_store.data); assert.ok(reset_store.verify_password_reset_code('009789', reset.data.reset_id).success); const reset_verified = clone_data(reset_store.data)
  const reports_store = make(data), saved = reports_store.submit_report({ target_type: 'user', target_id: 'user_lina', reason: 'Harassment', description: 'Repeated unwanted contact.' }); assert.ok(saved.success)
  const deletion_store = make(data); assert.ok((await deletion_store.delete_account('12341234', 'Privacy concerns')).success)
  const fixtures = { data, guest, pending, verified, reset_pending, reset_verified, reports: clone_data(reports_store.data), deleted: clone_data(deletion_store.data) }
  const cases = [
    ['welcome', 'guest', '/pages/auth/welcome', '.welcome-page', 'Create Account'],
    ['login', 'guest', '/pages/auth/login', '.login-page', 'Keep your account details private'],
    ['signup', 'guest', '/pages/auth/signup', '.signup-page', 'Your university email is used for account access'],
    ['community', 'guest', '/pages/auth/community', '.community-page', 'Community'],
    ['verification-email', 'pending', '/pages/auth/verification/email', '.verification-email-page', 'Confirm your account using the code'],
    ['verification-code', 'pending', '/pages/auth/verification/code', '.verification-page', 'Code: 009789'],
    ['verification-success', 'verified', '/pages/auth/verification/success', '.verification-success-page', 'Account code confirmed'],
    ['reset-email', 'guest', '/pages/auth/reset/email', '.reset-email-page', 'Enter the email address associated with your account'],
    ['reset-code', 'reset_pending', `/pages/auth/reset/code?reset_id=${reset.data.reset_id}`, '.reset-code-page', 'Reset code: 009789'],
    ['reset-new', 'reset_verified', `/pages/auth/reset/new?reset_id=${reset.data.reset_id}`, '.reset-new-page', 'New password'],
    ['settings', 'data', '/pages/settings/index', '.settings-page', 'Account'],
    ['privacy-settings', 'data', '/pages/settings/privacy', '.settings-privacy-page', 'Visible in Discover'],
    ['language', 'data', '/pages/settings/lang', '.settings-language-page', 'English is currently available'],
    ['legal-menu', 'data', '/pages/settings/legal', '.settings-legal-page', 'Read the Terms of Use'],
    ['terms', 'guest', '/pages/legal/terms', '.legal-terms-page', 'These terms explain how to use Cimoa'],
    ['privacy', 'guest', '/pages/legal/privacy', '.legal-privacy-page', 'Saving an entry does not transmit it to a moderation or support team'],
    ['profile-edit', 'data', '/pages/profile/edit', '.profile-edit-page', 'Student verification'],
    ['profile-verification', 'data', '/pages/profile/verification', '.profile-verification-page', 'Account code confirmation does not verify university enrollment'],
    ['reverify', 'data', '/pages/profile/reverify', '.profile-reverify-page', 'University verification is currently unavailable'],
    ['report-user', 'data', '/pages/safety/report-user?target_user_id=user_lina', '.safety-report-user-page', 'Submit report'],
    ['report-event', 'data', '/pages/events/report?event_id=event_picnic', '.event-report-page', 'Submit report'],
    ['reports', 'reports', '/pages/safety/reports', '.safety-reports-page', 'Saved'],
    ['report-detail', 'reports', `/pages/safety/report-detail?report_id=${saved.data}`, '.safety-report-detail-page', 'A saved report does not indicate a moderation decision'],
    ['support', 'data', '/pages/settings/support', '.settings-support-page', 'How can I contact support?'],
    ['coin-help', 'data', '/pages/coins/help', '.coin-help-page', 'Coins and purchases'],
    ['coins', 'data', '/pages/coins/index', '.coin-center-page', 'Purchases are currently unavailable'],
    ['delete-info', 'data', '/pages/settings/delete/info', '.delete-info-page', 'Deleting your account removes its saved private records'],
    ['delete-final', 'data', '/pages/settings/delete/final', '.delete-final-page', 'This removes your account and its saved private records'],
    ['delete-success', 'deleted', '/pages/settings/delete/success', '.delete-success-page', 'Your account was deleted'],
  ].map(([name, fixture, route, selector, text]) => ({ name, fixture, route, selector, text }))
  return { fixtures, cases }
}
