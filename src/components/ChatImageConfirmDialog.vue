<script setup>
import EventConfirmDialog from './EventConfirmDialog.vue'
import ProfilePhoto from './ProfilePhoto.vue'
defineProps({ open: Boolean, src: { type: String, default: '' } })
defineEmits(['close'])
</script>
<template>
  <EventConfirmDialog :open="open" label="Shared photo" close-interaction="chat.image.close.click.1" style="--event-dialog-bottom: var(--app-safe-bottom);" @close="$emit('close')">
    <text class="event-dialog-title">Shared photo</text>
    <view v-if="open" class="chat-full-photo"><ProfilePhoto :src="src" name="Shared photo" contain portrait retry-interaction="chat.image.retry.click.1" /></view>
    <view class="event-dialog-secondary" role="button" tabindex="0" data-interaction="chat.image.close.click.1" @click="$emit('close')" @keydown.enter="$emit('close')">Close</view>
  </EventConfirmDialog>
</template>
<style scoped>
.chat-full-photo { position: relative; width: 100%; height: min(95.42vw, 48vh); overflow: hidden; border-radius: 30.534rpx; margin: 30.534rpx 0; }
</style>
