// A document may complete its native launch only once. This is presentation state,
// never an account/session flag and never persisted.
const finished_documents = new WeakSet()
const revealed_documents = new WeakSet()
const finite_animations = element => (element.getAnimations?.() || []).filter(animation => {
  const timing = animation.effect?.getComputedTiming?.()
  return timing && Number.isFinite(timing.iterations) && Number.isFinite(timing.endTime)
})

// The native acknowledgment says the cover has gone, not that the visible
// campus entrance has finished. Observe its real animations, never another
// fixed delay or the image-preparation promise.
export function create_startup_reveal_settler({ get_document = () => globalThis.document } = {}) {
  let pending = null
  const finish = (task, result) => {
    if (pending !== task) return
    pending = null
    task.document.removeEventListener?.('visibilitychange', task.visibility_changed)
    task.resolve(result)
  }
  const cancel = () => { if (pending) finish(pending, false) }
  const wait = element => {
    if (pending?.element === element) return pending.promise
    cancel()
    const document = get_document()
    if (!document || !element?.isConnected || document.visibilityState === 'hidden') return Promise.resolve(false)
    const task = { document, element }
    task.promise = new Promise(resolve => { task.resolve = resolve })
    task.visibility_changed = () => { if (document.visibilityState === 'hidden') cancel() }
    pending = task
    document.addEventListener?.('visibilitychange', task.visibility_changed)
    const animations = [...element.querySelectorAll?.('[data-startup-reveal]') || []].flatMap(finite_animations)
    Promise.all(animations.map(animation => Promise.resolve(animation.finished).catch(() => {}))).then(() => {
      finish(task, element.isConnected && document.visibilityState !== 'hidden')
    }, () => finish(task, false))
    return task.promise
  }
  return { wait, cancel }
}

export function create_startup_handoff({
  get_document = () => globalThis.document,
  get_window = () => globalThis.window,
  available = () => !!get_window()?.webkit?.messageHandlers?.CimoaHost && typeof get_window()?.CimoaNativeBridge?.request === 'function',
  request = () => get_window().CimoaNativeBridge.request('finishLaunch'),
  request_frame = callback => get_window().requestAnimationFrame(callback),
  cancel_frame = id => get_window().cancelAnimationFrame(id),
  browser_ready = false,
  on_reveal = () => {},
} = {}) {
  let pending = null
  const cleanup = task => {
    for (const [id, resolve] of task.frames) { cancel_frame(id); resolve(false) }
    task.frames.clear()
    task.document.removeEventListener?.('visibilitychange', task.visibility_changed)
    get_window()?.removeEventListener?.('cimoa:launch-reveal', task.reveal)
  }
  const finish = (task, result) => {
    if (pending !== task) return
    pending = null; cleanup(task); task.resolve(result)
  }
  const cancel = () => {
    if (!pending) return
    const task = pending
    pending = null; cleanup(task); task.request?.cancel?.()
    task.resolve({ requested: false, reason: 'cancelled' })
  }
  const current = task => pending === task && task.element.isConnected && task.document.visibilityState !== 'hidden'
  const reveal = task => {
    if (!current(task) || task.revealed || revealed_documents.has(task.document)) return
    task.revealed = true
    revealed_documents.add(task.document)
    on_reveal()
  }
  const frame = task => new Promise(resolve => {
    const id = request_frame(() => { task.frames.delete(id); resolve(true) })
    task.frames.set(id, resolve)
  })
  const run = async task => {
    try {
      if (!task.native && !task.completed) reveal(task)
      await Promise.resolve(task.document.fonts?.ready).catch(() => {})
      if (!current(task)) { finish(task, { requested: false, reason: 'not-visible' }); return }
      const animations = finite_animations(task.element)
      await Promise.all(animations.map(animation => Promise.resolve(animation.finished).catch(() => {})))
      if (!current(task)) { finish(task, { requested: false, reason: 'not-visible' }); return }
      if (!await frame(task) || !current(task) || !await frame(task) || !current(task)) { finish(task, { requested: false, reason: 'not-visible' }); return }
      if (task.native) { task.request = request(); await task.request }
      if (!current(task)) { finish(task, { requested: false, reason: 'not-visible' }); return }
      // A background interruption can cancel the first JS caller after native
      // accepted it. A later trusted completion must still reveal the target,
      // even if that caller missed the one-time native reveal event.
      if (task.native) reveal(task)
      finished_documents.add(task.document)
      finish(task, task.native ? { requested: true } : { requested: false, reason: task.completed ? 'complete' : 'browser' })
    } catch {
      finish(task, { requested: false, reason: 'host-unavailable' })
    }
  }
  const start = (element, { allow_splash = false } = {}) => {
    if (pending?.element === element && pending.allow_splash === allow_splash) return pending.promise
    cancel()
    const document = get_document()
    const native = available()
    if (!document || !element?.isConnected || !native && !browser_ready) return Promise.resolve({ requested: false, reason: 'browser' })
    if (!allow_splash && element.closest?.('.splash-page')) return Promise.resolve({ requested: false, reason: 'splash' })
    const completed = finished_documents.has(document)
    if (completed && !browser_ready) return Promise.resolve({ requested: false, reason: 'complete' })
    const task = { document, element, allow_splash, native: native && !completed, completed, frames: new Map(), request: null, revealed: false }
    task.promise = new Promise(resolve => { task.resolve = resolve })
    task.visibility_changed = () => { if (document.visibilityState === 'hidden') cancel() }
    pending = task
    task.reveal = event => {
      const attempt = new URL(get_window().location.href).searchParams.get('launch')
      if (task.native && attempt && event.detail?.attempt === attempt) reveal(task)
    }
    if (task.native) get_window()?.addEventListener?.('cimoa:launch-reveal', task.reveal)
    document.addEventListener?.('visibilitychange', task.visibility_changed)
    void run(task)
    return task.promise
  }
  return { start, cancel }
}
