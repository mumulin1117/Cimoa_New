export function create_write_operation({ set_loading = () => {}, timers = globalThis } = {}) {
  let pending = null, generation = 0
  const cancel = () => {
    generation += 1
    if (pending) { timers.clearTimeout(pending.timer); pending.resolve({ success: false, reason: 'cancelled' }); pending = null }
    set_loading(false)
  }
  return {
    run(action, duration = 500) {
      if (pending) return Promise.resolve({ success: false, reason: 'busy' })
      const token = ++generation
      set_loading(true)
      return new Promise((resolve) => {
        pending = { resolve, timer: timers.setTimeout(async () => {
          let result
          try { result = await action() } catch (error) { result = { success: false, reason: 'operation_failed', message: error.message || 'Please retry.' } }
          if (token !== generation) return
          pending = null; set_loading(false); resolve(result)
        }, Math.max(400, Math.min(600, duration))) }
      })
    }, cancel,
  }
}
