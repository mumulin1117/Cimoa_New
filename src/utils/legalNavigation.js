import { coin_child_route } from './coinReturnContext.js'

// Named application origins only: never accept a caller-provided return URL.
export function legal_document_route(store, kind, origin, context_id) {
  const route = kind === 'privacy' ? '/pages/legal/privacy' : '/pages/legal/terms'
  const params = new URLSearchParams()
  if (['coins', 'settings', 'welcome', 'signup'].includes(origin)) params.set('origin', origin)
  if (origin === 'coins') {
    const owned = new URLSearchParams(coin_child_route(store, '/pages/coins/help', context_id).split('?')[1] || '')
    if (owned.has('return_context_id')) params.set('return_context_id', owned.get('return_context_id'))
  }
  return params.size ? `${route}?${params.toString()}` : route
}

export function legal_return_route(store, origin, context_id) {
  if (store.session.is_authenticated) return origin === 'coins'
    ? coin_child_route(store, '/pages/coins/help', context_id)
    : '/pages/settings/legal'
  return origin === 'signup' ? '/pages/auth/signup' : '/pages/auth/welcome'
}
