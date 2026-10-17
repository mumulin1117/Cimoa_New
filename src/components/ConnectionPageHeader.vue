<script setup>
import SourceIcon from './SourceIcon.vue'
defineProps({ title: String, interaction: String, busy: Boolean, compact: Boolean })
defineEmits(['back'])
</script>
<template>
  <view class="connection-header" :class="{ 'connection-header--compact': compact }">
    <view class="connection-round" role="button" tabindex="0" aria-label="Back" :aria-disabled="busy" :data-interaction="interaction" @click="!busy && $emit('back')" @keydown.enter="!busy && $emit('back')"><view><SourceIcon name="back" /></view></view>
    <view class="connection-heading"><slot><text>{{ title }}</text></slot></view>
    <slot name="right" />
  </view>
</template>
<style scoped>
.connection-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 91.603rpx;
  margin: 7.634rpx 38.168rpx 38.168rpx;
}
.connection-header--compact { height: 87.786rpx; margin-bottom: 26.718rpx; }
.connection-round {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 43.893rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  cursor: pointer;
}
.connection-round > view { width: 41.985rpx; height: 41.985rpx; }
.connection-heading {
  position: absolute;
  inset: 0 110.687rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13.359rpx;
  text-align: center;
  pointer-events: none;
}
.connection-heading > text { font-size: 40.076rpx; font-weight: 700; letter-spacing: -.025em; line-height: 1.15; }
</style>
