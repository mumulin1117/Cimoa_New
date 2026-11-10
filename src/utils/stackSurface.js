import { nextTick } from 'vue'
import { MOTION, NAVIGATION, STACK_SURFACE_MOTION } from '../config/navigation.js'
import { stack_surface_edge, stack_surface_source } from './stackSurfaceRoutes.js'
export { is_stack_route } from './stackSurfaceRoutes.js'

const current_pages = () => typeof getCurrentPages === 'function' ? getCurrentPages() : []
const native_node = value => value?.$el || value
const identity_for = endpoint => { try { return endpoint?.identity?.() } catch { return null } }
const endpoint_node = endpoint => { try { return native_node(endpoint?.element?.()) } catch { return null } }
const page_identity = page => page && ({ page, id: page.$page?.id ?? page.$basePage?.id })
const same_page = (a, b) => !!a && !!b && (a.id != null && b.id != null ? a.id === b.id : a.page === b.page)
const page_path = page => page?.$page?.fullPath || page?.$basePage?.fullPath || `/${page?.route || ''}`
const canonical_url = value => {
  try {
    if (typeof value !== 'string' || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return ''
    const url = new URL(value.startsWith('/') ? value : `/${value}`, 'https://cimoa.invalid')
    url.searchParams.sort()
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return '' }
}
const same_identity = (a, b) => typeof a?.auth_context === 'string' && !!a.auth_context.trim() && a.auth_context === b?.auth_context
const frame_geometry = endpoint => {
  try {
    const node = endpoint_node(endpoint), rect = node?.getBoundingClientRect?.()
    return node?.isConnected && rect && Number.isFinite(rect.width) && rect.width > 0 && Number.isFinite(rect.height) && rect.height > 0 ? rect : null
  } catch { return null }
}
const capture_scroll = endpoint => {
  const root = endpoint_node(endpoint)
  if (!root?.isConnected) return null
  try {
    const view = root.ownerDocument?.defaultView || globalThis.window
    const positions = [root, ...root.querySelectorAll?.('*') || []].filter(node => {
      if (node.scrollTop || node.scrollLeft) return true
      const vertical = node.scrollHeight > node.clientHeight, horizontal = node.scrollWidth > node.clientWidth
      if (!vertical && !horizontal) return false
      const style = view?.getComputedStyle?.(node)
      return vertical && /auto|scroll|overlay/.test(style?.overflowY || '') || horizontal && /auto|scroll|overlay/.test(style?.overflowX || '')
    }).map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }))
    return { root, positions }
  } catch { return null }
}
const restore_scroll = (endpoint, snapshot) => {
  const root = endpoint_node(endpoint)
  if (!snapshot || root !== snapshot.root || !root?.isConnected) return false
  try {
    root.getBoundingClientRect?.()
    for (const { node, top, left } of snapshot.positions) {
      if (!node.isConnected || root.contains && !root.contains(node)) continue
      node.scrollTop = top; node.scrollLeft = left
    }
    return true
  } catch { return false }
}

