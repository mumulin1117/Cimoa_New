import { host_request } from './hostBridge.js'
import { normalize_purchase_products } from '../stores/coinPackages.js'
import { subscribe_purchase_results } from './iapBridge.js'

const keys = ['request_id', 'package_id', 'owner_user_id', 'product_id']
const same_purchase = (a, b) => keys.every(key => typeof a?.[key] === 'string' && a[key] === b?.[key])
export const purchase_payload = (request, pack) => ({ request_id: request.request_id, owner_user_id: request.owner_user_id, package_id: request.package_id, product_id: request.product_id || pack?.product_id || '' })
export async function load_purchase_products(load = () => host_request('getPurchaseProducts', {})) {
  const result = await load()
  return normalize_purchase_products(Array.isArray(result) ? { products: result } : result)
}
export async function verify_native_purchase(result, host = host_request) {
  const receipt_id = result.receipt_id || result.transaction_id
  if (!receipt_id || typeof receipt_id !== 'string' || !keys.every(key => typeof result[key] === 'string' && !!result[key])) throw new Error('Purchase details are incomplete. Please reopen the coin store.')
  const verified = await host('verifyPurchase', { ...purchase_payload(result), receipt_id, transaction_id: receipt_id })
  if (verified?.verified !== true || !same_purchase(result, verified) || verified.receipt_id !== receipt_id || verified.transaction_id && verified.transaction_id !== receipt_id) throw new Error('Your purchase is awaiting confirmation. Please check again later.')
  return { ...verified, receipt_id, transaction_id: receipt_id }
}

const controllers = new WeakMap()
const inactive = () => ({ success: false, reason: 'cancelled' })
export function create_purchase_page_scope(is_account_current = () => true) {
  let active = true, generation = 0
  const current = (token = generation) => active && token === generation && is_account_current()
  return {
    capture: () => generation,
    is_current: current,
    guard: (token, action) => current(token) ? action() : inactive(),
    show() { active = true },
    hide() { active = false; generation++ },
  }
}
export const refresh_purchase_recovery = store => controllers.get(store)?.refresh() || Promise.resolve(inactive())
export const reconcile_purchase_result = (store, result) => controllers.get(store)?.process(result) || Promise.resolve(inactive())
export const abandon_interrupted_purchase = (store, request) => controllers.get(store)?.abandon(request) || Promise.resolve(inactive())

