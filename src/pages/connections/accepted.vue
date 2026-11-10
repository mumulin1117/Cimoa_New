<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import ConnectionIcon from '@/components/ConnectionIcon.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const store = use_app_store(), frame = ref(null), request_id = ref(''), match_id = ref(''), error = ref('')
onLoad(options => { request_id.value = String(options?.request_id || ''); match_id.value = String(options?.match_id || '') })
const request = computed(() => match_id.value ? store.match_invitation(match_id.value) : store.request_detail(request_id.value))
const connection = computed(() => request.value ? store.connection_by_user(request.value.other.user_id) : null)
const first_name = computed(() => request.value?.other?.user_name.split(' ')[0] || '')
const access_error = computed(() => !!request_id.value === !!match_id.value || !request.value || request.value.status !== 'accepted' || !connection.value?.conversation_id || (match_id.value ? connection.value.source_match_id !== match_id.value : connection.value.source_request_id !== request_id.value) ? 'This accepted connection is unavailable.' : '')
const go = async url => { if (access_error.value) return; try { await frame.value.navigate_forward(url) } catch (cause) { error.value = cause.message } }
const close = async () => { try { await frame.value.navigate_relaunch('/pages/home/index') } catch (cause) { error.value = cause.message } }
</script>
<template>
  <SecondaryPageFrame ref="frame" class="connection-accepted-page">
    <template #header><view class="accepted-header"><view class="accepted-close" role="button" tabindex="0" aria-label="Close" data-interaction="reqAccepted.closeAccepted.click.1" @click="close" @keydown.enter="close"><view><ConnectionIcon name="close" /></view></view></view></template>
    <view v-if="access_error" class="connection-unavailable" role="alert">{{ access_error }}</view>
    <view v-else class="accepted-content">
      <view class="accepted-celebrate"><ConnectionIcon name="celebrate" /></view>
      <view class="accepted-avatars"><view class="accepted-avatar accepted-avatar--mine"><UserAvatar :src="store.current_user.avatar_url" :name="store.current_user.user_name" /><view v-if="store.current_user.verified" class="accepted-badge"><ConnectionIcon name="verified" /></view></view><view class="accepted-avatar accepted-avatar--other"><UserAvatar :src="request.other.avatar_url" :name="request.other.user_name" /><view v-if="request.other.verified" class="accepted-badge"><ConnectionIcon name="verified" /></view></view></view>
      <text class="accepted-title">You’re connected</text><text class="accepted-copy">You and {{ first_name }} can now start a conversation.</text>
      <view class="accepted-interests"><text class="connection-eyebrow">YOU BOTH LIKE</text><view v-if="connection.shared_interests.length" class="accepted-interests-row"><view v-for="(interest,index) in connection.shared_interests.slice(0,3)" :key="interest.item_id" class="accepted-interest"><view :class="{ pink: index > 0 }"><text>{{ interest.emoji }}</text></view><text>{{ interest.label }}</text></view></view><text v-else class="accepted-empty">A new connection, a new perspective.</text></view>
    </view>
    <template #footer><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /><view v-if="!access_error" class="connection-footer"><view class="connection-primary" role="button" tabindex="0" data-interaction="reqAccepted.startChat.click.1" @click="go(`/pages/messages/chat?conversation_id=${encodeURIComponent(connection.conversation_id)}`)" @keydown.enter="go(`/pages/messages/chat?conversation_id=${encodeURIComponent(connection.conversation_id)}`)">Start Chatting<view class="accepted-arrow"><SourceIcon name="arrow-right" :stroke-width="2.4" /></view></view><view class="connection-secondary" role="button" tabindex="0" data-interaction="reqAccepted.viewProfile.click.1" @click="go(`/pages/discover/profile?user_id=${encodeURIComponent(request.other.user_id)}`)" @keydown.enter="go(`/pages/discover/profile?user_id=${encodeURIComponent(request.other.user_id)}`)">View {{ first_name }}’s Profile</view></view></template>
    <template #overlays><view v-if="!access_error" class="accepted-confetti" aria-hidden="true"><view v-for="index in 10" :key="index" /></view></template>
  </SecondaryPageFrame>
