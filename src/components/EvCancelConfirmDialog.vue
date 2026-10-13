<script setup>
import EventConfirmDialog from './EventConfirmDialog.vue'
defineProps({ open: Boolean, busy: Boolean, error: String })
const emit = defineEmits(['confirm', 'close', 'released'])
</script>
<template>
  <EventConfirmDialog :open="open" :busy="busy" label="Cancel your attendance?" close-interaction="sheetEvCancel.closeSheet.click.1" @close="emit('close')" @released="emit('released')">
    <text class="event-dialog-title">Cancel your attendance?</text>
    <text class="event-dialog-copy">Your spot may be offered to someone else. You will lose access to the event group chat.</text>
    <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
    <view class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="sheetEvCancel.keepSpot.click.1" @click="!busy && emit('close')" @keydown.enter="!busy && emit('close')">Keep my spot</view>
    <view class="event-dialog-secondary event-dialog-danger" role="button" tabindex="0" :aria-disabled="busy" data-interaction="sheetEvCancel.cancelAttendance.click.1" @click="!busy && emit('confirm')" @keydown.enter="!busy && emit('confirm')">Cancel attendance</view>
  </EventConfirmDialog>
</template>
