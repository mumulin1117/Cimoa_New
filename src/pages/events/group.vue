<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_event_page } from '@/composables/useEventPage.js'
import { use_event_media } from '@/composables/useEventMedia.js'
import { use_visual_viewport } from '@/composables/useEventViewport.js'
import { make_operation_id } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import EventAudio from '@/components/EventAudio.vue'
import EventConfirmDialog from '@/components/EventConfirmDialog.vue'
import EvCancelConfirmDialog from '@/components/EvCancelConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
const frame = ref(null), draft = ref(''), scroll_target = ref(''), preview_id = ref(''), active = ref(false)
const { height: viewport_height, keyboard_open } = use_visual_viewport()
const { store, event_id, conversation_id, event, access_error, error, sheet, locked, is_loading, go, back, open, close, write, attendance, cancel } = use_event_page(frame, { joinedOnly: true })
const group = computed(() => store.event_group(event_id.value, conversation_id.value))
const preview = computed(() => group.value?.messages.find(message => message.message_id === preview_id.value && message.kind === 'image')?.media?.media_url || '')
const group_error = computed(() => access_error.value || (!group.value ? 'This event and group do not match, or access has ended.' : ''))
const { draft: media, recording, busy, seconds, clear, photo, start, stop } = use_event_media(error)
let read_attempt = ''
const clear_transient = () => { clear(); draft.value = ''; preview_id.value = ''; cancel() }
watch(group_error, value => { if (value) clear_transient() })
watch(preview, value => { if (!value && sheet.value === 'preview') { preview_id.value = ''; close() } }, { flush: 'sync' })
onHide(() => { active.value = false; clear_transient() }); onShow(() => { active.value = true; read_attempt = '' })
const scroll_last = async () => { scroll_target.value = ''; await nextTick(); if (active.value && !group_error.value) scroll_target.value = group.value?.messages.at(-1)?.message_id || '' }
watch(() => group.value?.messages.at(-1)?.message_id, scroll_last, { immediate: true }); onShow(scroll_last)
watch(viewport_height, scroll_last)
watch(() => [active.value, group.value?.unread_count, is_loading.value, locked.value], async () => {
  if (!active.value || !group.value?.unread_count || is_loading.value || locked.value) return
  const unread_ids = group.value.messages.filter(row => row.sender_id !== store.session.current_user_id && !row.read_by.includes(store.session.current_user_id)).map(row => row.message_id).join(':')
  if (read_attempt === unread_ids) return
  read_attempt = unread_ids
  const result = await write(() => store.mark_read(conversation_id.value))
  if (active.value && !group_error.value && !result.success && result.reason !== 'cancelled') error.value = result.message
}, { immediate: true })
const close_media = () => { if (is_loading.value) return; close(); clear(); preview_id.value = '' }
const pick_photo = async () => { if (is_loading.value || locked.value || group_error.value) return; if (await photo()) open('media') }
const voice = () => { if (group_error.value || locked.value || busy.value || is_loading.value) return; clear(); open('voice') }
const show_image = message_id => {
  if (group_error.value || is_loading.value || locked.value) return
  preview_id.value = message_id
  if (preview.value) open('preview')
}
const send = async (with_media = false) => {
  if (is_loading.value || busy.value || group_error.value || (with_media ? !['media', 'voice'].includes(sheet.value) : locked.value)) return
  const content = with_media ? '' : draft.value, payload = with_media ? media.value : null
  if (with_media && !payload) return
  error.value = store.event_message_error(event_id.value, conversation_id.value, content, payload)
  if (error.value) return
  const operation_id = make_operation_id('group_send')
  const result = await write(scope => store.send_event_message(event_id.value, conversation_id.value, content, payload, operation_id, scope))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  if (with_media) close_media(); else draft.value = ''
  await scroll_last()
}
const toggle_mute = async () => {
  if (is_loading.value || group_error.value) return
  const result = await write(() => store.set_event_group_muted(event_id.value, conversation_id.value, !group.value.muted))
  if (!result.success && result.reason !== 'cancelled') error.value = result.message
}
const navigate_menu = kind => { close(); go(kind) }
</script>
<template>
  <SecondaryPageFrame ref="frame" class="event-page event-group-page" :class="{ 'event-group-page--keyboard': keyboard_open }" :style="{ height: viewport_height, '--app-safe-bottom': keyboard_open ? '0px' : undefined }" :scroll-locked="locked || is_loading" :scroll-into-view="scroll_target">
    <template #header><view class="event-group-header">
      <view class="event-group-control" role="button" tabindex="0" aria-label="Back" data-interaction="evGroup.goBack.click.1" @click="back(`/pages/events/detail?event_id=${encodeURIComponent(event_id)}`)" @keydown.enter="back(`/pages/events/detail?event_id=${encodeURIComponent(event_id)}`)"><view class="event-page-icon"><SourceIcon name="back" /></view></view>
      <template v-if="!group_error"><view class="event-group-cover"><ProfilePhoto :src="event.image_url" :name="event.title" event-cover /></view><view class="event-group-heading"><text>{{ event.title }}</text><text>{{ event.participant_count }} participants{{ group.muted ? ' · Muted' : '' }}</text></view><view class="event-page-round" role="button" tabindex="0" aria-label="Group options" data-interaction="evGroup.openGroupMenu.click.1" @click="open('menu')" @keydown.enter="open('menu')"><view class="event-page-icon"><SourceIcon name="more" /></view></view></template>
    </view></template>
    <view v-if="group_error" class="event-page-state" role="alert">{{ group_error }}</view>
    <view v-else class="event-group-messages">
      <view v-if="event.organizer?.update_text" class="event-page-card event-group-notice"><view class="event-group-organizer"><view class="event-group-organizer-icon"><SourceIcon name="verification-university" /></view></view><view class="event-group-notice-copy"><text class="event-person-name">{{ event.organizer.name }}</text><text>{{ event.organizer.update_text }}</text></view></view>
      <view v-if="!group.messages.length" class="event-page-state">No messages yet. Say hello to the students joining this event.</view>
      <view v-for="message in group.messages" :id="message.message_id" :key="message.message_id" class="event-message" :class="{ 'event-message--mine': message.mine }" :data-message-id="message.message_id">
        <view v-if="!message.mine" class="event-message-avatar"><UserAvatar :src="message.sender?.avatar_url" :name="message.sender?.user_name" /></view>
        <view class="event-message-main"><view class="event-message-meta"><text v-if="message.mine" class="event-message-time">{{ message.time_label }}</text><text class="event-message-name">{{ message.mine ? 'You' : message.sender?.user_name }}</text><text v-if="!message.mine" class="event-message-time">{{ message.time_label }}</text></view><view class="event-message-bubble">
          <text v-if="message.kind === 'text'">{{ message.body }}</text>
          <view v-else-if="message.kind === 'image'" class="event-message-image" role="button" tabindex="0" aria-label="Open shared photo" data-interaction="eventGroup.media.preview.click.1" @click="show_image(message.message_id)" @keydown.enter="show_image(message.message_id)"><ProfilePhoto :src="message.media?.media_url" name="Shared event photo" @ready="scroll_last" /></view>
          <EventAudio v-else :src="message.media?.media_url" :duration="message.media?.duration_ms" />
        </view></view><view v-if="message.mine" class="event-message-avatar"><UserAvatar :src="message.sender?.avatar_url" :name="message.sender?.user_name" /></view>
      </view>
    </view>
    <template #footer>
      <text v-if="error && !sheet" class="event-page-error" role="alert">{{ error }}</text>
      <view v-if="!group_error" class="event-group-composer">
        <view class="event-group-control" role="button" tabindex="0" aria-label="Send photo" :aria-disabled="busy || is_loading" data-interaction="evGroup.sendPhoto.click.1" @click="pick_photo" @keydown.enter="pick_photo"><view class="event-page-icon"><SourceIcon name="photo" :stroke-width="1.9" /></view></view>
        <input v-model="draft" :disabled="is_loading || locked || busy" :maxlength="2000" aria-label="Message event group" placeholder="Message the group" data-interaction="evGroup.onGroupDraft.change.1" @confirm="send(false)" />
        <view class="event-group-control" role="button" tabindex="0" aria-label="Record voice message" :aria-disabled="busy || is_loading" data-interaction="evGroup.recordGroupVoice.click.1" @click="voice" @keydown.enter="voice"><view class="event-page-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" /></svg></view></view>
        <view class="event-group-send" role="button" tabindex="0" aria-label="Send message" :aria-disabled="is_loading" data-interaction="evGroup.sendGroup.click.1" @click="send(false)" @keydown.enter="send(false)"><view class="event-page-icon"><SourceIcon name="send" :stroke-width="2.2" /></view></view>
      </view>
    </template>
    <template #overlays>
      <EventConfirmDialog :open="sheet === 'menu'" :busy="is_loading" label="Event group options" close-interaction="eventGroup.menu.close.click.1" @close="close" @released="!sheet && (locked = false)">
        <text class="event-dialog-title">{{ event?.title }}</text><text class="event-dialog-copy">Notification preference is stored on this device. Remote push delivery is not configured.</text>
        <view class="event-page-menu" role="button" tabindex="0" data-interaction="eventGroup.menu.mute.click.1" @click="toggle_mute" @keydown.enter="toggle_mute">{{ group?.muted ? 'Unmute group' : 'Mute group' }}</view>
        <view class="event-page-menu" role="button" tabindex="0" data-interaction="eventGroup.menu.participants.click.1" @click="navigate_menu('participants')" @keydown.enter="navigate_menu('participants')">View participants</view>
        <view class="event-page-menu" role="button" tabindex="0" data-interaction="eventGroup.menu.detail.click.1" @click="navigate_menu('detail')" @keydown.enter="navigate_menu('detail')">View event</view>
        <view class="event-page-menu" role="button" tabindex="0" data-interaction="eventGroup.menu.manage.click.1" @click="sheet = 'cancel'; error = ''" @keydown.enter="sheet = 'cancel'; error = ''">Manage attendance</view>
        <view class="event-page-menu" role="button" tabindex="0" data-interaction="eventGroup.menu.report.click.1" @click="navigate_menu('report')" @keydown.enter="navigate_menu('report')">Report Event</view>
        <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text><view class="event-dialog-secondary" role="button" tabindex="0" @click="close" @keydown.enter="close">Close</view>
      </EventConfirmDialog>
      <EvCancelConfirmDialog :open="sheet === 'cancel'" :busy="is_loading" :error="error" @confirm="attendance" @close="close" @released="!sheet && (locked = false)" />
      <EventConfirmDialog :open="['media', 'voice', 'preview'].includes(sheet)" :busy="is_loading" :label="sheet === 'voice' ? 'Voice message' : sheet === 'preview' ? 'Shared photo' : 'Send photo?'" close-interaction="eventGroup.media.close.click.1" @close="close_media" @released="!sheet && (locked = false)">
        <text class="event-dialog-title">{{ sheet === 'voice' ? 'Voice message' : sheet === 'preview' ? 'Shared photo' : 'Send photo?' }}</text>
        <view v-if="sheet === 'preview' || media?.kind === 'image'" class="event-media-preview"><ProfilePhoto :src="sheet === 'preview' ? preview : media?.url" name="Event photo preview" contain /></view>
        <template v-if="sheet === 'voice'"><text class="event-dialog-copy">{{ recording ? `Recording · ${seconds}s / 120s` : 'Record up to two minutes. Review before sending.' }}</text><EventAudio v-if="media?.kind === 'audio'" :key="media.url" :src="media.url" :duration="media.duration_ms" /><view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="busy || is_loading" data-interaction="eventGroup.media.record.click.1" @click="!is_loading && (recording ? stop() : start())" @keydown.enter="!is_loading && (recording ? stop() : start())">{{ busy ? 'Opening microphone…' : recording ? 'Stop recording' : media ? 'Record again' : 'Start recording' }}</view></template>
        <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
        <view v-if="media && sheet !== 'preview'" class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="is_loading || busy" data-interaction="eventGroup.media.send.click.1" @click="send(true)" @keydown.enter="send(true)">Send {{ media.kind === 'image' ? 'photo' : 'voice message' }}</view>
        <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="eventGroup.media.close.click.2" @click="close_media" @keydown.enter="close_media">{{ sheet === 'preview' ? 'Close' : 'Cancel' }}</view>
      </EventConfirmDialog>
      <EventActionLoading :visible="is_loading" label="Saving event group…" />
    </template>
  </SecondaryPageFrame>
