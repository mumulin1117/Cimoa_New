import { shallowRef } from 'vue'
import { MOTION } from '../config/navigation.js'

export const match_ignition = shallowRef(null)
let timer, generation = 0
const valid_bounds = bounds => bounds && [bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) && bounds.width > 0 && bounds.height > 0
export const motion_reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
export function clear_match_ignition() { generation++; clearTimeout(timer); timer = null; match_ignition.value = null }
export function begin_match_ignition(element, context, { now = Date.now(), schedule = setTimeout } = {}) {
  clear_match_ignition()
  const bounds = element?.getBoundingClientRect?.()
  if (!valid_bounds(bounds) || !context || globalThis.document?.hidden) return false
  const id = generation
  match_ignition.value = { id, context, stage: 'source', bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }, deadline: now + MOTION.match_ignite, duration: MOTION.match_ignite, reduced: motion_reduced() }
  timer = schedule(() => { if (generation === id) clear_match_ignition() }, MOTION.match_ignite)
  return true
}
export function land_match_ignition(element, context, now = Date.now()) {
  const cue = match_ignition.value, bounds = element?.getBoundingClientRect?.()
  if (!cue || cue.context !== context || !valid_bounds(bounds) || now >= cue.deadline) return false
  match_ignition.value = { ...cue, stage: 'arrival', bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }, duration: cue.deadline - now }
  return true
}
export const land_match_ignition_for_entry = context => land_match_ignition(globalThis.document?.querySelector('.auto-match-index .am-1469-8'), context)
