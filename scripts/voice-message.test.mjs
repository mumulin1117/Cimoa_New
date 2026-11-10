import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'vue/compiler-sfc'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const voice = read('src/components/ChatVoiceConfirmDialog.vue')

test('voice studio is a real themed Vue confirmation sheet rather than a native prompt', () => {
  assert.deepEqual(parse(voice).errors, [])
  assert.match(voice, /<script setup>/)
  assert.match(voice, /<EventConfirmDialog[^>]*class="chat-voice-sheet"[^>]*:open="open"[^>]*:busy="sending"[^>]*label="Voice message"/)
  for (const token of ['surface-voice-border', 'gradient-voice-sheet', 'gradient-voice-stage', 'shadow-voice-control']) assert.ok(voice.includes(`var(--cimoa-${token})`))
  assert.doesNotMatch(voice, /#[a-f\d]{3,8}\b|\brgba?\(|\b(?:localStorage|indexedDB|setTimeout|setInterval)\s*[.(]/i)
  assert.match(voice, /MOTION\.action_breathe/)
  assert.match(voice, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/)
})

test('voice state and recipient are derived from the existing media lifecycle and conversation', () => {
  for (const state of ['idle', 'requesting', 'recording', 'processing', 'preview', 'sending', 'error']) assert.ok(voice.includes(`'${state}'`))
  assert.match(voice, /:data-voice-state="state"/)
  assert.match(voice, /props\.media\?\.kind === 'audio' && !!props\.media\.url && props\.media\.duration_ms > 0/)
  assert.match(voice, /participant\.user_name/)
  assert.match(voice, /:src="participant\.avatar_url"/)
  const chat = read('src/pages/messages/chat.vue')
  assert.match(chat, /<ChatVoiceConfirmDialog[^>]*:participant="participant"/)
  assert.match(chat, /@record="recording \? stop_recording\(\) : start_recording\(\)"/)
  assert.match(chat, /@send="send\(true\)"/)
  assert.match(chat, /store\.send_direct_message\(/)
  assert.match(chat, /use_write_loading\(\)/)
})

test('voice preview uses real player events and disables playback while publishing', () => {
  assert.match(voice, /<EventAudio[^>]*:src="media\.url"[^>]*:duration="media\.duration_ms"[^>]*:disabled="sending \|\| busy"/)
  assert.match(voice, /#default="\{ playing, pending, elapsed, error: playback_error, toggle \}"/)
  assert.match(voice, /:aria-valuenow="Math\.min\(media\.duration_ms, Math\.floor\(elapsed \* 1000\)\)"/)
  assert.match(voice, /<ChatActionLoading :visible="sending" label="Sending voice message"/)
  assert.match(voice, /props\.open && has_audio\.value && !props\.recording && !props\.busy && !props\.sending/)
  const audio = read('src/components/EventAudio.vue')
  assert.match(audio, /time: value => \{ if \(current === token\) elapsed\.value = value \}/)
  assert.match(audio, /watch\(\(\) => props\.disabled, disabled => \{ if \(disabled\) audio\?\.pause\(\) \}\)/)
  assert.match(audio, /onHide\(dispose\); onUnmounted\(dispose\)/)
})

test('record, review, close and send keep stable interaction IDs and accessible keyboard controls', () => {
  assert.match(voice, /interactionPrefix: \{ type: String, default: 'chat\.media' \}/)
  assert.match(voice, /const action_id = \(action, index = 1\) => `\$\{props\.interactionPrefix\}\.\$\{action\}\.click\.\$\{index\}`/)
  for (const action of ["action_id('record')", "action_id('preview')", "action_id('send')", "action_id('close')", "action_id('close', 2)", "action_id('dismiss')"]) assert.ok(voice.includes(action), action)
  assert.match(voice, /const preview_id = computed\(\(\) => props\.previewInteraction \|\| action_id\('preview'\)\)/)
  assert.match(voice, /event\.key !== 'Tab'/)
  assert.match(voice, /addEventListener\('keydown', contain_focus\)/)
  assert.match(voice, /removeEventListener\('keydown', contain_focus\)/)
  assert.match(voice, /onUnmounted\(release_keyboard\)/)
  assert.doesNotMatch(voice, /@keydown="contain_focus"/)
  assert.match(voice, /previous_focus\.focus\?\.\(\)/)
  assert.match(voice, /@keydown\.space\.prevent="close"/)
  assert.match(voice, /\.voice-footer \{ flex: none;/)
  assert.match(voice, /--app-safe-bottom/)
  assert.match(voice, /class="voice-error" role="alert"/)
})

test('recording processing remains cancellable and clears the pending media lifecycle', () => {
  const media = read('src/composables/useEventMedia.js')
  assert.match(media, /processing = ref\(false\)/)
  assert.match(media, /busy\.value = true; processing\.value = true; recording\.value = false/)
  assert.match(media, /capture_controller\?\.abort\(\)/)
  assert.match(media, /recorder\?\.dispose\(\)/)
  assert.match(media, /processing\.value = false/)
  assert.match(media, /onHide\(clear\); onUnmounted\(clear\)/)
})
