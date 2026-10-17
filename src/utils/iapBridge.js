const callback_timeout_ms = 8000
const same_purchase = (a, b) => ['request_id', 'package_id', 'owner_user_id', 'product_id'].every(key => a[key] === b[key])
export function create_purchase_bridge({ timers = globalThis, clock = Date.now, send = payload => globalThis.window?.webkit?.messageHandlers?.CimoaPurchase?.postMessage(payload) } = {}) {
  const requests = new Map()
  const settle = (entry, result) => {
    timers.clearTimeout(entry.timer); entry.timer = null; entry.result = result
    entry.resolve?.(result); entry.resolve = null; entry.promise = null
  }
  const register = (payload, deadline_at) => {
    for (const [id, entry] of requests) if (!entry.promise && entry.deadline_at + callback_timeout_ms < clock()) requests.delete(id)
    let entry = requests.get(payload.request_id)
    if (entry && !same_purchase(entry.payload, payload)) return null
    if (!entry) {
      entry = { payload: { ...payload }, deadline_at: Number.isFinite(deadline_at) ? Math.min(deadline_at, clock() + callback_timeout_ms) : clock() + callback_timeout_ms, dispatched: false, result: null, promise: null, timer: null, resolve: null }
      requests.set(payload.request_id, entry)
    }
    return entry
  }
  const dispatch_once = entry => {
    if (!entry.result && !entry.dispatched && clock() < entry.deadline_at) {
      entry.dispatched = true
      try { send(entry.payload) } catch { /* Missing handlers never mean success. */ }
    }
  }
  return {
    request(payload, { deadline_at, dispatch = true } = {}) {
      const entry = register(payload, deadline_at)
      if (!entry) return Promise.resolve({ ...payload, status: 'failure', message: 'This purchase belongs to a different request.' })
      if (entry.result) return Promise.resolve(entry.result)
      if (entry.promise) return entry.promise
      const promise = new Promise(resolve => { entry.resolve = resolve })
      entry.promise = promise
      entry.timer = timers.setTimeout(() => settle(entry, { ...entry.payload, status: 'timeout' }), Math.max(0, entry.deadline_at - clock()))
      if (dispatch) dispatch_once(entry)
      return promise
    },
    dispatch(payload, { deadline_at } = {}) {
      const entry = register(payload, deadline_at)
      if (!entry) return false
      dispatch_once(entry); return true
    },
    resolve(request_id, result) {
      const entry = requests.get(request_id)
      if (!entry || entry.result || !['success', 'failure', 'cancelled'].includes(result.status) || !same_purchase(entry.payload, { ...result, request_id })) return false
      if (clock() >= entry.deadline_at) { settle(entry, { ...entry.payload, status: 'timeout' }); return false }
      settle(entry, { ...result, request_id, received_at: clock() }); return true
    },
    cancel(request_id) {
      const entry = requests.get(request_id)
      if (!entry || entry.result) return false
      settle(entry, { ...entry.payload, status: 'cancelled' }); return true
    },
    suspend(request_id) {
      const entry = requests.get(request_id)
      if (!entry || entry.result) return
      timers.clearTimeout(entry.timer); entry.timer = null
      entry.resolve?.({ ...entry.payload, status: 'interrupted' }); entry.resolve = null; entry.promise = null
    },
    forget(request_id) {
      const entry = requests.get(request_id)
      if (!entry) return
      timers.clearTimeout(entry.timer); entry.resolve?.({ ...entry.payload, status: 'interrupted' }); requests.delete(request_id)
    },
  }
}
const bridge = create_purchase_bridge()
export const request_purchase = (payload, options) => bridge.request(typeof payload === 'string' ? { request_id: `iap_${globalThis.crypto?.randomUUID?.() || Date.now()}`, package_id: payload, owner_user_id: null, product_id: null } : payload, options)
// The persisted request owns one full 8000ms window. Restoring a document does
// not renew that window or send a second native purchase message.
export const watch_purchase = (request, pack, dispatch = false) => {
  const payload = { request_id: request.request_id, package_id: request.package_id, owner_user_id: request.owner_user_id, product_id: pack.product_id }, options = { deadline_at: request.created_at + callback_timeout_ms, dispatch: false }
  // Dispatch has no observer/timer until Purchasing owns the visible wait.
  return dispatch ? bridge.dispatch(payload, options) : bridge.request(payload, options)
}
export const resolve_purchase = bridge.resolve
export const cancel_purchase_request = bridge.cancel
export const suspend_purchase_request = bridge.suspend
export const forget_purchase_request = bridge.forget
export function install_purchase_bridge() {
  if (typeof window !== 'undefined') window.CimoaPurchaseBridge = Object.freeze({ resolve: (request_id, result) => result && typeof result === 'object' ? bridge.resolve(request_id, result) : false })
}
export { callback_timeout_ms }
