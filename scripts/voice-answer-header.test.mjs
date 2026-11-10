import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const source = read('src/pages/discover/icebreaker/voice.vue')
const { descriptor, errors } = parse(source), nodes = []
const walk = node => { nodes.push(node); for (const child of node.children || []) walk(child) }
walk(descriptor.template.ast)
const attr = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
const directive = (node, name, arg) => node.props?.find(prop => prop.type === 7 && prop.name === name && prop.arg?.content === arg)

test('voice answer uses the same title as text and has no More prop or handler', () => {
  assert.deepEqual(errors, [])
  const header = nodes.find(node => node.tag === 'IcebreakerHeader')
  assert.equal(attr(header, 'title'), 'Your answer')
  assert.equal(attr(header, 'variant'), 'voice')
  assert.equal(attr(header, 'interaction'), 'ibVoice.goBack.click.1')
  assert.ok(!header.props.some(prop => prop.name === 'menu' || prop.arg?.content === 'menu'))
  assert.equal(directive(header, 'on', 'back').exp.content, 'back')
  assert.equal(directive(header, 'bind', 'busy').exp.content, 'is_loading || navigating || media_busy')
  assert.match(read('src/pages/discover/icebreaker/text.vue'), /<IcebreakerHeader title="Your answer"/)
})

test('recording, permission, text switch, preview and discard controls remain wired', () => {
  for (const id of ['ibVoice.record.click.1', 'ibVoice.switchToTextReply.click.1', 'ibVoice.sendVoiceRequest.click.1']) assert.equal(source.split(id).length - 1, 1)
  assert.match(source, /@click="review"/)
  assert.match(source, /Review voice introduction/)
  assert.match(source, /\/pages\/discover\/icebreaker\/preview\?user_id=/)
  assert.match(source, /@confirm="allow"/)
  assert.match(source, /:open="discard" mode="discard"/)
  const preview = read('src/pages/discover/icebreaker/preview.vue')
  for (const id of ['ibPreview.deleteVoice.click.1', 'ibPreview.reRecord.click.1']) assert.ok(preview.includes(id))
  assert.match(preview, /<IcebreakerHeader title="Voice preview"/)
})

test('the original source menu contract is explicitly retired without changing its source snapshot', () => {
  const contracts = JSON.parse(read('docs/ui-restoration/discover-request-voice/interactions.json'))
  const menu = contracts.find(row => row.interaction_id === 'ibVoice.openVoiceMenu.click.1')
  assert.match(menu.trigger, /Retired/)
  assert.equal(Object.keys(menu).length, 10)
  assert.match(menu.persistence, /none/)
  const contract = JSON.parse(read('docs/ui-restoration/discover-request-voice/source-contract.json'))
  assert.equal(contract.user_header_override_2026_10_24.title, 'Your answer')
  assert.match(contract.user_header_override_2026_10_24.right_menu, /removed/)
})
