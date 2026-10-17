<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import ConnectionPageHeader from '@/components/ConnectionPageHeader.vue'
import ConnectionIcon from '@/components/ConnectionIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import EventAudio from '@/components/EventAudio.vue'

const store = use_app_store(), frame = ref(null), request_id = ref(''), error = ref('')
onLoad(options => { request_id.value = String(options?.request_id || '') })
const request = computed(() => store.request_detail(request_id.value))
const first_name = computed(() => request.value?.other?.user_name.split(' ')[0] || '')
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !request.value || request.value.sender_id !== store.session.current_user_id ? 'This sent request is unavailable.' : '')
const status_label = computed(() => request.value?.status === 'pending' ? `Waiting for ${first_name.value}` : request.value?.status === 'accepted' ? request.value.conversation_id ? 'Connected' : 'Connection no longer available' : request.value?.status === 'declined' ? 'Request closed' : 'Request cancelled')
const done = async () => { try { await frame.value.navigate_relaunch('/pages/discover/index') } catch (cause) { error.value = cause.message } }
const back = async () => { try { await frame.value.navigate_back('/pages/discover/index') } catch (cause) { error.value = cause.message } }
</script>

<template>
  <SecondaryPageFrame ref="frame" class="connection-sent-page">
    <template #header><ConnectionPageHeader title="Introduction sent" interaction="reqSent.goBack.click.1" @back="back" /></template>
    <view v-if="access_error" class="connection-unavailable" role="alert">{{ access_error }}</view>
    <view v-else class="connection-body">
      <view class="sent-hero">
        <view class="sent-check"><view><ConnectionIcon name="sent" /></view></view>
        <text class="sent-title">Your introduction was sent</text>
        <view class="sent-recipient"><view><UserAvatar :src="request.other.avatar_url" :name="request.other.user_name" /></view><text>to {{ request.other.user_name }}{{ request.other.university ? ` · ${request.other.university}` : '' }}</text></view>
      </view>
      <view class="connection-card sent-question"><text class="connection-eyebrow">ICEBREAKER</text><text class="connection-question">{{ request.question }}</text></view>
      <view class="connection-card sent-answer"><text class="connection-eyebrow">YOUR ANSWER</text><text v-if="request.kind === 'text'" class="connection-answer">{{ request.text }}</text><EventAudio v-else-if="request.audio" :src="request.audio.media_url" :duration="request.audio.duration_ms" interaction="reqSent.togglePlay.click.1" /><text v-else class="connection-answer" role="alert">This voice recording is unavailable on this device.</text></view>
      <view class="sent-status"><view><ConnectionIcon name="clock" /></view><text>{{ status_label }}</text></view>
      <text v-if="request.status === 'pending'" class="sent-note">Chat and video calls unlock once {{ first_name }} accepts.</text>
    </view>
    <template #footer><text v-if="error" class="connection-error" role="alert">{{ error }}</text><view class="connection-footer"><view class="connection-primary" role="button" tabindex="0" data-interaction="reqSent.doneSent.click.1" @click="done" @keydown.enter="done">Done</view></view></template>
  </SecondaryPageFrame>
</template>
<style scoped>
@import './connections.css';
.sent-hero { display: flex; flex-direction: column; align-items: center; gap: 26.718rpx; margin-top: 22.901rpx; }
.sent-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 167.939rpx;
  height: 167.939rpx;
  border-radius: 83.969rpx;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-gradient-primary);
  box-shadow: var(--cimoa-shadow-connection-success);
}
.sent-check > view { width: 80.153rpx; height: 80.153rpx; }
.sent-title { font-size: 51.527rpx; font-weight: 800; letter-spacing: -.03em; text-align: center; }
.sent-recipient { display: flex; align-items: center; gap: 19.084rpx; margin-top: 3.817rpx; }
.sent-recipient > view { flex: none; width: 83.969rpx; height: 83.969rpx; border-radius: 50%; }
.sent-recipient > text { color: var(--cimoa-text-secondary); font-size: 32.443rpx; overflow-wrap: anywhere; }
.sent-question { margin-top: 41.985rpx; }
.sent-answer { margin-top: 22.901rpx; }
.sent-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 17.176rpx;
  min-height: 83.969rpx;
  margin-top: 34.351rpx;
  padding: 11.45rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-surface-connection-waiting);
  color: var(--cimoa-text-connection-status);
}
.sent-status > view { flex: none; width: 34.351rpx; height: 34.351rpx; }
.sent-status > text { font-size: 30.534rpx; font-weight: 600; }
.sent-note {
  display: block;
  margin-top: 22.901rpx;
  color: var(--cimoa-text-connection-muted);
  font-size: 27.672rpx;
  text-align: center;
  text-wrap: pretty;
}
</style>
