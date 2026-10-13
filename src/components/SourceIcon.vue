<script setup>
// Exact source paths: Home 220/228/267/270/271, Discover 366/376/384/388, TabBar.dc.html.
defineProps({ name: { type: String, required: true } })
</script>

<template>
  <view class="source-icon" aria-hidden="true">
    <svg v-if="name === 'lightning'" viewBox="0 0 12 18" fill="currentColor"><path d="M7.5 0 0 10h4l-1 8 8-10.5H7z" /></svg>
    <svg v-else-if="name === 'verified'" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" class="verified-circle" /><path d="m7.5 12.4 3 3 6-6.4" class="verified-check" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <template v-if="name === 'home'"><path d="M3 10.5 12 3.5l9 7V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></template>
      <template v-else-if="name === 'discover'"><circle cx="11" cy="11" r="7" /><path d="M16.2 16.2 21 21" /></template>
      <template v-else-if="name === 'events'"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v3M16 3v3M3 10h18" /></template>
      <template v-else-if="name === 'person'"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.4-4.2 5-6 7.5-6s6.1 1.8 7.5 6" /></template>
      <template v-else-if="name === 'chevron'"><path d="M9 5l7 7-7 7" stroke-width="2.4" /></template>
      <template v-else-if="name === 'back'"><path d="M15 5l-7 7 7 7" stroke-width="2.4" /></template>
      <template v-else-if="name === 'university'"><path d="M2 8.5l10-4.5 10 4.5-10 4.5zM6 10.8v4.4c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.4M22 8.5v5" stroke-width="1.9" /></template>
      <template v-else-if="name === 'goal-search'"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 20 20" /></template>
      <template v-else-if="name === 'filter'"><path d="M4 7h16M7 12h10M10 17h4" /></template>
      <template v-else-if="name === 'book'"><path d="M2.5 5.5c3.2-1 6.3-.7 9.5 1.2 3.2-1.9 6.3-2.2 9.5-1.2v13c-3.2-1-6.3-.7-9.5 1.2-3.2-1.9-6.3-2.2-9.5-1.2zM12 6.7v13" stroke-width="1.9" /></template>
      <template v-else-if="name === 'puzzle'"><path d="M9.2 3.8a2.3 2.3 0 0 1 4.6 0V5H17a1 1 0 0 1 1 1v3.3h1.2a2.3 2.3 0 0 1 0 4.6H18V18a1 1 0 0 1-1 1h-3.3v-1.2a2.3 2.3 0 0 0-4.6 0V19H6a1 1 0 0 1-1-1v-3.4h1.2a2.3 2.3 0 0 0 0-4.6H5V6a1 1 0 0 1 1-1h3.2z" stroke-width="1.9" /></template>
    </svg>
  </view>
</template>

<style scoped>
.source-icon { display: inline-flex; width: 100%; height: 100%; color: inherit; }
svg { display: block; width: 100%; height: 100%; }
.verified-circle { fill: var(--cimoa-status-verified); }
.verified-check { stroke: var(--cimoa-text-inverse); }
</style>
