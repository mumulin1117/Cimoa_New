<script setup>
import { getCurrentInstance, onMounted, onUnmounted, ref } from 'vue'
import { MOTION } from '@/config/navigation.js'
const gradient_id = `cimoa-progress-${getCurrentInstance().uid}`
const paused = ref(false)
const visibility = () => { paused.value = document.visibilityState === 'hidden' }
onMounted(() => { if (typeof document !== 'undefined') { visibility(); document.addEventListener('visibilitychange', visibility) } })
onUnmounted(() => { if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility) })
const motion_style = { '--action-orbit-duration': `${MOTION.action_orbit}ms`, '--action-breathe-duration': `${MOTION.action_breathe}ms` }
</script>
<template>
  <view class="brand-progress-mark" :class="{ 'brand-progress-mark--paused': paused }" :style="motion_style" aria-hidden="true">
    <svg class="brand-progress-orbit" viewBox="0 0 40 40" fill="none">
      <defs><linearGradient :id="gradient_id" x1="4" y1="6" x2="36" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="var(--cimoa-brand-cyan)" /><stop offset="0.35" stop-color="var(--cimoa-brand-blue)" /><stop offset="0.7" stop-color="var(--cimoa-brand-purple)" /><stop offset="1" stop-color="var(--cimoa-brand-pink)" /></linearGradient></defs>
      <circle class="brand-progress-track" cx="20" cy="20" r="15" stroke-width="3" />
      <path d="M20 5a15 15 0 0 1 15 15M20 35A15 15 0 0 1 5 20" :stroke="`url(#${gradient_id})`" stroke-width="3.5" stroke-linecap="round" />
      <circle cx="35" cy="20" r="2.5" fill="var(--cimoa-brand-pink)" /><circle cx="5" cy="20" r="2.5" fill="var(--cimoa-brand-cyan)" />
    </svg>
    <view class="brand-progress-core" />
  </view>
</template>
<style scoped>
.brand-progress-mark { position: relative; display: block; width: 100%; height: 100%; }
.brand-progress-orbit { display: block; width: 100%; height: 100%; animation: brand-action-orbit var(--action-orbit-duration) linear infinite; }
.brand-progress-track { stroke: var(--cimoa-surface-border); }
.brand-progress-core { position: absolute; inset: 38%; border-radius: 50%; background: var(--cimoa-gradient-primary); animation: brand-action-breathe var(--action-breathe-duration) ease-in-out infinite; }
.brand-progress-mark--paused .brand-progress-orbit, .brand-progress-mark--paused .brand-progress-core { animation-play-state: paused; }
@keyframes brand-action-orbit { to { transform: rotate(360deg); } }
@keyframes brand-action-breathe { 0%, 100% { opacity: .55; transform: scale(.8); } 50% { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .brand-progress-orbit, .brand-progress-core { animation: none; } }
</style>
