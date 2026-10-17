<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { MOTION } from '@/config/navigation.js'
const props = defineProps({ open: Boolean, busy: Boolean, label: { type: String, required: true }, closeInteraction: String })
const emit = defineEmits(['close', 'released'])
const rendered = ref(false), showing = ref(false)
let timer, token = 0
watch(() => props.open, async open => {
  const current = ++token; clearTimeout(timer)
  if (open) {
    rendered.value = true; showing.value = false
    await nextTick()
    timer = setTimeout(() => { if (current === token) showing.value = true }, 32)
  } else {
    showing.value = false
    timer = setTimeout(() => { rendered.value = false; emit('released') }, MOTION.sheet)
  }
})
const close = () => { if (!props.busy) emit('close') }
onUnmounted(() => { token++; clearTimeout(timer) })
</script>
<template>
  <view v-show="rendered" class="event-dialog" :class="{ 'event-dialog--open': showing }" :style="{ '--event-sheet-duration': `${MOTION.sheet}ms` }" @keydown.esc="close">
    <view class="event-dialog-mask" :data-interaction="closeInteraction" @click="close" @touchmove.stop.prevent />
    <view class="event-dialog-panel" role="dialog" aria-modal="true" :aria-label="label" :aria-busy="busy" @click.stop>
      <slot name="corner" />
      <view class="event-dialog-handle" />
      <slot name="header" />
      <scroll-view class="event-dialog-scroll" scroll-y :show-scrollbar="false"><slot /></scroll-view>
    </view>
  </view>
</template>
<style scoped>
.event-dialog { position: fixed; inset: 0; z-index: 1200; }
.event-dialog-mask {
  position: absolute;
  inset: 0;
  background: var(--cimoa-surface-event-scrim);
  backdrop-filter: blur(3.817rpx);
  opacity: 0;
  transition: opacity var(--event-sheet-duration) ease;
}
.event-dialog-panel {
  position: absolute;
  bottom: var(--event-dialog-bottom, var(--app-main-tab-bar-height));
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  max-height: calc(100% - var(--event-dialog-bottom, var(--app-main-tab-bar-height)) - var(--app-safe-top, 0px) - 30.534rpx);
  box-sizing: border-box;
  padding: 49.618rpx 41.985rpx 64.885rpx;
  border-radius: 61.069rpx 61.069rpx 0 0;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-event-sheet);
  overflow: hidden;
  transform: translateY(100%);
  opacity: 0;
  transition: transform var(--event-sheet-duration) ease, opacity var(--event-sheet-duration) ease;
}
.event-dialog--open .event-dialog-mask, .event-dialog--open .event-dialog-panel { opacity: 1; }
.event-dialog--open .event-dialog-panel { transform: translateY(0); }
.event-dialog-handle {
  flex: none;
  width: 83.969rpx;
  height: 9.542rpx;
  border-radius: 5.725rpx;
  background: var(--cimoa-surface-event-handle);
  margin: 0 auto 34.351rpx;
}
.event-dialog-scroll { min-height: 0; flex: 1; max-height: calc(100vh - var(--event-dialog-bottom, var(--app-main-tab-bar-height)) - var(--app-safe-top, 0px) - 188.93rpx); }
.event-dialog-scroll :deep(.uni-scroll-view) { height: auto; max-height: inherit; }
.event-dialog :deep(.event-dialog-title) { display: block; font-size: 47.71rpx; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: anywhere; }
.event-dialog :deep(.event-dialog-copy) { display: block; font-size: 29.58rpx; color: var(--cimoa-text-secondary); margin-top: 26.718rpx; line-height: 1.45; }
.event-dialog :deep(.event-dialog-primary), .event-dialog :deep(.event-dialog-secondary) {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 114.504rpx;
  margin-top: 38.168rpx;
  padding: 11.45rpx;
  border-radius: 57.252rpx;
  font-size: 36.26rpx;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
}
.event-dialog :deep(.event-dialog-primary) { color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-event-confirm); }
.event-dialog :deep(.event-dialog-secondary) { min-height: 106.87rpx; margin-top: 19.084rpx; font-size: 34.351rpx; font-weight: 600; color: var(--cimoa-text-event-cancel); }
.event-dialog :deep(.event-dialog-danger) { color: var(--cimoa-status-danger); }
.event-dialog :deep([aria-disabled="true"]) { opacity: 0.55; cursor: default; }
.event-dialog :deep(.event-dialog-error) { display: block; margin-top: 19.084rpx; color: var(--cimoa-status-danger); font-size: 28.626rpx; overflow-wrap: anywhere; }
</style>
