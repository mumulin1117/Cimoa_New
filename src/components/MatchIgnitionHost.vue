<script setup>
import { computed } from 'vue'
import { match_ignition } from '@/utils/matchIgnition.js'
const cue = match_ignition
const placement = computed(() => {
  if (!cue.value) return {}
  const scale = 750 / uni.getWindowInfo().windowWidth, bounds = cue.value.bounds
  return { left: `${(bounds.left + bounds.width / 2) * scale}rpx`, top: `${(bounds.top + bounds.height / 2) * scale}rpx`, '--ignite-duration': `${cue.value.duration}ms` }
})
</script>
<template>
  <view v-if="cue" :key="`${cue.id}-${cue.stage}`" class="match-ignition" :class="[`match-ignition--${cue.stage}`, { 'match-ignition--reduced': cue.reduced }]" :style="placement" aria-hidden="true">
    <view class="ignition-arc" /><view class="ignition-point ignition-point--cyan" /><view class="ignition-point ignition-point--pink" />
  </view>
</template>
<style scoped>
.match-ignition {
  position: fixed;
  z-index: 1100;
  width: 190.84rpx;
  height: 190.84rpx;
  margin: -95.42rpx 0 0 -95.42rpx;
  pointer-events: none;
  border-radius: 50%;
  isolation: isolate;
}
.ignition-arc {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--cimoa-gradient-match-ignition);
  mask-image: radial-gradient(circle, transparent 48%, var(--cimoa-surface-card) 52%, var(--cimoa-surface-card) 55%, transparent 60%);
  animation: ignition-gather var(--ignite-duration) ease-out both;
}
.ignition-point {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 11.45rpx;
  height: 11.45rpx;
  margin: -5.725rpx;
  border-radius: 50%;
}
.ignition-point--cyan { background: var(--cimoa-brand-cyan); box-shadow: var(--cimoa-shadow-connection-cyan); animation: ignition-cyan var(--ignite-duration) ease-out both; }
.ignition-point--pink { background: var(--cimoa-brand-pink); box-shadow: var(--cimoa-shadow-connection-pink); animation: ignition-pink var(--ignite-duration) ease-out both; }
.match-ignition--arrival { width: 381.68rpx; height: 190.84rpx; margin-left: -190.84rpx; }
.match-ignition--arrival .ignition-arc { background: var(--cimoa-gradient-press-glow); mask-image: none; animation-name: ignition-arrive; }
.match-ignition--arrival .ignition-point { display: none; }
.match-ignition--reduced .ignition-point { display: none; }
.match-ignition--reduced .ignition-arc { animation-name: ignition-fade; }
@keyframes ignition-gather { 0% { opacity: 0; transform: scale(1.2) rotate(-20deg); } 24% { opacity: .75; } 100% { opacity: 0; transform: scale(.45) rotate(18deg); } }
@keyframes ignition-cyan { from { opacity: .8; transform: translate(-61.069rpx, -26.718rpx); } to { opacity: 0; transform: translate(0, 0); } }
@keyframes ignition-pink { from { opacity: .65; transform: translate(57.252rpx, 22.901rpx); } to { opacity: 0; transform: translate(0, 0); } }
@keyframes ignition-arrive { from { opacity: .9; transform: scale(.8); } to { opacity: 0; transform: scale(1.12); } }
@keyframes ignition-fade { from { opacity: .45; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .ignition-point { display: none; }
  .ignition-arc { animation-name: ignition-fade; }
}
</style>
