<script setup>
import { computed, nextTick, ref, watch, onUnmounted } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store, make_operation_id } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_event_media } from '@/composables/useEventMedia.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import EventAudio from '@/components/EventAudio.vue'
import EventConfirmDialog from '@/components/EventConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import SafetyActionsSheet from '@/components/SafetyActionsSheet.vue'

const store = use_app_store()
const frame = ref(null)
const conversation_id = ref('')
const draft = ref('')
const sheet = ref('')
const scroll_target = ref('')
const error = ref('')
const active = ref(true)
const was_available = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { draft: media, recording, busy: media_busy, seconds, clear: clear_media, photo, start: start_recording, stop: stop_recording } = use_event_media(error)

const conversation = computed(() => store.direct_conversation(conversation_id.value))
const participant = computed(() => conversation.value?.participant || null)
const participant_first_name = computed(() => participant.value?.user_name?.trim().split(/\s+/)[0] || 'student')
const muted = computed(() => participant.value ? store.is_direct_muted(participant.value.user_id) : false)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated
    ? 'Your session has expired. Please sign in again.'
    : !conversation.value
      ? 'This conversation is unavailable. It may have ended or the account may be blocked.'
      : '')
const locked = computed(() => !!sheet.value || is_loading.value || media_busy.value)

onLoad(options => {
  conversation_id.value = String(options?.conversation_id || '')
  was_available.value = !!store.direct_conversation(conversation_id.value)
})
const leave = () => { active.value = false; sheet.value = ''; cancel_loading(); clear_media() }
onHide(leave)
onUnmounted(leave)

const scroll_last = async () => {
  scroll_target.value = ''
  await nextTick()
  if (active.value && conversation.value) scroll_target.value = conversation.value.messages.at(-1)?.message_id || ''
}
watch(() => conversation.value?.messages.at(-1)?.message_id, scroll_last, { immediate: true })
onShow(async () => {
  active.value = true
  error.value = ''
  if (was_available.value && store.hydration_status === 'ready' && !conversation.value) {
    try { await frame.value.navigate_back('/pages/home/index') } catch (cause) { error.value = cause.message }
    return
  }
  const row = store.current_conversations.find(item => item.conversation_id === conversation_id.value)
  if (row?.unread_count) {
    const result = await run_with_loading(() => store.mark_read(conversation_id.value))
    if (active.value && !result.success && result.reason !== 'cancelled') error.value = result.message
  }
  scroll_last()
})

