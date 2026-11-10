import assert from 'node:assert/strict'
import { detect_device_locale, get_locale, initialize_locale, locale_label, set_locale, t, format_number } from '../src/i18n/index.js'
import { computed } from 'vue'
import { create_seed } from '../src/stores/seed.js'
import { event_card } from '../src/stores/eventSelectors.js'
import { format_coin_date } from '../src/utils/coinHistory.js'

const values = new Map()
const env = (languages) => ({
  navigator: { languages, language: languages[0] },
  uni: {
    getStorageSync: key => values.get(key) || '',
    setStorageSync: (key, value) => values.set(key, value),
  },
})

assert.equal(detect_device_locale(env(['fr-FR', 'en-US'])), 'fr-FR')
assert.equal(detect_device_locale(env(['de-DE'])), 'en-US')
assert.equal(initialize_locale(env(['fr-CA'])), 'fr-FR')
assert.equal(t('Settings'), 'Réglages')
assert.equal(locale_label('en-US'), 'Anglais')

set_locale('en-US', { persist: true, env: env(['fr-FR']) })
assert.equal(get_locale(), 'en-US')
assert.equal(initialize_locale(env(['fr-FR'])), 'en-US', 'explicit selection must win over the device language')
assert.equal(t('Settings'), 'Settings')

values.clear()
assert.equal(initialize_locale(env(['fr-FR'])), 'fr-FR', 'cleared installation data must follow the device language again')

const web_values = new Map()
const web_env = {
  navigator: { languages: ['en-US'], language: 'en-US' },
  localStorage: {
    getItem: key => web_values.get(key) ?? null,
    setItem: (key, value) => web_values.set(key, value),
  },
}
set_locale('fr-FR', { persist: true, env: web_env })
assert.equal(initialize_locale(web_env), 'fr-FR', 'H5 and WKWebView keep an explicit French preference without a uni storage global')
assert.throws(() => set_locale('zh-Hant'), /Unsupported language/)

const rendered = computed(() => t('People you’ve met'))
set_locale('en-US')
assert.equal(rendered.value, 'People you’ve met')
const seed = create_seed(), before = JSON.stringify(seed)
const event = seed.events[0]
const english_date = format_coin_date(event.starts_at)
set_locale('fr-FR')
assert.equal(rendered.value, 'Vos rencontres', 'display values must react in Vue without rewriting DOM')
assert.equal(t('  Campus events  '), '  Événements du campus  ')
assert.equal(t('Write your reply to Zane…'), 'Écrivez votre réponse à Zane…')
assert.equal(t('📚 Study buddy'), '📚 Partenaire d’études')
assert.equal(t('Send text introduction?'), 'Envoyer la présentation écrite ?')
assert.equal(t('Zane: profile photo'), 'Zane : photo de profil')
assert.equal(t('Write your reply to Coffee…'), 'Écrivez votre réponse à Coffee…', 'a display name must not be translated as a catalog label')
assert.equal(t('You get 3 free matches every day — 2 left today. After that, each match costs 10 coins. You can pause or leave at any time. A match doesn’t unlock chat — you both have to accept first.').includes('You get'), false)
assert.equal(t('How would you spend your ideal weekend?'), 'Comment passerais-tu ton week-end idéal ?')
assert.equal(t(event.title), 'Pique-nique au coucher du soleil')
assert.ok(!event_card(seed, event, Date.now()).date_label.includes('PM'))
assert.notEqual(format_coin_date(event.starts_at), english_date, 'coin dates must be recomputed for the active locale')
assert.equal(format_number(1600), '1\u202f600')
assert.equal(t(2027), '2027', 'years and numeric input labels must not gain grouping separators')
assert.equal(JSON.stringify(seed), before, 'display translation must not change entities, IDs, preferences or user-authored data')
set_locale('en-US')
assert.equal(rendered.value, 'People you’ve met', 'switching back must restore source English, not retain translated DOM copy')
assert.equal(t('How would you spend your ideal weekend?'), 'How would you spend your ideal weekend?')

console.log('localization tests passed')
