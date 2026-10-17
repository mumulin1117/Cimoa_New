<script setup>
import SourceIcon from './SourceIcon.vue'
import EventConfirmDialog from './EventConfirmDialog.vue'

const props = defineProps({
  open: Boolean,
  mode: { type: String, default: 'menu' },
  userName: { type: String, default: 'this account' },
  busy: Boolean,
  error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'report', 'open-block', 'confirm-block'])
const act = event => { if (!props.busy) emit(event) }
</script>

<template>
  <EventConfirmDialog
    :open="open"
    :busy="busy"
    :label="mode === 'block' ? `Block ${userName}?` : `${userName} safety actions`"
    :close-interaction="mode === 'block' ? 'sheetBlock.closeSheet.click.1' : 'sheetSafetyMini.closeSheet.click.1'"
    style="--event-dialog-bottom: var(--app-safe-bottom);"
    @close="act('close')"
  >
    <template v-if="mode === 'menu'">
      <text class="event-dialog-title">{{ userName }}</text>
      <view class="safety-action-list">
        <view class="safety-action safety-action--icon" role="button" tabindex="0" data-interaction="sheetSafetyMini.openReport.click.1" @click="act('report')" @keydown.enter="act('report')"><view class="safety-action-icon"><SourceIcon name="flag" /></view><text>Report</text></view>
        <view class="safety-action safety-action--icon safety-action--danger" role="button" tabindex="0" data-interaction="sheetSafetyMini.openBlock.click.1" @click="act('open-block')" @keydown.enter="act('open-block')"><view class="safety-action-icon"><SourceIcon name="blocked" /></view><text>Block</text></view>
        <slot name="actions" />
      </view>
      <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
      <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="sheetSafetyMini.closeSheet.click.2" @click="act('close')" @keydown.enter="act('close')">Cancel</view>
    </template>
    <template v-else>
      <text class="event-dialog-title">Block {{ userName }}?</text>
      <view class="safety-block-copy">
        <text>{{ userName }} will no longer be able to message or call you.</text>
        <text>Your existing conversation will be hidden.</text>
        <text>{{ userName }} will not receive a notification.</text>
      </view>
      <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
      <view class="event-dialog-primary event-dialog-danger" role="button" tabindex="0" :aria-disabled="busy" data-interaction="sheetBlock.confirmBlock.click.1" @click="act('confirm-block')" @keydown.enter="act('confirm-block')">Block {{ userName }}</view>
      <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="sheetBlock.closeSheet.click.2" @click="act('close')" @keydown.enter="act('close')">Cancel</view>
    </template>
  </EventConfirmDialog>
</template>

<style src="./safety-actions.css" scoped />
