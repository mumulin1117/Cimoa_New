import { authenticated, owner_id, user_by_id, privacy_for, relationship_state, introduction_blocker, ensure } from './selectors.js'
import { auth_context_key } from './accountDefaults.js'
import { transact, failure } from './transactions.js'

export const DISCOVER_GUIDE_REVISION = 1

function target_available(data, target_user_id, now) {
  const user = user_by_id(data, target_user_id)
  return !!(user?.discoverable && Number.isInteger(user.discover_order) && privacy_for(data, target_user_id).discover_visible !== false && !introduction_blocker(data, target_user_id, now) && relationship_state(data, target_user_id, now).status === 'none' && user.icebreaker_ids.some(id => data.icebreakers.some(row => row.question_id === id && row.user_id === target_user_id)))
}

// Progress is a presentation session, not a second deck, draft or relationship.
// The optional account receipt is the only persisted part of the walkthrough.
export function discover_guide_context(data, now, hydration_status, session, current_target_user_id = '') {
  const owner = owner_id(data), user = user_by_id(data, owner)
  const account = data.accounts.find(row => row.account_id === data.session.account_id)
  const settings = data.settings.find(row => row.owner_user_id === owner)
  const receipt = settings?.discover_guide || null
  const account_ready = account?.auth_provider !== 'local' || account.local_verification?.status === 'verified'
  const profile_ready = user?.onboarding_status === 'complete' || account?.auth_provider === 'fixture' && user?.onboarding_status === undefined
  const eligible = hydration_status === 'ready' && authenticated(data, now) && account_ready && !!user && profile_ready && !!settings && !receipt
  const presented = session?.auth_context === auth_context_key(data) && Number.isInteger(session.step) && session.step >= 0 && session.step <= 6 && typeof session.target_user_id === 'string' && session.target_user_id ? session : null
  const target_user_id = presented?.target_user_id || current_target_user_id || ''
  const available = eligible && target_available(data, target_user_id, now)
  const current = available ? presented : null
  return { eligible, receipt, started: !!current, step: current?.step ?? 0, target_user_id, target_available: available }
}

export const discover_guide_actions = {
  begin_discover_guide(target_user_id, expected_context) {
    const guide = this.discover_guide, current = this.discover_people[this.discover_card_index]
    if (expected_context !== this.auth_context || !guide.eligible || !guide.target_available || !current || current.user_id !== target_user_id || guide.started && guide.target_user_id !== target_user_id) return failure('guide_unavailable', 'This guide is unavailable right now.')
    if (!guide.started) this.discover_guide_session = { auth_context: expected_context, step: 0, target_user_id }
    return { success: true }
  },
  move_discover_guide(step, expected_context) {
    const guide = this.discover_guide
    if (expected_context !== this.auth_context || !guide.started || !Number.isInteger(step) || step < 0 || step > 6 || Math.abs(step - guide.step) > 1) return failure('guide_unavailable', 'Please reopen the guide and try again.')
    this.discover_guide_session = { ...this.discover_guide_session, step }
    return { success: true }
  },
  finish_discover_guide(outcome, expected_context, scope = {}) {
    if (expected_context !== this.auth_context || !['completed', 'skipped'].includes(outcome)) return failure('guide_unavailable', 'Your session changed. Please reopen this page.')
    if (this.discover_guide.receipt) return { success: true, repeated: true }
    if (!this.discover_guide.started || outcome === 'completed' && this.discover_guide.step !== 6) return failure('guide_incomplete', 'Continue through the guide, or choose Skip.')
    const result = transact(this, null, (data, now) => {
      ensure(discover_guide_context(data, now, 'ready', this.discover_guide_session).started, 'Please reopen the guide and try again.')
      data.settings.find(row => row.owner_user_id === owner_id(data)).discover_guide = { revision: DISCOVER_GUIDE_REVISION, outcome, completed_at: now }
    }, { expected_context, is_current: scope.is_current })
    if (result.success) this.discover_guide_session = null
    return result.success ? result : failure('guide_update_failed', 'Couldn’t finish the guide. Please try again.')
  },
  cancel_discover_guide(expected_context) {
    if (expected_context !== undefined && expected_context !== this.auth_context) return false
    this.discover_guide_session = null
    return true
  },
}
