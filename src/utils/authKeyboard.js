// Presentation-only coordination. This utility never submits a form or changes
// focus until a caller has already validated its navigation intent.
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null
const editable = node => {
  if (!node || node.disabled || node.readOnly) return false
  const tag = String(node.tagName || '').toLowerCase()
  if (tag === 'textarea') return true
  if (tag === 'input') return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'hidden', 'image'].includes(String(node.type || '').toLowerCase())
  if (node.isContentEditable) return true
  try {
    const owner = node.closest?.('[contenteditable]')
    return !!owner && owner.getAttribute('contenteditable') !== 'false'
  } catch { return false }
}

export function create_auth_keyboard_handoff({
  get_document = () => typeof document === 'undefined' ? null : document,
  get_window = () => typeof window === 'undefined' ? null : window,
  hide_keyboard = () => {},
  schedule = setTimeout,
  cancel_timer = clearTimeout,
  request_frame,
  cancel_frame,
  timeout_ms,
  stable_frames = 2,
  tolerance = 1,
} = {}) {
  const doc = get_document(), win = get_window(), viewport = win?.visualViewport
  const raf = request_frame || (callback => win?.requestAnimationFrame ? win.requestAnimationFrame(callback) : schedule(callback, 0))
  const caf = cancel_frame || (id => win?.cancelAnimationFrame ? win.cancelAnimationFrame(id) : cancel_timer(id))
  const frame_count = Math.max(2, Math.floor(stable_frames) || 2)
  const epsilon = Math.max(0, finite(tolerance) ?? 1)
  const timeout = finite(timeout_ms)
  if (!(timeout > 0)) throw new Error('A finite keyboard handoff timeout is required.')
  let pending = null, disposed = false, baseline = null, phase = 'idle'
  const listeners = []
  const listen = (target, type, callback) => {
    if (!target?.addEventListener) return
    target.addEventListener(type, callback)
    listeners.push(() => target.removeEventListener(type, callback))
  }
  const snapshot = () => {
    if (!viewport) return null
    const height = finite(viewport.height), width = finite(viewport.width)
    if (!(height > 0) || !(width > 0)) return null
    return { height, width, top: finite(viewport.offsetTop) ?? 0, scale: finite(viewport.scale) ?? 1 }
  }
  const same_plane = (a, b) => !!a && !!b && Math.abs(a.width - b.width) <= epsilon && Math.abs(a.scale - b.scale) <= 0.001
  const same_geometry = (a, b) => same_plane(a, b) && Math.abs(a.height - b.height) <= epsilon && Math.abs(a.top - b.top) <= epsilon
  const learn_baseline = () => {
    if (pending || editable(doc?.activeElement)) return
    const measured = snapshot()
    if (!measured) return
    const value = layout_baseline(measured) || measured
    // During a closing animation an unfocused viewport can still be short.
    // Remember the largest observed unoccluded height, never its intermediate
    // resize frames. A component can mount after blur but before native closure;
    // in that case the measured layout viewport supplies the missing baseline.
    // Width/scale changes establish a different layout plane.
    if (!same_plane(value, baseline) || value.height > baseline.height) baseline = value
  }
  const hidden = () => doc?.visibilityState === 'hidden' || doc?.hidden === true
  const layout_baseline = value => {
    if (!value) return null
    const height = Math.max(finite(doc?.documentElement?.clientHeight) ?? 0, finite(win?.innerHeight) ?? 0)
    return height > value.height + epsilon ? { ...value, height, top: 0 } : null
  }
  const finish = (task, ready, reason) => {
    if (pending !== task) return
    pending = null
    cancel_timer(task.timer)
    if (task.frame != null) caf(task.frame)
    phase = ready ? 'ready' : 'cancelled'
    task.resolve({ ready, reason })
    if (ready) learn_baseline()
  }
  const cancel = (reason = 'cancelled') => {
    if (pending) finish(pending, false, reason)
  }
  const check = task => {
    if (pending !== task || disposed) return
    task.frame = null
    if (hidden()) return finish(task, false, 'hidden')
    if (editable(doc?.activeElement)) return finish(task, false, 'refocused')
    const value = snapshot()
    if (value && (task.expected || task.initial) && !same_plane(value, task.expected || task.initial)) return finish(task, false, 'layout-changed')
    // A stationary but still-short viewport is not a closed keyboard. This
    // avoids navigating before iOS has even begun its delayed close animation.
    const closed = !value || !!task.expected && value.height >= task.expected.height - epsilon && value.top <= task.expected.top + epsilon
    task.stable = closed && (!value || same_geometry(value, task.previous)) ? task.stable + 1 : 0
    task.previous = value
    if (closed && task.stable >= frame_count) return finish(task, true, value ? 'closed' : 'unobservable')
    task.frame = raf(() => check(task))
  }
  const prepare = () => {
    if (pending) return pending.promise
    if (disposed || hidden()) return Promise.resolve({ ready: false, reason: disposed ? 'disposed' : 'hidden' })
    const focused = editable(doc?.activeElement) ? doc.activeElement : null
    const value = snapshot()
    const measured_open = value && same_plane(value, baseline) && (value.height < baseline.height - epsilon || value.top > baseline.top + epsilon)
    if (!focused && !measured_open) {
      learn_baseline(); phase = 'ready'
      return Promise.resolve({ ready: true, reason: 'no-keyboard' })
    }
    const task = { expected: same_plane(value, baseline) ? baseline : layout_baseline(value), initial: value, previous: value, stable: 0, frame: null, timer: null }
    task.promise = new Promise(resolve => { task.resolve = resolve })
    pending = task; phase = 'closing'
    task.timer = schedule(() => {
      // An observation deadline is not proof that the keyboard closed. Keep the
      // source page if a shortened viewport is still measurable; a retry can
      // observe the real platform result without navigating from stale frames.
      const latest = snapshot()
      const closed = !latest || task.expected && same_plane(latest, task.expected) && latest.height >= task.expected.height - epsilon && latest.top <= task.expected.top + epsilon
      finish(task, !!closed && !disposed && !hidden() && !editable(doc?.activeElement), 'observation-timeout')
    }, timeout)
    try { focused?.blur?.() } catch { /* The native close request remains available. */ }
    try {
      const result = hide_keyboard()
      result?.catch?.(() => {})
    } catch { /* Browser blur is still a valid keyboard close request. */ }
    if (pending === task && !value) finish(task, !hidden() && !editable(doc?.activeElement), 'unobservable')
    else if (pending === task) task.frame = raf(() => check(task))
    return task.promise
  }
  const changed = () => { if (!pending) learn_baseline() }
  const focus_changed = event => { if (pending && editable(event?.target || doc?.activeElement)) cancel('refocused') }
  listen(viewport, 'resize', changed)
  listen(viewport, 'scroll', changed)
  listen(win, 'resize', changed)
  listen(doc, 'focusin', focus_changed)
  listen(doc, 'visibilitychange', () => { if (hidden()) cancel('hidden'); else learn_baseline() })
  listen(win, 'pagehide', () => cancel('page-hidden'))
  listen(win, 'orientationchange', () => { cancel('layout-changed'); baseline = null; learn_baseline() })
  learn_baseline()
  return {
    prepare,
    cancel,
    dispose: () => { cancel('disposed'); disposed = true; phase = 'disposed'; listeners.splice(0).forEach(remove => remove()) },
    state: () => ({ phase, pending: !!pending }),
  }
}
