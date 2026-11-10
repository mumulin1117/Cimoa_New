import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { clone_data } from '../src/stores/seed.js'
import { events_destination } from '../src/utils/eventsNavigation.js'

const now = Date.UTC(2026, 9, 24, 1)
const source = fs.readFileSync(new URL('../src/pages/events/index.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(source), nodes = []
const walk = node => { nodes.push(node); for (const child of node.children || []) walk(child) }
walk(descriptor.template.ast)
const attr = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
const directive = (node, name, argument) => node.props?.find(prop => prop.type === 7 && prop.name === name && (!argument || prop.arg?.content === argument))
const modifiers = prop => prop?.modifiers.map(modifier => modifier.content)
const make = (scenario = 'default', transform = () => {}) => {
  let disk = create_scenario(scenario, now), writes = 0
  for (const event of disk.events) if (['event_picnic', 'event_mic', 'event_yoga'].includes(event.event_id)) Object.assign(event, { starts_at: now, ends_at: now + 7200000 })
  transform(disk)
  const store = use_app_store(createPinia())
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => clone_data(disk), write: (_, data) => { writes++; disk = clone_data(data) } } })
  assert.equal(store.hydrate().success, true)
  return { store, writes: () => writes, persisted: () => clone_data(disk) }
}

test('the whole cell owns detail navigation and Join retains its exact stopped confirmation handler', () => {
  assert.deepEqual(errors, [])
  const card = nodes.find(node => attr(node, 'class') === 'event-card')
  assert.equal(attr(card, 'data-interaction'), 'events.cell.open.click.1')
  assert.equal(attr(card, 'role'), 'button')
  assert.equal(attr(card, 'tabindex'), '0')
  assert.equal(directive(card, 'on', 'click').exp.content, "navigate('detail', event.event_id)")
  const keys = card.props.filter(prop => prop.type === 7 && prop.name === 'on' && prop.arg?.content === 'keydown')
  assert.deepEqual(keys.map(modifiers), [['enter'], ['space', 'prevent']])
  const primary = nodes.find(node => attr(node, 'class') === 'event-join')
  for (const argument of ['click', 'keydown']) {
    const action = directive(primary, 'on', argument)
    assert.equal(action.exp.content, "!event.join_disabled && open('join', event.event_id)")
    assert.ok(modifiers(action).includes('stop'))
  }
  const primary_space = primary.props.find(prop => prop.type === 7 && prop.name === 'on' && prop.arg?.content === 'keydown' && modifiers(prop).includes('space'))
  assert.deepEqual(modifiers(primary_space), ['space', 'stop'])
  assert.equal(primary_space.exp, undefined)
  for (const name of ['event-title', 'event-participants', 'event-manage-link']) for (const node of nodes.filter(node => attr(node, 'class') === name)) {
    assert.equal(attr(node, 'role'), undefined)
    assert.equal(attr(node, 'tabindex'), undefined)
    assert.equal(directive(node, 'on'), undefined)
    assert.equal(directive(node, 'bind', 'data-target').exp.content, "target('detail', event.event_id)")
  }
  const cover = nodes.find(node => attr(node, 'class') === 'event-cover')
  assert.deepEqual(modifiers(directive(cover, 'on', 'click')), ['capture', 'stop'])
  assert.equal(directive(cover, 'on', 'click').exp.content, "navigate('detail', event.event_id)")
})

test('the unified read-only cell entry has a complete ten-field contract', () => {
  const contracts = JSON.parse(fs.readFileSync(new URL('../docs/ui-restoration/events/interactions.json', import.meta.url), 'utf8'))
  const matches = contracts.filter(row => row.interaction_id === 'events.cell.open.click.1')
  assert.equal(matches.length, 1)
  for (const name of ['interaction_id', 'source_screen', 'trigger', 'preconditions', 'visible_feedback', 'success_result', 'failure_result', 'persistence', 'sync_scope', 'acceptance']) assert.ok(typeof matches[0][name] === 'string' && matches[0][name].length > 0, name)
  assert.match(matches[0].success_result, /\/pages\/events\/detail\?event_id/)
  assert.match(matches[0].persistence, /none/)
})

test('first and later canonical event cells resolve their own details without changing any business state', () => {
  const { store, writes } = make(), before = clone_data(store.data), order = store.event_feed.map(event => event.event_id)
  assert.deepEqual(order.slice(0, 3), ['event_picnic', 'event_mic', 'event_yoga'])
  for (const event of store.event_feed) {
    assert.equal(events_destination(store, 'detail', event.event_id), `/pages/events/detail?event_id=${event.event_id}`)
    assert.equal(store.event_detail(event.event_id).title, event.title)
    assert.equal(store.event_detail(event.event_id).participant_count, event.participant_count)
  }
  assert.deepEqual(store.event_feed.map(event => event.event_id), order)
  assert.deepEqual(store.data, before)
  assert.equal(writes(), 0)
})

test('joined event cells retain their canonical detail, participant and group identities while navigation remains read-only', () => {
  const { store, writes } = make('event_joined'), before = clone_data(store.data)
  const card = store.event_feed.find(event => event.event_id === 'event_picnic')
  assert.equal(card.join_label, 'Joined')
  assert.equal(card.join_disabled, false)
  assert.equal(events_destination(store, 'detail', card.event_id), '/pages/events/detail?event_id=event_picnic')
  assert.equal(events_destination(store, 'participants', card.event_id), '/pages/events/participants?event_id=event_picnic')
  assert.equal(events_destination(store, 'group', card.event_id), '/pages/events/group?event_id=event_picnic&conversation_id=group_picnic')
  assert.equal(store.event_detail(card.event_id).joined, true)
  assert.deepEqual(store.data, before)
  assert.equal(writes(), 0)
})

test('the unchanged Join action admits once, persists one membership and does not connect people or change money', () => {
  const { store, writes, persisted } = make(), before = clone_data(store.data), id = 'event_mic'
  assert.equal(store.event_join_blocker(id), '')
  const result = store.join_event(id)
  assert.equal(result.success, true)
  assert.equal(writes(), 1)
  const admitted = clone_data(store.data)
  assert.equal(store.join_event(id).success, false)
  assert.deepEqual(store.data, admitted)
  assert.deepEqual(persisted(), admitted)
  assert.equal(writes(), 1)
  assert.equal(admitted.memberships.filter(row => row.event_id === id && row.user_id === admitted.session.current_user_id && row.status === 'joined').length, 1)
  assert.equal(store.event_detail(id).participant_count, store.event_people(id).length)
  for (const name of ['relationships', 'requests', 'messages', 'coin_transactions', 'event_preferences']) assert.deepEqual(admitted[name], before[name])
})

test('full event Join is disabled and rejected without writing, while its cell can still resolve the same detail', () => {
  const { store, writes } = make('default', data => { data.events.find(event => event.event_id === 'event_picnic').capacity = 3 })
  const before = clone_data(store.data), card = store.event_feed[0]
  assert.equal(card.event_id, 'event_picnic')
  assert.equal(card.join_disabled, true)
  assert.equal(card.join_label, 'Event full')
  assert.equal(events_destination(store, 'detail', card.event_id), '/pages/events/detail?event_id=event_picnic')
  assert.equal(store.join_event(card.event_id).success, false)
  assert.deepEqual(store.data, before)
  assert.equal(writes(), 0)
})
