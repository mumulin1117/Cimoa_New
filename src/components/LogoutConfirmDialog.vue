<script setup>
import OnboardingSheet from './OnboardingSheet.vue'
defineProps({ open: Boolean, busy: Boolean, error: String })
const emit = defineEmits(['close', 'confirm'])
</script>
<template>
  <OnboardingSheet class="logout-dialog" :open="open" :busy="busy" label="Log out of Cimoa?" close-interaction="sheetLogout.closeSheet.click.1" @close="emit('close')">
    <text class="event-dialog-title">Log out of Cimoa?</text><text class="event-dialog-copy">Your account stays as it is. You can log back in anytime.</text>
    <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
    <view class="event-dialog-primary" role="button" :aria-disabled="busy" data-interaction="sheetLogout.closeSheet.click.2" @click="!busy && emit('close')">Stay Logged In</view>
    <view class="event-dialog-secondary event-dialog-danger" role="button" :aria-disabled="busy" data-interaction="sheetLogout.logOut2.click.1" @click="!busy && emit('confirm')">Log Out</view>
  </OnboardingSheet>
</template>
<style scoped>
.logout-dialog :deep(.event-dialog-copy) { margin-top: 15.267rpx; font-size: 30.534rpx; }
.logout-dialog :deep(.event-dialog-primary) { min-height: 110.687rpx; }
.logout-dialog :deep(.event-dialog-secondary) { min-height: 99.237rpx; margin-top: 0; color: var(--cimoa-text-settings-danger); }
</style>
