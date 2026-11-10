import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { home_feed } from '../src/stores/homeFeed.js'
import { home_destination, require_home_destination_ready } from '../src/utils/homeNavigation.js'

const now = Date.now(), source = fs.readFileSync(new URL('../src/pages/home/index.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(source)
const template = descriptor.template.ast, nodes = []
const walk = (node, ancestors = []) => { nodes.push({ node, ancestors }); for (const child of node.children || []) walk(child, [...ancestors, node]) }
walk(template)
const attr = (node, name) => node.props?.find(row => row.type === 6 && row.name === name)?.value?.content
const directive = (node, name, argument) => node.props?.find(row => row.type === 7 && row.name === name && (!argument || row.arg?.content === argument))?.exp?.content
const interaction = id => nodes.find(({ node }) => attr(node, 'data-interaction') === id)
const make = (scenario, transform = () => {}) => {
  const data = create_scenario(scenario, now); transform(data)
  let writes = 0
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => data, write: () => { writes++; throw Error('Navigation must never write') } } })
  assert.equal(store.hydrate().success, true)
  return { store, writes: () => writes }
}

test('the populated CTA reuses the complete existing empty-state action and is last after the optional status card', () => {
  assert.deepEqual(errors, [])
  const empty = interaction('home.startAutoMatch.click.2'), tail = interaction('home.startAutoMatch.click.3')
  assert.ok(empty && tail)
  assert.equal(tail.node.loc.source.replace('home.startAutoMatch.click.3', 'home.startAutoMatch.click.2'), empty.node.loc.source)
  const wrapper = tail.ancestors.at(-1), branch = tail.ancestors.at(-2)
  assert.equal(attr(wrapper, 'class'), 'home-list-actions')
  assert.equal(directive(wrapper, 'if'), 'cards.length')
  const siblings = branch.children.filter(row => row.type === 1)
  assert.equal(siblings.at(-1), wrapper)
  assert.equal(attr(siblings.at(-2), 'data-interaction'), 'home.amCardGo.click.1')
  assert.equal(directive(tail.node, 'bind', 'data-target'), "target('match')")
  assert.equal(directive(tail.node, 'on', 'click'), "navigate('match', 'cta', $event)")
  assert.equal(directive(tail.node, 'on', 'keydown'), "navigate('match', 'cta', $event)")
  assert.doesNotMatch(descriptor.styles.map(row => row.content).join('\n'), /\.home-list-actions[^{}]*\.home-primary/)
})

test('the new interaction has a complete read-only ten-field contract', () => {
  const contracts = JSON.parse(fs.readFileSync(new URL('../docs/ui-restoration/home/interactions.json', import.meta.url), 'utf8'))
  const matches = contracts.filter(row => row.interaction_id === 'home.startAutoMatch.click.3')
  assert.equal(matches.length, 1)
  for (const name of ['interaction_id', 'source_screen', 'trigger', 'preconditions', 'visible_feedback', 'success_result', 'failure_result', 'persistence', 'sync_scope', 'acceptance']) assert.ok(typeof matches[0][name] === 'string' && matches[0][name].length > 0, name)
  assert.match(matches[0].success_result, /\/pages\/auto-match\/index/)
  assert.match(matches[0].persistence, /none/)
})

test('all populated canonical lists and request-only data share the existing entry without writes', () => {
  for (const scenario of ['default', 'three_chats', 'home_single', 'home_long', 'home_empty', 'requests_only']) {
    const { store, writes } = make(scenario === 'requests_only' ? 'default' : scenario, data => { if (scenario === 'requests_only') { data.relationships = []; data.match_sessions = [] } })
    const before = JSON.stringify(store.data), order = store.home_feed.cards.map(row => row.user_id)
    assert.equal(store.home_feed.status, scenario === 'home_empty' ? 'empty' : 'ready')
    if (scenario === 'requests_only') assert.deepEqual(store.home_feed.cards.map(row => row.kind), ['invite'])
    for (let repeat = 0; repeat < 3; repeat++) assert.equal(require_home_destination_ready(home_destination(store, 'match')), '/pages/auto-match/index')
    assert.deepEqual(store.home_feed.cards.map(row => row.user_id), order)
    assert.equal(JSON.stringify(store.data), before)
    assert.equal(writes(), 0)
  }
})

test('existing active matches retain their exact route and persisted state beside the new entry', () => {
  for (const status of ['searching', 'paused', 'found', 'waiting']) {
    const { store, writes } = make(`match_${status}`), before = JSON.stringify(store.data)
    assert.equal(home_destination(store, 'match'), '/pages/auto-match/index')
    assert.equal(home_destination(store, 'status'), `/pages/auto-match/${status}?match_id=match_liam`)
    assert.equal(JSON.stringify(store.data), before)
    assert.equal(writes(), 0)
  }
})

test('loading, corrupt reads and expired sessions have no cards or valid matching destination', () => {
  const fixture = create_scenario('default', now)
  for (const state of ['loading', 'error']) {
    const projected = home_feed(fixture, now, state, 'Unable to read connections')
    assert.deepEqual(projected.cards, [])
    assert.throws(() => home_destination({ home_feed: projected }, 'match'), /unavailable/)
  }
  const { store, writes } = make('session_expired'), before = JSON.stringify(store.data)
  assert.equal(store.home_feed.status, 'session_expired')
  assert.deepEqual(store.home_feed.cards, [])
  assert.throws(() => home_destination(store, 'match'), /expired/)
  assert.equal(JSON.stringify(store.data), before)
  assert.equal(writes(), 0)
})
