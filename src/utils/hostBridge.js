const methods = new Set(['getEnvironment', 'getSafeArea', 'openSettings', 'getNotificationPermission', 'getPermissions', 'requestNotifications'])
export function create_host_bridge({ timers = globalThis, send = payload => globalThis.window?.webkit?.messageHandlers?.CimoaHost?.postMessage(payload), timeout_ms = 8000 } = {}) {
  let sequence = 0
  return {
    request(method) {
      if (!methods.has(method)) return Promise.reject(new Error('Unsupported native bridge method.'))
      const request_id = `host_${Date.now()}_${++sequence}`
      return new Promise((resolve, reject) => {
        const timer = timers.setTimeout(() => reject(new Error('The native host did not respond.')), method === 'requestNotifications' ? Math.max(timeout_ms, 60000) : timeout_ms)
        try {
          const response = send({ version: 1, request_id, method })
          if (!response?.then) throw new Error('The native host is unavailable in this environment.')
          response.then(result => {
            if (result?.version !== 1 || result.request_id !== request_id || result.success !== true || !result.result || typeof result.result !== 'object') throw new Error('Invalid native host response.')
            resolve(result.result)
          }).catch(error => reject(new Error(error?.message || 'The native request failed.'))).finally(() => timers.clearTimeout(timer))
        } catch (error) { timers.clearTimeout(timer); reject(error) }
      })
    },
  }
}
const host_bridge = create_host_bridge()
export function install_host_bridge() {
  if (typeof window !== 'undefined') window.CimoaNativeBridge = Object.freeze({ request: method => host_bridge.request(method) })
}