</template>

<style scoped>
.event-group-header { padding: 0 30.534rpx; }
.event-group-header .event-page-round .event-page-icon { width: 38.168rpx; height: 38.168rpx; }
.event-group-heading { font-weight: 800; letter-spacing: -0.02em; }
.event-group-heading > text:first-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-group-heading > text + text { margin-top: 0; letter-spacing: normal; }
.event-group-header .event-page-round { box-shadow: var(--cimoa-shadow-event-group-menu); }
.event-group-notice { display: flex; align-items: center; gap: 26.718rpx; }
.event-group-organizer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 50%;
  background: var(--cimoa-surface-profile-icon);
  flex: none;
}
.event-group-organizer-icon { width: 45.802rpx; height: 45.802rpx; }
.event-group-notice-copy { flex: 1; min-width: 0; }
.event-group-notice .event-person-name { font-size: 32.443rpx; font-weight: 800; letter-spacing: -0.02em; }
.event-group-notice-copy > text + text { display: block; margin-top: 3.817rpx; font-size: 29.58rpx; color: var(--cimoa-text-secondary); }
.event-message-main { display: flex; flex-direction: column; align-items: flex-start; gap: 9.542rpx; }
.event-message-bubble { max-width: 100%; white-space: normal; text-wrap: pretty; }
.event-message--mine .event-message-main { align-items: flex-end; }
.event-message-meta { padding: 0; align-items: center; color: var(--cimoa-text-secondary); }
.event-message-meta .event-message-name { color: var(--cimoa-text-secondary); font-size: 24.809rpx; font-weight: 700; }
.event-message-meta .event-message-time { color: var(--cimoa-text-auth-placeholder); font-size: 23.855rpx; font-weight: 400; }
.event-group-composer { min-height: 225.191rpx; padding: 22.901rpx 30.534rpx 53.435rpx; gap: 19.084rpx; }
.event-group-composer .event-group-control { width: 83.969rpx; }
.event-group-composer svg { width: 100%; height: 100%; display: block; }
.event-group-send { box-shadow: var(--cimoa-shadow-event-group-send); }
.event-group-composer :deep(.uni-input-placeholder) { color: var(--cimoa-text-chat-placeholder); font-weight: 400; padding-left: 3.817rpx; }
.event-group-composer [data-interaction='evGroup.recordGroupVoice.click.1'] .event-page-icon { width: 40.076rpx; height: 40.076rpx; }
.event-group-send .event-page-icon { width: 38.168rpx; height: 38.168rpx; }
.event-group-page--keyboard .event-group-composer { min-height: 137.405rpx; padding-bottom: 22.901rpx; }
</style>
