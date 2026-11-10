import { auth_message } from './authFeedback.js'

const methods = new Set(['getEnvironment', 'getSafeArea', 'openSettings', 'getNotificationPermission', 'getPermissions', 'requestNotifications', 'finishLaunch', 'getPurchaseProducts', 'startPurchase', 'getPendingPurchases', 'getPurchaseStatus', 'verifyPurchase', 'acknowledgePurchase', 'abandonInterruptedPurchase', 'setLanguage'])
export function create_host_bridge({ timers = globalThis, send = payload => globalThis.window?.webkit?.messageHandlers?.CimoaHost?.postMessage(payload), timeout_ms = 8000 } = {}) {
  let sequence = 0
  return {
    request(method, params) {
      if (!methods.has(method)) return Promise.reject(new Error('Unsupported system request. Please return and try another option.'))
      if (params !== undefined && (!params || typeof params !== 'object' || Array.isArray(params))) return Promise.reject(new Error('This system request is incomplete. Please try again.'))
      const request_id = `host_${Date.now()}_${++sequence}`
      let cancel_request
      const pending = new Promise((resolve, reject) => {
        let settled = false
        const finish = (success, result) => {
          if (settled) return
          settled = true; timers.clearTimeout(timer)
          if (success) resolve(result); else reject(result)
        }
        const timer = timers.setTimeout(() => finish(false, new Error('Your device did not respond. Please try again.')), method === 'requestNotifications' ? Math.max(timeout_ms, 60000) : timeout_ms)
        cancel_request = () => finish(false, new Error('The system request was cancelled.'))
        try {
          const response = send({ version: 1, request_id, method, ...(params !== undefined ? { params } : {}) })
          if (!response?.then) throw new Error('This device feature is currently unavailable.')
          response.then(result => {
            if (result?.version !== 1 || result.request_id !== request_id || result.success !== true || !result.result || typeof result.result !== 'object') throw new Error('Invalid system response. Please try again.')
            finish(true, result.result)
          }).catch(error => finish(false, new Error(auth_message(error?.message, 'The system request couldn’t be completed. Please try again.'))))
        } catch (error) { finish(false, new Error(auth_message(error.message, 'The system request couldn’t be completed. Please try again.'))) }
      })
      Object.defineProperty(pending, 'cancel', { value: () => cancel_request?.() })
      return pending
    },
  }
}
const host_bridge = create_host_bridge()
export const host_request = (method, params) => host_bridge.request(method, params)
export function install_host_bridge() {
  if (typeof window !== 'undefined') window.CimoaNativeBridge = Object.freeze({ request: host_request })
}
