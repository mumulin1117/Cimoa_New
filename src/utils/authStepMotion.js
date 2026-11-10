import { MOTION } from '../config/navigation.js'

const percentage = value => Number.isFinite(value) && value >= 0 && value <= 100

// Presentation only. A page must actually become visible before it can supply
// the next origin; attempted navigation cannot advance registration progress.
export function create_auth_step_motion({ now = Date.now, duration = MOTION.page } = {}) {
  let previous = null, revision = 0
  const sample = () => {
    if (!previous) return null
    const elapsed = Math.max(0, Math.min(1, (now() - previous.started_at) / duration))
    return previous.from + (previous.to - previous.from) * elapsed
  }
  const clear = () => { previous = null; revision++ }
  const present = ({ context, step, index, progress, reduced = false, allowed = true } = {}) => {
    const valid = allowed && typeof context === 'string' && !!context && typeof step === 'string' && !!step && Number.isInteger(index) && index >= 0 && percentage(progress)
    if (!valid) { clear(); return { from: percentage(progress) ? progress : 0, to: percentage(progress) ? progress : 0, animate: false, revision } }
    const same = previous?.context === context
    const adjacent = same && previous.step !== step && Math.abs(previous.index - index) === 1
    const from = adjacent && !reduced ? sample() : progress
    const animate = from !== progress
    previous = { context, step, index, from, to: progress, started_at: now() }
    return { from, to: progress, animate, revision: ++revision }
  }
  return { present, sample, clear }
}

const auth_step_motion = create_auth_step_motion()
export const present_auth_step_motion = input => auth_step_motion.present(input)
export const clear_auth_step_motion = () => auth_step_motion.clear()
