import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const group = read('src/pages/events/group.vue'), voice = read('src/components/ChatVoiceConfirmDialog.vue')

test('event group voice entry reuses the exact private-chat studio with the real event recipient', () => {
  assert.deepEqual(parse(group).errors, [])
  assert.match(group, /import ChatVoiceConfirmDialog from '@\/components\/ChatVoiceConfirmDialog\.vue'/)
  assert.match(group, /<ChatVoiceConfirmDialog[^>]*class="event-group-voice-sheet"[^>]*:open="sheet === 'voice'"[^>]*:group="event"/)
  assert.match(group, /interaction-prefix="eventGroup\.media"/)
  assert.match(group, /preview-interaction="eventGroup\.media\.voicePreview\.click\.1"/)
  assert.match(group, /@record="recording \? stop\(\) : start\(\)"/)
  assert.match(group, /@send="send\(true\)"/)
  assert.match(voice, /<ProfilePhoto v-if="group" :src="group\.image_url" :name="group\.title" event-cover/)
  assert.match(voice, /To \{\{ group \? group\.title : participant\.user_name \}\}/)
  assert.match(voice, /\.voice-recipient-avatar \{[^}]*position: relative;[^}]*overflow: hidden;/s)
})

test('shared voice interaction IDs remain private by default and use explicit distinct group namespaces', () => {
  assert.match(voice, /interactionPrefix: \{ type: String, default: 'chat\.media' \}/)
  assert.match(voice, /const action_id = \(action, index = 1\) => `\$\{props\.interactionPrefix\}\.\$\{action\}\.click\.\$\{index\}`/)
  assert.match(voice, /props\.previewInteraction \|\| action_id\('preview'\)/)
  assert.match(group, /data-interaction="evGroup\.recordGroupVoice\.click\.1"/)
  assert.match(group, /data-interaction="eventGroup\.media\.preview\.click\.1"/)
  assert.match(voice, /:data-interaction="preview_id"/)
  assert.match(voice, /@released="emit\('released'\)"/)
  assert.match(group, /@released="!sheet && \(locked = false\)"/)
  for (const action of ['close', 'record', 'toggle', 'send']) assert.ok(voice.includes(`@click.stop="${action}"`), `Real ${action} touch must stop before its replaced child target bubbles into the Sheet`)
  assert.match(voice, /\.voice-close > view,[^}]+pointer-events: none;/)
})

test('group voice keeps canonical Store sending, permission cleanup and inline brand feedback', () => {
  assert.match(group, /store\.send_event_message\(event_id\.value, conversation_id\.value, content, payload, operation_id, scope\)/)
  assert.match(group, /await write\(scope => store\.send_event_message/)
  assert.match(group, /:sending="is_loading && sheet === 'voice'"/)
  assert.match(group, /<EventActionLoading :visible="is_loading && sheet !== 'voice'"/)
  assert.match(group, /<EventAudio[^>]*:disabled="sheet === 'voice'"/)
  assert.match(group, /watch\(group_error, value => \{ if \(value\) \{ clear_transient\(\); close\(\) \} \}\)/)
  assert.match(group, /onHide\(\(\) => \{ active\.value = false; clear_transient\(\{ discard_text: false \}\) \}\)/)
  assert.match(group, /onUnmounted\(clear_transient\)/)
  assert.doesNotMatch(group, /localStorage|indexedDB|new MediaRecorder|getUserMedia|chat\.media\./)
})
