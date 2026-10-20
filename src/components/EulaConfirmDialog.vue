<script setup>
import { eula_document } from '@/utils/legalDocuments.js'
import EventConfirmDialog from './EventConfirmDialog.vue'
import LegalDocumentContent from './LegalDocumentContent.vue'
defineProps({ open: Boolean, busy: Boolean, suspended: Boolean, error: String })
defineEmits(['confirm', 'decline', 'read'])
</script>

<template>
  <EventConfirmDialog class="eula-dialog" :open="open" :busy="busy" :dismissible="false" :inert="suspended ? true : null" :aria-hidden="suspended ? true : null" label="End User License Agreement">
    <template #header><view class="eula-header"><text class="eula-eyebrow">Welcome to Cimoa</text><text class="event-dialog-title">End User License Agreement</text></view></template>
    <LegalDocumentContent :document="eula_document" sheet />
    <template #footer>
      <view class="eula-actions">
        <view class="eula-links"><view v-for="row in [['terms', 'Terms of Use'], ['privacy', 'Privacy Policy'], ['community', 'Community Guidelines']]" :key="row[0]" role="button" tabindex="0" :aria-disabled="busy" :data-interaction="`welcome.eula.read.${row[0]}`" @click="!busy && $emit('read', row[0])" @keydown.enter="!busy && $emit('read', row[0])" @keydown.space.prevent="!busy && $emit('read', row[0])">{{ row[1] }}</view></view>
        <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
        <view class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="welcome.eula.accept.click.1" @click="!busy && $emit('confirm')" @keydown.enter="!busy && $emit('confirm')" @keydown.space.prevent="!busy && $emit('confirm')">Agree and Continue</view>
        <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="welcome.eula.decline.click.1" @click="!busy && $emit('decline')" @keydown.enter="!busy && $emit('decline')" @keydown.space.prevent="!busy && $emit('decline')">Not Now</view>
      </view>
    </template>
  </EventConfirmDialog>
</template>

<style scoped>
.eula-dialog :deep(.event-dialog-panel) {
  top: calc(var(--app-safe-top, 0px) + (100% - var(--app-safe-top, 0px) - var(--app-safe-bottom, 0px)) / 2);
  bottom: auto;
  left: 30.534rpx;
  right: 30.534rpx;
  height: calc(100% - var(--app-safe-top, 0px) - var(--app-safe-bottom, 0px) - 45.802rpx);
  max-height: calc(100% - var(--app-safe-top, 0px) - var(--app-safe-bottom, 0px) - 45.802rpx);
  padding: 38.168rpx;
  border-radius: 49.618rpx;
  transform: translateY(-50%) scale(.96);
}
.eula-dialog.event-dialog--open :deep(.event-dialog-panel) { transform: translateY(-50%) scale(1); }
.eula-dialog :deep(.event-dialog-handle) { display: none; }
.eula-dialog :deep(.event-dialog-scroll) { height: 0; max-height: none; }
.eula-dialog :deep(.event-dialog-scroll .uni-scroll-view) { height: 100%; max-height: 100%; }
.eula-header, .eula-actions { flex: none; }
.eula-header { padding-bottom: 15.267rpx; }
.eula-eyebrow { display: block; margin-bottom: 11.45rpx; font-size: 26.718rpx; color: var(--cimoa-text-secondary); }
.eula-dialog :deep(.event-dialog-title) { font-size: 41.985rpx; line-height: 1.15; }
.eula-links { display: flex; flex-wrap: wrap; gap: 7.634rpx 22.901rpx; margin-top: 19.084rpx; }
.eula-links > view { min-height: 45.802rpx; font-size: 24.809rpx; line-height: 1.5; color: var(--cimoa-text-link); text-decoration: underline; cursor: pointer; }
.eula-actions .event-dialog-primary { min-height: 99.237rpx; margin-top: 19.084rpx; font-size: 32.443rpx; }
.eula-actions .event-dialog-secondary { min-height: 76.336rpx; margin-top: 7.634rpx; font-size: 30.534rpx; }
</style>
