<script setup>
// Exact source paths: Home 220/228/267/270/271, Discover 366/376/384/388, TabBar.dc.html.
defineProps({ name: { type: String, required: true }, strokeWidth: { type: Number, default: null } })
</script>

<template>
  <view class="source-icon" aria-hidden="true">
    <svg v-if="name === 'lightning'" viewBox="0 0 12 18" fill="currentColor"><path d="M7.5 0 0 10h4l-1 8 8-10.5H7z" /></svg>
    <svg v-else-if="name === 'verified'" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" class="verified-circle" /><path d="m7.5 12.4 3 3 6-6.4" class="verified-check" :stroke-width="strokeWidth || 2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
    <svg v-else-if="name === 'apple'" viewBox="0 0 24 24" fill="currentColor"><path d="M16.2 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.5-.1-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 3 2.3 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.7-3.6zM14.3 5.6c.6-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z" /></svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="strokeWidth || 2" stroke-linecap="round" stroke-linejoin="round">
      <template v-if="name === 'settings'"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.4-2-3.4-2.3.7a7.6 7.6 0 0 0-1.7-1L15 3h-6l-.4 2.9a7.6 7.6 0 0 0-1.7 1l-2.3-.7-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.4 2 3.4 2.3-.7a7.6 7.6 0 0 0 1.7 1L9 21h6l.4-2.9a7.6 7.6 0 0 0 1.7-1l2.3.7 2-3.4z" /></template>
      <template v-else-if="name === 'edit'"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></template>
      <template v-else-if="name === 'height'"><path d="M8 2v20M16 2v20M8 6h4M8 12h4M8 18h4" /></template>
      <template v-else-if="name === 'people'"><circle cx="9" cy="8" r="3.4" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 20a5.6 5.6 0 0 0-2.2-4.4" /></template>
      <template v-else-if="name === 'sparkle'"><path d="M12 3l1.6 4.8L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.2z" /></template>
      <template v-else-if="name === 'bell'"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2.4 2.4 0 0 0 4 0" /></template>
      <template v-else-if="name === 'shield'"><path d="M12 3l7 3v5c0 5-3.2 7.8-7 9-3.8-1.2-7-4-7-9V6zM9 12l2 2 4-4" /></template>
      <template v-else-if="name === 'globe'"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" /></template>
      <template v-else-if="name === 'blocked'"><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></template>
      <template v-else-if="name === 'flag'"><path d="M5 21V4h13l-2.5 4L18 12H5" /></template>
      <template v-else-if="name === 'support'"><path d="M12 3.8c4.8 0 8.5 3.3 8.5 7.6s-3.7 7.6-8.5 7.6c-1.1 0-2.2-.2-3.2-.5-.4-.1-.8-.1-1.2.1l-2.4 1.2c-.6.3-1.2-.2-1-.8l.6-2c.1-.4 0-.8-.2-1.1C3.9 14.6 3.5 13 3.5 11.4 3.5 7.1 7.2 3.8 12 3.8z" /></template>
      <template v-else-if="name === 'legal'"><path d="M6 4h9l3 3v13H6zM9 9h6M9 13h6M9 17h4" /></template>
      <template v-else-if="name === 'logout'"><path d="M9 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h4M15 16l4-4-4-4M19 12H9" /></template>
      <template v-else-if="name === 'delete'"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M7 7l1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" /></template>
      <template v-else-if="name === 'arrow-right'"><path d="M5 12h14M13 6l6 6-6 6" /></template>
      <template v-else-if="name === 'home'"><path d="M3 10.5 12 3.5l9 7V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></template>
      <template v-else-if="name === 'discover'"><circle cx="11" cy="11" r="7" /><path d="M16.2 16.2 21 21" /></template>
      <template v-else-if="name === 'events' || name === 'my-events'"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v3M16 3v3M3 10h18" /><path v-if="name === 'my-events'" d="m9 15 2 2 4-4" /></template>
      <template v-else-if="name === 'location'"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" stroke-width="1.9" /><circle cx="12" cy="10" r="2.6" stroke-width="1.9" /></template>
      <template v-else-if="name === 'person'"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.4-4.2 5-6 7.5-6s6.1 1.8 7.5 6" /></template>
      <template v-else-if="name === 'chevron'"><path d="M9 5l7 7-7 7" stroke-width="2.4" /></template>
      <template v-else-if="name === 'back'"><path d="M15 5l-7 7 7 7" stroke-width="2.4" /></template>
      <template v-else-if="name === 'university'"><path d="M2 8.5l10-4.5 10 4.5-10 4.5zM6 10.8v4.4c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.4M22 8.5v5" :stroke-width="strokeWidth || 1.9" /></template>
      <template v-else-if="name === 'goal-search'"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 20 20" /></template>
      <template v-else-if="name === 'filter'"><path d="M4 7h16M7 12h10M10 17h4" /></template>
      <template v-else-if="name === 'book'"><path d="M2.5 5.5c3.2-1 6.3-.7 9.5 1.2 3.2-1.9 6.3-2.2 9.5-1.2v13c-3.2-1-6.3-.7-9.5 1.2-3.2-1.9-6.3-2.2-9.5-1.2zM12 6.7v13" :stroke-width="strokeWidth || 1.9" /></template>
      <template v-else-if="name === 'puzzle'"><path d="M9.2 3.8a2.3 2.3 0 0 1 4.6 0V5H17a1 1 0 0 1 1 1v3.3h1.2a2.3 2.3 0 0 1 0 4.6H18V18a1 1 0 0 1-1 1h-3.3v-1.2a2.3 2.3 0 0 0-4.6 0V19H6a1 1 0 0 1-1-1v-3.4h1.2a2.3 2.3 0 0 0 0-4.6H5V6a1 1 0 0 1 1-1h3.2z" :stroke-width="strokeWidth || 1.9" /></template>
      <template v-if="name === 'more'"><circle cx="5" cy="12" r="1.9" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.9" fill="currentColor" stroke="none" /></template>
      <template v-if="name === 'check'"><path d="m5 12 4 4L19 6" /></template>
      <template v-if="name === 'photo'"><rect x="2.5" y="5" width="19" height="15" rx="3" /><circle cx="8.5" cy="10.5" r="1.7" /><path d="m4 17 5-5 4 4 3-3 5 5" /></template>
      <template v-if="name === 'mic'"><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1M12 18v3.5M8.5 21.5h7" /></template>
      <template v-if="name === 'send'"><path d="M22 2 11 13M22 2 15 22l-4-9-9-4z" /></template>
      <template v-if="name === 'play'"><path d="m7 4 13 8-13 8z" fill="currentColor" stroke="none" /></template>
      <template v-if="name === 'pause'"><path d="M8 5v14M16 5v14" stroke-width="4" /></template>
    </svg>
  </view>
</template>

<style scoped>
.source-icon { display: inline-flex; width: 100%; height: 100%; color: inherit; }
svg { display: block; width: 100%; height: 100%; }
.verified-circle { fill: var(--cimoa-status-verified); }
.verified-check { stroke: var(--cimoa-text-inverse); }
</style>
