import { ONBOARDING_FLOW, onboarding_route } from './onboardingFlow.js'
export const AUTHENTICATED_MAIN_ROUTE = '/pages/home/index'
const available_auth_routes = new Set(['/pages/auth/splash', '/pages/auth/welcome', '/pages/auth/login', '/pages/auth/age', '/pages/auth/community', '/pages/auth/signup', '/pages/auth/verification/email', '/pages/auth/verification/code', '/pages/auth/verification/success', '/pages/auth/verification/unsupported', '/pages/auth/reset/email', '/pages/auth/reset/code', '/pages/auth/reset/new', '/pages/legal/terms', '/pages/legal/privacy', '/pages/permissions/photos', '/pages/permissions/notif', '/pages/settings/delete/success', '/pages/discover/index', AUTHENTICATED_MAIN_ROUTE, ...ONBOARDING_FLOW.map(onboarding_route)])
export const auth_destination = target => {
  if (!available_auth_routes.has(target.split('?')[0])) throw new Error('This step is currently unavailable. Your account information has not changed.')
  return target
}
export const startup_destination = store => {
  if (store.hydration_status !== 'ready') throw new Error(store.hydration_error || 'Your information couldn’t be loaded. Please try again.')
  if (store.session.is_authenticated) return authenticated_destination(store)
  if (store.local_verification) return auth_destination(store.local_verification.verified ? '/pages/auth/verification/success' : '/pages/auth/verification/code')
  return auth_destination('/pages/auth/welcome')
}
export const authenticated_destination = store => store.requires_local_verification ? auth_destination('/pages/auth/verification/code') : store.onboarding && !store.onboarding.completed ? onboarding_route(store.onboarding.step) : AUTHENTICATED_MAIN_ROUTE
