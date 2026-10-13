export function fake_clock(start = 0) {
  let now = start, next_id = 0
  const tasks = new Map()
  const schedule = (fn, delay, interval = 0) => { const id = ++next_id; tasks.set(id, { fn, at: now + delay, interval }); return id }
  return {
    now: () => now,
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: (id) => tasks.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, delay), clearInterval: (id) => tasks.delete(id),
    pending: () => tasks.size,
    async advance(ms) {
      const end = now + ms
      for (;;) {
        const first = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!first) break
        const [id, task] = first; now = task.at; tasks.delete(id)
        if (task.interval) tasks.set(id, { ...task, at: now + task.interval })
        task.fn(); await Promise.resolve(); await Promise.resolve()
      }
      now = end; await Promise.resolve()
    },
  }
}
