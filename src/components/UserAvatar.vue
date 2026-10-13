<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { media_cache } from '@/utils/mediaRepository.js'
import SourceIcon from './SourceIcon.vue'
const props = defineProps({ src: { type: String, default: '' }, name: { type: String, default: 'User' } })
const resolved = ref(''), failed = ref(false)
let generation = 0, lease = null
watch(() => props.src, async (src) => {
  const token = ++generation
  lease?.release(); lease = null; resolved.value = ''; failed.value = false
  try {
    const next = await media_cache.acquire(src)
    if (token !== generation) { next.release(); return }
    lease = next; resolved.value = next.url
  } catch { if (token === generation) failed.value = true }
}, { immediate: true })
onUnmounted(() => { generation++; lease?.release(); lease = null })
</script>
<template>
  <view class="user-avatar" role="img" :aria-label="failed ? `${name}: photo unavailable` : name">
    <image v-if="resolved && !failed" :src="resolved" mode="aspectFill" @error="failed = true" />
    <view v-else class="avatar-fallback"><SourceIcon name="person" /></view>
  </view>
</template>
<style scoped>
.user-avatar { width: 100%; height: 100%; overflow: hidden; border-radius: inherit; background: var(--cimoa-surface-tinted); }
.user-avatar image { display: block; width: 100%; height: 100%; }
.avatar-fallback { width: 55%; height: 55%; margin: 22.5%; color: var(--cimoa-text-secondary); }
</style>
