import { nextTick } from 'vue'
import { MOTION, NAVIGATION, SEND_SURFACE_MOTION } from '../config/navigation.js'
import { full_surface_geometry, send_surface_geometry } from './sendSurfaceGeometry.js'

const DISCOVER = 'pages/discover/index', SELECT = 'pages/discover/icebreaker/select'
const current_pages = () => typeof getCurrentPages === 'function' ? getCurrentPages() : []
const native_node = value => value?.$el || value
const identity_for = endpoint => { try { return endpoint?.identity?.() } catch { return null } }
const page_identity = page => page && ({ page, id: page.$page?.id ?? page.$basePage?.id })
const same_page = (a, b) => !!a && !!b && (a.id != null && b.id != null ? a.id === b.id : a.page === b.page)
const page_url = page => {
  try { return new URL(page?.$page?.fullPath || page?.$basePage?.fullPath || `/${page?.route || ''}`, 'https://cimoa.invalid') } catch { return null }
}
const path_for = page => page_url(page)?.pathname.replace(/^\//, '')
const discover_nested = (page, user_id) => /^pages\/discover\/icebreaker\/(text|voice|preview)$/.test(path_for(page) || '') && page_url(page)?.searchParams.get('user_id') === user_id || /^pages\/coins\//.test(path_for(page) || '')
const endpoint_node = endpoint => { try { return native_node(endpoint?.element?.()) } catch { return null } }
const measure = endpoint => {
  try {
    const root = endpoint_node(endpoint), anchor = native_node(endpoint?.anchor?.())
    if (!root?.isConnected || !anchor?.isConnected) return null
    return send_surface_geometry(anchor.getBoundingClientRect(), root.getBoundingClientRect())
  } catch { return null }
}
const measure_full_frame = endpoint => {
  try {
    const root = endpoint_node(endpoint)
    if (!root?.isConnected) return null
    const rect = root.getBoundingClientRect(), view = root.ownerDocument?.defaultView || globalThis.window
    return full_surface_geometry(rect, { left: 0, top: 0, width: view?.innerWidth ?? rect.width, height: view?.innerHeight ?? rect.height })
  } catch { return null }
}
const capture_scroll = endpoint => {
  const root = endpoint_node(endpoint)
  if (!root?.isConnected) return null
  try {
    const view = root.ownerDocument?.defaultView || globalThis.window
    const positions = [root, ...root.querySelectorAll?.('*') || []].filter(node => {
      if (node.scrollTop || node.scrollLeft) return true
      const style = view?.getComputedStyle?.(node)
      return node.scrollHeight > node.clientHeight && /auto|scroll|overlay/.test(style?.overflowY || '') || node.scrollWidth > node.clientWidth && /auto|scroll|overlay/.test(style?.overflowX || '')
    }).map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }))
    return { root, positions }
  } catch { return null }
}
const restore_scroll = (endpoint, snapshot) => {
  const root = endpoint_node(endpoint)
  if (!snapshot || root !== snapshot.root || !root?.isConnected) return false
  try {
    // Teleport can reset the native scroller inside uni-scroll-view. Resolve its
    // connected layout before restoring the same nodes, never a copied list.
    root.getBoundingClientRect?.()
    for (const { node, top, left } of snapshot.positions) {
      if (!node.isConnected || root.contains && !root.contains(node)) continue
      node.scrollTop = top; node.scrollLeft = left
    }
    return true
  } catch { return false }
}

