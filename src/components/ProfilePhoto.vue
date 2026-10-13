<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { media_cache } from '@/utils/mediaRepository.js'
const props = defineProps({ src: { type: String, default: '' }, name: { type: String, required: true } })
const resolved = ref(''), status = ref('loading')
let generation = 0, lease = null, timer
const release = () => { clearTimeout(timer); lease?.release(); lease = null }
const fail = () => { generation++; release(); resolved.value = ''; status.value = 'error' }
const load = async () => {
  const token = ++generation
  release(); resolved.value = ''; status.value = props.src ? 'loading' : 'empty'
  if (!props.src) return
  timer = setTimeout(() => { if (token === generation) fail() }, 10000)
  try {
    const next = await media_cache.acquire(props.src)
    if (token !== generation) { next.release(); return }
    lease = next; resolved.value = next.url
  } catch { if (token === generation) fail() }
}
const loaded = () => { if (resolved.value) { clearTimeout(timer); status.value = 'ready' } }
watch(() => props.src, load, { immediate: true })
onUnmounted(() => { generation++; release() })
</script>

<template>
  <view class="profile-photo" :data-media-status="status" role="img" :aria-label="`${name}: ${status === 'ready' ? 'profile photo' : status === 'empty' ? 'no photos' : status === 'error' ? 'photo unavailable' : 'loading photo'}`">
    <image v-if="resolved" :key="resolved" :src="resolved" mode="aspectFill" @load="loaded" @error="fail" />
    <view v-if="status !== 'ready'" class="profile-photo-status" aria-live="polite">
      <text>{{ status === 'loading' ? 'Loading photo…' : status === 'empty' ? 'No photos yet' : 'Photo could not be loaded.' }}</text>
      <view v-if="status === 'error'" class="photo-retry" role="button" tabindex="0" aria-label="Retry photo" @click.stop="load" @keydown.enter.stop="load" @keydown.space.stop.prevent="load">Retry photo</view>
    </view>
  </view>
</template>

<style scoped>
.profile-photo { position: absolute; inset: 0; overflow: hidden; background: var(--cimoa-surface-deep); }
.profile-photo image { display: block; width: 100%; height: 100%; }
.profile-photo :deep(img) { object-fit: cover; object-position: 50% 22%; }
.profile-photo :deep(uni-image > div) { background-position: 50% 22% !important; }
.profile-photo-status {
  position: absolute;
  top: 25%;
  right: 30.534rpx;
  left: 30.534rpx;
  text-align: center;
  color: var(--cimoa-text-inverse);
  font-size: 28.626rpx;
}
.photo-retry {
  display: inline-block;
  margin-top: 22.901rpx;
  padding: 15.267rpx 30.534rpx;
  border: 1px solid var(--cimoa-surface-photo-tag-border);
  border-radius: 34.351rpx;
  background: var(--cimoa-surface-photo-tag);
  cursor: pointer;
}
</style>
