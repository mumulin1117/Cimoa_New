import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'
import { createPinia } from 'pinia'
import { use_app_store, configure_store_runtime } from '../src/stores/store.js'
import { create_scenario } from '../src/stores/scenarios.js'
import { events_destination, event_report_fallback } from '../src/utils/eventsNavigation.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const group = read('src/pages/events/group.vue'), report = read('src/pages/events/report.vue')

test('group More navigates directly to the report without retaining the old group menu', () => {
  const { descriptor, errors } = parse(group), nodes = []
  assert.deepEqual(errors, [])
  const walk = node => { nodes.push(node); for (const child of node.children || []) walk(child) }; walk(descriptor.template.ast)
  const attr = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const more = nodes.find(node => attr(node, 'data-interaction') === 'evGroup.openGroupMenu.click.1')
  assert.equal(attr(more, 'aria-label'), 'Report group chat')
  for (const handler of more.props.filter(prop => prop.type === 7 && prop.name === 'on')) assert.equal(handler.exp.content, 'report_group')
  assert.match(group, /go\('group-report'\)/)
  assert.doesNotMatch(group, /eventGroup\.menu\.|sheet === 'menu'|open\('menu'\)/)
})

test('group reporting reuses exactly the event report layout and styles, not a duplicate report page', () => {
  const { descriptor, errors } = parse(report)
  assert.deepEqual(errors, [])
  assert.match(report, /is_group \? 'Report group chat' : 'Report event'/)
  assert.match(report, /is_group.value \? store.group_report_reasons : store.event_report_reasons/)
  assert.match(report, /target_type: target_type.value, target_id: target_id.value, context_id: is_group.value \? event_id.value : null/)
  assert.match(report, /event_report_fallback\(store, event_id.value, origin_conversation_id.value\)/)
  assert.match(report, /return_after_report/)
  assert.match(report, /await return_after_report\(\)/)
  assert.doesNotMatch(report, /event-report-saved/)
  assert.ok(descriptor.styles.every(style => !style.content.includes('event-group-report-page')), 'No divergent group-report style overrides')
  assert.doesNotMatch(report, /localStorage|indexedDB/)
})

test('group report routes require exact joined event and conversation while old event routes are unchanged', () => {
  const now = Date.now(), data = create_scenario('event_joined', now), store = use_app_store(createPinia())
  let writes = 0
  configure_store_runtime(store, { clock: () => now, persistence: { read: () => data, write() { writes++; throw Error('Read navigation cannot write') } } })
  assert.equal(store.hydrate().success, true)
  const before = JSON.stringify(store.data)
  assert.equal(events_destination(store, 'group-report', 'event_picnic', 'group_picnic'), '/pages/events/report?event_id=event_picnic&target_type=group&origin_conversation_id=group_picnic')
  assert.equal(events_destination(store, 'report', 'event_picnic'), '/pages/events/report?event_id=event_picnic')
  for (const [event_id, conversation_id] of [['event_mic', 'group_picnic'], ['event_picnic', 'conversation_chloe'], ['event_picnic', ''], ['event_picnic', 'missing_group']]) assert.throws(() => events_destination(store, 'group-report', event_id, conversation_id), /unavailable/)
  assert.equal(event_report_fallback(store, 'event_picnic', 'group_picnic'), '/pages/events/group?event_id=event_picnic&conversation_id=group_picnic')
  assert.equal(JSON.stringify(store.data), before); assert.equal(writes, 0)
})
