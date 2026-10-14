<script setup>
import EventConfirmDialog from './EventConfirmDialog.vue'
defineProps({ open: Boolean, document: Object })
const emit = defineEmits(['close'])
</script>
<template>
  <EventConfirmDialog class="agreement-sheet" :open="open" :label="document?.title || 'Agreement'" @close="emit('close')">
    <text class="event-dialog-title">{{ document?.title }}</text>
    <text v-for="paragraph in document?.paragraphs" :key="paragraph" class="event-dialog-copy">{{ paragraph }}</text>
    <view class="event-dialog-secondary" role="button" tabindex="0" @click="emit('close')" @keydown.enter="emit('close')">Close</view>
  </EventConfirmDialog>
</template>
<style scoped>
.agreement-sheet :deep(.event-dialog-panel) { bottom: 0; max-height: calc(100% - var(--app-safe-top, 0px) - 30.534rpx); padding-bottom: calc(38.168rpx + var(--app-safe-bottom, 0px)); }
.agreement-sheet :deep(.event-dialog-scroll) { max-height: calc(100vh - var(--app-safe-top, 0px) - var(--app-safe-bottom, 0px) - 152.672rpx); }
</style>
