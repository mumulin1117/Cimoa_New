<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { MOTION } from '@/config/navigation.js'
import EventConfirmDialog from './EventConfirmDialog.vue'
import EventAudio from './EventAudio.vue'
import SourceIcon from './SourceIcon.vue'
import ConnectionIcon from './ConnectionIcon.vue'
import IcebreakerIcon from './IcebreakerIcon.vue'
import UserAvatar from './UserAvatar.vue'
import ProfilePhoto from './ProfilePhoto.vue'
import BrandProgressMark from './BrandProgressMark.vue'
import ChatActionLoading from './ChatActionLoading.vue'

const props = defineProps({ open: Boolean, recording: Boolean, busy: Boolean, processing: Boolean, sending: Boolean, seconds: Number, media: Object, error: String, participant: Object, group: Object, interactionPrefix: { type: String, default: 'chat.media' }, previewInteraction: String })
const emit = defineEmits(['close', 'record', 'send', 'released'])
const action_id = (action, index = 1) => `${props.interactionPrefix}.${action}.click.${index}`
const preview_id = computed(() => props.previewInteraction || action_id('preview'))
const dialog = ref(null)
let previous_focus, keyboard_root
const release_keyboard = () => { keyboard_root?.removeEventListener('keydown', contain_focus); keyboard_root = null }
watch(() => props.open, async open => {
  if (typeof document === 'undefined') return
  release_keyboard()
  if (open) previous_focus = document.activeElement
  await nextTick()
  if (open && props.open) {
    keyboard_root = dialog.value?.$el || dialog.value
    // uni-view normalizes away shiftKey and the real target. Focus containment
    // needs the native KeyboardEvent, without changing uni's action handlers.
    keyboard_root?.addEventListener('keydown', contain_focus)
    keyboard_root?.querySelector('.voice-close')?.focus()
  }
  else if (!props.open && previous_focus?.isConnected) previous_focus.focus?.()
})
const contain_focus = event => {
  if (event.key !== 'Tab' || !props.open) return
  const root = dialog.value?.$el || dialog.value
  const controls = [...(root?.querySelectorAll('[role="button"][tabindex="0"]') || [])].filter(element => element.getAttribute('aria-disabled') !== 'true' && element.getBoundingClientRect().height > 0)
  const next = event.shiftKey ? controls.at(-1) : controls[0]
  const edge = event.shiftKey ? controls[0] : controls.at(-1)
  if (next && (event.target === edge || !controls.includes(event.target))) { event.preventDefault(); next.focus() }
}
onUnmounted(release_keyboard)
const has_audio = computed(() => props.media?.kind === 'audio' && !!props.media.url && props.media.duration_ms > 0)
const state = computed(() => props.sending ? 'sending' : props.processing ? 'processing' : props.busy ? 'requesting' : props.recording ? 'recording' : has_audio.value ? 'preview' : props.error ? 'error' : 'idle')
const mmss = value => { const seconds = Math.max(0, Math.ceil(value || 0)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
const control_label = computed(() => props.busy ? props.processing ? 'Preparing your audio…' : 'Opening microphone…' : props.recording ? 'Stop recording' : has_audio.value ? 'Record again' : 'Start recording')
const status_label = computed(() => props.busy ? props.processing ? 'Preparing audio' : 'Microphone access' : props.recording ? 'Recording' : 'Your voice, your moment')
const close = () => { if (props.open && !props.sending) emit('close') }
const record = () => { if (props.open && !props.busy && !props.sending) emit('record') }
const send = () => { if (props.open && has_audio.value && !props.recording && !props.busy && !props.sending) emit('send') }
</script>

<template>
  <EventConfirmDialog ref="dialog" class="chat-voice-sheet" :open="open" :busy="sending" label="Voice message" :close-interaction="action_id('close')" :data-voice-state="state" :style="{ '--event-dialog-bottom': 'calc(var(--app-safe-bottom) + 22.901rpx)', '--voice-breathe': `${MOTION.action_breathe}ms`, '--voice-feedback': `${MOTION.popover}ms` }" @close="close" @released="emit('released')">
    <template #header>
      <view class="voice-heading">
        <view class="voice-heading-copy"><text class="voice-title">Voice message</text><text class="voice-subtitle">Some things sound better in your voice.</text></view>
        <view class="voice-close" role="button" :tabindex="sending ? -1 : 0" aria-label="Close voice message" :aria-disabled="sending" :data-interaction="action_id('dismiss')" @click.stop="close" @keydown.enter="close" @keydown.space.prevent="close"><view><SourceIcon name="close" /></view></view>
      </view>
      <view v-if="group || participant" class="voice-recipient"><view class="voice-recipient-avatar"><ProfilePhoto v-if="group" :src="group.image_url" :name="group.title" event-cover /><UserAvatar v-else :src="participant.avatar_url" :name="participant.user_name" /></view><text>To {{ group ? group.title : participant.user_name }}</text></view>
    </template>

    <view class="voice-studio" :class="{ 'voice-studio--preview': has_audio, 'voice-studio--live': recording }">
      <template v-if="!has_audio">
        <view class="voice-status" role="status"><view v-if="recording" class="voice-live-dot" /><text>{{ status_label }}</text></view>
        <view class="voice-control-space">
          <view class="voice-orbit voice-orbit--outer" aria-hidden="true" /><view class="voice-orbit voice-orbit--inner" aria-hidden="true" />
          <view class="voice-record" role="button" :tabindex="busy || sending ? -1 : 0" :aria-label="control_label" :aria-disabled="busy || sending" :aria-busy="busy" :data-interaction="action_id('record')" @click.stop="record" @keydown.enter="record" @keydown.space.prevent="record">
            <view class="voice-record-icon"><BrandProgressMark v-if="busy" /><svg v-else-if="recording" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg><SourceIcon v-else name="mic" /></view>
          </view>
        </view>
        <view class="voice-timer" :aria-label="`${seconds || 0} seconds of 120 seconds`"><text>{{ mmss(seconds) }}</text><text class="voice-limit"> / 02:00</text></view>
        <text class="voice-instruction">{{ control_label }}</text>
      </template>
      <template v-else>
        <view class="voice-review-heading"><view class="voice-review-icon"><SourceIcon name="mic" /></view><text>Ready for a listen</text><text class="voice-duration">{{ mmss(media.duration_ms / 1000) }}</text></view>
        <EventAudio v-if="open" :key="media.url" :src="media.url" :duration="media.duration_ms" :disabled="sending || busy" :interaction="preview_id">
          <template #default="{ playing, pending, elapsed, error: playback_error, toggle }">
            <view class="voice-player" :data-playing="playing">
              <view class="voice-play" role="button" :tabindex="pending || sending ? -1 : 0" :aria-label="pending ? 'Loading voice message' : playing ? 'Pause voice message' : 'Play voice message'" :aria-disabled="pending || sending" :aria-busy="pending" :data-interaction="preview_id" @click.stop="toggle" @keydown.enter="toggle" @keydown.space.prevent="toggle"><view><BrandProgressMark v-if="pending" /><SourceIcon v-else :name="playing ? 'pause' : 'play'" /></view></view>
              <view class="voice-playback"><view class="voice-track" role="progressbar" aria-label="Voice playback progress" :aria-valuenow="Math.min(media.duration_ms, Math.floor(elapsed * 1000))" :aria-valuemax="media.duration_ms" aria-valuemin="0"><view :style="{ width: `${Math.min(100, elapsed * 100000 / media.duration_ms)}%` }" /></view><view class="voice-playback-labels"><text>{{ pending ? 'Preparing audio…' : playing ? 'Playing' : elapsed * 1000 >= media.duration_ms ? 'Ready to replay' : elapsed ? 'Paused' : 'Listen before sending' }}</text><text>{{ mmss(Math.floor(elapsed)) }}</text></view></view>
            </view>
            <text v-if="playback_error" class="voice-error" role="alert">{{ playback_error }}</text>
          </template>
        </EventAudio>
        <view class="voice-rerecord" role="button" :tabindex="busy || sending ? -1 : 0" :aria-disabled="busy || sending" :data-interaction="action_id('record')" @click.stop="record" @keydown.enter="record" @keydown.space.prevent="record"><view><IcebreakerIcon name="rerecord" /></view><text>Record again</text></view>
      </template>
    </view>
    <text v-if="error" class="voice-error" role="alert">{{ error }}</text>

    <template #footer>
      <view class="voice-footer">
        <text class="voice-note">{{ has_audio ? 'Send when it feels right.' : 'Up to 2 minutes. Always review before sending.' }}</text>
        <view v-if="has_audio" class="voice-send chat-media-send" role="button" :tabindex="busy || sending ? -1 : 0" :aria-disabled="busy || sending" :aria-busy="sending" :data-interaction="action_id('send')" @click.stop="send" @keydown.enter="send" @keydown.space.prevent="send"><ChatActionLoading :visible="sending" label="Sending voice message" /><view v-show="!sending" class="voice-send-icon"><ConnectionIcon name="send" /></view><text>{{ sending ? 'Sending…' : 'Send voice message' }}</text></view>
        <view class="voice-cancel" role="button" :tabindex="sending ? -1 : 0" :aria-disabled="sending" :data-interaction="action_id('close', 2)" @click.stop="close" @keydown.enter="close" @keydown.space.prevent="close">Cancel</view>
      </view>
    </template>
  </EventConfirmDialog>
</template>

<style scoped>
.chat-voice-sheet :deep(.event-dialog-panel) {
  right: 22.901rpx;
  left: 22.901rpx;
  padding: 19.084rpx 30.534rpx 11.45rpx;
  border: 1px solid var(--cimoa-surface-voice-border);
  border-radius: 53.435rpx;
  background: var(--cimoa-gradient-voice-sheet);
  box-shadow: var(--cimoa-shadow-voice-sheet);
}
.chat-voice-sheet :deep(.event-dialog-handle) { width: 64.885rpx; height: 7.634rpx; margin-bottom: 30.534rpx; background: var(--cimoa-surface-outline); }
.voice-heading { display: flex; align-items: flex-start; gap: 11.45rpx; }
.voice-heading-copy { flex: 1; min-width: 0; padding-top: 1.908rpx; }
.voice-title {
  display: block;
  color: var(--cimoa-text-title);
  font-size: 41.985rpx;
  font-weight: 750;
  letter-spacing: -0.025em;
  line-height: 1.2;
}
.voice-subtitle { display: block; margin-top: 11.45rpx; color: var(--cimoa-text-secondary); font-size: 25.763rpx; line-height: 1.5; }
.voice-close {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 83.969rpx;
  height: 83.969rpx;
  margin-top: -11.45rpx;
  margin-right: -15.267rpx;
  color: var(--cimoa-text-secondary);
  cursor: pointer;
}
.voice-close > view { width: 61.069rpx; height: 61.069rpx; padding: 11.45rpx; border-radius: 50%; background: var(--cimoa-surface-tinted); }
.voice-recipient {
  display: flex;
  align-items: center;
  align-self: flex-start;
  gap: 11.45rpx;
  max-width: 100%;
  margin: 26.718rpx 0;
  color: var(--cimoa-text-secondary);
  font-size: 24.809rpx;
}
.voice-recipient-avatar {
  position: relative;
  flex: none;
  width: 41.985rpx;
  height: 41.985rpx;
  border-radius: 50%;
  overflow: hidden;
}
.voice-recipient > text { min-width: 0; overflow-wrap: anywhere; }
.voice-studio {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 396.947rpx;
  padding: 26.718rpx 22.901rpx;
  border: 1px solid var(--cimoa-surface-voice-border);
  border-radius: 38.168rpx;
  background: var(--cimoa-gradient-voice-stage);
}
.voice-status {
  display: flex;
  align-items: center;
  gap: 11.45rpx;
  color: var(--cimoa-text-secondary);
  font-size: 24.809rpx;
  font-weight: 550;
}
.voice-live-dot { width: 11.45rpx; height: 11.45rpx; border-radius: 50%; background: var(--cimoa-brand-purple); }
.voice-control-space {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 244.275rpx;
  height: 217.557rpx;
  margin: 7.634rpx 0;
}
.voice-orbit { position: absolute; border: 1px solid var(--cimoa-surface-voice-border); border-radius: 50%; pointer-events: none; }
.voice-orbit--outer { width: 213.74rpx; height: 213.74rpx; }
.voice-orbit--inner { width: 183.206rpx; height: 183.206rpx; }
.voice-record {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 148.855rpx;
  height: 148.855rpx;
  border-radius: 50%;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-gradient-chat-send);
  box-shadow: var(--cimoa-shadow-voice-control);
  cursor: pointer;
  transition: transform var(--voice-feedback) ease;
}
.voice-record-icon { width: 64.885rpx; height: 64.885rpx; }
/* Keep the native target on its stable control while recording/player icons change. */;
.voice-close > view, .voice-record-icon, .voice-play > view, .voice-rerecord > view, .voice-send > view, .voice-send > text { pointer-events: none; }
.voice-record-icon > svg { display: block; width: 100%; height: 100%; }
.voice-record[aria-busy="true"] { background: var(--cimoa-surface-card); }
.voice-studio--live .voice-orbit--outer { animation: voice-breathe var(--voice-breathe) ease-in-out infinite; }
.voice-timer {
  color: var(--cimoa-text-title);
  font-size: 41.985rpx;
  font-weight: 650;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
}
.voice-limit { color: var(--cimoa-text-secondary); font-size: 24.809rpx; font-weight: 450; letter-spacing: 0; }
.voice-instruction { margin-top: 11.45rpx; color: var(--cimoa-text-secondary); font-size: 24.809rpx; text-align: center; }
.voice-review-heading {
  display: flex;
  align-items: center;
  gap: 11.45rpx;
  align-self: stretch;
  color: var(--cimoa-text-title);
  font-size: 26.718rpx;
  font-weight: 600;
}
.voice-review-icon { width: 30.534rpx; height: 30.534rpx; color: var(--cimoa-brand-purple); }
.voice-duration { margin-left: auto; color: var(--cimoa-text-secondary); font-size: 24.809rpx; font-variant-numeric: tabular-nums; }
.voice-studio :deep(.event-audio) { width: 100%; }
.voice-player { display: flex; align-items: center; gap: 26.718rpx; width: 100%; margin: 45.802rpx 0 22.901rpx; }
.voice-play {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 106.87rpx;
  height: 106.87rpx;
  border-radius: 50%;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-gradient-chat-send);
  cursor: pointer;
}
.voice-play > view { width: 41.985rpx; height: 41.985rpx; }
.voice-play[aria-busy="true"] { background: var(--cimoa-surface-card); }
.voice-playback { flex: 1; min-width: 0; }
.voice-track { height: 9.542rpx; overflow: hidden; border-radius: 9.542rpx; background: var(--cimoa-surface-outline); }
.voice-track > view { height: 100%; border-radius: inherit; background: var(--cimoa-gradient-primary); }
.voice-playback-labels {
  display: flex;
  justify-content: space-between;
  gap: 7.634rpx;
  margin-top: 15.267rpx;
  color: var(--cimoa-text-secondary);
  font-size: 22.901rpx;
  line-height: 1.4;
}
.voice-playback-labels > text:last-child { flex: none; font-variant-numeric: tabular-nums; }
.voice-rerecord {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 11.45rpx;
  min-height: 83.969rpx;
  padding: 0 26.718rpx;
  color: var(--cimoa-text-settings-purple);
  font-size: 26.718rpx;
  font-weight: 600;
  cursor: pointer;
}
.voice-rerecord > view { width: 34.351rpx; height: 34.351rpx; }
.voice-error {
  display: block;
  margin-top: 19.084rpx;
  color: var(--cimoa-status-danger);
  font-size: 24.809rpx;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.voice-footer { flex: none; padding-top: 26.718rpx; }
.voice-note { display: block; color: var(--cimoa-text-secondary); font-size: 22.901rpx; line-height: 1.5; text-align: center; }
.voice-send {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15.267rpx;
  min-height: 103.053rpx;
  margin-top: 22.901rpx;
  padding: 11.45rpx 22.901rpx;
  box-sizing: border-box;
  border-radius: 53.435rpx;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-gradient-primary);
  box-shadow: var(--cimoa-shadow-connection-chat-send);
  font-size: 30.534rpx;
  font-weight: 650;
  cursor: pointer;
}
.voice-send-icon { width: 34.351rpx; height: 34.351rpx; }
.voice-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 83.969rpx;
  margin-top: 7.634rpx;
  color: var(--cimoa-text-secondary);
  font-size: 26.718rpx;
  font-weight: 550;
  cursor: pointer;
}
.chat-voice-sheet [aria-disabled="true"] { cursor: default; }
.voice-send[aria-disabled="true"], .voice-rerecord[aria-disabled="true"], .voice-cancel[aria-disabled="true"], .voice-close[aria-disabled="true"] { opacity: 0.55; }
.voice-record:not([aria-disabled="true"]):active, .voice-play:not([aria-disabled="true"]):active, .voice-send:not([aria-disabled="true"]):active { transform: scale(0.96); }
.chat-voice-sheet [role="button"]:focus-visible { outline: 2px solid var(--cimoa-brand-purple); outline-offset: 5.725rpx; }
@keyframes voice-breathe {
  0%, 100% { transform: scale(0.96); opacity: 0.45; }
  50% { transform: scale(1.07); opacity: 0.9; }
}
@media (prefers-reduced-motion: reduce) {
  .voice-studio--live .voice-orbit--outer { animation: none; }
  .voice-record { transition: none; }
  .voice-record:not([aria-disabled="true"]):active, .voice-play:not([aria-disabled="true"]):active, .voice-send:not([aria-disabled="true"]):active { transform: none; }
  .chat-voice-sheet :deep(.event-dialog-panel), .chat-voice-sheet :deep(.event-dialog-mask) { transition: none; }
}
</style>
