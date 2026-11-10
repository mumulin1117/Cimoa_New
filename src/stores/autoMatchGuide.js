import { authenticated, owner_id, user_by_id, ensure } from './selectors.js'
import { auth_context_key } from './accountDefaults.js'
import { transact, failure } from './transactions.js'

export const AUTO_MATCH_GUIDE_REVISION = 1
export function auto_match_guide_context(data, now, hydration_status, session) {
  const owner = owner_id(data), user = user_by_id(data, owner)
  const settings = data.settings.find(row => row.owner_user_id === owner)
  const account = data.accounts.find(row => row.account_id === data.session.account_id)
  const receipt = settings?.auto_match_guide || null
  const account_ready = account?.auth_provider !== 'local' || account.local_verification?.status === 'verified'
  // Prepared fixture profiles already enter Home without registration setup.
  // Do not invent a completed status or relax a local account's setup checks.
  const profile_ready = user?.onboarding_status === 'complete' || account?.auth_provider === 'fixture' && user?.onboarding_status === undefined
  // Completion belongs to this installation's account preference, not to its
  // social history. A fresh install can contain existing matching entities.
  const presented = session?.auth_context === auth_context_key(data) && Array.isArray(session.matching_ids) ? session : null
  const matching_started = presented && data.match_sessions.some(row => row.owner_user_id === owner && !presented.matching_ids.includes(row.match_id))
  const eligible = hydration_status === 'ready' && authenticated(data, now) && account_ready && !!user && profile_ready && !!settings && !receipt && !matching_started
  const current = eligible ? presented : null
  return { eligible, receipt, step: current?.step ?? 0, started: !!current }
}

export const auto_match_guide_actions = {
  begin_auto_match_guide(expected_context) {
    if (expected_context !== this.auth_context || !this.auto_match_guide.eligible) return failure('guide_unavailable', 'This guide is unavailable right now.')
    if (!this.auto_match_guide.started) this.auto_match_guide_session = { auth_context: expected_context, step: 0, matching_ids: this.data.match_sessions.filter(row => row.owner_user_id === owner_id(this.data)).map(row => row.match_id) }
    return { success: true }
  },
  move_auto_match_guide(step, expected_context) {
    if (expected_context !== this.auth_context || !this.auto_match_guide.started || !Number.isInteger(step) || step < 0 || step > 3 || Math.abs(step - this.auto_match_guide.step) > 1) return failure('guide_unavailable', 'Please reopen the guide and try again.')
    this.auto_match_guide_session = { ...this.auto_match_guide_session, step }
    return { success: true }
  },
  finish_auto_match_guide(outcome, expected_context, scope = {}) {
    if (expected_context !== this.auth_context || !['completed', 'skipped'].includes(outcome)) return failure('guide_unavailable', 'Your session changed. Please reopen this page.')
    if (this.auto_match_guide.receipt) return { success: true, repeated: true }
    if (!this.auto_match_guide.started || outcome === 'completed' && this.auto_match_guide.step !== 3) return failure('guide_incomplete', 'Continue through the guide, or choose Skip.')
    const result = transact(this, null, (data, now) => {
      ensure(auto_match_guide_context(data, now, 'ready', this.auto_match_guide_session).started, 'Please reopen the guide and try again.')
      data.settings.find(row => row.owner_user_id === owner_id(data)).auto_match_guide = { revision: AUTO_MATCH_GUIDE_REVISION, outcome, completed_at: now }
    }, { expected_context, is_current: scope.is_current })
    if (result.success) this.auto_match_guide_session = null
    return result.success ? result : failure('guide_update_failed', 'Couldn’t finish the guide. Please try again.')
  },
}
