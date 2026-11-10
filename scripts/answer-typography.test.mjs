import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_seed, clone_data } from '../src/stores/seed.js'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const text = read('src/pages/discover/icebreaker/text.vue')
const header = read('src/components/IcebreakerHeader.vue')
const person = read('src/components/IcebreakerPerson.vue')
const shared = read('src/pages/discover/icebreaker/icebreaker.css')
const css = source => [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n')
const script = source => source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1] || ''
const rules = source => [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, declarations]) => ({
  selectors: selectors.split(',').map(selector => selector.trim()),
  declarations: Object.fromEntries(declarations.split(';').map(row => row.trim()).filter(Boolean).map(row => {
    const colon = row.indexOf(':')
    return [row.slice(0, colon).trim(), row.slice(colon + 1).trim()]
  })),
}))
const rule = (source, selector) => {
  const matches = rules(source).filter(row => row.selectors.includes(selector))
  assert.ok(matches.length, `Missing CSS selector: ${selector}`)
  return Object.assign({}, ...matches.map(row => row.declarations))
}
const pixels = (value, label) => {
  assert.match(value || '', /^-?\d+(?:\.\d+)?rpx$/, `${label} must use design rpx`)
  return parseFloat(value) * 393 / 750
}
const dimension = (declarations, property, expected, label) => {
  assert.ok(Math.abs(pixels(declarations[property], `${label}.${property}`) - expected) < 0.002, `${label}.${property} should be ${expected}px at 393px`)
}
const typography = (declarations, size, weight, line, label) => {
  dimension(declarations, 'font-size', size, label)
  assert.equal(declarations['font-weight'], String(weight), `${label}.font-weight`)
  dimension(declarations, 'line-height', line, label)
}
const textStyles = css(text), headerStyles = css(header), personStyles = css(person)

test('Your answer header is 20/600/26 and stays vertically centered without a text-only top offset', () => {
  const base = rule(headerStyles, '.ice-header-title')
  const variant = rule(headerStyles, '.ice-header--text .ice-header-title')
  typography(variant, 20, 600, 26, 'text header')
  const resolved = { ...base, ...variant }
  assert.equal(resolved.display, 'flex')
  assert.equal(resolved['align-items'], 'center')
  assert.equal(resolved['justify-content'], 'center')
  assert.equal(resolved['text-align'], 'center')
  assert.match(resolved.inset, /^0\s+/)
  for (const property of ['top', 'bottom']) assert.ok(!Object.hasOwn(variant, property), `Text variant must not hard-position ${property}`)
  assert.match(text, /<IcebreakerHeader\b[^>]*title="Your answer"[^>]*variant="text"/)
})

