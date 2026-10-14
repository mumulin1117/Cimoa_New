const available_auth_routes = new Set(['/pages/auth/splash', '/pages/auth/welcome', '/pages/auth/login', '/pages/auth/age', '/pages/auth/verification/code', '/pages/auth/verification/success'])
export const auth_destination = target => {
  if (target === '/pages/onboarding/notif') return target
  if (['/pages/onboarding/interests', '/pages/onboarding/goal', '/pages/onboarding/ice'].includes(target)) return target
  if (target.split('?')[0] === '/pages/permissions/photos') return target
  if (['/pages/onboarding/uni', '/pages/onboarding/major', '/pages/onboarding/photos', '/pages/onboarding/about'].includes(target)) return target
  if (['/pages/auth/community', '/pages/auth/signup', '/pages/auth/verification/email', '/pages/onboarding/basic', '/pages/home/index'].includes(target)) return target
  if (!available_auth_routes.has(target)) throw new Error('This step has not been restored yet. Your account data has not changed.')
  return target
}
export const startup_destination = store => {
  if (store.hydration_status !== 'ready') throw new Error(store.hydration_error || 'Saved data could not be loaded. Please retry.')
  if (store.session.is_authenticated) return authenticated_destination(store)
  if (store.local_verification) return auth_destination(store.local_verification.verified ? '/pages/auth/verification/success' : '/pages/auth/verification/code')
  return auth_destination('/pages/auth/welcome')
}
export const authenticated_destination = store => store.requires_local_verification ? auth_destination('/pages/auth/verification/code') : store.onboarding && !store.onboarding.completed ? onboarding_route(store.onboarding.step) : '/pages/home/index'
import { onboarding_route } from './onboardingFlow.js'
