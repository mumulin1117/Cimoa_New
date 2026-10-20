<script setup>
import EventConfirmDialog from './EventConfirmDialog.vue'
import LegalDocumentContent from './LegalDocumentContent.vue'
import SourceIcon from './SourceIcon.vue'
defineProps({ open: Boolean, document: Object })
const emit = defineEmits(['close'])
</script>
<template>
  <EventConfirmDialog class="agreement-sheet" :open="open" :label="document?.title || 'Agreement'" close-interaction="sheetAgreement.closeSheet.click.1" @close="emit('close')">
    <template #header><view class="agreement-header"><text class="event-dialog-title">{{ document?.title }}</text><view class="agreement-close" role="button" tabindex="0" :aria-label="`Close ${document?.title || 'agreement'}`" data-interaction="sheetAgreement.closeSheet.click.2" @click="emit('close')" @keydown.enter="emit('close')" @keydown.space.prevent="emit('close')"><SourceIcon name="close" :stroke-width="2.4" /></view></view></template>
    <LegalDocumentContent v-if="document" :document="document" sheet />
  </EventConfirmDialog>
</template>
<style scoped>
.agreement-sheet :deep(.event-dialog-panel) { bottom: 0; max-height: calc(100% - var(--app-safe-top, 0px) - 30.534rpx); padding-bottom: calc(38.168rpx + var(--app-safe-bottom, 0px)); }
.agreement-sheet { z-index: 1400; }
.agreement-sheet :deep(.event-dialog-scroll) { max-height: calc(100vh - var(--app-safe-top, 0px) - var(--app-safe-bottom, 0px) - 251.908rpx); }
.agreement-header { flex: none; display: flex; align-items: center; gap: 15.267rpx; margin-bottom: 11.45rpx; }
.agreement-header .event-dialog-title { flex: 1; min-width: 0; }
.agreement-close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 83.969rpx;
  height: 83.969rpx;
  border-radius: 50%;
  color: var(--cimoa-text-title);
  background: var(--cimoa-surface-tinted);
  cursor: pointer;
}
.agreement-close .source-icon { width: 38.168rpx; height: 38.168rpx; }
</style>