// One application controller, one write queue, no page-owned balance mutation.
// Stop/start invalidates stale results while leaving native transactions intact.
export function create_purchase_recovery({ store, run_with_loading, on_error = () => {}, host = host_request, subscribe = subscribe_purchase_results, clock = Date.now } = {}) {
  if (!store || typeof run_with_loading !== 'function') throw new Error('Purchase recovery requires the application store and its write-loading controller.')
  let running = false, epoch = 0, unsubscribe, refreshing, draining = false
  const queue = [], pending = new Map()
  const context = () => store.hydration_status === 'ready' && store.session.is_authenticated ? { owner: store.session.current_user_id, key: store.auth_context, epoch } : null
  const current = owner => running && owner && owner.epoch === epoch && context()?.key === owner.key && context()?.owner === owner.owner
  const report = (message, owner) => { if (current(owner)) on_error(message) }
  const key_for = result => `${epoch}:${result.owner_user_id}:${result.request_id}:${result.status}:${result.receipt_id || result.transaction_id || ''}:${result.recovery_state || ''}`
  const drain = async () => {
    if (draining) return
    draining = true
    try {
      while (queue.length) {
        const item = queue.shift(), { result, owner, resolve, key } = item
        let settled = inactive()
        try {
          if (current(owner) && result.owner_user_id === owner.owner) {
            const request = store.purchase_by_id(result.request_id)
            if (item.legacy_expire) {
              settled = await run_with_loading(scope => store.expire_unconfigured_purchase(result.request_id, { is_current: () => current(owner) && scope.is_current(), expected_context: owner.key }))
            } else if (item.release) {
              settled = await run_with_loading(async scope => {
                if (!current(owner) || !scope.is_current()) return inactive()
                const latest = store.purchase_by_id(result.request_id)
                if (latest?.status === 'success') return { success: true, repeated: true, data: { status: 'success' } }
                if (latest?.status !== 'pending' || latest.phase !== 'interrupted' || latest.can_abandon_interrupted !== true || queue.some(task => task.result.request_id === result.request_id && task.result.status === 'success')) return { success: false, reason: 'purchase_still_pending', message: 'This purchase is being checked. Please wait for the final result.' }
                const snapshot = await host('abandonInterruptedPurchase', purchase_payload(latest, store.coin_package_by_id(latest.package_id)))
                if (!current(owner) || !scope.is_current()) return inactive()
                if (!same_purchase(result, snapshot) || snapshot.recovery_state !== 'abandoned') return { success: false, reason: 'purchase_still_pending', message: 'This purchase could not be released. Please check again later.' }
                return store.note_purchase_state(result.request_id, { ...snapshot, status: 'pending' }, { is_current: () => current(owner) && scope.is_current(), expected_context: owner.key })
              })
              if (!settled.success && settled.reason !== 'cancelled') report(settled.message || 'This purchase could not be released. Please check again later.', owner)
            } else if (request?.status === 'success' && result.status !== 'success') settled = { success: true, repeated: true, data: { status: 'success' } }
            else if (result.status === 'success') {
              settled = await run_with_loading(scope => store.settle_purchase(result.request_id, { ...result, receipt_id: result.receipt_id || result.transaction_id }, { is_current: () => current(owner) && scope.is_current(), expected_context: owner.key, allow_recovery: true }))
              // Finish StoreKit only after the atomic ledger+request write. A
              // failed finish is retried from unfinished transactions next time.
              if (settled.success && current(owner)) {
                try { const ack = await host('acknowledgePurchase', { transaction_id: result.receipt_id || result.transaction_id, owner_user_id: owner.owner }); if (ack?.acknowledged !== true) throw new Error('Purchase acknowledgement failed') }
                catch { report('Your coins are available. Purchase confirmation will be checked again when you return.', owner) }
              } else if (!settled.success && settled.reason !== 'cancelled') report(settled.message || 'Your purchase is awaiting confirmation. Please check again later.', owner)
            } else if (request && ['pending', 'timeout'].includes(request.status)) {
              let snapshot = result
              if (['failure', 'cancelled'].includes(result.status)) {
                snapshot = await host('getPurchaseStatus', purchase_payload(request, store.coin_package_by_id(request.package_id)))
                if (!same_purchase(result, snapshot) || snapshot.status !== result.status) throw new Error('Your purchase is still being checked. Please return to the coin store later.')
                snapshot = { ...snapshot, native_final: true }
              }
              const terminal = ['failure', 'cancelled', 'timeout'].includes(snapshot.status)
              const recovery_state = snapshot.recovery_state || '', phase = recovery_state === 'interrupted' ? 'interrupted' : recovery_state === 'abandoned' ? 'abandoned' : snapshot.status === 'accepted' ? 'accepted' : 'pending'
              const unchanged = !terminal && request.status === 'pending' && request.phase === phase && request.recovery_state === recovery_state && request.can_abandon_interrupted === (snapshot.can_abandon_interrupted === true)
              settled = unchanged ? { success: true, repeated: true, data: { status: request.status } } : await run_with_loading(scope => terminal
                ? store.settle_purchase(request.request_id, snapshot, { is_current: () => current(owner) && scope.is_current(), expected_context: owner.key })
                : store.note_purchase_state(request.request_id, snapshot, { is_current: () => current(owner) && scope.is_current(), expected_context: owner.key }))
              if (!settled.success && settled.reason !== 'cancelled') report(settled.message || 'Your purchase is still being checked. Please try again later.', owner)
            }
          }
        } catch { report('Your purchase is still being checked. Please reopen the coin store to check again.', owner) }
        finally { pending.delete(key); resolve(settled) }
      }
    } finally { draining = false }
  }
  const enqueue = (result, owner, release = false, legacy_expire = false) => {
    const key = `${legacy_expire ? 'legacy:' : release ? 'release:' : ''}${key_for(result)}`
    if (pending.has(key)) return pending.get(key)
    const promise = new Promise(resolve => queue.push({ result: { ...result }, owner, resolve, key, release, legacy_expire }))
    pending.set(key, promise); drain(); return promise
  }
  const process = result => {
    const owner = context()
    if (!current(owner) || !result || result.owner_user_id !== owner.owner || !['accepted', 'pending', 'success', 'failure', 'cancelled', 'timeout'].includes(result.status) || !keys.every(key => typeof result[key] === 'string' && !!result[key])) return Promise.resolve(inactive())
    return enqueue(result, owner)
  }
  const refresh = () => {
    const owner = context()
    if (!current(owner)) return Promise.resolve(inactive())
    if (host === host_request && !globalThis.window?.webkit?.messageHandlers?.CimoaHost) return Promise.resolve({ success: false, reason: 'host_unavailable' })
    if (refreshing?.key === owner.key && refreshing.epoch === epoch) return refreshing.promise
    const promise = (async () => {
      try {
        // Read the durable request journal first. Scanning unfinished StoreKit
        // transactions may need the network and must not make an already
        // accepted purchase fall back to an expired H5 acknowledgement timer.
        const seen_statuses = new Map()
        const read_statuses = async () => {
          for (const request of store.current_purchase_requests.filter(row => ['pending', 'timeout'].includes(row.status))) {
            if (!current(owner)) return inactive()
            if (store.purchase_is_legacy_unconfigured(request.request_id)) {
              if (request.status === 'pending' && clock() - request.created_at >= 8000) await enqueue(purchase_payload(request), owner, false, true)
              continue
            }
            const payload = purchase_payload(request, store.coin_package_by_id(request.package_id)), status = await host('getPurchaseStatus', payload)
            if (!current(owner)) return inactive()
            if (!same_purchase(payload, status)) throw new Error('Invalid purchase status')
            const signature = JSON.stringify([status.status, status.recovery_state, status.receipt_id, status.transaction_id, status.can_abandon_interrupted])
            if (seen_statuses.get(request.request_id) === signature) continue
            seen_statuses.set(request.request_id, signature)
            if (status.status === 'unknown') {
              if (status.recovery_state === 'abandoned') { await process({ ...status, status: 'pending' }); continue }
              // Unknown is only a host-acknowledgement timeout when StoreKit
              // never accepted it, not a cancellation of an Apple payment.
              if (request.status === 'pending' && !request.accepted_at && (!request.phase || request.phase === 'awaiting_host') && clock() - request.created_at >= 8000) await process({ ...payload, status: 'timeout' })
            } else await process(status)
          }
        }
        await read_statuses()
        const result = await host('getPendingPurchases', { owner_user_id: owner.owner })
        if (!current(owner)) return inactive()
        if (!Array.isArray(result?.purchases)) throw new Error('Invalid pending purchases')
        for (const purchase of result.purchases) { if (!current(owner)) return inactive(); await process(purchase) }
        // Recovery may have changed a journal request from checking to an
        // interrupted/abandoned result without producing a paid delivery event.
        await read_statuses()
        return { success: true }
      } catch {
        // A browser without a host or an offline App Store cannot settle money.
        return { success: false, reason: 'purchase_recovery_unavailable' }
      }
    })()
    refreshing = { key: owner.key, epoch, promise }
    promise.finally(() => { if (refreshing?.promise === promise) refreshing = null })
    return promise
  }
  const controller = {
    start() { if (!running) { running = true; epoch++; controllers.set(store, controller); unsubscribe = subscribe(result => { process(result) }) } return refresh() },
    refresh,
    process,
    async abandon(request) {
      const owner = context()
      if (!current(owner) || request.owner_user_id !== owner.owner || request.phase !== 'interrupted' || request.can_abandon_interrupted !== true) return inactive()
      return enqueue({ ...purchase_payload(request, store.coin_package_by_id(request.package_id)), status: 'pending' }, owner, true)
    },
    stop() {
      running = false; epoch++; unsubscribe?.(); unsubscribe = null; refreshing = null
      for (const item of queue.splice(0)) { pending.delete(item.key); item.resolve(inactive()) }
      if (controllers.get(store) === controller) controllers.delete(store)
    },
  }
  return controller
}
