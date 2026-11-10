import { NAVIGATION } from '../config/navigation.js'

const key_for = input => {
  if (!input || !['select', 'text', 'voice'].includes(input.target_kind)) return null
  const { auth_context, user_id, target_kind } = input
  const question_id = target_kind === 'select' ? '' : input.question_id
  if (![auth_context, user_id].every(value => typeof value === 'string' && value.trim()) || typeof question_id !== 'string' || (target_kind !== 'select' && !question_id.trim())) return null
  return JSON.stringify([auth_context, user_id, question_id, target_kind])
}

// This receipt joins presentation only. It never stores a profile, answer,
// draft, request, relationship, or a second version of business state.
export function create_icebreaker_motion_receipt({ now = Date.now, max_age_ms = NAVIGATION.callback_timeout_ms } = {}) {
  let pending = null, generation = 0
  const clear = token => {
    if (token == null || pending?.token === token) pending = null
  }
  const arm = input => {
    const key = key_for(input)
    if (!key) { pending = null; return null }
    const token = ++generation
    pending = { token, key, started_at: now() }
    return token
  }
  const consume = input => {
    const receipt = pending
    pending = null
    if (!receipt || key_for(input) !== receipt.key) return false
    const age = now() - receipt.started_at
    return Number.isFinite(age) && age >= 0 && age <= max_age_ms
  }
  return { arm, consume, clear }
}

const presentation = create_icebreaker_motion_receipt()
export const arm_icebreaker_motion = presentation.arm
export const consume_icebreaker_motion = presentation.consume
export const clear_icebreaker_motion = presentation.clear