// Only short-lived identity, measured geometry and Vue-owned endpoint references
// live here. The host contains empty Teleport destinations, never copied pages.
export function create_send_surface({
  strategy = 'point',
  source_route = DISCOVER,
  target_route = SELECT,
  target_identity_query = 'user_id',
  identity_keys = ['auth_context', 'user_id'],
  nested_routes = discover_nested,
  root_id = 'cimoa-send-surface-root',
  source_id = 'cimoa-send-surface-source',
  target_id = 'cimoa-send-surface-target',
  attribute_prefix = 'send-surface',
  get_pages = current_pages,
  next_tick = nextTick,
  animate = (node, frames, options) => node.animate(frames, options),
  schedule = setTimeout,
  cancel = clearTimeout,
  reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true,
  hidden = () => globalThis.document?.hidden === true,
  available = () => !!globalThis.document?.getElementById(source_id) && !!globalThis.document?.getElementById(target_id),
  measure_source = strategy === 'bottom' ? measure_full_frame : measure,
} = {}) {
  const presentation = Object.freeze({ root_id, source_id, target_id, attribute_prefix })
  const identity_fields = Object.freeze([...identity_keys])
  const same_identity = (a, b) => !!a && identity_fields.every(key => typeof a[key] === 'string' && a[key].trim() && a[key] === b?.[key])
  const is_source = page => typeof source_route === 'function' ? source_route(path_for(page), page) : Array.isArray(source_route) ? source_route.includes(path_for(page)) : path_for(page) === source_route
  const is_target = (page, user_id) => path_for(page) === target_route && (!target_identity_query || page_url(page)?.searchParams.get(target_identity_query) === user_id)
  const is_nested = (page, user_id) => typeof nested_routes === 'function' ? nested_routes(page, user_id) : nested_routes.includes(path_for(page))
  let association = null, generation = 0, deadline = null, running = null, last_issue = ''
  const sources = new Set(), listeners = new Set(), source_scrolls = new Map()
  const pages = () => { try { return get_pages() } catch { return [] } }
  const state = () => {
    const link = association, phase = link?.phase || 'idle'
    const active = !!link && !['settled'].includes(phase)
    return { phase, strategy, direction: link?.direction || '', user_id: link?.identity.user_id || '', token: link?.token ?? null, geometry: link?.geometry || null, reduced: !!link?.reduced, source: link?.source || null, target: link?.target || null, source_borrowed: active, target_borrowed: active && !!link?.target, busy: active && !!link?.target, issue: last_issue }
  }
  const publish = () => { const value = state(); listeners.forEach(listener => { try { listener(value) } catch { /* A visual observer cannot own navigation. */ } }) }
  const stop_deadline = () => { if (deadline != null) cancel(deadline); deadline = null }
  const stop_animation = () => {
    const task = running
    if (!task) return
    running = null; cancel(task.timer)
    task.resolve(false)
    try { task.animation?.cancel?.() } catch { /* The route may already have removed this element. */ }
  }
  const restore_source_scroll = (endpoint, record) => {
    if (source_scrolls.get(endpoint) !== record) return
    if (!sources.has(endpoint) || !same_identity(identity_for(endpoint), record.identity) || !pages().some(page => same_page(page_identity(page), record.page))) { source_scrolls.delete(endpoint); return }
    if (restore_scroll(endpoint, record.snapshot) && association?.source !== endpoint && same_page(page_identity(pages().at(-1)), record.page)) source_scrolls.delete(endpoint)
  }
  const restore_link_scroll = link => {
    const record = source_scrolls.get(link.source)
    if (record) restore_source_scroll(link.source, record)
    if (same_identity(identity_for(link.target), link.identity)) restore_scroll(link.target, link.target_scroll)
  }
  const restore_after_flush = link => {
    const pending = [...source_scrolls], token = generation
    void next_tick().then(() => {
      for (const [endpoint, record] of pending) restore_source_scroll(endpoint, record)
      if (link && generation === token && (!association || association === link) && same_page(page_identity(pages().at(-1)), link.target_page) && same_identity(identity_for(link.target), link.identity)) restore_scroll(link.target, link.target_scroll)
    }).catch(() => { /* A destroyed owner has no connected scroll region to restore. */ })
  }
  const clear = (reason = '') => {
    const link = association
    generation++; stop_deadline(); stop_animation(); association?.cancelled?.(false); association?.arrived?.(false); association = null; last_issue = reason; publish()
    if (link) restore_after_flush(link)
  }
  const fail = reason => { clear(reason); return false }
  const still_current = link => association === link && generation === link.token && !hidden()
  const source_valid = link => sources.has(link.source) && same_identity(identity_for(link.source), link.identity) && pages().some(page => same_page(page_identity(page), link.source_page) && is_source(page))
  const target_valid = (link, { exact = true } = {}) => {
    const stack = pages(), source_index = stack.findIndex(page => same_page(page_identity(page), link.source_page)), target = stack[source_index + 1]
    if (source_index < 0 || !is_target(target, link.identity.user_id)) return false
    if (link.target_page && !same_page(page_identity(target), link.target_page)) return false
    return exact ? source_index + 1 === stack.length - 1 : stack.slice(source_index + 2).every(page => is_nested(page, link.identity.user_id))
  }
  const set_phase = (link, phase) => { if (association !== link) return; link.phase = phase; publish() }
  const arm_deadline = (link, reason = 'presentation-timeout') => {
    stop_deadline()
    deadline = schedule(() => { if (association === link) fail(reason) }, NAVIGATION.callback_timeout_ms)
  }
  const reconcile_return = link => {
    if (!still_current(link) || link.phase !== 'back-dispatched' || !source_valid(link) || !same_page(page_identity(pages().at(-1)), link.source_page)) return false
    link.arrived?.(true)
    return true
  }
  const play = (link, direction) => new Promise(resolve => {
    if (!still_current(link)) { resolve(false); return }
    stop_animation()
    const node = endpoint_node(link.target), duration = direction === 'forward' ? MOTION.page : MOTION.back
    const from = strategy === 'bottom' ? direction === 'forward' ? 'translateY(100%)' : 'translateY(0)' : direction === 'forward' ? link.geometry.start_clip : link.geometry.end_clip
    const to = strategy === 'bottom' ? direction === 'forward' ? 'translateY(0)' : 'translateY(100%)' : direction === 'forward' ? link.geometry.end_clip : link.geometry.start_clip
    const property = strategy === 'bottom' ? 'transform' : 'clipPath'
    const frames = link.reduced ? [{ opacity: direction === 'forward' ? 0 : 1 }, { opacity: direction === 'forward' ? 1 : 0 }] : [{ [property]: from }, { [property]: to }]
    const task = { resolve, animation: null, timer: null, complete: false }
    running = task
    const complete = success => {
      if (running !== task || task.complete) return
      task.complete = true; cancel(task.timer)
      // Keep the end fill until the real Teleport hand-off has flushed.
      resolve(success && still_current(link))
    }
    try {
      task.animation = animate(node, frames, { duration, easing: direction === 'forward' ? SEND_SURFACE_MOTION.enter_easing : SEND_SURFACE_MOTION.exit_easing, fill: 'both' })
      if (!task.animation) throw new Error('Animation is unavailable')
      if (task.animation.finished?.then) task.animation.finished.then(() => complete(true), () => complete(false))
      else task.timer = schedule(() => complete(true), duration)
      arm_deadline(link)
    } catch { if (running === task) running = null; fail('animation-unavailable'); resolve(false) }
  })
  const release_animation = () => {
    const task = running
    running = null
    if (task) { cancel(task.timer); try { task.animation?.cancel?.() } catch { /* Already removed by Vue. */ } }
  }
  const register_source = endpoint => {
    sources.add(endpoint)
    return () => { sources.delete(endpoint); source_scrolls.delete(endpoint); if (association?.source === endpoint) clear('source-unmounted') }
  }
  const navigate = async (endpoint, user_id, dispatch) => {
    if (association && association.phase !== 'settled') return false
    if (typeof dispatch !== 'function') return false
    const identity = identity_for(endpoint), page = pages().at(-1)
    if (!sources.has(endpoint) || !same_identity(identity, { ...identity, user_id }) || !is_source(page) || hidden() || !available()) { clear('source-unavailable'); return dispatch() }
    const geometry = measure_source(endpoint)
    if (!geometry) { clear('source-unmeasurable'); return dispatch() }
    const source_scroll = capture_scroll(endpoint)
    clear()
    const link = association = { token: generation, source: endpoint, source_page: page_identity(page), target: null, target_page: null, target_scroll: null, identity: { ...identity }, geometry, reduced: reduced(), phase: 'forward-pending', direction: 'forward' }
    source_scrolls.set(endpoint, { identity: link.identity, page: link.source_page, snapshot: source_scroll })
    link.cancellation = new Promise(resolve => { link.cancelled = resolve })
    publish(); arm_deadline(link)
    try {
      // Vue migrates the unique real frame before uni-app deactivates its page.
      await next_tick()
      if (!still_current(link)) return false
      restore_link_scroll(link)
      if (!source_valid(link)) return fail('source-changed')
      if (!endpoint_node(endpoint)?.isConnected) return fail('source-disconnected')
      const result = await Promise.race([dispatch(), link.cancellation])
      if (result === false && association === link) clear('navigation-cancelled')
      return result
    } catch (error) { if (association === link) clear('navigation-failed'); throw error }
  }
  const enter = endpoint => {
    const link = association
    if (!link || link.phase !== 'forward-pending') return false
    if (!still_current(link) || !source_valid(link) || !same_identity(identity_for(endpoint), link.identity) || !target_valid(link)) return fail('target-mismatch')
    link.target = endpoint; link.target_page = page_identity(pages().at(-1)); set_phase(link, 'forward-ready')
    return true
  }
  const attach = async endpoint => {
    const link = association
    if (!link || link.target !== endpoint || link.phase !== 'forward-ready') return false
    await next_tick()
    if (!still_current(link)) return false
    restore_link_scroll(link)
    if (!source_valid(link) || !target_valid(link) || !endpoint_node(link.source)?.isConnected || !endpoint_node(endpoint)?.isConnected) return fail('target-unmeasurable')
    link.target_scroll = capture_scroll(endpoint)
    set_phase(link, 'forward-running')
    if (!await play(link, 'forward')) { if (association === link) clear('animation-cancelled'); return false }
    if (!still_current(link)) return false
    stop_deadline(); set_phase(link, 'settled')
    await next_tick()
    if (!still_current(link)) return false
    restore_link_scroll(link); release_animation()
    return true
  }
  const back = async (endpoint, dispatch) => {
    const link = association
    if (link?.target === endpoint && link.phase !== 'settled') return false
    if (!link || link.target !== endpoint || typeof dispatch !== 'function') return null
    if (!still_current(link) || !source_valid(link) || !same_identity(identity_for(endpoint), link.identity) || !target_valid(link)) { clear('return-mismatch'); return null }
    link.target_scroll = capture_scroll(endpoint)
    link.direction = 'back'; set_phase(link, 'back-ready'); arm_deadline(link)
    await next_tick()
    if (!still_current(link)) return false
    restore_link_scroll(link)
    const geometry = measure_source(link.source)
    if (!geometry || !endpoint_node(endpoint)?.isConnected || !target_valid(link)) { clear('return-unmeasurable'); return null }
    link.geometry = geometry; set_phase(link, 'back-running')
    if (!await play(link, 'back')) { if (association === link) clear('animation-cancelled'); return false }
    if (!still_current(link) || !source_valid(link) || !target_valid(link)) { if (association === link) clear('return-changed'); return false }
    link.arrival = new Promise(resolve => { link.arrived = resolve })
    set_phase(link, 'back-dispatched'); arm_deadline(link, 'return-arrival-timeout')
    try {
      const result = await Promise.race([dispatch(), link.cancellation])
      if (result === false) { if (association === link) clear('navigation-cancelled'); return false }
      await next_tick()
      if (!still_current(link)) return false
      // The platform Back callback may acknowledge before browser history has
      // activated the source. Keep the collapsed real target and its underlay
      // until source onShow/hash/pop confirms that exact retained page.
      reconcile_return(link)
      if (!await Promise.race([link.arrival, link.cancellation]) || !still_current(link)) return false
      await next_tick()
      if (!still_current(link)) return false
      restore_link_scroll(link)
      if (!same_page(page_identity(pages().at(-1)), link.source_page)) { clear('return-not-arrived'); return false }
      // Restore only after the real stack has activated the same source page.
      clear()
      const token = generation
      await next_tick()
      if (generation === token) restore_link_scroll(link)
      return result
    } catch (error) { if (association === link) clear('navigation-failed'); throw error }
  }
  const route_changed = () => {
    restore_after_flush()
    const link = association
    if (!link) return false
    if (link.phase === 'back-dispatched') {
      reconcile_return(link)
      void next_tick().then(() => reconcile_return(link)).catch(() => {})
    }
    if (!source_valid(link) || hidden()) return fail('route-changed')
    const stack = pages(), current = stack.at(-1)
    if (same_page(page_identity(current), link.source_page)) {
      if (['forward-pending', 'back-dispatched'].includes(link.phase)) return true
      return fail('route-changed')
    }
    if (is_target(current, link.identity.user_id) && target_valid(link)) return true
    if (link.phase === 'settled' && target_valid(link, { exact: false })) return true
    return fail('route-changed')
  }
  const identity_changed = endpoint => {
    const record = source_scrolls.get(endpoint)
    if (record && !same_identity(identity_for(endpoint), record.identity)) source_scrolls.delete(endpoint)
    if (association && [association.source, association.target].includes(endpoint) && !same_identity(identity_for(endpoint), association.identity)) clear('identity-changed')
  }
  const release_target = endpoint => {
    if (association?.target === endpoint && association.phase !== 'back-dispatched') clear('target-unmounted')
  }
  return { strategy, presentation, identity_keys: identity_fields, register_source, navigate, enter, attach, back, route_changed, identity_changed, release_target, clear, get current() { return state() }, subscribe(listener) { listeners.add(listener); listener(state()); return () => listeners.delete(listener) } }
}

