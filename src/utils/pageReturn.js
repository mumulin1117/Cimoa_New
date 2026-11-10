// A return delay is presentation, not permission to pop a hidden page later.
export function create_page_return({ navigate, duration, on_state = () => {}, schedule = setTimeout, clear = clearTimeout } = {}) {
  let pending = null, disposed = false
  const finish = (task, error, result) => {
    if (pending !== task) return
    clear(task.timer); pending = null; on_state(false)
    if (error) task.reject(error)
    else task.resolve(result)
  }
  const cancel = () => {
    if (pending && !pending.dispatched) finish(pending, null, false)
  }
  const run = (delta = 1) => {
    if (disposed) return Promise.resolve(false)
    if (pending) return pending.delta === delta ? pending.promise : Promise.resolve(false)
    const task = { delta, dispatched: false, timer: null }
    task.promise = new Promise((resolve, reject) => { task.resolve = resolve; task.reject = reject })
    pending = task; on_state(true)
    task.timer = schedule(async () => {
      if (pending !== task || disposed) return
      task.dispatched = true
      try { finish(task, null, await navigate(delta)) } catch (error) { finish(task, error) }
    }, duration)
    return task.promise
  }
  return { run, cancel, dispose: () => { cancel(); disposed = true }, state: () => ({ pending: !!pending, dispatched: !!pending?.dispatched }) }
}
