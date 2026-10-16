<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { media_cache } from '@/utils/mediaRepository.js'
const props = defineProps({ src: { type: String, default: '' }, name: { type: String, required: true }, position: { type: String, default: '50% 22%' }, eventCover: Boolean, portrait: Boolean, retryInteraction: { type: String, default: '' } })
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
  <view class="profile-photo" :class="{ 'profile-photo--event': eventCover, 'profile-photo--portrait': portrait }" :style="{ '--profile-photo-position': position }" :data-media-status="status" role="img" :aria-label="`${name}: ${status === 'ready' ? eventCover ? 'event cover' : 'profile photo' : status === 'empty' ? 'no photos' : status === 'error' ? 'photo unavailable' : 'loading photo'}`">
    <image v-if="resolved" :key="resolved" :src="resolved" mode="aspectFill" @load="loaded" @error="fail" />
    <view v-if="status !== 'ready'" class="profile-photo-status" aria-live="polite">
      <text>{{ status === 'loading' ? 'Loading photo…' : status === 'empty' ? 'No photos yet' : portrait ? 'Photo unavailable' : 'Photo could not be loaded.' }}</text>
      <view v-if="status === 'error'" class="photo-retry" role="button" tabindex="0" aria-label="Retry photo" :data-interaction="retryInteraction || undefined" @click.stop="load" @keydown.enter.stop="load" @keydown.space.stop.prevent="load">Retry photo</view>
    </view>
  </view>
</template>

<style scoped>
.profile-photo { position: absolute; inset: 0; overflow: hidden; background: var(--cimoa-surface-deep); }
.profile-photo image { display: block; width: 100%; height: 100%; }
.profile-photo :deep(img) { object-fit: cover; object-position: var(--profile-photo-position); }
.profile-photo :deep(uni-image > div) { background-position: var(--profile-photo-position) !important; }
.profile-photo--event :deep(img), .profile-photo--portrait :deep(img) { object-position: center; }
.profile-photo--event :deep(uni-image > div), .profile-photo--portrait :deep(uni-image > div) { background-position: center !important; }
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
.profile-photo--portrait { background: var(--cimoa-surface-tinted); }
.profile-photo--portrait .profile-photo-status {
  top: 50%;
  right: 15.267rpx;
  left: 15.267rpx;
  transform: translateY(-50%);
  color: var(--cimoa-text-secondary);
  font-size: 22.901rpx;
  line-height: 1.2;
}
.profile-photo--portrait .photo-retry { margin-top: 7.634rpx; padding: 11.45rpx 15.267rpx; background: var(--cimoa-surface-card); color: var(--cimoa-text-link); }
</style>
