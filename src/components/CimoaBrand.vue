<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { MOTION } from '@/config/navigation.js'
const props = defineProps({ splash: Boolean, encounter: Boolean, active: { type: Boolean, default: true } })
const arc = ref(null)
let motion_query
const sync_motion = () => {
  const svg = arc.value?.$el || arc.value
  if (!props.encounter || !svg) return
  if (props.active && !motion_query?.matches) svg.unpauseAnimations?.()
  else svg.pauseAnimations?.()
}
watch(() => props.active, sync_motion)
onMounted(() => {
  motion_query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  motion_query?.addEventListener?.('change', sync_motion)
  sync_motion()
})
onUnmounted(() => { (arc.value?.$el || arc.value)?.pauseAnimations?.(); motion_query?.removeEventListener?.('change', sync_motion) })
</script>
<template>
  <view class="brand" :class="{ 'brand--splash': splash }">
    <svg ref="arc" class="brand-arc" viewBox="0 0 58 16" fill="none" aria-hidden="true"><defs><linearGradient id="cimoa-home-arc" x1="0" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse"><stop class="arc-start" /><stop class="arc-mid" offset="0.5" /><stop class="arc-end" offset="1" /></linearGradient></defs><path d="M3 14C3 7 11.5 2 29 2s26 5 26 12" stroke="url(#cimoa-home-arc)" stroke-width="4" stroke-linecap="round" />
      <g v-if="encounter" class="splash-arc-lights">
        <circle class="splash-arc-particle splash-arc-particle--cyan" r="1.65" opacity="0"><animateMotion path="M3 14C3 7 11.5 2 29 2" :dur="`${MOTION.startup_arc}ms`" repeatCount="1" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".22 .65 .3 1" /><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.8;1" :dur="`${MOTION.startup_arc}ms`" repeatCount="1" fill="freeze" /></circle>
        <circle class="splash-arc-particle splash-arc-particle--pink" r="1.65" opacity="0"><animateMotion path="M55 14C55 7 46.5 2 29 2" :dur="`${MOTION.startup_arc}ms`" repeatCount="1" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".22 .65 .3 1" /><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.8;1" :dur="`${MOTION.startup_arc}ms`" repeatCount="1" fill="freeze" /></circle>
      </g>
    </svg>
    <text class="brand-name">Cimoa</text>
    <text v-if="!splash" class="brand-tagline">Real people. A rounder you.</text>
  </view>
</template>
<style scoped>
.brand { display: flex; flex-direction: column; align-items: center; gap: 3.817rpx; padding-top: 3.817rpx; }
.brand-arc { width: 110.687rpx; height: 30.534rpx; flex: none; }
.arc-start { stop-color: var(--cimoa-brand-cyan); }
.arc-mid { stop-color: var(--cimoa-brand-arc-mid); }
.arc-end { stop-color: var(--cimoa-brand-pink); }
.brand-name { font-size: 40.076rpx; font-weight: 500; letter-spacing: .30em; padding-left: .30em; }
.brand-tagline { font-size: 26.718rpx; color: var(--cimoa-text-tagline); letter-spacing: -.01em; white-space: nowrap; }
.brand--splash { gap: 5.725rpx; padding-top: 0; }
.brand--splash .brand-arc { width: 154.58rpx; height: 43.511rpx; }
.brand--splash .brand-name { font-size: 57.252rpx; }
.splash-arc-particle--cyan { fill: var(--cimoa-brand-cyan); filter: drop-shadow(0 0 3.817rpx var(--cimoa-brand-cyan)); }
.splash-arc-particle--pink { fill: var(--cimoa-brand-pink); filter: drop-shadow(0 0 3.817rpx var(--cimoa-brand-pink)); }
@media (prefers-reduced-motion: reduce) { .splash-arc-lights { display: none; } }
</style>
