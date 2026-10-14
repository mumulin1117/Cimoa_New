<script setup>
import EventConfirmDialog from './EventConfirmDialog.vue'

const props = defineProps({
  open: Boolean,
  mode: { type: String, default: 'menu' },
  userName: { type: String, default: 'this account' },
  muted: Boolean,
  busy: Boolean,
  error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'view-profile', 'toggle-mute', 'report', 'open-block', 'confirm-block'])
const act = event => { if (!props.busy) emit(event) }
</script>

<template>
  <EventConfirmDialog
    :open="open"
    :busy="busy"
    :label="mode === 'block' ? `Block ${userName}?` : `${userName} actions`"
    :close-interaction="mode === 'block' ? 'sheetBlock.closeSheet.click.1' : 'sheetSafety.closeSheet.click.1'"
    style="--event-dialog-bottom: var(--app-safe-bottom);"
    @close="act('close')"
  >
    <template v-if="mode === 'menu'">
      <text class="event-dialog-title">{{ userName }}</text>
      <view class="safety-action-list">
        <view class="safety-action" role="button" tabindex="0" data-interaction="sheetSafety.viewProfile.click.1" @click="act('view-profile')" @keydown.enter="act('view-profile')">View Profile</view>
        <view class="safety-action" role="button" tabindex="0" data-interaction="sheetSafety.muteNotifs.click.1" @click="act('toggle-mute')" @keydown.enter="act('toggle-mute')">{{ muted ? 'Unmute Notifications' : 'Mute Notifications' }}</view>
        <view class="safety-action" role="button" tabindex="0" data-interaction="sheetSafety.openReport.click.1" @click="act('report')" @keydown.enter="act('report')">Report</view>
        <view class="safety-action safety-action--danger" role="button" tabindex="0" data-interaction="sheetSafety.openBlock.click.1" @click="act('open-block')" @keydown.enter="act('open-block')">Block</view>
      </view>
      <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
      <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="sheetSafety.closeSheet.click.2" @click="act('close')" @keydown.enter="act('close')">Cancel</view>
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