export const send_surface = create_send_surface()
export const clear_send_surface = reason => send_surface.clear(reason)

// Home reuses the same ownership, route and cancellation engine. Only the
// authenticated user's entry page and its two non-matching children may retain
// this receipt; starting or viewing an actual match deliberately ends it.
export function create_auto_match_surface(options = {}) {
  return create_send_surface({
    source_route: 'pages/home/index',
    target_route: 'pages/auto-match/index',
    target_identity_query: null,
    nested_routes: ['pages/auto-match/preferences', 'pages/auto-match/history'],
    root_id: 'cimoa-auto-match-surface-root',
    source_id: 'cimoa-auto-match-surface-source',
    target_id: 'cimoa-auto-match-surface-target',
    attribute_prefix: 'auto-match-surface',
    ...options,
  })
}
export const auto_match_surface = create_auto_match_surface()
export const clear_auto_match_surface = reason => auto_match_surface.clear(reason)

export function create_match_preferences_surface(options = {}) {
  return create_send_surface({
    strategy: 'bottom',
    source_route: ['pages/auto-match/index', 'pages/auto-match/searching', 'pages/auto-match/paused', 'pages/auto-match/no-match', 'pages/discover/index'],
    target_route: 'pages/auto-match/preferences',
    target_identity_query: null,
    nested_routes: [],
    root_id: 'cimoa-match-preferences-surface-root',
    source_id: 'cimoa-match-preferences-surface-source',
    target_id: 'cimoa-match-preferences-surface-target',
    attribute_prefix: 'match-preferences-surface',
    ...options,
  })
}
export const match_preferences_surface = create_match_preferences_surface()
export const clear_match_preferences_surface = reason => match_preferences_surface.clear(reason)