// Links contain presentation ownership only. Each pair refers to the original
// Vue instances in the real uni-app stack; no page or business data is copied.
export function create_stack_surface({
  get_pages = current_pages,
  next_tick = nextTick,
  animate = (node, frames, options) => node.animate(frames, options),
  schedule = setTimeout,
  cancel = clearTimeout,
  reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true,
  hidden = () => globalThis.document?.hidden === true,
  available = () => !!globalThis.document?.getElementById('cimoa-stack-surface-source') && !!globalThis.document?.getElementById('cimoa-stack-surface-target'),
  measure = frame_geometry,
} = {}) {
  const presentation = Object.freeze({ root_id: 'cimoa-stack-surface-root', source_id: 'cimoa-stack-surface-source', target_id: 'cimoa-stack-surface-target', attribute_prefix: 'stack-surface' })
  const endpoints = new Map(), listeners = new Set(), scrolls = new Map()
  let links = [], active = null, last = null, generation = 0, deadline = null, running = null, last_issue = ''
  const pages = () => { try { return get_pages() || [] } catch { return [] } }
  const state = () => {
    const link = active || last, borrowed = !!active && active.phase !== 'settled'
    return { strategy: 'stack', phase: active?.phase || (link ? 'settled' : 'idle'), direction: link?.direction || '', user_id: '', token: link?.token ?? null, reduced: !!link?.reduced, geometry: link?.geometry || null, source: link?.source || null, target: link?.target || null, source_borrowed: borrowed, target_borrowed: borrowed && !!active?.target, busy: borrowed, issue: last_issue }
  }
  const publish = () => { const value = state(); listeners.forEach(listener => { try { listener(value) } catch { /* Presentation observers never own navigation. */ } }) }
  const stop_deadline = () => { if (deadline != null) cancel(deadline); deadline = null }
  const release_animation = () => {
    const task = running
    running = null
    if (!task) return
    for (const timer of task.timers) cancel(timer)
    for (const animation of task.animations) { try { animation.cancel?.() } catch { /* Its owner may already be gone. */ } }
    task.resolve(false)
  }
  const page_matches = (page, record) => !!record && same_page(page_identity(page), record.page) && canonical_url(page_path(page)) === record.url
  const record_valid = (endpoint, record) => endpoints.has(endpoint) && same_identity(identity_for(endpoint), record?.identity) && pages().some(page => page_matches(page, record))
  const link_valid = link => {
    const stack = pages(), index = stack.findIndex(page => page_matches(page, link.source_record))
    return index >= 0 && record_valid(link.source, link.source_record) && same_identity(identity_for(link.target), link.identity) && page_matches(stack[index + 1], link.target_record)
  }
  const prune = () => {
    links = links.filter(link_valid)
    if (last && !links.includes(last)) last = links.at(-1) || null
    for (const [endpoint, record] of scrolls) if (!record_valid(endpoint, record)) scrolls.delete(endpoint)
  }
  const remember_scroll = (endpoint, record, snapshot = capture_scroll(endpoint)) => { if (snapshot) scrolls.set(endpoint, { ...record, snapshot }) }
  const restore_all = () => {
    for (const [endpoint, record] of scrolls) {
      if (!record_valid(endpoint, record)) { scrolls.delete(endpoint); continue }
      restore_scroll(endpoint, record.snapshot)
    }
  }
  const release_current_scroll = () => {
    if (active) return
    for (const [endpoint, record] of scrolls) if (page_matches(pages().at(-1), record) && !links.some(link => link.source === endpoint)) scrolls.delete(endpoint)
  }
  const restore_after_flush = () => { void next_tick().then(() => { restore_all(); release_current_scroll() }).catch(() => {}) }
  const reset = (reason, retain_links) => {
    const link = active
    generation++; active = null; links = retain_links ? links.filter(item => item !== link) : []; last = links.at(-1) || null; last_issue = reason
    if (retain_links) prune()
    stop_deadline(); release_animation(); link?.cancelled?.(false); link?.completed?.(false); link?.arrived?.(false)
    publish(); restore_after_flush()
  }
  const clear = (reason = '') => reset(reason, false)
  const abort = reason => reset(reason, true)
  const fail = reason => { abort(reason); return false }
  const current = link => active === link && link.token === generation && !hidden()
  const arm_deadline = (link, reason = 'presentation-timeout') => {
    stop_deadline()
    deadline = schedule(() => { if (active === link) fail(reason) }, NAVIGATION.callback_timeout_ms)
  }
  const set_phase = (link, phase) => { if (active === link) { link.phase = phase; publish() } }
  const target_valid = link => {
    const stack = pages(), index = stack.findIndex(page => page_matches(page, link.source_record))
    const target = stack[index + 1]
    return index >= 0 && index + 1 === stack.length - 1 && record_valid(link.source, link.source_record) && canonical_url(page_path(target)) === link.expected_url && (!link.target_record || page_matches(target, link.target_record))
  }
  const reconcile_return = link => {
    if (!current(link) || link.phase !== 'back-dispatched' || !record_valid(link.source, link.source_record) || !page_matches(pages().at(-1), link.source_record)) return false
    link.arrived?.(true)
    return true
  }
  const play = (link, direction) => new Promise(resolve => {
    if (!current(link)) { resolve(false); return }
    release_animation()
    const returning = direction === 'back', duration = returning ? MOTION.back : MOTION.page
    const parallax = STACK_SURFACE_MOTION.parallax * 100
    const frames = link.reduced ? [
      [{ opacity: 1 }, { opacity: 1 }],
      [{ opacity: returning ? 1 : 0 }, { opacity: returning ? 0 : 1 }],
    ] : [
      [{ transform: `translate3d(${-parallax * Number(returning)}%,0,0)` }, { transform: `translate3d(${-parallax * Number(!returning)}%,0,0)` }],
      [{ transform: `translate3d(${100 * Number(!returning)}%,0,0)` }, { transform: `translate3d(${100 * Number(returning)}%,0,0)` }],
    ]
    const task = { resolve, animations: [], timers: [], complete: false }
    running = task
    const finish = success => {
      if (running !== task || task.complete) return
      task.complete = true
      for (const timer of task.timers) cancel(timer)
      resolve(success && current(link))
    }
    try {
      const pending = [link.source, link.target].map((endpoint, index) => {
        const animation = animate(endpoint_node(endpoint), frames[index], { duration, easing: returning ? STACK_SURFACE_MOTION.exit_easing : STACK_SURFACE_MOTION.enter_easing, fill: 'both' })
        if (!animation) throw new Error('Animation is unavailable')
        task.animations.push(animation)
        return animation.finished?.then ? animation.finished : new Promise(done => { task.timers.push(schedule(done, duration)) })
      })
      Promise.all(pending).then(() => finish(true), () => finish(false))
      arm_deadline(link)
    } catch { finish(false) }
  })
  const capture_endpoint = endpoint => {
    const page = pages().at(-1), url = canonical_url(page_path(page)), identity = identity_for(endpoint)
    if (!page || !stack_surface_source(url) || !same_identity(identity, identity)) return null
    const existing = endpoints.get(endpoint)
    if (existing && !page_matches(page, existing)) return existing
    const record = { page: page_identity(page), url, identity: { ...identity } }
    endpoints.set(endpoint, record)
    return record
  }
  const register = endpoint => {
    if (!endpoints.has(endpoint)) { endpoints.set(endpoint, null); capture_endpoint(endpoint) }
    return () => {
      const returning_target = active?.target === endpoint && active.phase === 'back-dispatched'
      if (active && (active.source === endpoint || active.target === endpoint) && !returning_target) abort('page-unmounted')
      endpoints.delete(endpoint); scrolls.delete(endpoint)
      links = links.filter(link => link.source !== endpoint && link.target !== endpoint)
      if (last && !links.includes(last)) last = links.at(-1) || null
      publish()
    }
  }
  const forward = async (endpoint, url, dispatch) => {
    if (active) return false
    if (typeof dispatch !== 'function') return false
    prune()
    const source_record = endpoints.get(endpoint) || capture_endpoint(endpoint), destination = canonical_url(url)
    if (!source_record || !page_matches(pages().at(-1), source_record) || !record_valid(endpoint, source_record) || !stack_surface_edge(source_record.url, url) || hidden() || !available() || !measure(endpoint)) { last_issue = 'source-unavailable'; publish(); return dispatch() }
    const identity = identity_for(endpoint)
    remember_scroll(endpoint, source_record)
    const link = active = { token: ++generation, source: endpoint, source_record, target: null, target_record: null, expected_url: destination, identity: { ...identity }, geometry: measure(endpoint), reduced: !!reduced(), phase: 'forward-pending', direction: 'forward' }
    link.cancellation = new Promise(resolve => { link.cancelled = resolve })
    link.completion = new Promise(resolve => { link.completed = resolve })
    last_issue = ''; publish(); arm_deadline(link)
    try {
      await next_tick()
      if (!current(link)) return false
      restore_all()
      if (!record_valid(endpoint, source_record) || !endpoint_node(endpoint)?.isConnected) return fail('source-changed')
      const result = await Promise.race([Promise.resolve().then(dispatch), link.cancellation])
      if (result === false) { if (active === link) abort('navigation-cancelled'); return false }
      if (!await Promise.race([link.completion, link.cancellation])) return false
      return result
    } catch (error) { if (active === link) abort('navigation-failed'); throw error }
  }
  const enter = endpoint => {
    const record = capture_endpoint(endpoint), link = active
    if (link?.phase === 'back-dispatched') reconcile_return(link)
    if (link?.target === endpoint && ['forward-ready', 'forward-attaching', 'forward-running'].includes(link.phase)) return true
    if (!link || link.phase !== 'forward-pending') return links.some(item => item.target === endpoint && link_valid(item))
    if (link.source === endpoint) return false
    if (!current(link) || !record || !same_identity(identity_for(endpoint), link.identity) || !target_valid(link) || record.url !== link.expected_url || !page_matches(pages().at(-1), record)) return fail('target-mismatch')
    link.target = endpoint; link.target_record = record; set_phase(link, 'forward-ready')
    return true
  }
  const attach = async endpoint => {
    const link = active
    if (!link || link.target !== endpoint || link.phase !== 'forward-ready') return false
    set_phase(link, 'forward-attaching')
    await next_tick()
    if (!current(link)) return false
    restore_all()
    if (!target_valid(link) || !same_identity(identity_for(endpoint), link.identity) || !measure(endpoint) || !measure(link.source)) return fail('target-unmeasurable')
    remember_scroll(endpoint, link.target_record)
    set_phase(link, 'forward-running')
    if (!await play(link, 'forward')) { if (active === link) abort('animation-cancelled'); return false }
    if (!current(link)) return false
    stop_deadline(); links.push(link); last = link; set_phase(link, 'settled')
    await next_tick()
    if (!current(link)) return false
    restore_all(); release_animation(); active = null; release_current_scroll(); publish(); link.completed(true)
    return true
  }
  const back = async (endpoint, dispatch) => {
    if (active) return false
    prune()
    const link = links.findLast(item => item.target === endpoint && page_matches(pages().at(-1), item.target_record))
    if (!link || typeof dispatch !== 'function') return null
    if (hidden() || !available() || !link_valid(link) || !target_valid(link)) return null
    remember_scroll(endpoint, link.target_record)
    link.token = ++generation; link.phase = 'back-ready'; link.direction = 'back'; link.reduced = !!reduced(); active = link; last_issue = ''
    link.cancellation = new Promise(resolve => { link.cancelled = resolve })
    link.arrival = new Promise(resolve => { link.arrived = resolve })
    publish(); arm_deadline(link)
    await next_tick()
    if (!current(link)) return false
    restore_all()
    if (!measure(endpoint) || !measure(link.source) || !target_valid(link)) { abort('return-unmeasurable'); return null }
    set_phase(link, 'back-running')
    if (!await play(link, 'back')) { if (active === link) abort('animation-cancelled'); return false }
    if (!current(link) || !target_valid(link)) { if (active === link) abort('return-changed'); return false }
    set_phase(link, 'back-dispatched'); arm_deadline(link, 'return-arrival-timeout')
    try {
      const result = await Promise.race([Promise.resolve().then(dispatch), link.cancellation])
      if (result === false) { if (active === link) abort('navigation-cancelled'); return false }
      await next_tick()
      if (!current(link)) return false
      reconcile_return(link)
      if (!await Promise.race([link.arrival, link.cancellation]) || !current(link)) return false
      if (!page_matches(pages().at(-1), link.source_record)) { abort('return-not-arrived'); return false }
      stop_deadline(); links = links.filter(item => item !== link); last = links.at(-1) || null; set_phase(link, 'settled')
      await next_tick()
      if (!current(link)) return false
      restore_all(); release_animation(); active = null; prune(); release_current_scroll(); publish()
      return result
    } catch (error) { if (active === link) abort('navigation-failed'); throw error }
  }
  const route_changed = () => {
    restore_after_flush()
    const link = active
    if (hidden()) { clear('background'); return false }
    if (!link) { prune(); publish(); return true }
    if (link.phase === 'settled' && link.direction === 'back' && page_matches(pages().at(-1), link.source_record)) return true
    if (link.phase === 'back-dispatched' && reconcile_return(link)) return true
    if (!record_valid(link.source, link.source_record)) return fail('route-changed')
    if (link.phase === 'forward-pending' && page_matches(pages().at(-1), link.source_record)) return true
    if (target_valid(link)) return true
    return fail('route-changed')
  }
  const identity_changed = endpoint => {
    const record = endpoints.get(endpoint), identity = identity_for(endpoint)
    if (!record || same_identity(record.identity, identity)) return
    clear('identity-changed'); scrolls.delete(endpoint)
    endpoints.set(endpoint, { ...record, identity: identity ? { ...identity } : null })
  }
  return {
    strategy: 'stack', presentation, identity_keys: Object.freeze(['auth_context']),
    register, enter, attach, forward, back, clear, route_changed, identity_changed,
    managed: endpoint => !!active && [active.source, active.target].includes(endpoint) || links.some(link => link.target === endpoint && link_valid(link)),
    page_route: endpoint => endpoints.get(endpoint)?.url || '',
    get current() { return state() },
    subscribe(listener) { listeners.add(listener); listener(state()); return () => listeners.delete(listener) },
  }
}

export const stack_surface = create_stack_surface()
export const clear_stack_surface = reason => stack_surface.clear(reason)
