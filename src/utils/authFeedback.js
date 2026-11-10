import { toast_message } from './toast.js'

// UI copy only. Keep validation and transaction outcomes unchanged.
export function auth_message(input, fallback = 'This action couldn’t be completed. Please try again.') {
  const text = String(input || '').trim()
  if (!text) return fallback
  if (/QuotaExceededError|storage quota|quota.{0,20}(?:storage|disk)|storage (?:is )?full|not enough (?:device )?(?:space|storage)/i.test(text)) return 'Your device doesn’t have enough space. Free up some space and try again.'
  if (/\b(?:injected|fixture|stack|TypeError|ReferenceError|SyntaxError|DOMException|indexedDB|localStorage)\b|(?:\/Users\/|node_modules|\.vue:\d)|failed to execute ['"]?setItem|(?:navigateTo|navigateBack|redirectTo|reLaunch|switchTab):fail/i.test(text)) return fallback
  return toast_message(text.replace(/\bsaved ((?:account|registration|reset) )?data\b/gi, (_, kind = '') => `Your ${kind}information`), 'error')
}

export function auth_loading_message(input) {
  const text = String(input || '').trim()
  return !text || /\b(?:local|saving|saved|records?|draft|demo)\b/i.test(text) ? 'Please wait…' : text
}

// Controlled presentation, not a second business state or an expiring success Toast.
export function create_auth_notice_controller({ on_start = () => {} } = {}) {
  let current = null, sequence = 0
  const listeners = new Set(), publish = () => listeners.forEach(listener => listener(current))
  const dismiss = owner => {
    if (!current || current.owner !== owner) return false
    current = null; publish(); return true
  }
  return {
    show(owner, message, { scope = 'auth' } = {}) {
      const text = auth_loading_message(message)
      const presentation_scope = ['auth', 'app', 'event', 'profile', 'coin'].includes(scope) ? scope : 'app'
      if (current?.owner === owner && current.message === text && current.scope === presentation_scope) return current.id
      on_start()
      current = Object.freeze({ id: `auth-${++sequence}`, owner, message: text, scope: presentation_scope, tone: 'progress', busy: true })
      publish(); return current.id
    },
    dismiss,
    clear() { if (current) { current = null; publish() } },
    get current() { return current },
    subscribe(listener) { listeners.add(listener); listener(current); return () => listeners.delete(listener) },
  }
}
