const auth_sources = new Set([
  'pages/auth/welcome', 'pages/auth/login', 'pages/auth/age', 'pages/auth/community', 'pages/auth/signup',
  'pages/auth/reset/email', 'pages/auth/reset/code', 'pages/auth/reset/new',
  'pages/auth/verification/email', 'pages/auth/verification/code', 'pages/auth/verification/success', 'pages/auth/verification/unsupported',
  'pages/onboarding/basic', 'pages/onboarding/uni', 'pages/onboarding/major', 'pages/onboarding/photos', 'pages/onboarding/about',
  'pages/onboarding/interests', 'pages/onboarding/goal', 'pages/onboarding/ice', 'pages/onboarding/notif', 'pages/onboarding/complete',
])
const event_sources = new Set([
  'pages/events/index', 'pages/events/detail', 'pages/events/participants', 'pages/events/join-success',
  'pages/events/upcoming', 'pages/events/group', 'pages/events/report',
])
const account_pages = new Set([
  'pages/profile/index', 'pages/profile/edit', 'pages/profile/basic', 'pages/profile/goals', 'pages/profile/interests',
  'pages/profile/ice', 'pages/profile/prefs', 'pages/profile/preview', 'pages/profile/verification', 'pages/profile/reverify',
  'pages/discover/profile',
  'pages/settings/index', 'pages/settings/blocked', 'pages/settings/lang', 'pages/settings/legal', 'pages/settings/notif',
  'pages/settings/perm', 'pages/settings/privacy', 'pages/settings/support', 'pages/settings/delete/info',
  'pages/settings/delete/reason', 'pages/settings/delete/final', 'pages/settings/delete/success',
  'pages/safety/report-user', 'pages/safety/reports', 'pages/safety/report-detail',
  'pages/coins/index', 'pages/coins/history', 'pages/coins/purchase-detail', 'pages/coins/spend-detail', 'pages/coins/help',
  'pages/coins/purchasing', 'pages/coins/processing', 'pages/coins/success', 'pages/coins/failed', 'pages/coins/cancelled', 'pages/coins/spend-failed',
])
// These pages can lend their real frame to an authorized account destination.
// They do NOT gain horizontal transitions between their own routes.
const account_entries = new Set([
  'pages/home/index', 'pages/discover/index', 'pages/messages/chat', 'pages/messages/call/waiting',
  'pages/connections/accepted', 'pages/connections/received',
  'pages/discover/icebreaker/text', 'pages/discover/icebreaker/preview',
  'pages/auto-match/index', 'pages/auto-match/searching', 'pages/auto-match/paused',
  'pages/auto-match/found', 'pages/auto-match/connected', 'pages/auto-match/waiting',
])
const account_documents = new Set(['pages/legal/terms', 'pages/legal/privacy'])

// Explicit source/target edges preserve Send, Auto Match, preferences, Tab and
// guest legal/permission presentation exceptions. No global route-prefix rule.
export const stack_surface_route = (value = '') => {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\\\s]/.test(value) || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return ''
  try { return new URL(value.startsWith('/') ? value : `/${value}`, 'https://cimoa.invalid').pathname.replace(/^\//, '') } catch { return '' }
}
export const stack_surface_family = value => {
  const route = stack_surface_route(value)
  return auth_sources.has(route) ? 'auth' : event_sources.has(route) ? 'events' : account_pages.has(route) ? 'account' : account_documents.has(route) ? 'account-document' : account_entries.has(route) ? 'account-entry' : ''
}
export const stack_surface_source = value => !!stack_surface_family(value)
export const is_stack_route = stack_surface_source
export const stack_surface_target = value => ['auth', 'events', 'account', 'account-document'].includes(stack_surface_family(value)) && !['pages/auth/welcome', 'pages/events/index'].includes(stack_surface_route(value))
export const stack_surface_edge = (from, to) => {
  const source = stack_surface_family(from), target = stack_surface_family(to)
  if (!source || !stack_surface_target(to)) return false
  if (source === 'auth') return target === 'auth'
  if (source === 'events' && target === 'events') return true
  if (target === 'account') return ['events', 'account', 'account-entry', 'account-document'].includes(source)
  return target === 'account-document' && source === 'account'
}
