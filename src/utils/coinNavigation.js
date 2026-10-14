export const COIN_ROUTES = Object.freeze({
  center: '/pages/coins/index',
  purchasing: '/pages/coins/purchasing',
  success: '/pages/coins/success',
  failed: '/pages/coins/failed',
  cancelled: '/pages/coins/cancelled',
  history: '/pages/coins/history',
  purchaseDetail: '/pages/coins/purchase-detail',
  spendDetail: '/pages/coins/spend-detail',
  help: '/pages/coins/help',
  processing: '/pages/coins/processing',
  spendFailed: '/pages/coins/spend-failed',
})

// Stage 5 restores one page at a time. This gate prevents an unfinished
// dependency from creating a purchase request or leaving the current page.
const restored_coin_routes = new Set(Object.values(COIN_ROUTES))

export function require_coin_route_ready(route) {
  if (!restored_coin_routes.has(route.split('?')[0])) throw new Error('This coin page is still being restored. No purchase or balance change was made.')
  return route
}
