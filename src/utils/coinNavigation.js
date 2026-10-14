export const COIN_ROUTES = Object.freeze({
  center: '/pages/coins/index',
  purchasing: '/pages/coins/purchasing',
  failed: '/pages/coins/failed',
  cancelled: '/pages/coins/cancelled',
  history: '/pages/coins/history',
  help: '/pages/coins/help',
})

// Stage 5 restores one page at a time. This gate prevents an unfinished
// dependency from creating a purchase request or leaving the current page.
const restored_coin_routes = new Set([COIN_ROUTES.center, COIN_ROUTES.purchasing, COIN_ROUTES.failed, COIN_ROUTES.cancelled, COIN_ROUTES.history])

export function require_coin_route_ready(route) {
  if (!restored_coin_routes.has(route.split('?')[0])) throw new Error('This coin page is still being restored. No purchase or balance change was made.')
  return route
}
