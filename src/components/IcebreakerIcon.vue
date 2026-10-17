<script setup>
// Exact paths from decoded HTML 634/642/646/714/734/739/768/784/789.
defineProps({ name: String })
</script>
<template><svg class="ice-source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <template v-if="name === 'keyboard'"><rect x="2" y="6" width="20" height="12" rx="2.5" /><path d="M6 10h0M10 10h0M14 10h0M18 10h0M6 14h12" /></template>
  <template v-else-if="name === 'mic'"><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" /></template>
  <template v-else-if="name === 'check'"><path d="M5 12.5l4.5 4.5L19 7" stroke-width="3" /></template>
  <template v-else-if="name === 'info'"><circle cx="12" cy="12" r="9.2" /><path d="M12 11v5.5M12 8v.01" /></template>
  <template v-else-if="name === 'play'"><path d="M7.5 5 18.5 12 7.5 19z" fill="currentColor" /></template>
  <template v-else-if="name === 'pause'"><rect x="6" y="4" width="4.5" height="16" rx="1.6" fill="currentColor" stroke="none" /><rect x="13.5" y="4" width="4.5" height="16" rx="1.6" fill="currentColor" stroke="none" /></template>
  <template v-else-if="name === 'delete'"><path d="M4 7h16M9.5 7V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V7M6 7l1 12.2c.1 1 .9 1.8 2 1.8h6c1.1 0 1.9-.8 2-1.8L18 7M10 11v6M14 11v6" /></template>
  <template v-else-if="name === 'rerecord'"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.5H8" /><rect x="10" y="8" width="4" height="6.5" rx="2" /><path d="M12 17v-1" /></template>
</svg></template>
<style scoped>.ice-source-icon { display: block; width: 100%; height: 100%; }</style>
