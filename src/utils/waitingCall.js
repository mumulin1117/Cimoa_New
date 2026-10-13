// The only permitted call simulation: waiting, then one return. No connection state.
export function create_waiting_call({ on_dots, on_end, random = Math.random, timers = globalThis }) {
  let ended = false, dots = 0
  const interval = timers.setInterval(() => { dots = (dots + 1) % 4; on_dots('.'.repeat(dots)) }, 450)
  const end = (reason = 'manual') => {
    if (ended) return false
    ended = true; timers.clearInterval(interval); timers.clearTimeout(timeout); on_end(reason); return true
  }
  const timeout = timers.setTimeout(() => end('timeout'), 8000 + Math.min(1, Math.max(0, random())) * 4000)
  return { end, dispose() { if (!ended) { ended = true; timers.clearInterval(interval); timers.clearTimeout(timeout) } } }
}
