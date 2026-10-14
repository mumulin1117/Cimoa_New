<script setup>
import { ref } from 'vue'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import SourceIcon from './SourceIcon.vue'
defineProps({ title: String, busy: Boolean, backInteraction: { type: String, default: '' } })
const emit = defineEmits(['back', 'error']), frame = ref(null)
defineExpose({
  navigate_forward: target => frame.value.navigate_forward(target),
  navigate_back: (fallback = '/pages/auth/welcome') => frame.value.navigate_back(fallback),
})
</script>
<template>
  <SecondaryPageFrame ref="frame" class="auth-frame">
    <template #header><view class="auth-header"><view class="auth-back" role="button" aria-label="Back" tabindex="0" :aria-disabled="busy" :data-interaction="backInteraction || undefined" @click="!busy && emit('back')" @keydown.enter="!busy && emit('back')"><SourceIcon name="back" /></view><text class="auth-header-title">{{ title }}</text></view></template>
    <view class="auth-content"><slot /></view>
    <template #footer><view class="auth-footer"><slot name="footer" /></view></template>
    <template #overlays><slot name="overlays" /></template>
  </SecondaryPageFrame>
</template>
<style scoped>
.auth-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 30.534rpx; }
.auth-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 43.893rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
}
.auth-back .source-icon { width: 41.985rpx; height: 41.985rpx; }
.auth-header-title {
  position: absolute;
  inset: 0 110.687rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40.076rpx;
  font-weight: 700;
  letter-spacing: -.025em;
  line-height: 1.15;
  pointer-events: none;
  text-align: center;
}
.auth-content { padding: 0 38.168rpx 38.168rpx; }
.auth-footer { display: flex; flex-direction: column; gap: 11.45rpx; padding: 0 38.168rpx 57.252rpx; }
</style>
