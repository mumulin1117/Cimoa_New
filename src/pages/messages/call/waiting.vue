<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { create_waiting_call } from '@/utils/waitingCall.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const store = use_app_store()
const frame = ref(null)
const conversation_id = ref('')
const dots = ref('')
const error = ref('')
const ending = ref(false)
let waiting = null
const conversation = computed(() => store.direct_conversation(conversation_id.value))
const participant = computed(() => conversation.value?.participant || null)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Return and retry.'
  : !store.session.is_authenticated
    ? 'Your session has expired. Please sign in again.'
    : !conversation.value
      ? 'This conversation is unavailable, so the call cannot be started.'
      : '')

onLoad(options => { conversation_id.value = String(options?.conversation_id || '') })
const dispose = () => { waiting?.dispose(); waiting = null }
onHide(dispose)
onUnmounted(dispose)
const return_to_chat = async () => {
  if (ending.value) return
  ending.value = true
  dispose()
  try { await frame.value.navigate_back(`/pages/messages/chat?conversation_id=${encodeURIComponent(conversation_id.value)}`) } catch (cause) { error.value = cause.message; ending.value = false }
}
const start_waiting = () => {
  dispose(); dots.value = ''; ending.value = false
  if (access_error.value) return
  waiting = create_waiting_call({ on_dots: value => { dots.value = value }, on_end: return_to_chat })
}
onShow(start_waiting)
const end_call = () => { if (!ending.value) waiting?.end('manual') }
</script>

<template>
  <SecondaryPageFrame ref="frame" class="waiting-call-page" :scroll-locked="true">
    <view v-if="access_error" class="waiting-call-error" role="alert">{{ access_error }}</view>
    <view v-else class="waiting-call-content">
      <view class="waiting-call-avatar"><UserAvatar :src="participant?.avatar_url" :name="participant?.user_name" /></view>
      <text class="waiting-call-name">{{ participant?.user_name }}</text>
      <text class="waiting-call-state">Waiting for {{ participant?.user_name }}{{ dots }}</text>
      <text class="waiting-call-copy">This local simulation never claims the other person answered. It returns to your conversation after 8–12 seconds.</text>
      <view class="waiting-call-end" role="button" tabindex="0" :aria-disabled="ending" data-interaction="callActive.endCall.click.1" @click="end_call" @keydown.enter="end_call"><svg viewBox="0 0 24 24"><path d="M12 9.2c-3.3 0-6.3 1-8.6 2.8-.6.5-.9 1.2-.8 2l.3 1.8c.1.8.9 1.3 1.7 1.1l3-.8c.6-.2 1-.7 1-1.3v-1.6c1.1-.4 2.2-.5 3.4-.5s2.3.1 3.4.5v1.6c0 .6.4 1.1 1 1.3l3 .8c.8.2 1.6-.3 1.7-1.1l.3-1.8c.1-.8-.2-1.5-.8-2-2.3-1.8-5.3-2.8-8.6-2.8z" /></svg></view>
      <text class="waiting-call-end-label">{{ ending ? 'Returning…' : 'End call' }}</text>
      <text v-if="error" class="waiting-call-error" role="alert">{{ error }}</text>
    </view>
  </SecondaryPageFrame>
</template>

<style scoped>
.waiting-call-page { color: var(--cimoa-text-inverse); background: var(--cimoa-surface-deep); }
.waiting-call-content { display: flex; flex-direction: column; align-items: center; min-height: 100%; padding: 152.672rpx 53.435rpx 76.336rpx; box-sizing: border-box; text-align: center; }
.waiting-call-avatar { width: 209.924rpx; height: 209.924rpx; border: 6.679rpx solid var(--cimoa-surface-card); border-radius: 50%; box-shadow: var(--cimoa-shadow-discover-photo); }
.waiting-call-name { margin-top: 34.351rpx; font-size: 57.252rpx; font-weight: 800; letter-spacing: -0.03em; }
.waiting-call-state { margin-top: 19.084rpx; font-size: 32.443rpx; font-weight: 600; }
.waiting-call-copy { max-width: 610.687rpx; margin-top: 22.901rpx; color: var(--cimoa-text-profile-song-artist); font-size: 26.718rpx; line-height: 1.5; }
.waiting-call-end { display: flex; align-items: center; justify-content: center; width: 133.588rpx; height: 133.588rpx; margin-top: auto; border-radius: 50%; background: var(--cimoa-status-danger); box-shadow: var(--cimoa-shadow-event-confirm); cursor: pointer; }
.waiting-call-end svg { width: 57.252rpx; height: 57.252rpx; fill: var(--cimoa-text-inverse); }
.waiting-call-end[aria-disabled="true"] { opacity: 0.55; cursor: default; }
.waiting-call-end-label { margin-top: 19.084rpx; font-size: 28.626rpx; font-weight: 600; }
.waiting-call-error { display: block; margin: 76.336rpx 38.168rpx; padding: 38.168rpx; border-radius: 38.168rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); font-size: 28.626rpx; line-height: 1.45; }
</style>
