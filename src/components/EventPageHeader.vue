<script setup>
import SourceIcon from './SourceIcon.vue'
defineProps({ title: String, backInteraction: String, moreInteraction: String, busy: Boolean })
const emit = defineEmits(['back', 'more'])
</script>
<template>
  <view class="event-page-header">
    <view class="event-page-round" role="button" tabindex="0" aria-label="Back" :aria-disabled="busy" :data-interaction="backInteraction" @click="!busy && emit('back')" @keydown.enter="!busy && emit('back')"><view class="event-page-icon"><SourceIcon name="back" /></view></view>
    <text class="event-page-header-title">{{ title }}</text>
    <view v-if="moreInteraction" class="event-page-round" role="button" tabindex="0" aria-label="More options" :aria-disabled="busy" :data-interaction="moreInteraction" @click="!busy && emit('more')" @keydown.enter="!busy && emit('more')"><view class="event-page-icon"><SourceIcon name="more" /></view></view>
  </view>
</template>
