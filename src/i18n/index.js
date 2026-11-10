import { ref, toDisplayString } from 'vue'
import { fr } from './fr-FR.js'
import { fr_extra } from './fr-extra.js'
import { fr_data } from './fr-data.js'
import { fr_feedback } from './fr-feedback.js'
import { legal_fr } from './legal-fr.js'
import { host_request } from '../utils/hostBridge.js'

export const SUPPORTED_LOCALES = Object.freeze(['en-US', 'fr-FR'])
export const DEFAULT_LOCALE = 'en-US'
const PREFERENCE_KEY = 'cimoa_locale_preference_v1'
const current = ref(DEFAULT_LOCALE)

export const normalize_locale = value => String(value || '').toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US'

export const detect_device_locale = (env = globalThis) => {
  const values = env?.navigator?.languages?.length ? env.navigator.languages : [env?.navigator?.language]
  return normalize_locale(values.find(Boolean))
}

const storage = env => {
  const api = env?.uni || (typeof uni !== 'undefined' ? uni : null)
  if (api?.getStorageSync && api?.setStorageSync) return api
  const web = env?.localStorage
  if (!web?.getItem || !web?.setItem) return null
  return {
    getStorageSync: key => web.getItem(key) ?? '',
    setStorageSync: (key, value) => web.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)),
  }
}
const read_preference = (env = globalThis) => {
  try {
    const api = storage(env)
    const raw = api?.getStorageSync?.(PREFERENCE_KEY)
    if (!raw) return null
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return SUPPORTED_LOCALES.includes(value?.locale) && value?.source === 'user' ? value : null
  } catch { return null }
}

const write_preference = (locale, env = globalThis) => {
  const api = storage(env)
  if (!api?.setStorageSync) throw new Error('Language preferences are unavailable.')
  api.setStorageSync(PREFERENCE_KEY, JSON.stringify({ locale, source: 'user' }))
}

const apply_document_language = locale => {
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  if (globalThis.window?.webkit?.messageHandlers?.CimoaHost) host_request('setLanguage', { locale }).catch(() => {})
}

export const locale = current
export const get_locale = () => current.value
export const initialize_locale = (env = globalThis) => {
  const preference = read_preference(env)
  current.value = preference?.locale || detect_device_locale(env)
  apply_document_language(current.value)
  return current.value
}

export const set_locale = (value, { persist = false, env = globalThis } = {}) => {
  if (!SUPPORTED_LOCALES.includes(value)) throw new Error('Unsupported language.')
  if (persist) write_preference(value, env)
  current.value = value
  apply_document_language(value)
  return value
}

const interpolate = (value, params) => String(value).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`)
const canonical = value => String(value).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
const translations = { ...fr, ...fr_extra, ...fr_data, ...fr_feedback }
const normalized = new Map(Object.entries(translations).map(([key, value]) => [canonical(key), value]))
const escape_pattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const templates = Object.entries(translations).filter(([key]) => /\{\w+\}/.test(key)).map(([key, value]) => {
  const names = [...key.matchAll(/\{(\w+)\}/g)].map(match => match[1])
  const pattern = new RegExp('^' + canonical(key).split(/\{\w+\}/).map(escape_pattern).join('(.+?)') + '$', 'i')
  return { names, pattern, value }
})
const find_translation = source => {
  const exact = translations[source] || normalized.get(canonical(source))
  if (exact) return exact
  for (const { names, pattern, value } of templates) {
    const match = source.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').match(pattern)
    if (match) return interpolate(value, Object.fromEntries(names.map((name, index) => [name, name === 'name' ? match[index + 1] : t(match[index + 1])])))
  }
  const punctuation = source.match(/^(.*?)([.!?…])$/)
  if (punctuation) {
    const base = translations[punctuation[1]] || normalized.get(canonical(punctuation[1]))
    if (base) return /[.!?…]$/.test(base) ? base : base + (/[!?]/.test(punctuation[2]) ? ' ' : '') + punctuation[2]
  }
  return null
}
const translate_dynamic = source => {
  const emoji = source.match(/^((?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F|\u200D)+\s+)(.+)$/u)
  if (emoji) return emoji[1] + t(emoji[2])
  const rules = [
    [/^(\d[\d\s,.]*) Coins$/i, '$1 pièces'],
    [/^(\d[\d\s,.]*) coins$/i, '$1 pièces'],
    [/^(\d+) participants?$/i, '$1 participants'],
    [/^(\d+) interests?$/i, "$1 centres d’intérêt"],
    [/^Step (\d+) of (\d+)$/i, 'Étape $1 sur $2'],
    [/^View (.+) profile$/i, 'Voir le profil de $1'],
    [/^Say Hi to (.+)$/i, 'Dire bonjour à $1'],
    [/^(\d+) free matches remaining$/i, '$1 rencontres gratuites restantes'],
    [/^(\d+) min$/i, '$1 min'],
    [/^(\d+) km$/i, '$1 km'],
  ]
  for (const [pattern, replacement] of rules) if (pattern.test(source)) return source.replace(pattern, replacement)
  if (source.includes('. ')) {
    const sentences = source.split(/(?<=\.)\s+/), output = []
    for (let start = 0; start < sentences.length;) {
      let end = sentences.length, translated = null
      for (; end > start; end -= 1) {
        translated = find_translation(sentences.slice(start, end).join(' '))
        if (translated) break
      }
      output.push(translated || t(sentences[start]))
      start = translated ? end : start + 1
    }
    return output.join(' ')
  }
  for (const separator of [' · ', '\n', ' / ', ', ', ': ']) {
    if (source.includes(separator)) return source.split(separator).map(part => t(part)).join(separator)
  }
  return source
}
export const t = (source, params = {}) => {
  const value = toDisplayString(source)
  if (current.value !== 'fr-FR' || !value.trim()) return interpolate(value, params)
  const core = value.trim().replace(/\s+/g, ' ')
  const translated = find_translation(core) || translate_dynamic(core)
  return value.replace(value.trim(), interpolate(translated, params))
}
export const locale_label = value => value === 'fr-FR' ? t('French') : t('English')
export const format_number = value => new Intl.NumberFormat(current.value).format(value)
export const format_date = (value, options = {}) => new Intl.DateTimeFormat(current.value, options).format(value)
export const localize_legal_document = document => current.value === 'fr-FR' && legal_fr[document?.id]
  ? { ...document, ...legal_fr[document.id], sections: legal_fr[document.id].sections.map(row => [...row]) }
  : document

export const i18n = {
  install(app) {
    app.config.globalProperties.$t = t
    app.provide('cimoa-i18n', { locale: current, t, set_locale, format_number, format_date })
  },
}