test('only the text identity card uses a 14/500/20 secondary name and 18/600/26 question', () => {
  const name = rule(personStyles, '.ice-person--text .ice-person-name')
  const question = rule(personStyles, '.ice-person--text .ice-person-question')
  typography(name, 14, 500, 20, 'text identity')
  typography(question, 18, 600, 26, 'text question')
  assert.equal(name.color, 'var(--cimoa-text-secondary)')
  assert.equal(question['overflow-wrap'], 'anywhere')
  assert.match(person, /variant === 'text'" class="ice-person-question"/)
  assert.match(text, /<IcebreakerPerson\b[^>]*:user="context.user"[^>]*:question="context.question.text"[^>]*variant="text"/)
})

test('editor hierarchy is 22/600/28 title, 17/400/26 answer and 12/400/18 counter', () => {
  typography(rule(textStyles, '.ice-write-title'), 22, 600, 28, 'write heading')
  const field = rule(textStyles, '.ice-textarea')
  typography(field, 17, 400, 26, 'answer input')
  assert.equal(field['font-family'], 'inherit')
  dimension(field, 'height', 170, 'answer input')
  dimension(field, 'min-height', 170, 'answer input')
  const counter = rule(textStyles, '.ice-counter')
  typography(counter, 12, 400, 18, 'answer counter')
  assert.equal(counter['text-align'], 'right')
})

test('text-only actions have 16/600/22 and 14/500/20 type while retaining the 60px primary control', () => {
  const primary = rule(shared, '.ice-primary')
  const textPrimary = rule(textStyles, '.ice-text-send')
  typography(textPrimary, 16, 600, 22, 'text send')
  dimension(primary, 'height', 60, 'default primary control')
  assert.equal(textPrimary.height, 'auto')
  dimension(textPrimary, 'min-height', 60, 'text primary control')
  assert.equal(primary.background, 'var(--cimoa-gradient-primary)')
  assert.equal(primary.color, 'var(--cimoa-text-inverse)')
  typography(rule(textStyles, '.ice-text-page .ice-switch'), 14, 500, 20, 'switch to voice')
  assert.match(text, /<text>Send text introduction<\/text>\s*<text>· 10 Coins<\/text>/)
  assert.match(text, /data-interaction="ibText.switchToVoice.click.1"[^>]*>Switch to voice<\/view>/)
})

test('default and voice variants keep their existing type; text overrides cannot become global', () => {
  const baseHeader = rule(headerStyles, '.ice-header-title')
  dimension(baseHeader, 'font-size', 21, 'default header')
  assert.equal(baseHeader['font-weight'], '700')
  assert.equal(rule(headerStyles, '.ice-header--voice .ice-header-title')['font-weight'], '800')
  const baseName = rule(personStyles, '.ice-person-name')
  dimension(baseName, 'font-size', 20, 'default person name')
  assert.equal(baseName['font-weight'], '800')
  assert.equal(rule(personStyles, '.ice-person--voice .ice-person-name')['letter-spacing'], '-0.02em')
  assert.equal(rule(personStyles, '.ice-person--voice').background, 'var(--cimoa-surface-transparent)')
  assert.ok(!rules(personStyles).some(row => row.selectors.includes('.ice-person-question')), 'Question typography must be explicitly text-variant scoped')
  assert.equal(rule(shared, '.ice-primary')['font-weight'], '700')
  assert.equal(rule(shared, '.ice-switch')['font-weight'], '600')
})

test('typography uses design rpx and configured semantic theme colors rather than inline hardcoded color', () => {
  const theme = JSON.parse(read('src/config/theme.json'))
  const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => value && typeof value === 'object'
    ? flatten(value, `${prefix}${key.replaceAll('_', '-')}-`)
    : [`--cimoa-${prefix}${key.replaceAll('_', '-')}`])
  const tokens = new Set([...flatten(theme.colors), ...flatten(theme.gradients, 'gradient-'), ...flatten(theme.shadows, 'shadow-')])
  for (const source of [textStyles, headerStyles, personStyles, shared]) {
    assert.doesNotMatch(source, /#[\da-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/)
    for (const [, token] of source.matchAll(/var\((--cimoa-[\w-]+)/g)) assert.ok(tokens.has(token), `Missing semantic theme token: ${token}`)
    for (const row of rules(source)) if (row.declarations['font-size']) pixels(row.declarations['font-size'], row.selectors.join(', '))
  }
  assert.match(text, /<style scoped src="\.\/icebreaker.css"><\/style>/)
  assert.match(text, /<style scoped>/)
})

test('text form preserves the 300-character limit, stable interaction IDs and explicit fee confirmation', () => {
  const pageScript = script(text)
  for (const id of ['ibText.goBack.click.1', 'ibText.onReply.change.1', 'ibText.continueText.click.1', 'ibText.switchToVoice.click.1']) assert.equal(text.split(id).length - 1, 1, id)
  assert.match(text, /:maxlength="300"/)
  assert.match(text, /\{\{ reply.length \}\} \/ 300/)
  assert.match(pageScript, /reply\.value = String\(event.detail.value\)\.slice\(0, 300\)/)
  assert.match(pageScript, /!reply\.value.trim\(\) \|\| reply.value.length > 300/)
  assert.match(pageScript, /sheet.value = context.value.balance < 10 \? 'insufficient' : 'confirm'/)
  assert.match(text, /<IntroductionConfirmDialog\b[^>]*kind="text"[^>]*@confirm="confirm_text"/)
  const editing = pageScript.slice(pageScript.indexOf('const edit ='), pageScript.indexOf('const back ='))
  assert.match(editing, /stage\(\)/)
  assert.doesNotMatch(editing, /run_with_loading|persist_introduction_form|prepare_introduction_spend/)
  const confirmation = pageScript.slice(pageScript.indexOf('const confirm_text ='), pageScript.indexOf('const coins ='))
  assert.match(confirmation, /run_with_loading\([\s\S]*store.persist_introduction_form\(draft_id.value\)[\s\S]*store.prepare_introduction_spend\(draft_id.value, 'text'\)/)
  assert.doesNotMatch(pageScript, /\b(?:localStorage|indexedDB|setTimeout|setInterval|watch|update_introduction_draft)\b/)
  assert.match(pageScript, /onHide\(leave\); onUnmounted\(leave\)/)
})

function fixture() {
  const now = Date.UTC(2026, 9, 23, 1)
  let disk = create_seed(now), writes = 0
  const persistence = { read: () => clone_data(disk), write: (_, value) => { writes++; disk = clone_data(value) } }
  const make = () => {
    const store = use_app_store(createPinia())
    configure_store_runtime(store, { persistence, clock: () => now }); store.hydrate()
    return store
  }
  const store = make()
  return { store, writes: () => writes, disk: () => clone_data(disk), reload: make }
}
const openAnswer = store => {
  const opened = store.stage_introduction_form('user_zane', store.questions_for_user('user_zane')[0].question_id, 'text')
  assert.ok(opened.success)
  return opened.data
}

test('editing and switching modes keep an unpublished answer only in memory, including the original 300-character boundary', () => {
  const f = fixture(), before = clone_data(f.store.data), id = openAnswer(f.store)
  const answer = 'a'.repeat(300)
  for (const patch of [{ text: answer }, { mode: 'voice' }, { mode: 'text' }]) assert.ok(f.store.edit_introduction_form(id, patch).success)
  assert.equal(f.store.introduction_context('user_zane', id).draft.payload.text, answer)
  assert.equal(f.store.edit_introduction_form(id, { text: 'a'.repeat(301) }).success, false)
  assert.equal(f.store.introduction_context('user_zane', id).draft.payload.text, answer)
  assert.deepEqual(clone_data(f.store.data), before)
  assert.deepEqual(f.disk(), before)
  assert.equal(f.writes(), 0)
  assert.ok(f.reload().introduction_context('user_zane', id).error, 'Refreshing must not restore unpublished input')
})

test('explicit confirmation publishes without debiting; cancellation is inert and successful processing charges exactly 10 once', async () => {
  const f = fixture(), id = openAnswer(f.store), initialBalance = f.store.coin_balance
  assert.ok(f.store.edit_introduction_form(id, { text: 'Coffee and a campus walk after class?' }).success)
  assert.equal(f.writes(), 0)
  assert.ok(f.store.persist_introduction_form(id).success)
  const confirmation = f.store.prepare_introduction_spend(id, 'text')
  assert.ok(confirmation.success)
  assert.equal(f.store.coin_balance, initialBalance)
  const prepared = clone_data(f.store.data), writes = f.writes()
  const cancelled = await f.store.complete_coin_spend(confirmation.data, { is_current: () => false })
  assert.equal(cancelled.reason, 'cancelled')
  assert.equal(f.writes(), writes)
  assert.deepEqual(clone_data(f.store.data), prepared)
  const result = await f.store.complete_coin_spend(confirmation.data)
  assert.ok(result.success)
  const request = f.store.request_detail(result.data.destination_id)
  assert.equal(request.kind, 'text')
  assert.equal(request.status, 'pending')
  assert.equal(request.text, 'Coffee and a campus walk after class?')
  assert.equal(f.store.coin_balance, initialBalance - 10)
  assert.equal(f.store.coin_transactions.filter(row => row.related_id === request.request_id && row.amount === -10).length, 1)
  const committed = clone_data(f.store.data)
  assert.equal((await f.store.complete_coin_spend(confirmation.data)).repeated, true)
  assert.deepEqual(clone_data(f.store.data), committed)
  assert.equal(f.reload().introduction_context('user_zane').primary.label, 'Waiting for reply')
})
