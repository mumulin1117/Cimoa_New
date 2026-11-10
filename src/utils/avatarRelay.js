import { MOTION, NAVIGATION } from '../config/navigation.js'

const HOME = 'pages/home/index', CHAT = 'pages/messages/chat', PROFILE = 'pages/discover/profile'
const dom_node = value => value?.$el || value
const finite_rect = rect => rect && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0
const same_identity = (source, target) => !!source && ['user_id', 'conversation_id', 'auth_context'].every(key => source[key] && source[key] === target?.[key])
const page_identity = page => page && ({ page, id: page.$page?.id ?? page.$basePage?.id })
const same_page = (a, b) => !!a && !!b && (a.id != null && b.id != null ? a.id === b.id : a.page === b.page)
const page_location = page => {
  try { return new URL(page?.$page?.fullPath || page?.$basePage?.fullPath || page?.route || '/', 'https://cimoa.invalid') } catch { return null }
}
const is_chat = (url, id) => url?.pathname.replace(/^\//, '') === CHAT && url.searchParams.get('conversation_id') === id
// Keep the uni global read at module scope, matching routeTransition's adapter.
// uni's H5 injection does not rewrite a reference used only in default params.
const current_pages = () => typeof getCurrentPages === 'function' ? getCurrentPages() : []

// Capture only an image already displayed by UserAvatar. Never resolve media or
// await decode before navigation, and never retain an unowned Blob URL lease.
export function measure_avatar(element, { final_position = false, window: win = globalThis.window } = {}) {
  const root = dom_node(element)
  const node = root?.matches?.('.user-avatar') ? root : root?.querySelector?.('.user-avatar') || root
  const image = node?.matches?.('img') ? node : node?.querySelector?.('img')
  if (!node?.isConnected || !image?.complete || !(image.naturalWidth > 0) || !(image.naturalHeight > 0)) return null
  const raw = node.getBoundingClientRect?.(), url = image.currentSrc || image.src
  if (!finite_rect(raw) || !url || /^(?:indexeddb:|javascript:|data:)/i.test(url)) return null
  const bounds = { left: raw.left, top: raw.top, width: raw.width, height: raw.height }
  if (final_position) {
    // The real header is mounted inside cRise. Remove only that presentation
    // translation so the relay lands at the header's resting position.
    const transition = node.closest?.('.page-transition')
    const transform = transition && win?.getComputedStyle?.(transition)?.transform
    const match = transform?.match(/^matrix\(([^)]+)\)$/)
    if (match) {
      const values = match[1].split(',').map(Number)
      if (values.length === 6 && values.every(Number.isFinite)) { bounds.left -= values[4]; bounds.top -= values[5] }
    }
  }
  const width = win?.innerWidth, height = win?.innerHeight
  if (Number.isFinite(width) && (bounds.left < 0 || bounds.left + bounds.width > width)) return null
  if (Number.isFinite(height) && (bounds.top < 0 || bounds.top + bounds.height > height)) return null
  return { node, image, url, bounds }
}

