const available_auth_routes = new Set(['/pages/auth/splash', '/pages/auth/welcome', '/pages/auth/login', '/pages/auth/verification/code'])
export const auth_destination = target => {
  if (!available_auth_routes.has(target)) throw new Error('This step has not been restored yet. Your account data has not changed.')
  return target
}
export const startup_destination = store => {
  if (store.hydration_status !== 'ready') throw new Error(store.hydration_error || 'Saved data could not be loaded. Please retry.')
  if (store.session.is_authenticated) return authenticated_destination(store)
  if (store.local_verification) return auth_destination('/pages/auth/verification/code')
  return auth_destination('/pages/auth/welcome')
}
export const authenticated_destination = store => store.requires_local_verification ? auth_destination('/pages/auth/verification/code') : '/pages/home/index'
