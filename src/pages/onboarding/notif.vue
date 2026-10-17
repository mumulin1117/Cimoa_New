<script setup>
import { ref } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
const frame = ref(null), { error, access_error, is_loading, go, save, recover } = use_onboarding('notif', frame)
</script>
<template>
  <SecondaryPageFrame ref="frame" class="onboarding-notif-page">
    <view class="notice-content"><view class="notice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2.4 2.4 0 0 0 4 0" /></svg></view><text class="notice-title">Stay in the loop</text><text class="notice-copy">Get notified when someone accepts your introduction, when an Auto Match is ready, or when an event is about to start.</text><text v-if="access_error || error" class="auth-error-box" role="alert">{{ access_error || error }}</text></view>
    <template #footer><view class="notice-footer"><template v-if="!access_error"><view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="obNotif.enableNotifs.click.1" @click="!is_loading && go('/pages/permissions/notif')" @keydown.enter="!is_loading && go('/pages/permissions/notif')">Enable Notifications</view><view class="notice-secondary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="obNotif.skipNotifs.click.1" @click="save({ notification_permission: 'skipped' })" @keydown.enter="save({ notification_permission: 'skipped' })">Not Now</view></template><view v-else class="auth-primary" role="button" tabindex="0" @click="recover" @keydown.enter="recover">Continue account setup</view></view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Saving your choice…" /></template>
  </SecondaryPageFrame>
</template>
<style>
@import './notice.css';
</style>
