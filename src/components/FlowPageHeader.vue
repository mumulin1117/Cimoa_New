<script setup>
import SourceIcon from './SourceIcon.vue'
defineProps({ title: String, interaction: String, busy: Boolean })
defineEmits(['back'])
</script>

<template>
  <view class="flow-header">
    <view class="flow-back" role="button" tabindex="0" aria-label="Back" :aria-disabled="busy" :data-interaction="interaction" @click="!busy && $emit('back')" @keydown.enter="!busy && $emit('back')"><SourceIcon name="back" /></view>
    <text>{{ title }}</text>
  </view>
</template>
