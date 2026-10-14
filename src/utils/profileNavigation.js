// Exact source targets; no arbitrary URLs or copies of the current user in route params.
export function profile_destination(store, kind) {
  if (store.hydration_status !== 'ready') throw new Error('Saved data is unavailable. Please retry loading it.')
  if (!store.session.is_authenticated || !store.current_user.user_id) throw new Error('Your session has expired. Please sign in again.')
  const route = { settings: '/pages/settings/index', edit: '/pages/profile/edit', coins: '/pages/coins/index', preview: '/pages/profile/preview' }[kind]
  if (!route) throw new Error('This page is unavailable.')
  return route
}
export const PROFILE_DEFERRED_ROUTES = Object.freeze(['/pages/coins/index', '/pages/profile/verification', '/pages/settings/support', '/pages/settings/notif', '/pages/settings/privacy', '/pages/settings/perm', '/pages/settings/lang', '/pages/settings/blocked', '/pages/safety/reports', '/pages/settings/legal', '/pages/settings/delete/info'])
export function require_profile_destination_ready(url) {
  if (PROFILE_DEFERRED_ROUTES.includes(url.split('?')[0])) throw new Error('This destination has not been restored yet. Your profile and coins have not changed.')
  return url
}