const close_sheet = () => { if (!locked.value || (!is_loading.value && !media_busy.value)) { sheet.value = ''; error.value = ''; clear_media() } }
const back = async () => { if (locked.value) return; try { await frame.value.navigate_back('/pages/home/index') } catch (cause) { error.value = cause.message } }
const open_profile = async () => {
  if (is_loading.value || media_busy.value || access_error.value) return
  sheet.value = ''
  try { await frame.value.navigate_forward(`/pages/discover/profile?user_id=${encodeURIComponent(participant.value.user_id)}&origin_conversation_id=${encodeURIComponent(conversation_id.value)}`) } catch (cause) { error.value = cause.message }
}
const start_call = async () => {
  if (locked.value || access_error.value) return
  try { await frame.value.navigate_forward(`/pages/messages/call/waiting?conversation_id=${encodeURIComponent(conversation_id.value)}`) } catch (cause) { error.value = cause.message }
}
const open_report = async () => {
  if (is_loading.value || access_error.value) return
  sheet.value = ''
  try { await frame.value.navigate_forward(`/pages/safety/report-user?target_user_id=${encodeURIComponent(participant.value.user_id)}&context_id=${encodeURIComponent(conversation_id.value)}`) } catch (cause) { error.value = cause.message }
}
const toggle_mute = async () => {
  if (is_loading.value || access_error.value) return
  error.value = ''
  const result = await run_with_loading(() => store.set_direct_muted(participant.value.user_id, !muted.value))
  if (!active.value || result.reason === 'cancelled') return
  if (!result.success) error.value = result.message
}
const confirm_block = async () => {
  if (is_loading.value || access_error.value) return
  error.value = ''
  const result = await run_with_loading(() => store.block_user(participant.value.user_id))
  if (!active.value || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  sheet.value = ''
  try { await frame.value.navigate_back('/pages/home/index') } catch (cause) { error.value = cause.message }
}
const send = async (with_media = false) => {
  if (is_loading.value || media_busy.value || access_error.value || (sheet.value && !['media', 'voice'].includes(sheet.value))) return
  const payload = with_media ? media.value : null
  const body = with_media ? '' : draft.value
  error.value = store.direct_message_error(conversation_id.value, body, payload)
  if (error.value) return
  const result = await run_with_loading(scope => store.send_direct_message(conversation_id.value, body, payload, make_operation_id('direct_send'), scope))
  if (!active.value || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  if (with_media) { sheet.value = ''; clear_media() } else draft.value = ''
  await scroll_last()
}
const pick_photo = async () => {
  if (locked.value || access_error.value) return
  if (await photo()) sheet.value = 'media'
}
const open_voice = () => { if (!locked.value && !access_error.value) { error.value = ''; clear_media(); sheet.value = 'voice' } }
</script>

<template>
  <SecondaryPageFrame ref="frame" class="direct-chat-page" :scroll-locked="locked" :scroll-into-view="scroll_target">
    <template #header>
      <view class="chat-header">
        <view class="chat-round" role="button" tabindex="0" aria-label="Back" data-interaction="chat.goBack.click.1" @click="back" @keydown.enter="back"><view class="chat-icon"><SourceIcon name="back" /></view></view>
        <template v-if="participant">
          <view class="chat-person" role="button" tabindex="0" :aria-label="`View ${participant.user_name} profile`" data-interaction="chat.viewProfile.click.1" @click="open_profile" @keydown.enter="open_profile">
            <view class="chat-avatar"><UserAvatar :src="participant.avatar_url" :name="participant.user_name" /><view class="chat-online-dot" /></view>
            <view class="chat-heading"><text>{{ participant_first_name }}</text><text><view class="chat-status-dot" />Connected{{ muted ? ' · Muted' : '' }}</text></view>
          </view>
          <view class="chat-round chat-call" role="button" tabindex="0" aria-label="Start video call" data-interaction="chat.startCall.click.1" @click="start_call" @keydown.enter="start_call"><svg viewBox="0 0 24 24"><rect x="1.5" y="5.5" width="14.5" height="13" rx="3.2" /><path d="M17 10.2 22 7v10l-5-3.2z" /></svg></view>
          <view class="chat-round" role="button" tabindex="0" aria-label="Safety actions" data-interaction="chat.openSafety.click.1" @click="sheet = 'safety'; error = ''" @keydown.enter="sheet = 'safety'; error = ''"><view class="chat-icon"><SourceIcon name="more" /></view></view>
        </template>
      </view>
    </template>

    <view v-if="access_error" class="chat-state" role="alert">{{ access_error }}</view>
    <view v-else class="chat-messages">
      <text class="chat-day">Messages are stored locally on this device.</text>
      <view v-if="!conversation.messages.length" class="chat-state" role="status">No messages yet. Start the conversation when you’re ready.</view>
      <view v-for="message in conversation.messages" :id="message.message_id" :key="message.message_id" class="chat-message" :class="{ 'chat-message--mine': message.mine }">
        <view v-if="!message.mine" class="chat-message-avatar"><UserAvatar :src="participant.avatar_url" :name="participant.user_name" /></view>
        <view class="chat-message-main">
          <view class="chat-bubble">
            <text v-if="message.kind === 'text'">{{ message.body }}</text>
            <view v-else-if="message.kind === 'image'" class="chat-image"><ProfilePhoto :src="message.media?.media_url || ''" name="Shared photo" portrait /></view>
            <EventAudio v-else :src="message.media?.media_url || ''" :duration="message.media?.duration_ms" interaction="chat.media.play.click.1" />
          </view>
          <text class="chat-time">{{ message.time_label }}</text>
        </view>
      </view>
    </view>

    <template #footer>
      <text v-if="error && !sheet" class="chat-error" role="alert">{{ error }}</text>
      <view v-if="!access_error" class="chat-composer">
        <view class="chat-round" role="button" tabindex="0" aria-label="Send photo" :aria-disabled="locked" data-interaction="chat.sendPhoto.click.1" @click="pick_photo" @keydown.enter="pick_photo"><view class="chat-icon"><SourceIcon name="photo" /></view></view>
        <view class="chat-input"><input v-model="draft" :disabled="locked" :maxlength="2000" :placeholder="`Message ${participant_first_name}`" aria-label="Message" data-interaction="chat.onDraft.change.1" @confirm="send(false)" /><view class="chat-mic" role="button" tabindex="0" aria-label="Record voice message" :aria-disabled="locked" data-interaction="chat.sendVoiceMsg.click.1" @click="open_voice" @keydown.enter="open_voice"><SourceIcon name="mic" /></view></view>
        <view class="chat-send" role="button" tabindex="0" aria-label="Send message" :aria-disabled="locked || !draft.trim()" data-interaction="chat.send.click.1" @click="send(false)" @keydown.enter="send(false)"><view class="chat-icon"><SourceIcon name="send" /></view></view>
      </view>
    </template>

    <template #overlays>
      <SafetyActionsSheet :open="['safety', 'block'].includes(sheet)" :mode="sheet === 'block' ? 'block' : 'menu'" :user-name="participant?.user_name" :muted="muted" :busy="is_loading" :error="error" @close="close_sheet" @view-profile="open_profile" @toggle-mute="toggle_mute" @report="open_report" @open-block="sheet = 'block'; error = ''" @confirm-block="confirm_block" />
      <EventConfirmDialog :open="['media', 'voice'].includes(sheet)" :busy="is_loading || media_busy" :label="sheet === 'voice' ? 'Voice message' : 'Send photo?'" close-interaction="chat.media.close.click.1" style="--event-dialog-bottom: var(--app-safe-bottom);" @close="close_sheet">
        <text class="event-dialog-title">{{ sheet === 'voice' ? 'Voice message' : 'Send photo?' }}</text>
        <view v-if="media?.kind === 'image'" class="chat-media-preview"><ProfilePhoto :src="media.url" name="Photo preview" portrait /></view>
        <template v-if="sheet === 'voice'">
          <text class="event-dialog-copy">{{ recording ? `Recording · ${seconds}s / 120s` : 'Record up to two minutes. Review it before sending.' }}</text>
          <EventAudio v-if="media?.kind === 'audio'" :key="media.url" :src="media.url" :duration="media.duration_ms" interaction="chat.media.preview.click.1" />
          <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="media_busy || is_loading" data-interaction="chat.media.record.click.1" @click="!is_loading && (recording ? stop_recording() : start_recording())" @keydown.enter="!is_loading && (recording ? stop_recording() : start_recording())">{{ media_busy ? 'Opening microphone…' : recording ? 'Stop recording' : media ? 'Record again' : 'Start recording' }}</view>
        </template>
        <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
        <view v-if="media" class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="is_loading || media_busy" data-interaction="chat.media.send.click.1" @click="send(true)" @keydown.enter="send(true)">Send {{ media.kind === 'image' ? 'photo' : 'voice message' }}</view>
        <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="chat.media.close.click.2" @click="close_sheet" @keydown.enter="close_sheet">Cancel</view>
      </EventConfirmDialog>
      <EventActionLoading :visible="is_loading" :label="sheet === 'block' ? 'Blocking account…' : sheet === 'safety' ? 'Saving notification preference…' : 'Saving message…'" />
    </template>
  </SecondaryPageFrame>
</template>

<style scoped>
.direct-chat-page { background: var(--cimoa-page-gradient); }
.chat-header { display: flex; align-items: center; gap: 22.901rpx; min-height: 122.137rpx; padding: 11.45rpx 34.351rpx 7.634rpx; }
.chat-round { flex: none; display: flex; align-items: center; justify-content: center; width: 99.237rpx; height: 99.237rpx; border-radius: 50%; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); color: var(--cimoa-text-title); cursor: pointer; }
.chat-icon { width: 41.985rpx; height: 41.985rpx; }
.chat-person { display: flex; align-items: center; flex: 1; min-width: 0; gap: 19.084rpx; cursor: pointer; }
.chat-avatar { position: relative; flex: none; width: 110.687rpx; height: 110.687rpx; border: 5.725rpx solid var(--cimoa-surface-card); border-radius: 50%; box-shadow: var(--cimoa-shadow-header); }
.chat-online-dot { position: absolute; right: -1.908rpx; bottom: 1.908rpx; width: 28.626rpx; height: 28.626rpx; border: 4.771rpx solid var(--cimoa-surface-card); border-radius: 50%; background: var(--cimoa-status-success); }
.chat-heading { flex: 1; min-width: 0; }
.chat-heading > text:first-child { display: block; overflow: hidden; color: var(--cimoa-text-title); font-size: 45.802rpx; font-weight: 800; letter-spacing: -0.03em; text-overflow: ellipsis; white-space: nowrap; }
.chat-heading > text:last-child { display: flex; align-items: center; gap: 11.45rpx; margin-top: 1.908rpx; color: var(--cimoa-text-secondary); font-size: 28.626rpx; }
.chat-status-dot { width: 17.176rpx; height: 17.176rpx; border-radius: 50%; background: var(--cimoa-status-success); }
.chat-call svg { width: 64.885rpx; height: 64.885rpx; fill: var(--cimoa-button-primary); }
.chat-messages { display: flex; flex-direction: column; gap: 34.351rpx; padding: 30.534rpx 34.351rpx 41.985rpx; }
.chat-day { color: var(--cimoa-text-auth-placeholder); font-size: 27.672rpx; text-align: center; }
.chat-message { display: flex; align-items: flex-end; gap: 19.084rpx; justify-content: flex-start; }
.chat-message--mine { justify-content: flex-end; }
.chat-message-avatar { flex: none; width: 80.153rpx; height: 80.153rpx; border: 3.817rpx solid var(--cimoa-surface-card); border-radius: 50%; box-shadow: var(--cimoa-shadow-card); }
.chat-message-main { display: flex; flex-direction: column; align-items: flex-start; max-width: 68%; }
.chat-message--mine .chat-message-main { align-items: flex-end; }
.chat-bubble { max-width: 100%; padding: 26.718rpx 34.351rpx; border-radius: 49.618rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); color: var(--cimoa-text-title); font-size: 34.351rpx; font-weight: 500; line-height: 1.35; overflow-wrap: anywhere; }
.chat-message--mine .chat-bubble { color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-primary); }
.chat-time { margin-top: 7.634rpx; color: var(--cimoa-text-tertiary); font-size: 24.809rpx; }
.chat-image { position: relative; width: 343.511rpx; height: 343.511rpx; overflow: hidden; border-radius: 30.534rpx; }
.chat-state { margin: 45.802rpx 38.168rpx; padding: 45.802rpx; border-radius: 45.802rpx; color: var(--cimoa-text-secondary); background: var(--cimoa-surface-empty); font-size: 30.534rpx; line-height: 1.5; }
.chat-error { display: block; padding: 15.267rpx 34.351rpx 0; color: var(--cimoa-status-danger); font-size: 26.718rpx; overflow-wrap: anywhere; }
.chat-composer { display: flex; align-items: center; gap: 19.084rpx; min-height: 137.405rpx; padding: 15.267rpx 30.534rpx; background: var(--cimoa-surface-event-group-composer); }
.chat-input { display: flex; align-items: center; flex: 1; min-width: 0; height: 103.053rpx; padding: 0 19.084rpx 0 38.168rpx; border-radius: 51.527rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-auth-input); }
.chat-input input { flex: 1; min-width: 0; color: var(--cimoa-text-title); font-size: 32.443rpx; }
.chat-mic { flex: none; width: 45.802rpx; height: 45.802rpx; color: var(--cimoa-text-title); cursor: pointer; }
.chat-send { flex: none; display: flex; align-items: center; justify-content: center; width: 106.87rpx; height: 106.87rpx; border: 5.725rpx solid var(--cimoa-surface-card); border-radius: 50%; background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-primary); color: var(--cimoa-text-inverse); cursor: pointer; }
.chat-send[aria-disabled="true"], .chat-round[aria-disabled="true"], .chat-mic[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.chat-media-preview { position: relative; width: 100%; height: 572.519rpx; margin-top: 30.534rpx; overflow: hidden; border-radius: 38.168rpx; }
</style>
