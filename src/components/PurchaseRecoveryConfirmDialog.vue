<script setup>
import EventConfirmDialog from './EventConfirmDialog.vue'
defineProps({ open: Boolean, busy: Boolean, error: String })
defineEmits(['confirm', 'close'])
</script>
<template>
  <EventConfirmDialog :open="open" :busy="busy" label="Release this interrupted request?" close-interaction="purchaseRecovery.close.click.1" @close="$emit('close')">
    <text class="event-dialog-title">Release this interrupted request?</text>
    <text class="event-dialog-copy">The App Store could not confirm this request after an interruption. The original purchase may still complete. A new purchase is separate and may result in a separate charge. Any verified coins will go to the account that started the original purchase.</text>
    <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
    <view class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="purchaseRecovery.keepChecking.click.1" @click="!busy && $emit('close')" @keydown.enter="!busy && $emit('close')">Keep checking</view>
    <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="purchaseRecovery.release.click.1" @click="!busy && $emit('confirm')" @keydown.enter="!busy && $emit('confirm')">I understand, release request</view>
  </EventConfirmDialog>
</template>