</template>
<style scoped>
@import './connections.css';
.accepted-header { position: relative; height: 183.206rpx; }
.accepted-close {
  position: absolute;
  top: 7.634rpx;
  right: 38.168rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 50%;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  cursor: pointer;
}
.accepted-close > view { width: 38.168rpx; height: 38.168rpx; }
.accepted-content { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; padding: 0 38.168rpx 45.802rpx; }
.accepted-celebrate { width: 57.252rpx; height: 34.351rpx; }
.accepted-avatars { display: flex; align-items: center; }
.accepted-avatar { position: relative; width: 183.206rpx; height: 183.206rpx; border: 7.634rpx solid var(--cimoa-surface-card); border-radius: 99.237rpx; }
.accepted-avatar--mine { box-shadow: var(--cimoa-shadow-connection-cyan); }
.accepted-avatar--other { margin-left: -49.618rpx; box-shadow: var(--cimoa-shadow-connection-pink); }
.accepted-badge {
  position: absolute;
  right: -7.634rpx;
  bottom: -7.634rpx;
  width: 49.618rpx;
  height: 49.618rpx;
  border-radius: 50%;
}
.accepted-title { font-size: 61.069rpx; font-weight: 800; letter-spacing: -.035em; }
.accepted-copy { max-width: 553.435rpx; font-size: 32.443rpx; color: var(--cimoa-text-secondary); text-align: center; text-wrap: pretty; }
.accepted-interests { width: 100%; padding: 38.168rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.accepted-interests-row { display: flex; justify-content: space-around; margin-top: 26.718rpx; }
.accepted-interest {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15.267rpx;
  min-width: 0;
  text-align: center;
}
.accepted-interest > view {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 106.87rpx;
  height: 106.87rpx;
  border-radius: 50%;
  background: var(--cimoa-surface-settings-blue);
  font-size: 49.618rpx;
  line-height: 1;
}
.accepted-interest > view.pink { background: var(--cimoa-surface-event-people); }
.accepted-interest > text { font-size: 28.626rpx; font-weight: 600; overflow-wrap: anywhere; }
.accepted-empty { display: block; margin-top: 26.718rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; }
.accepted-arrow { width: 34.351rpx; height: 34.351rpx; }
.accepted-confetti { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
.accepted-confetti > view {
  position: absolute;
  width: 13.359rpx;
  height: 13.359rpx;
  border-radius: 50%;
  opacity: .4;
  background: var(--cimoa-brand-pink);
}
.accepted-confetti > view:nth-child(1) { left: 18%; top: 16%; width: 15.267rpx; height: 15.267rpx; opacity: .5; }
.accepted-confetti > view:nth-child(2) { left: 76%; top: 20%; background: var(--cimoa-brand-blue); }
.accepted-confetti > view:nth-child(3) { left: 6%; top: 36%; background: var(--cimoa-brand-cyan); }
.accepted-confetti > view:nth-child(4) { left: 92%; top: 32%; background: var(--cimoa-brand-connection-violet); }
.accepted-confetti > view:nth-child(5) { left: 12%; top: 56%; width: 11.45rpx; height: 11.45rpx; background: var(--cimoa-brand-connection-violet); }
.accepted-confetti > view:nth-child(6) { left: 93%; top: 46%; width: 11.45rpx; height: 11.45rpx; }
.accepted-confetti > view:nth-child(7) { left: 4%; top: 78%; width: 15.267rpx; height: 15.267rpx; }
.accepted-confetti > view:nth-child(8) {
  left: 28%;
  top: 88%;
  width: 11.45rpx;
  height: 11.45rpx;
  background: var(--cimoa-brand-blue);
  opacity: .35;
}
.accepted-confetti > view:nth-child(9) { left: 11%; top: 90%; width: 11.45rpx; height: 11.45rpx; background: var(--cimoa-brand-cyan); }
.accepted-confetti > view:nth-child(10) { left: 78%; top: 93%; background: var(--cimoa-brand-purple); }
</style>
