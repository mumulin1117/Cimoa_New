import { MOTION } from '../config/navigation.js'

export const FEEDBACK = Object.freeze({
  profile_updated: 'Profile updated',
  preferences_updated: 'Preferences updated',
  concern_received: 'Thank you for sharing your concern',
  concern_review: 'Thank you for sharing your concern. We’ll review it as soon as possible.',
  introduction_failed: 'Couldn’t send your introduction. Please try again.',
})

// Presentation only: do not change transaction results, storage keys or service status.
export function toast_message(input, tone = 'info') {
  const text = String(input || '').trim()
  if (!text) return ''
  if (/^Navigation is already in progress\.?$/i.test(text)) return 'This page is still opening. Please try again.'
  if (/QuotaExceededError|storage quota|quota.{0,20}(?:storage|disk)|storage (?:is )?full|not enough (?:device )?(?:space|storage)/i.test(text)) return 'Your device doesn’t have enough space. Free up some space and try again.'
  if (/\b(?:injected|fixture|stack|TypeError|ReferenceError|SyntaxError|DOMException|indexedDB|localStorage)\b|(?:\/Users\/|node_modules|\.vue:\d)|failed to execute ['"]?setItem|(?:navigateTo|navigateBack|redirectTo|reLaunch|switchTab):fail/i.test(text)) return 'This action couldn’t be completed. Please try again.'
  const polished = text
    .replace(/\bsaved (coin |purchase )?data\b/gi, (_, kind = '') => `Your ${kind}data`)
    .replace(/\b(?:local|browser) storage\b/gi, 'device storage')
    .replace(/\b(?:this )?introduction could not be saved\.?/gi, FEEDBACK.introduction_failed)
    .replace(/\b(?:this )?message could not be saved\.?/gi, 'Couldn’t send your message. Please try again.')
    .replace(/\bcould not be saved\b/gi, 'couldn’t be updated')
    .replace(/\balready being saved\b/gi, 'already being updated')
    .replace(/\bsaved (photo|audio|preferences|search time)\b/gi, '$1')
    .replace(/\b(introduction|message) drafts?\b/gi, '$1')
    .replace(/\bsupport drafts?\b/gi, 'support message')
    .replace(/\byour draft\b/gi, 'your message')
    .replace(/\b(?:this|a) draft\b/gi, 'this message')
    .replace(/\bthis record\b/gi, 'this entry')
    .replace(/\b(?:purchase|coin activity) record\b/gi, 'transaction')
    .replace(/\b(?:activity|purchase|coin) records?\b/gi, 'transactions')
  // Unknown adapter/debug text must not leak into the interface or invent success.
  return /\b(?:local|locally|saving|saved|drafts?|demo)\b|\b(?:test|mock|simulation|development) (?:account|data|mode|environment)\b|\b(?:on|in) (?:this|your) (?:device|browser) (?:only|mode)\b|\b(?:account|data|information) (?:exists?|is (?:available|kept)|was (?:created|stored)) (?:only )?on this device\b|\bthis build\b/i.test(polished)
    ? tone === 'error' ? 'This action couldn’t be completed. Please try again.' : 'Please check the latest details.'
    : polished
}

export function create_toast_controller({ schedule = setTimeout, cancel = clearTimeout } = {}) {
  let current = null, sequence = 0, timer = null
  const listeners = new Set()
  const publish = () => listeners.forEach(listener => listener(current))
  const dismiss = (id = current?.id, reason = 'close') => {
    if (!current || id !== current.id) return false
    cancel(timer); timer = null
    const previous = current; current = null; publish()
    previous.on_dismiss?.(reason)
    return true
  }
  const show = (message, options = {}) => {
    const tone = ['info', 'success', 'warning', 'error'].includes(options.tone) ? options.tone : 'info'
    const text = toast_message(message, tone)
    if (!text) return null
    cancel(timer)
    const previous = current
    const duration = Number.isFinite(options.duration) ? Math.max(2000, Math.min(options.duration, 10000)) : tone === 'error' || tone === 'warning' ? 5000 : 3500
    const id = ++sequence
    current = Object.freeze({ id, message: text, tone, duration, on_dismiss: options.on_dismiss })
    publish(); previous?.on_dismiss?.('replaced')
    timer = schedule(() => dismiss(id, 'timeout'), duration)
    return id
  }
  return { show, dismiss, clear: () => dismiss(current?.id, 'clear'), get current() { return current }, subscribe(listener) { listeners.add(listener); listener(current); return () => listeners.delete(listener) } }
}

export const toast = create_toast_controller()
export const show_toast = (message, options) => toast.show(message, options)
export const clear_toast = () => toast.clear()
export const toast_motion_style = () => ({ '--toast-enter': `${MOTION.toast_enter}ms`, '--toast-leave': `${MOTION.toast_leave}ms` })
