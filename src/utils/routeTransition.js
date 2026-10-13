import { MAIN_TABS, route_path } from '../config/navigation.js'
export const current_route = () => {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  return route_path(pages.at(-1)?.route || '')
}
export const route_depth = () => typeof getCurrentPages === 'function' ? getCurrentPages().length : 0
let navigating = false
const invoke = async (method, options = {}) => {
  if (navigating) throw new Error('Navigation is already in progress.')
  navigating = true
  try {
    return await new Promise((resolve, reject) => {
      const api = { navigateTo: uni.navigateTo, navigateBack: uni.navigateBack, redirectTo: uni.redirectTo, reLaunch: uni.reLaunch }
      api[method]({ ...options, animationType: 'none', animationDuration: 0, success: resolve, fail: (error) => reject(new Error(error.errMsg || 'This page could not be opened.')) })
    })
  } finally { navigating = false }
}
export const push_route = (url) => invoke('navigateTo', { url })
export const replace_route = (url) => current_route() === route_path(url) ? Promise.resolve({ unchanged: true }) : invoke('redirectTo', { url })
export const relaunch_route = (url) => invoke('reLaunch', { url })
export const back_route = (delta = 1) => invoke('navigateBack', { delta })
export const switch_tab_route = (url) => MAIN_TABS.some((tab) => tab.path === route_path(url)) ? replace_route(url) : Promise.reject(new Error('Unknown main tab.'))
export const route_query = (options = {}) => options
