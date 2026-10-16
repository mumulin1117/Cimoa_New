<script setup>
import EventConfirmDialog from './EventConfirmDialog.vue'
defineProps({ open: Boolean, busy: Boolean, label: String, closeInteraction: String })
const emit = defineEmits(['close'])
</script>
<template><EventConfirmDialog class="onboarding-sheet" :open="open" :busy="busy" :label="label" :close-interaction="closeInteraction" @close="emit('close')"><slot /></EventConfirmDialog></template>
<style scoped>
.onboarding-sheet :deep(.event-dialog-panel) { bottom: 0; max-height: calc(100% - var(--app-safe-top, 0px) - 30.534rpx); padding-bottom: calc(64.885rpx + var(--app-safe-bottom, 0px)); }
.onboarding-sheet :deep(.event-dialog-scroll) { max-height: calc(100vh - var(--app-safe-top, 0px) - var(--app-safe-bottom, 0px) - 152.672rpx); }
</style>
