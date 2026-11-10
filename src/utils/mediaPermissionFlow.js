import { auth_message } from './authFeedback.js'

// Transient permission-page state only. System authorization remains owned by
// the media adapter; navigating never grants or persists a permission itself.
export function create_media_permission_flow({ state, kind, context, read, request, navigate, open_settings }) {
  let active = false, generation = 0, sequence = 0, opening_settings = false
  const ticket = () => ({ generation, sequence: ++sequence, context: context() })
  const current = token => active && token.generation === generation && token.sequence === sequence && token.context === context()
  const message = cause => auth_message(cause?.message, 'This action couldn’t be completed. Please try again.')
  const reset_locks = () => { state.requesting = false; state.navigating = false; opening_settings = false }
  const hide = () => { active = false; generation++; sequence++; reset_locks() }
  const show = async () => {
    active = true; generation++; reset_locks()
    state.status = 'checking'; state.error = ''
    const token = ticket()
    try {
      const rows = await read()
      if (current(token)) state.status = rows[kind()]
    } catch (cause) {
      if (current(token)) { state.status = 'unavailable'; state.error = message(cause) }
    }
  }
  const return_once = async token => {
    if (!current(token) || state.navigating) return false
    state.navigating = true
    try {
      await navigate()
      if (current(token)) hide()
      return true
    } catch (cause) {
      if (current(token)) state.error = message(cause)
      return false
    } finally { if (current(token)) state.navigating = false }
  }
  const back = async () => {
    if (!active || state.requesting || state.navigating || opening_settings) return false
    return return_once(ticket())
  }
  const allow = async () => {
    if (!active || state.requesting || state.navigating || opening_settings) return false
    state.requesting = true; state.error = ''
    const token = ticket()
    try {
      const status = await request(kind())
      if (!current(token)) return false
      if (!['granted', 'denied', 'not_requested', 'unavailable'].includes(status)) throw new Error('System permission could not be confirmed. Please try again.')
      state.status = status
      if (status !== 'granted') {
        state.error = status === 'denied' ? 'Access is off. Open Settings to change it, or return to the previous page.' : 'Access was not granted. Please try again or return to the previous page.'
        return false
      }
      // End the permission operation before taking the navigation lock. The
      // public Back action stays guarded throughout, so it cannot double-pop.
      state.requesting = false
      return await return_once(token)
    } catch (cause) {
      if (current(token)) { state.status = /denied/i.test(cause?.message) ? 'denied' : 'unavailable'; state.error = message(cause) }
      return false
    } finally { if (current(token)) state.requesting = false }
  }
  const settings = async () => {
    if (!active || state.requesting || state.navigating || opening_settings) return false
    opening_settings = true; state.error = ''
    const token = ticket()
    try { await open_settings(); return current(token) }
    catch (cause) { if (current(token)) state.error = message(cause); return false }
    finally { if (current(token)) opening_settings = false }
  }
  return { show, hide, back, allow, settings, context_changed: () => active ? show() : hide() }
}
