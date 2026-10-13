<script setup>
import { computed } from 'vue'
import { use_app_store } from '@/stores/store.js'
import EventConfirmDialog from './EventConfirmDialog.vue'
const props = defineProps({ open: Boolean, eventId: String, busy: Boolean, error: String })
const emit = defineEmits(['confirm', 'close', 'released'])
const store = use_app_store(), event = computed(() => store.event_by_id(props.eventId))
</script>
<template>
  <EventConfirmDialog :open="open" :busy="busy" :label="event?.title || 'Join event'" close-interaction="sheetEvJoin.closeSheet.click.1" @close="emit('close')" @released="emit('released')">
    <text class="event-dialog-title">{{ event?.title || 'Event unavailable' }}</text>
    <view class="event-confirm-row"><text>When</text><text>{{ event?.date_label }}</text></view>
    <view class="event-confirm-row"><text>Where</text><text>{{ event?.location }}</text></view>
    <view class="event-confirm-row"><text>Spaces</text><text>{{ event?.available_count }} spaces left of {{ event?.capacity }}</text></view>
    <text class="event-dialog-copy">Joining is free. Other students will see that you are going.</text>
    <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
    <view class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="busy || !event" data-interaction="sheetEvJoin.confirmJoin.click.1" @click="!busy && event && emit('confirm')" @keydown.enter="!busy && event && emit('confirm')">Confirm join</view>
    <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="sheetEvJoin.closeSheet.click.2" @click="!busy && emit('close')" @keydown.enter="!busy && emit('close')">Not now</view>
  </EventConfirmDialog>
</template>
<style scoped>
.event-confirm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15.267rpx;
  min-height: 99.237rpx;
  border-bottom: 1px solid var(--cimoa-surface-event-divider);
  font-size: 32.443rpx;
}
.event-confirm-row text:first-child { color: var(--cimoa-text-secondary); flex: none; }
.event-confirm-row text:last-child { font-weight: 700; text-align: right; overflow-wrap: anywhere; min-width: 0; }
</style>
