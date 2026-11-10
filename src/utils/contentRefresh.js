// Cancellation settles callers and prevents a delayed read from running after navigation.
export function create_content_refresh({ read, delay, schedule = setTimeout, clear = clearTimeout }) {
  let pending = null
  const cancel = () => {
    if (!pending) return
    clear(pending.timer)
    pending.resolve({ success: false, reason: 'cancelled' }); pending = null
  }
  const start = () => {
    if (pending) return pending.promise
    const task = {}
    task.promise = new Promise(resolve => { task.resolve = resolve })
    pending = task
    task.timer = schedule(async () => {
      if (pending !== task) return
      let result
      try { result = await read() } catch { result = { success: false, message: 'Couldn’t refresh your connections. Please try again.' } }
      if (pending !== task) return
      pending = null; task.resolve(result)
    }, delay)
    return task.promise
  }
  return { start, cancel }
}
