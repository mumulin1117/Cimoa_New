<script setup>
import { ref, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_onboarding } from '@/composables/useOnboarding.js'
import { notification_permission, open_app_settings } from '@/utils/nativePermissions.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
const frame = ref(null), { error, access_error, allowed, context, is_loading, save, recover } = use_onboarding('notif', frame)
const status = ref('checking'), requesting = ref(false)
let active = false, generation = 0
onShow(async () => { active = true; const token = ++generation; try { const value = await notification_permission(); if (active && token === generation) status.value = value } catch (cause) { if (active && token === generation) { status.value = 'unavailable'; error.value = cause.message } } })
const hide = () => { active = false; generation++; requesting.value = false }
onHide(hide); onUnmounted(hide)
const allow = async () => {
  if (is_loading.value || requesting.value || !allowed.value) return
  error.value = ''; requesting.value = true
  const token = generation, account_id = context.value.account_id
  try {
    const value = await notification_permission(true)
    if (!active || token !== generation || context.value?.account_id !== account_id) return
    status.value = value
    if (value === 'granted') await save({ notification_permission: value })
    else error.value = value === 'unavailable' ? 'Notifications are unavailable in this browser or device. Continue without enabling them.' : value === 'denied' ? 'Notification access is off. Open Settings to change it, or continue without notifications.' : 'No permission was granted. Try again or continue without notifications.'
  } catch (cause) { if (active && token === generation) error.value = cause.message }
  finally { if (token === generation) requesting.value = false }
}
const decline = () => { if (!requesting.value) save({ notification_permission: status.value === 'denied' || status.value === 'unavailable' ? status.value : 'skipped' }) }
const settings = async () => { try { await open_app_settings() } catch (cause) { error.value = cause.message } }
</script>
<template>
  <SecondaryPageFrame ref="frame" class="permission-notif-page">
    <view class="notice-content"><view class="notice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2.4 2.4 0 0 0 4 0" /></svg></view><text class="notice-title">Turn on notifications</text><text class="notice-copy">Introductions, Auto Match results, and event reminders. Nothing promotional.</text>
      <view v-if="access_error || error || status === 'denied' || status === 'unavailable'" class="auth-card permission-error"><text class="permission-error-title">{{ status === 'denied' ? 'Access is off' : 'Notifications are not enabled' }}</text><text class="permission-error-copy" role="alert">{{ access_error || error || 'You can check system Settings, or continue without notifications.' }}</text><view v-if="!access_error" class="permission-settings" role="button" tabindex="0" data-interaction="permNotif.openSettings.click.1" @click="settings" @keydown.enter="settings">Open Settings</view></view>
    </view>
    <template #footer><view class="notice-footer"><template v-if="!access_error"><view class="auth-primary" role="button" tabindex="0" :aria-disabled="requesting || is_loading" data-interaction="permNotif.allowNotifs.click.1" @click="allow" @keydown.enter="allow">Allow Notifications</view><view class="notice-secondary" role="button" tabindex="0" :aria-disabled="requesting || is_loading" data-interaction="permNotif.denyNotifs.click.1" @click="decline" @keydown.enter="decline">Don’t Allow</view></template><view v-else class="auth-primary" role="button" tabindex="0" @click="recover" @keydown.enter="recover">Continue account setup</view></view></template>
    <template #overlays><AuthActionLoading :visible="requesting || is_loading" :label="is_loading ? 'Saving your choice…' : 'Waiting for system permission…'" /></template>
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
