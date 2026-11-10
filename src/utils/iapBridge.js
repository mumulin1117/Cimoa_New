import { host_request } from './hostBridge.js'

const callback_timeout_ms = 8000
const keys = ['request_id', 'package_id', 'owner_user_id', 'product_id']
const same_purchase = (a, b) => keys.every(key => a[key] === b[key])
const valid_payload = payload => keys.every(key => typeof payload?.[key] === 'string' && payload[key].length > 0 && payload[key].length < 256)
const final_statuses = ['success', 'failure', 'cancelled', 'timeout']
export function create_purchase_bridge({ timers = globalThis, clock = Date.now, send = payload => host_request('startPurchase', payload) } = {}) {
  const requests = new Map(), listeners = new Set()
  const publish = result => { for (const listener of listeners) { try { listener({ ...result }) } catch {} } }
  const settle = (entry, result) => {
    timers.clearTimeout(entry.timer); entry.timer = null; entry.result = result
    entry.resolve?.(result); entry.resolve = null; entry.promise = null; publish(result)
  }
  const accept = (entry, result) => {
    entry.accepted = true; timers.clearTimeout(entry.timer); entry.timer = null
    publish({ ...entry.payload, ...result, received_at: clock() })
  }
  const register = (payload, deadline_at, accepted = false) => {
    if (!valid_payload(payload)) return null
    let entry = requests.get(payload.request_id)
    if (entry && !same_purchase(entry.payload, payload)) return null
    if (!entry) {
      entry = { payload: { ...payload }, deadline_at: Number.isFinite(deadline_at) ? Math.min(deadline_at, clock() + callback_timeout_ms) : clock() + callback_timeout_ms, dispatched: false, accepted, result: null, promise: null, timer: null, resolve: null }
      requests.set(payload.request_id, entry)
    } else if (accepted && !entry.accepted && entry.result?.status === 'timeout') { entry.result = null; entry.accepted = true }
    else if (accepted) entry.accepted = true
    if (entry.accepted) { timers.clearTimeout(entry.timer); entry.timer = null }
    return entry
  }
  const receive = (request_id, result) => {
    if (!result || !['accepted', 'pending', ...final_statuses].includes(result.status)) return false
    let entry = requests.get(request_id)
    if (!entry) {
      if (!valid_payload({ ...result, request_id })) return false
      entry = register({ ...result, request_id }, undefined, true)
    }
    if (!same_purchase(entry.payload, { ...result, request_id })) return false
    if (['accepted', 'pending'].includes(result.status)) {
      if (entry.result && entry.result.status !== 'timeout') return false
      entry.result = null; accept(entry, result); return true
    }
    if (entry.result && !(entry.result.status === 'timeout' && result.status === 'success')) return false
    // Eight seconds bounds acknowledgement, not Apple's payment sheet or a
    // deferred approval. Even a late transaction reaches native verification.
    if (!entry.accepted && clock() >= entry.deadline_at && result.status !== 'success') { settle(entry, { ...entry.payload, status: 'timeout' }); return false }
    settle(entry, { ...result, request_id, received_at: clock() }); return true
  }
  const dispatch_once = entry => {
    if (entry.result || entry.dispatched || entry.accepted || clock() >= entry.deadline_at) return
    entry.dispatched = true
    try {
      const response = send(entry.payload)
      if (response?.then) response.then(result => { if (result && typeof result === 'object') receive(entry.payload.request_id, result) }, () => { /* Missing hosts keep the full acknowledgement window. */ })
    } catch { /* Missing handlers never mean success or a cancelled Apple payment. */ }
  }
  return {
    request(payload, { deadline_at, dispatch = true, accepted = false } = {}) {
      const entry = register(payload, deadline_at, accepted)
      if (!entry) return Promise.resolve({ ...payload, status: 'failure', message: 'This purchase belongs to a different request.' })
      if (entry.result) return Promise.resolve(entry.result)
      if (entry.promise) return entry.promise
      const promise = new Promise(resolve => { entry.resolve = resolve }); entry.promise = promise
      if (!entry.accepted) { timers.clearTimeout(entry.timer); entry.timer = timers.setTimeout(() => settle(entry, { ...entry.payload, status: 'timeout' }), Math.max(0, entry.deadline_at - clock())) }
      if (dispatch) dispatch_once(entry)
      return promise
    },
    dispatch(payload, { deadline_at, accepted = false } = {}) { const entry = register(payload, deadline_at, accepted); if (!entry) return false; dispatch_once(entry); return true },
    resolve: receive,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    cancel(request_id) {
      const entry = requests.get(request_id)
      if (!entry || entry.result || entry.accepted || entry.dispatched) return false
      settle(entry, { ...entry.payload, status: 'cancelled' }); return true
    },
    suspend(request_id) {
      const entry = requests.get(request_id)
      if (!entry || entry.result) return
      // Only the page observer is suspended. Application recovery continues to
      // own acknowledgement and any accepted StoreKit transaction.
      entry.resolve?.({ ...entry.payload, status: 'interrupted' }); entry.resolve = null; entry.promise = null
    },
    forget(request_id) {
      const entry = requests.get(request_id)
      if (!entry || entry.accepted && !entry.result) return false
      timers.clearTimeout(entry.timer); entry.resolve?.({ ...entry.payload, status: 'interrupted' }); requests.delete(request_id); return true
    },
  }
}
const bridge = create_purchase_bridge()
export const request_purchase = (payload, options) => bridge.request(typeof payload === 'string' ? { request_id: `iap_${globalThis.crypto?.randomUUID?.() || Date.now()}`, package_id: payload, owner_user_id: null, product_id: null } : payload, options)
export const watch_purchase = (request, pack, dispatch = false) => {
  const payload = { request_id: request.request_id, package_id: request.package_id, owner_user_id: request.owner_user_id, product_id: request.product_id || pack.product_id }
  const options = { deadline_at: request.created_at + callback_timeout_ms, dispatch: false, accepted: !!request.accepted_at || ['accepted', 'pending', 'interrupted', 'verification_pending'].includes(request.phase) }
  return dispatch ? bridge.dispatch(payload, options) : bridge.request(payload, options)
}
export const resolve_purchase = bridge.resolve
export const cancel_purchase_request = bridge.cancel
export const suspend_purchase_request = bridge.suspend
export const forget_purchase_request = bridge.forget
export const subscribe_purchase_results = bridge.subscribe
export function install_purchase_bridge() {
  if (typeof window !== 'undefined') window.CimoaPurchaseBridge = Object.freeze({ resolve: (request_id, result) => result && typeof result === 'object' ? bridge.resolve(request_id, result) : false })
}
export { callback_timeout_ms }
