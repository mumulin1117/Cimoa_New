<script setup>
import { getCurrentInstance } from 'vue'
defineProps({ name: String })
const gradient_id = `connection-video-${getCurrentInstance().uid}`
</script>
<template>
  <svg v-if="name === 'celebrate'" viewBox="0 0 30 18" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M7 14 3 2" class="cyan" stroke-width="2.4" /><path d="M15 11V1" class="violet" stroke-width="2.4" /><path d="M23 14l4-12" class="pink" stroke-width="2.4" /></svg>
  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="name === 'sent'" d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.6" />
    <template v-else-if="name === 'clock'"><circle cx="12" cy="12" r="9" stroke-width="2" /><path d="M12 7.5V12l3 2" stroke-width="2" /></template>
    <path v-else-if="name === 'closed'" d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="2.4" />
    <path v-else-if="name === 'close'" d="M6 6l12 12M18 6 6 18" stroke-width="2.4" />
    <template v-else-if="name === 'verified'"><circle cx="12" cy="12" r="11" fill="var(--cimoa-status-verified)" stroke="var(--cimoa-text-inverse)" stroke-width="2" /><path d="m7.5 12.4 3 3 6-6.4" stroke="var(--cimoa-text-inverse)" stroke-width="2.6" /></template>
    <template v-else-if="name === 'location'"><path d="M12 21s-7-6.2-7-11.4A7 7 0 0 1 19 9.6C19 14.8 12 21 12 21z" stroke-width="1.7" /><circle cx="12" cy="9.4" r="2.4" stroke-width="1.7" /></template>
    <path v-else-if="name === 'song-play'" d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none" />
    <template v-else-if="name === 'video'"><defs><linearGradient :id="gradient_id" x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop class="video-cyan" /><stop offset="0.55" class="video-purple" /><stop offset="1" class="video-pink" /></linearGradient></defs><rect x="1.5" y="5.5" width="14.5" height="13" rx="3.2" :fill="`url(#${gradient_id})`" stroke="none" /><path d="M17 10.2 22 7v10l-5-3.2z" :fill="`url(#${gradient_id})`" stroke="none" /></template>
    <template v-else-if="name === 'more'"><circle v-for="y in [5,12,19]" :key="y" cx="12" :cy="y" r="2" fill="currentColor" stroke="none" /></template>
    <template v-else-if="name === 'photo'"><rect x="3" y="3" width="18" height="18" rx="4" stroke-width="1.9" /><circle cx="9" cy="9" r="1.8" stroke-width="1.9" /><path d="M21 15.5 16 11 6 20.5" stroke-width="1.9" /></template>
    <template v-else-if="name === 'mic'"><rect x="9" y="2.5" width="6" height="11" rx="3" stroke-width="1.9" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" stroke-width="1.9" /></template>
    <path v-else-if="name === 'send'" d="M3.4 20.4 21 12 3.4 3.6l1.8 7.1L14 12l-8.8 1.3z" fill="currentColor" stroke="none" />
  </svg>
</template>
<style scoped>
svg { display: block; width: 100%; height: 100%; }
.cyan { stroke: var(--cimoa-brand-cyan); }
.violet { stroke: var(--cimoa-brand-connection-violet); }
.pink { stroke: var(--cimoa-brand-pink); }
.video-cyan { stop-color: var(--cimoa-brand-cyan); }
.video-purple { stop-color: var(--cimoa-brand-video-purple); }
.video-pink { stop-color: var(--cimoa-brand-pink); }
</style>
