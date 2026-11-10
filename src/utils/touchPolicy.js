// DOM presentation policy only: never dispatch business clicks, change a Store,
// capture a pointer owned by a card, or prevent scrolling/input events.
const installations = new WeakMap()
const controls = '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], button, a[href]'
const element = target => target?.nodeType === 3 ? target.parentElement : target
export const is_editable_target = target => {
  const node = element(target)
  if (!node?.closest) return false
  if (node.closest('input, textarea, uni-input, uni-textarea')) return true
  const editable = node.closest('[contenteditable]')
  return !!editable && ['true', '', 'plaintext-only'].includes(editable.getAttribute('contenteditable')?.toLowerCase())
}
const event_target = event => element(event.composedPath?.()[0] || event.target)
const disabled = node => {
  for (let item = node?.closest?.(controls); item; item = item.parentElement?.closest?.(controls)) {
    if (item.getAttribute('aria-disabled') === 'true' || item.disabled || item.hasAttribute('disabled')) return true
  }
  return false
}

export function install_touch_policy({ document: doc = globalThis.document, window: win = globalThis.window, timers = globalThis } = {}) {
  if (!doc?.addEventListener || !win?.addEventListener) return { cancel() {}, dispose() {}, refresh() {} }
  if (installations.has(doc)) return installations.get(doc)
  let active, blocked, disposed = false
  const protect_content = root => {
    const nodes = [...(root.querySelectorAll?.('img, image, uni-image, input, textarea') || [])]
    if (root.matches?.('img, image, uni-image, input, textarea')) nodes.push(root)
    for (const node of nodes) {
      // uni's CSS compiler rewrites input/textarea selectors to wrapper tags.
      // Mark the actual DOM editor, including dynamically mounted native inputs.
      if (node.matches('input, textarea')) node.setAttribute('data-cimoa-editable-input', '')
      else if (!is_editable_target(node)) node.setAttribute('draggable', 'false')
    }
  }
  const observer = typeof win.MutationObserver === 'function' ? new win.MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) protect_content(node)
  }) : null
  const old_scale = doc.documentElement.style.getPropertyValue('--app-touch-scale')
  const refresh = () => {
    const width = doc.documentElement.clientWidth || win.innerWidth
    if (Number.isFinite(width) && width > 0) doc.documentElement.style.setProperty('--app-touch-scale', String(393 / width))
  }
  const release = () => {
    if (!active) return
    timers.clearTimeout(active.timer)
    active.node.removeAttribute('data-touch-state')
    active = null
  }
  const cancel = () => {
    if (active) blocked = active.node
    release()
  }
  const protect = event => {
    if (!is_editable_target(event_target(event))) event.preventDefault()
  }
  const down = event => {
    // A new intentional touch always clears any cancelled compatibility click.
    // A second finger cancels the old press rather than transferring ownership.
    if (event.isPrimary === false || event.button != null && event.button !== 0) { cancel(); return }
    release(); blocked = null
    const target = event_target(event), node = target?.closest?.(controls)
    if (!node || is_editable_target(target) || disabled(node)) return
    const press = { node, id: event.pointerId, x: event.clientX, y: event.clientY }
    active = press
    if (node.hasAttribute?.('data-press-glow')) {
      const bounds = node.getBoundingClientRect?.()
      if (bounds?.width > 0 && bounds?.height > 0) {
        node.style?.setProperty('--press-x', `${Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100))}%`)
        node.style?.setProperty('--press-y', `${Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100))}%`)
      }
    }
    node.setAttribute('data-touch-state', 'pressed')
    press.timer = timers.setTimeout(() => {
      if (!disposed && active === press && node.isConnected && doc.visibilityState !== 'hidden') node.setAttribute('data-touch-state', 'held')
    }, 500)
  }
  const move = event => {
    if (active?.id === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10) cancel()
  }
  const up = event => { if (active?.id === event.pointerId) release() }
  const interrupted = event => { if (active?.id === event.pointerId) cancel() }
  const click = event => {
    const target = event_target(event)
    if (disabled(target) || event.detail > 0 && blocked?.contains(target)) {
      event.preventDefault(); event.stopImmediatePropagation()
    }
    blocked = null
  }
  const visibility = () => { if (doc.visibilityState === 'hidden') cancel() }
  const listeners = { contextmenu: protect, dragstart: protect, selectstart: protect, pointerdown: down, pointermove: move, pointerup: up, pointercancel: interrupted, lostpointercapture: interrupted, click, visibilitychange: visibility }
  for (const [name, handler] of Object.entries(listeners)) doc.addEventListener(name, handler, { capture: true, passive: !['contextmenu', 'dragstart', 'selectstart', 'click'].includes(name) })
  for (const name of ['pagehide', 'blur', 'hashchange', 'popstate']) win.addEventListener(name, cancel)
  win.addEventListener('resize', refresh); win.addEventListener('orientationchange', refresh)
  const policy = {
    cancel, refresh,
    dispose() {
      if (disposed) return
      disposed = true; cancel(); blocked = null
      observer?.disconnect()
      for (const [name, handler] of Object.entries(listeners)) doc.removeEventListener(name, handler, { capture: true })
      for (const name of ['pagehide', 'blur', 'hashchange', 'popstate']) win.removeEventListener(name, cancel)
      win.removeEventListener('resize', refresh); win.removeEventListener('orientationchange', refresh)
      if (old_scale) doc.documentElement.style.setProperty('--app-touch-scale', old_scale)
      else doc.documentElement.style.removeProperty('--app-touch-scale')
      installations.delete(doc)
    },
  }
  installations.set(doc, policy); refresh(); protect_content(doc)
  observer?.observe(doc.documentElement, { subtree: true, childList: true })
  return policy
}