export function create_avatar_relay({ clock = Date.now, schedule = setTimeout, cancel = clearTimeout, measure = measure_avatar, get_pages = current_pages, reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true, hidden = () => globalThis.document?.hidden === true } = {}) {
  let source = null, cue = null, timer = null, generation = 0, concealed = null
  const listeners = new Set()
  const publish = () => listeners.forEach(listener => { try { listener(cue)?.catch?.(() => {}) } catch { /* Optional presentation must never prevent navigation. */ } })
  const snapshot_for = (element, options) => { try { return measure(element, options) } catch { return null } }
  const pages = () => { try { return get_pages() } catch { return [] } }
  const source_alive = () => !!source && pages().some(page => same_page(page_identity(page), source.page))
  const restore_target = () => {
    if (!concealed) return
    const { node, value, priority } = concealed; concealed = null
    if (node.style.getPropertyValue('visibility') !== 'hidden' || node.style.getPropertyPriority('visibility') !== 'important') return
    if (value) node.style.setProperty('visibility', value, priority)
    else node.style.removeProperty('visibility')
  }
  const conceal_target = target => {
    const node = target.node
    if (!node?.style?.getPropertyValue || !node.style.setProperty) return
    concealed = { node, value: node.style.getPropertyValue('visibility'), priority: node.style.getPropertyPriority('visibility') }
    node.style.setProperty('visibility', 'hidden', 'important')
  }
  const clear = () => { generation++; cancel(timer); timer = null; restore_target(); source = null; cue = null; publish() }
  const stop_animation = () => { cancel(timer); timer = null; restore_target(); if (cue) { cue = null; publish() } }
  const capture = input => {
    clear()
    const page = pages().at(-1)
    if (!input?.user_id || !input.conversation_id || !input.auth_context || !input.avatar_src || page_location(page)?.pathname.replace(/^\//, '') !== HOME || hidden()) return false
    const snapshot = snapshot_for(input.element)
    if (!snapshot) return false
    source = { user_id: input.user_id, conversation_id: input.conversation_id, auth_context: input.auth_context, avatar_src: input.avatar_src, snapshot, page: page_identity(page), captured_at: clock(), stage: 'pending', target: null }
    const token = generation
    timer = schedule(() => { if (generation === token && source?.stage === 'pending') clear() }, NAVIGATION.callback_timeout_ms)
    return true
  }
  const play = (from, to, direction, duration) => {
    stop_animation()
    if (!(duration > 0) || hidden()) return false
    const token = generation
    const started_at = clock()
    conceal_target(to)
    cue = Object.freeze({ id: token, direction, url: source.snapshot.url, from: from.bounds, to: to.bounds, started_at, duration, reduced: reduced() })
    publish()
    timer = schedule(() => {
      if (generation !== token) return
      restore_target(); cue = null; timer = null; publish()
      if (direction === 'back') source = null
    }, duration)
    return true
  }
  const arrive = input => {
    // uni-app legitimately detaches cached Home DOM while chat is active. Its
    // real page-stack identity, not isConnected, owns this visual association.
    if (!same_identity(source, input) || input.avatar_src !== source?.avatar_src || !source_alive() || !is_chat(page_location(pages().at(-1)), source.conversation_id) || hidden()) { clear(); return false }
    const target = snapshot_for(input.element, { final_position: true })
    if (!target || target.url !== source.snapshot.url) return false
    source.target = target
    if (source.stage !== 'pending') { source.stage = 'chat'; return false }
    source.stage = 'chat'
    const elapsed = Math.max(0, clock() - (input.entered_at ?? clock()))
    return play(source.snapshot, target, 'forward', Math.max(0, MOTION.avatar_relay - elapsed))
  }
  const prepare_return = input => {
    if (!same_identity(source, input) || !source_alive()) return false
    const target = snapshot_for(input.element, { final_position: true })
    if (!target || target.url !== source.snapshot.url) { clear(); return false }
    stop_animation(); source.target = target; source.stage = 'returning'
    return true
  }
  const resume_home = ({ auth_context, resolve } = {}) => {
    if (!source) return false
    if (source.return_started) return false
    if (!source_alive() || !same_page(page_identity(pages().at(-1)), source.page)) { clear(); return false }
    if (source.auth_context !== auth_context || !['chat', 'returning'].includes(source.stage) || !source.target) { clear(); return false }
    let element
    try { element = resolve?.(source.user_id) } catch { clear(); return false }
    const target = snapshot_for(element, { final_position: true })
    const destination = target?.node.closest?.('[data-target]')?.getAttribute('data-target')
    let destination_url
    try { destination_url = destination && new URL(destination, 'https://cimoa.invalid') } catch { clear(); return false }
    if (!target || target.url !== source.snapshot.url || destination && !is_chat(destination_url, source.conversation_id)) { clear(); return false }
    source.stage = 'returning'; source.return_started = true
    return play(source.target, target, 'back', MOTION.back)
  }
  const route_changed = location => {
    if (!source) return false
    if (!source_alive()) { clear(); return false }
    let url
    try { url = new URL(String(location || '').replace(/^#\/?/, '/'), 'https://cimoa.invalid') } catch { clear(); return false }
    const path = url.pathname.replace(/^\//, '')
    if (path === CHAT && url.searchParams.get('conversation_id') === source.conversation_id) return true
    if (path === PROFILE && url.searchParams.get('user_id') === source.user_id && url.searchParams.get('origin_conversation_id') === source.conversation_id) { stop_animation(); return true }
    if (path === HOME) return true
    clear(); return false
  }
  return { capture, arrive, prepare_return, resume_home, route_changed, clear, get pending() { return !!source }, get current() { return cue }, subscribe(listener) { listeners.add(listener); try { listener(cue)?.catch?.(() => {}) } catch { /* Optional presentation subscriber. */ } return () => listeners.delete(listener) } }
}

export const avatar_relay = create_avatar_relay()
export const capture_avatar_relay = input => avatar_relay.capture(input)
export const land_chat_avatar_relay = input => avatar_relay.arrive(input)
export const prepare_avatar_relay_return = input => avatar_relay.prepare_return(input)
export const resume_home_avatar_relay = input => avatar_relay.resume_home(input)
export const clear_avatar_relay = () => avatar_relay.clear()
