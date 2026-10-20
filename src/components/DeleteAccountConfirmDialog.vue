<script setup>
import OnboardingSheet from './OnboardingSheet.vue'
defineProps({ open: Boolean, busy: Boolean, error: String })
const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <OnboardingSheet class="delete-account-dialog" :open="open" :busy="busy" label="Delete this account?" close-interaction="delFinal.closeDeleteConfirm.click.1" @close="emit('close')">
    <text class="event-dialog-title">Delete this account?</text>
    <text class="event-dialog-copy">Your saved profile, private activity, messages, remaining coins and media will be removed. This cannot be undone.</text>
    <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
    <view class="event-dialog-primary" role="button" :aria-disabled="busy" data-interaction="delFinal.keepAccount.click.2" @click="!busy && emit('close')">Keep My Account</view>
    <view class="event-dialog-secondary event-dialog-danger" role="button" :aria-disabled="busy" data-interaction="delFinal.confirmDelete.click.1" @click="!busy && emit('confirm')">Delete Account</view>
  </OnboardingSheet>
</template>

<style scoped>
.delete-account-dialog :deep(.event-dialog-copy) { margin-top: 15.267rpx; font-size: 30.534rpx; }
.delete-account-dialog :deep(.event-dialog-primary) { min-height: 110.687rpx; }
.delete-account-dialog :deep(.event-dialog-secondary) { min-height: 99.237rpx; margin-top: 0; color: var(--cimoa-text-settings-danger); }
</style>
