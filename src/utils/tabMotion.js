import { MAIN_TABS, MOTION, route_path } from '../config/navigation.js'

const tab_index = route => MAIN_TABS.findIndex(tab => tab.path === route_path(route))
const ease = value => 1 - (1 - value) ** 3

// One process-lifetime presentation timeline, shared by the source and the
// replacement page. It never selects a route or touches a business entity.
export function create_tab_motion_controller({ now = Date.now, duration = MOTION.tab_slide, icon_duration = MOTION.tab_icon } = {}) {
  let plan = null, pending = null, revision = 0
  const listeners = new Set()
  const publish = () => {
    for (const listener of [...listeners]) {
      try { listener() } catch { /* Presentation must not strand navigation. */ }
    }
  }
  const sample = (route, { reduced = false } = {}) => {
    const actual = Math.max(0, tab_index(route))
    const relevant = plan && [plan.from, plan.to].includes(route_path(route))
    if (!relevant || reduced) return { position: actual, moving: false, busy: !!pending, target: null, icon_scale: 1, revision }
    const progress = Math.max(0, Math.min(1, (now() - plan.started_at) / duration))
    const icon_progress = Math.max(0, Math.min(1, (now() - plan.started_at) / icon_duration))
    return {
      position: plan.from_index + (plan.to_index - plan.from_index) * ease(progress),
      moving: progress < 1 || icon_progress < 1, busy: !!pending, target: plan.to,
      icon_scale: 1 + Math.sin(icon_progress * Math.PI) * 0.055,
      revision: plan.revision,
    }
  }
  const clear = () => { revision++; plan = null; pending = null; publish() }
  const run = (from, to, navigate) => {
    from = route_path(from); to = route_path(to)
    if (from === to) return Promise.resolve({ unchanged: true })
    if (pending) return pending.to === to ? pending.promise : Promise.reject(new Error('Navigation is already in progress.'))
    const actual_from_index = tab_index(from), to_index = tab_index(to)
    if (actual_from_index < 0 || to_index < 0) return Promise.resolve().then(navigate)
    // A completed route can be followed by another intentional touch before
    // its light has landed. Continue from the rendered position, not its slot.
    const from_index = sample(from).position
    const token = ++revision
    let resolve, reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    const task = { to, revision: token, promise }
    pending = task
    plan = { from, to, from_index, to_index, started_at: now(), revision: token }
    publish()
    const finish = (failed, value) => {
      if (pending === task) {
        pending = null
        if (failed) plan = null
        publish()
      }
      if (failed) reject(value)
      else resolve(value)
    }
    try { Promise.resolve(navigate()).then(value => finish(false, value), error => finish(true, error)) } catch (error) { finish(true, error) }
    return promise
  }
  return { run, sample, clear, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) } }
}

const tab_motion = create_tab_motion_controller()
export const run_tab_motion = (from, to, navigate) => tab_motion.run(from, to, navigate)
export const sample_tab_motion = (route, options) => tab_motion.sample(route, options)
export const subscribe_tab_motion = listener => tab_motion.subscribe(listener)
export const clear_tab_motion = () => tab_motion.clear()
