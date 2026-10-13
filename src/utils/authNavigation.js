const available_auth_routes = new Set(['/pages/auth/splash'])
export const auth_destination = target => {
  if (!available_auth_routes.has(target)) throw new Error('This step has not been restored yet. Your account data has not changed.')
  return target
}
export const startup_destination = store => {
  if (store.hydration_status !== 'ready') throw new Error(store.hydration_error || 'Saved data could not be loaded. Please retry.')
  return store.session.is_authenticated ? '/pages/home/index' : auth_destination('/pages/auth/welcome')
}
