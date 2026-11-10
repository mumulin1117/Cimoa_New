import { MAIN_TABS, NAVIGATION, route_path } from '../config/navigation.js'
import { clear_toast } from './toast.js'
import { auth_message } from './authFeedback.js'
import { run_tab_motion, clear_tab_motion } from './tabMotion.js'
export const current_route = () => {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  return route_path(pages.at(-1)?.route || '')
}
export const route_depth = () => typeof getCurrentPages === 'function' ? getCurrentPages().length : 0
const location_key = value => {
  const url = new URL(value || '/', 'https://cimoa.invalid')
  url.searchParams.sort()
  return `${route_path(url.pathname)}${url.search}`
}
const page_snapshot = page => ({ page, id: page.$page?.id ?? page.$basePage?.id, location: location_key(page.$page?.fullPath || page.$basePage?.fullPath || page.route) })
const platform_navigation = (method, options) => {
  if (method === 'navigateTo') return uni.navigateTo(options)
  if (method === 'navigateBack') return uni.navigateBack(options)
  if (method === 'redirectTo') return uni.redirectTo(options)
  if (method === 'reLaunch') return uni.reLaunch(options)
  throw new Error('This page couldn’t be opened. Please try again.')
}
export function create_route_controller({
  api = platform_navigation,
  get_pages = () => typeof getCurrentPages === 'function' ? getCurrentPages() : [],
  schedule = setTimeout,
  cancel = clearTimeout,
  on_success = clear_toast,
  timeout_ms = NAVIGATION.callback_timeout_ms,
} = {}) {
  let pending = null
  const snapshot = () => { try { return get_pages().map(page_snapshot) } catch { return [] } }
  const same_page = (a, b) => a && b && (a.id != null && b.id != null ? a.id === b.id : a.page === b.page)
  const arrived = task => {
    const pages = snapshot(), last = pages.at(-1), source = task.before.at(-1)
    if (!last || !task.target || last.location !== task.target.location) return false
    if (task.method === 'navigateBack') return pages.length === task.before.length - task.delta && same_page(last, task.target)
    if (same_page(last, source)) return false
    return task.method === 'reLaunch' ? pages.length === 1 : task.method === 'navigateTo' ? pages.length === task.before.length + 1 : pages.length === task.before.length
  }
  const finish = (task, error, value) => {
    if (pending !== task) return false
    pending = null; cancel(task.timer)
    if (error) task.reject(error)
    else {
      // A presentation subscriber must never strand a completed navigation.
      try { on_success() } catch { /* Navigation has already succeeded. */ }
      task.resolve(value)
    }
    return true
  }
  const reconcile = () => pending && arrived(pending) ? finish(pending, null, { arrived: true }) : false
  const invoke = (method, options = {}) => {
    reconcile()
    const key = JSON.stringify([method, options])
    if (pending) return pending.key === key ? pending.promise : Promise.reject(new Error('Navigation is already in progress.'))
    const before = snapshot(), delta = Number(options.delta ?? 1)
    const target = method === 'navigateBack' ? before.at(-1 - delta) : { location: location_key(options.url) }
    const task = { key, method, before, delta, target }
    task.promise = new Promise((resolve, reject) => { task.resolve = resolve; task.reject = reject })
    pending = task
    const fail = error => finish(task, new Error(auth_message(error?.errMsg || error?.message, 'This page couldn’t be opened. Please try again.')))
    task.timer = schedule(() => {
      if (pending !== task) return
      if (!reconcile()) finish(task, new Error('This page couldn’t be opened. Please try again.'))
    }, timeout_ms)
    try {
      const result = api(method, {
        ...options, animationType: 'none', animationDuration: 0,
        success: value => finish(task, null, value), fail,
        complete: value => {
          if (pending !== task) return
          if (/:fail\b/.test(value?.errMsg || '')) fail(value)
          else if (/:ok\b/.test(value?.errMsg || '')) finish(task, null, value)
          else reconcile()
        },
      })
      if (result && typeof result.then === 'function') result.then(value => finish(task, null, value), fail)
    } catch (error) { fail(error) }
    return task.promise
  }
  return { invoke, reconcile }
}
const navigation = create_route_controller()
const invoke = navigation.invoke
// Called by mounted/shown page frames; the controller still verifies the actual
// complete route, entity query, page identity and stack, not a guessed timer.
export const notify_route_ready = navigation.reconcile
export const push_route = (url) => { clear_tab_motion(); return invoke('navigateTo', { url }) }
export const replace_route = (url) => {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [], last = pages.at(-1)
  return last && page_snapshot(last).location === location_key(url) ? Promise.resolve({ unchanged: true }) : invoke('redirectTo', { url })
}
export const relaunch_route = (url) => { clear_tab_motion(); return invoke('reLaunch', { url }) }
export const back_route = (delta = 1) => { clear_tab_motion(); return invoke('navigateBack', { delta }) }
export const switch_tab_route = (url) => MAIN_TABS.some((tab) => tab.path === route_path(url)) ? run_tab_motion(current_route(), url, () => replace_route(url)) : Promise.reject(new Error('This page is unavailable. Please return and try another option.'))
export const route_query = (options = {}) => options
