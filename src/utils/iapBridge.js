const callback_timeout_ms = 8000
export function create_purchase_bridge({ timers = globalThis, send = (payload) => globalThis.window?.webkit?.messageHandlers?.CimoaPurchase?.postMessage(payload) } = {}) {
  const pending = new Map()
  return {
    request(payload) {
      if (pending.has(payload.request_id)) return pending.get(payload.request_id).promise
      let resolve
      const promise = new Promise((done) => { resolve = done })
      const timer = timers.setTimeout(() => { pending.delete(payload.request_id); resolve({ ...payload, status: 'timeout' }) }, callback_timeout_ms)
      pending.set(payload.request_id, { payload, timer, resolve, promise })
      try { send(payload) } catch { /* Keep the full callback deadline, including absent/broken handlers. */ }
      return promise
    },
    resolve(request_id, result) {
      const request = pending.get(request_id)
      if (!request || !['success', 'failure', 'cancelled'].includes(result.status)) return false
      if (['package_id', 'owner_user_id', 'product_id'].some((key) => result[key] !== request.payload[key])) return false
      timers.clearTimeout(request.timer); pending.delete(request_id)
      request.resolve({ ...result, request_id }); return true
    },
    cancel(request_id) {
      const request = pending.get(request_id)
      if (!request) return false
      timers.clearTimeout(request.timer); pending.delete(request_id); request.resolve({ ...request.payload, status: 'cancelled' }); return true
    },
  }
}
const bridge = create_purchase_bridge()
export const request_purchase = (payload) => bridge.request(typeof payload === 'string' ? { request_id: `iap_${globalThis.crypto?.randomUUID?.() || Date.now()}`, package_id: payload, owner_user_id: null, product_id: null } : payload)
export const resolve_purchase = bridge.resolve
export const cancel_purchase_request = bridge.cancel
export { callback_timeout_ms }
