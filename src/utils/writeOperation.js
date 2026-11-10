import { auth_message } from './authFeedback.js'

export function create_write_operation({ set_loading = () => {}, timers = globalThis, is_active = () => true } = {}) {
  let pending = null, generation = 0
  const cancelled = () => ({ success: false, reason: 'cancelled' })
  const current = task => pending === task && task.token === generation && is_active()
  const cancel = () => {
    generation += 1
    const task = pending
    pending = null
    if (task) { timers.clearTimeout(task.timer); task.resolve(cancelled()) }
    set_loading(false)
  }
  return {
    run(action, duration = 500) {
      if (pending) return Promise.resolve({ success: false, reason: 'busy' })
      if (!is_active()) return Promise.resolve(cancelled())
      let resolve
      const promise = new Promise(finish => { resolve = finish })
      const task = { token: ++generation, resolve, timer: null, started: false }
      // Reserve the operation before notifying synchronous Loading watchers.
      // A rapid second tap (or a watcher) must never reserve a second write.
      pending = task
      set_loading(true)
      if (!current(task)) { if (pending === task) cancel(); return promise }
      const requested_duration = Number.isFinite(duration) ? duration : 500
      task.timer = timers.setTimeout(async () => {
        // clearTimeout cannot retract a callback already queued by WebKit.
        if (!current(task) || task.started) { if (pending === task && !is_active()) cancel(); return }
        task.started = true
        task.timer = null
        let result
        try { result = await action({ is_current: () => current(task) }) }
        catch (error) { result = { success: false, reason: 'operation_failed', message: auth_message(error?.message, 'This action couldn’t be completed. Please try again.') } }
        // Cancellation ends the caller's Promise immediately, but never tries
        // to undo an atomic Store commit or cancel an accepted Apple payment.
        if (!current(task)) { if (pending === task) cancel(); return }
        pending = null
        set_loading(false)
        resolve(result)
      }, Math.max(400, Math.min(600, requested_duration)))
      return promise
    }, cancel,
  }
}
