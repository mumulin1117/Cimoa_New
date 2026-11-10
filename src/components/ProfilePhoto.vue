<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { media_cache } from '@/utils/mediaRepository.js'
import { prepare_image } from '@/utils/imagePreparation.js'
import { DISCOVER_DECK } from '@/config/discoverDeck.js'
import BrandProgressMark from './BrandProgressMark.vue'
const props = defineProps({ src: { type: String, default: '' }, name: { type: String, required: true }, position: { type: String, default: '50% 22%' }, eventCover: Boolean, portrait: Boolean, contain: Boolean, deck: Boolean, reveal: { type: Boolean, default: true }, fade: { type: Boolean, default: true }, retryInteraction: { type: String, default: '' } })
const emit = defineEmits(['ready', 'error', 'loading'])
const resolved = ref(''), status = ref('loading')
let generation = 0, lease = null, timer, preparation
const release = () => { clearTimeout(timer); preparation?.cancel(); preparation = null; lease?.release(); lease = null }
const fail = () => { generation++; release(); resolved.value = ''; status.value = 'error'; emit('error', props.src) }
const load = async () => {
  const token = ++generation
  release(); resolved.value = ''; status.value = props.src ? 'loading' : 'empty'
  if (!props.src) return
  emit('loading', props.src)
  timer = setTimeout(() => { if (token === generation) fail() }, 10000)
  try {
    const next = await media_cache.acquire(props.src)
    if (token !== generation) { next.release(); return }
    lease = next
    if (props.deck) {
      preparation = prepare_image(next.url)
      const decoded = await preparation.ready
      if (!decoded || token !== generation) return
    }
    resolved.value = next.url
    if (props.deck && preparation?.cached) loaded()
  } catch { if (token === generation) fail() }
}
const loaded = () => { if (resolved.value && status.value !== 'ready') { clearTimeout(timer); status.value = 'ready'; emit('ready', props.src) } }
watch(() => props.src, load, { immediate: true })
onUnmounted(() => { generation++; release() })
</script>

<template>
  <view class="profile-photo" :class="{ 'profile-photo--event': eventCover, 'profile-photo--portrait': portrait, 'profile-photo--contain': contain, 'profile-photo--deck': deck, 'profile-photo--revealed': reveal }" :style="{ '--profile-photo-position': position, '--profile-photo-fade': `${fade ? DISCOVER_DECK.entrance.fade_ms : 0}ms` }" :data-media-status="status" :data-media-decoded="deck && !!resolved" role="img" :aria-label="`${name}: ${status === 'ready' ? eventCover ? 'event cover' : 'profile photo' : status === 'empty' ? 'no photos' : status === 'error' ? 'photo unavailable' : 'loading photo'}`">
    <image v-if="resolved" :key="resolved" :src="resolved" :mode="contain ? 'aspectFit' : 'aspectFill'" @load="loaded" @error="fail" />
    <view v-if="status !== 'ready' && (!deck || status !== 'loading')" class="profile-photo-status" aria-live="polite">
      <view v-if="status === 'loading'" class="profile-photo-loading" aria-hidden="true"><BrandProgressMark /></view>
      <text v-if="!portrait || status !== 'loading'">{{ status === 'loading' ? 'Loading photo…' : status === 'empty' ? 'No photos yet' : portrait ? 'Photo unavailable' : 'Photo could not be loaded.' }}</text>
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
.profile-photo-loading {
  width: 76.336rpx;
  height: 76.336rpx;
  padding: 9.542rpx;
  margin: 0 auto 15.267rpx;
  border-radius: 26.718rpx;
  background: var(--cimoa-surface-toast);
  box-shadow: var(--cimoa-shadow-toast);
}
.profile-photo--portrait .profile-photo-loading { width: 38.168rpx; height: 38.168rpx; padding: 3.817rpx; margin-bottom: 0; border-radius: 50%; }
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
.profile-photo--contain :deep(img) { object-fit: contain; }
.profile-photo--contain :deep(uni-image > div) { background-size: contain !important; }
.profile-photo--deck { background: var(--cimoa-surface-skeleton); }
.profile-photo--deck image { opacity: 0; transition: opacity var(--profile-photo-fade) ease-out; }
.profile-photo--deck.profile-photo--revealed[data-media-status="ready"] image { opacity: 1; }
.profile-photo--deck .profile-photo-status { color: var(--cimoa-text-secondary); }
.profile-photo--deck .photo-retry { color: var(--cimoa-text-link); background: var(--cimoa-surface-card); }
</style>
