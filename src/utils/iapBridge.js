const callback_timeout_ms = 8000
const pending_requests = new Map()

export const request_purchase = (package_id) => new Promise((resolve) => {
  const request_id = `iap_${Date.now()}`
  const timer = setTimeout(() => {
    pending_requests.delete(request_id)
    resolve({ status: 'timeout', package_id })
  }, callback_timeout_ms)
  pending_requests.set(request_id, { package_id, timer, resolve })
  const handler = typeof window !== 'undefined' ? window.webkit?.messageHandlers?.CimoaPurchase : null
  if (handler) handler.postMessage({ request_id, package_id })
})

export const resolve_purchase = (request_id, result) => {
  const request = pending_requests.get(request_id)
  if (!request) return false
  clearTimeout(request.timer)
  pending_requests.delete(request_id)
  request.resolve({ ...result, package_id: request.package_id })
  return true
}

export { callback_timeout_ms }
