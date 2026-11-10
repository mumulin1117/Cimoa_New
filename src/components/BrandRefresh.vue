<script setup>
import { computed, getCurrentInstance, onMounted, onUnmounted, ref } from 'vue'
import { MOTION } from '@/config/navigation.js'
import { REFRESH_ORBIT_PATH, REFRESH_ORBIT_REVERSE, refresh_orbit_presentation } from '@/utils/refreshOrbit.js'
const props = defineProps({ refreshing: Boolean, progress: { type: Number, default: 0 }, label: { type: String, default: '' } })
const gradient_id = `refresh-orbit-${getCurrentInstance().uid}`
const model = computed(() => refresh_orbit_presentation(props.progress, props.refreshing))
const display_label = computed(() => props.label || model.value.label)
const motion_query = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const reduced_motion = ref(motion_query?.matches || false)
const document_visible = ref(typeof document === 'undefined' || document.visibilityState !== 'hidden')
const animate = computed(() => props.refreshing && !reduced_motion.value && document_visible.value)
const motion_changed = () => { reduced_motion.value = !!motion_query?.matches }
const visibility_changed = () => { document_visible.value = document.visibilityState !== 'hidden' }
onMounted(() => { motion_query?.addEventListener('change', motion_changed); if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility_changed) })
onUnmounted(() => { motion_query?.removeEventListener('change', motion_changed); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility_changed) })
</script>
<template>
  <view class="brand-refresh" :class="{ 'brand-refresh--active': refreshing, 'brand-refresh--ready': model.state === 'ready' }" :style="{ '--refresh-orbit-motion': `${MOTION.refresh_orbit}ms`, '--refresh-settle-motion': `${MOTION.refresh_settle}ms`, '--refresh-fade-motion': `${MOTION.refresh_fade}ms` }" :data-refresh-state="model.state" :data-refresh-progress="model.progress" role="status" :aria-label="display_label" :aria-busy="refreshing">
    <view class="refresh-composition">
      <view class="refresh-orbit" aria-hidden="true">
        <svg viewBox="0 0 76 46" fill="none">
          <defs>
            <linearGradient :id="gradient_id" x1="10" y1="14" x2="66" y2="32" gradientUnits="userSpaceOnUse"><stop class="orbit-cyan" /><stop class="orbit-blue" offset=".34" /><stop class="orbit-purple" offset=".64" /><stop class="orbit-pink" offset="1" /></linearGradient>
            <radialGradient :id="`${gradient_id}-halo`"><stop class="orbit-purple" stop-opacity=".17" /><stop class="orbit-cyan" offset=".6" stop-opacity=".05" /><stop class="orbit-purple" offset="1" stop-opacity="0" /></radialGradient>
          </defs>
          <ellipse cx="38" cy="23" rx="34" ry="22" :fill="`url(#${gradient_id}-halo)`" :opacity="model.track_opacity" />
          <g class="refresh-orbit-tracks" :opacity="model.track_opacity">
            <path class="refresh-orbit-rail" :d="REFRESH_ORBIT_PATH" stroke-width="1.1" />
            <path class="refresh-orbit-progress" :d="REFRESH_ORBIT_PATH" :stroke="`url(#${gradient_id})`" stroke-width="1.4" stroke-linecap="round" pathLength="100" stroke-dasharray="100" :stroke-dashoffset="model.dash_offset" />
          </g>
          <g v-if="animate" class="refresh-orbit-flow">
            <path class="refresh-orbit-trail" :d="REFRESH_ORBIT_PATH" :stroke="`url(#${gradient_id})`" stroke-width="2.6" stroke-linecap="round" pathLength="100" stroke-dasharray="9 91" />
            <g class="refresh-orbit-particle refresh-orbit-particle--cyan"><circle r="7" opacity=".12" /><ellipse cx="-3" rx="5" ry="1.6" opacity=".22" /><circle r="2.7" /><circle class="orbit-core" r=".85" /><animateMotion :dur="`${MOTION.refresh_orbit}ms`" repeatCount="indefinite" rotate="auto" :path="REFRESH_ORBIT_PATH" /></g>
            <g class="refresh-orbit-particle refresh-orbit-particle--pink"><circle r="7" opacity=".12" /><ellipse cx="-3" rx="5" ry="1.6" opacity=".22" /><circle r="2.7" /><circle class="orbit-core" r=".85" /><animateMotion :dur="`${MOTION.refresh_orbit}ms`" repeatCount="indefinite" rotate="auto" :path="REFRESH_ORBIT_REVERSE" /></g>
          </g>
          <g v-else class="refresh-orbit-rest">
            <g class="refresh-orbit-particle refresh-orbit-particle--cyan" :transform="`translate(${refreshing ? 35 : model.cyan.x} ${refreshing ? 23 : model.cyan.y})`" data-orbit-node="cyan"><circle r="7" opacity=".12" /><circle r="2.7" /><circle class="orbit-core" r=".85" /></g>
            <g class="refresh-orbit-particle refresh-orbit-particle--pink" :transform="`translate(${refreshing ? 41 : model.pink.x} ${refreshing ? 23 : model.pink.y})`" data-orbit-node="pink"><circle r="7" opacity=".12" /><circle r="2.7" /><circle class="orbit-core" r=".85" /></g>
          </g>
        </svg>
      </view>
      <slot name="copy"><text class="refresh-copy">{{ display_label }}</text></slot>
    </view>
  </view>
</template>
<style scoped>
.brand-refresh {
  height: 122.137rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cimoa-text-secondary);
}
.refresh-composition { display: flex; align-items: center; justify-content: center; gap: 11.45rpx; max-width: 100%; }
.refresh-orbit { flex: none; width: 137.405rpx; height: 83.969rpx; }
.refresh-orbit svg { display: block; width: 100%; height: 100%; overflow: visible; }
.refresh-copy { font-size: 24.809rpx; font-weight: 500; line-height: 1.4; letter-spacing: -.01em; }
.orbit-cyan { stop-color: var(--cimoa-brand-cyan); }
.orbit-blue { stop-color: var(--cimoa-brand-blue); }
.orbit-purple { stop-color: var(--cimoa-brand-purple); }
.orbit-pink { stop-color: var(--cimoa-brand-pink); }
.orbit-core { fill: var(--cimoa-surface-card); }
.refresh-orbit-rail { stroke: var(--cimoa-surface-refresh-track); }
.refresh-orbit-progress { opacity: .32; }
.refresh-orbit-particle--cyan { fill: var(--cimoa-brand-cyan); }
.refresh-orbit-particle--pink { fill: var(--cimoa-brand-pink); }
.refresh-orbit-trail { animation: refresh-flow var(--refresh-orbit-motion) linear infinite; }
.refresh-orbit-flow { animation: refresh-reveal var(--refresh-fade-motion) ease both; }
.brand-refresh--ready .refresh-orbit-rest { transform-box: fill-box; transform-origin: center; animation: refresh-meet var(--refresh-settle-motion) cubic-bezier(.2,.8,.25,1) both; }
@keyframes refresh-flow { to { stroke-dashoffset: -100; } }
@keyframes refresh-reveal { from { opacity: 0; } to { opacity: 1; } }
@keyframes refresh-meet { 0% { transform: scale(1); } 45% { transform: scale(1.12); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .brand-refresh--ready .refresh-orbit-rest, .refresh-orbit-flow, .refresh-orbit-trail { animation: none; } }
</style>
