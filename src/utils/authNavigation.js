import { ONBOARDING_FLOW, onboarding_route } from './onboardingFlow.js'
const available_auth_routes = new Set(['/pages/auth/splash', '/pages/auth/welcome', '/pages/auth/login', '/pages/auth/age', '/pages/auth/community', '/pages/auth/signup', '/pages/auth/verification/email', '/pages/auth/verification/code', '/pages/auth/verification/success', '/pages/legal/terms', '/pages/permissions/photos', '/pages/permissions/notif', '/pages/home/index', ...ONBOARDING_FLOW.map(onboarding_route)])
export const auth_destination = target => {
  if (!available_auth_routes.has(target.split('?')[0])) throw new Error('This step has not been restored yet. Your account data has not changed.')
  return target
}
export const startup_destination = store => {
  if (store.hydration_status !== 'ready') throw new Error(store.hydration_error || 'Saved data could not be loaded. Please retry.')
  if (store.session.is_authenticated) return authenticated_destination(store)
  if (store.local_verification) return auth_destination(store.local_verification.verified ? '/pages/auth/verification/success' : '/pages/auth/verification/code')
  return auth_destination('/pages/auth/welcome')
}
export const authenticated_destination = store => store.requires_local_verification ? auth_destination('/pages/auth/verification/code') : store.onboarding && !store.onboarding.completed ? onboarding_route(store.onboarding.step) : '/pages/home/index'
