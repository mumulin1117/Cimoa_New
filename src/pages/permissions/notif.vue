<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { ref } from 'vue'
import { use_notification_permission } from '@/composables/useNotificationPermission.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
const frame = ref(null), { error, access_error, is_loading, recover, status, requesting, allow, decline, settings } = use_notification_permission(frame)
</script>
<template>
  <SecondaryPageFrame ref="frame" class="permission-notif-page">
    <view class="notice-content"><view class="notice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2.4 2.4 0 0 0 4 0" /></svg></view><text class="notice-title">Turn on notifications</text><text class="notice-copy">Introductions, Auto Match results, and event reminders. Nothing promotional.</text>
      <view v-if="access_error || error || status === 'denied' || status === 'unavailable'" class="auth-card permission-error"><text class="permission-error-title">{{ status === 'denied' ? 'Access is off' : 'Notifications are not enabled' }}</text><text class="permission-error-copy" role="alert">{{ auth_message(access_error || error || 'You can check system Settings, or continue without notifications.') }}</text><view v-if="!access_error" class="permission-settings" role="button" tabindex="0" data-interaction="permNotif.openSettings.click.1" @click="settings" @keydown.enter="settings">Open Settings</view></view>
    </view>
    <template #footer><view class="notice-footer"><template v-if="!access_error"><view class="auth-primary" role="button" tabindex="0" :aria-disabled="requesting || is_loading" :aria-busy="requesting || is_loading" data-interaction="permNotif.allowNotifs.click.1" @click="allow" @keydown.enter="allow" @keydown.space.prevent="allow">Continue</view><view class="notice-secondary" role="button" tabindex="0" :aria-disabled="requesting || is_loading" data-interaction="permNotif.denyNotifs.click.1" @click="decline" @keydown.enter="decline" @keydown.space.prevent="decline">Cancel</view></template><view v-else class="auth-primary" role="button" tabindex="0" @click="recover" @keydown.enter="recover">Continue account setup</view></view></template>
    <template #overlays><AuthActionLoading :visible="requesting || is_loading" :label="is_loading ? 'Updating notification preferences…' : 'Waiting for system permission…'" /></template>
  </SecondaryPageFrame>
</template>
<style>
@import '../onboarding/notice.css';
</style>
<style scoped>
.notice-content { padding-top: 244.275rpx; }
.notice-icon { background: var(--cimoa-surface-deep); }
.notice-title { font-size: 51.527rpx; }
.permission-error { width: 100%; }
.permission-error-title { display: block; font-size: 32.443rpx; font-weight: 700; margin-bottom: 11.45rpx; }
.permission-error-copy { display: block; font-size: 29.58rpx; color: var(--cimoa-text-secondary); line-height: 1.45; }
.permission-settings { display: flex; align-items: center; justify-content: center; min-height: 91.603rpx; margin-top: 22.901rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-tinted); font-size: 31.489rpx; font-weight: 600; }
</style>
