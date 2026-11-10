<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { create_audio_playback } from '@/utils/audioPlayback.js'
import { bind_card_pointer_events, create_pointer_gesture } from '@/utils/discoverSwipe.js'
import BrandProgressMark from './BrandProgressMark.vue'
const props = defineProps({ src: String, duration: Number })
const playing = ref(false), pending = ref(false), error = ref(''), current_time = ref(0)
const waveform = ref(null), seek_position = ref(null)
const display_time = computed(() => seek_position.value ?? current_time.value)
const bars = [8,14,22,12,26,16,20,10,24,14,18,8,22,12,16,10,20,14]
const label = computed(() => { const seconds = Math.ceil((props.duration || 0) / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` })
let audio, token = 0, page_visible = true, suspended = false, unbind_seek
const dispose = () => { token++; seek_gesture.cancel(); audio?.destroy(); audio = null; playing.value = false; pending.value = false; current_time.value = 0; seek_position.value = null }
const prepare = async () => {
  if (audio || pending.value) return
  const current = ++token; pending.value = true; error.value = ''
  try {
    const player = await create_audio_playback(props.src, { play: () => { if (current === token) playing.value = true }, pause: () => { if (current === token) playing.value = false }, ended: () => { if (current === token) { playing.value = false; current_time.value = 0 } }, time: seconds => { if (current === token) current_time.value = seconds }, error: message => { if (current === token) { playing.value = false; pending.value = false; error.value = message } } })
    if (current !== token) { player.destroy(); return }
    audio = player
  } catch (cause) { if (current === token) error.value = cause.message }
  finally { if (current === token) pending.value = false }
}
const toggle = async () => {
  if (pending.value || !page_visible || suspended) return
  if (!audio) { await prepare(); if (!audio) return }
  if (playing.value) { audio.pause(); return }
  const current = token; pending.value = true; error.value = ''
  try { await audio.play() } catch (cause) { if (current === token) { playing.value = false; error.value = cause.message } }
  finally { if (current === token) pending.value = false }
}
const can_seek = () => page_visible && !suspended && !pending.value && audio && Number.isFinite(audio.duration) && audio.duration > 0
const seek_at = event => {
  if (!can_seek()) return null
  const rect = (waveform.value?.$el || waveform.value)?.getBoundingClientRect?.()
  return rect?.width > 0 && Number.isFinite(event.clientX) ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * audio.duration : null
}
const preview_seek = event => { seek_position.value = seek_at(event) }
const seek_gesture = create_pointer_gesture({
  element: () => waveform.value?.$el || waveform.value,
  can_start: can_seek,
  capture: 'horizontal',
  cancel_vertical: true,
  start: preview_seek,
  move: preview_seek,
  end: event => { const seconds = seek_at(event); seek_position.value = null; if (seconds !== null) audio.seek(seconds) },
  cancel: () => { seek_position.value = null },
})
const seek_by = delta => { if (can_seek()) audio.seek(Math.max(0, Math.min(audio.duration, current_time.value + delta))) }
watch(waveform, () => {
  seek_gesture.cancel(); unbind_seek?.()
  unbind_seek = bind_card_pointer_events(waveform.value?.$el || waveform.value, {
    ...seek_gesture,
    suspend: () => { suspended = true; dispose() },
    resume: () => { suspended = false; if (page_visible) prepare() },
  })
}, { flush: 'post' })
watch(() => props.src, () => { dispose(); if (page_visible && !suspended) prepare() }, { immediate: true })
onShow(() => { page_visible = true; suspended = false; prepare() })
onHide(() => { page_visible = false; dispose() })
onUnmounted(() => { page_visible = false; dispose(); unbind_seek?.() })
</script>
<template>
  <view class="request-audio">
    <view class="request-audio-row"><view class="request-audio-play" role="button" tabindex="0" :aria-label="pending ? 'Loading voice introduction' : playing ? 'Pause voice introduction' : 'Play voice introduction'" :aria-disabled="pending" :aria-busy="pending" data-interaction="reqReceived.togglePlay.click.1" @click="toggle" @keydown.enter="toggle"><view v-if="pending" class="request-audio-loading"><BrandProgressMark /></view><svg v-else-if="!playing" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M7.5 5 18.5 12 7.5 19z" /></svg><view v-else class="request-audio-pause"><view /><view /></view></view><view ref="waveform" class="request-audio-wave" role="slider" tabindex="0" aria-label="Voice introduction progress" :aria-disabled="pending || !audio" :aria-valuemin="0" :aria-valuemax="Math.ceil((duration || 0) / 1000)" :aria-valuenow="Math.floor(display_time)" data-interaction="reqReceived.seekLiam.click.1" @keydown.left.prevent="seek_by(-5)" @keydown.right.prevent="seek_by(5)"><view v-for="(height,index) in bars" :key="index" :style="{ height: `${height * 750 / 393}rpx` }" :class="{ played: display_time > 0 && index / bars.length < display_time / (duration / 1000) }" /></view><text class="request-audio-duration">{{ pending ? '…' : label }}</text></view>
    <text v-if="error" class="request-audio-error" role="alert">{{ error }}</text>
  </view>
</template>
<style scoped>
.request-audio-row { display: flex; align-items: center; gap: 26.718rpx; margin-top: 22.901rpx; }
.request-audio-play {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 91.603rpx;
  height: 91.603rpx;
  border-radius: 50%;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-gradient-connection-voice);
  cursor: pointer;
}
.request-audio-play svg { width: 38.168rpx; height: 38.168rpx; }
.request-audio-loading { width: 53.435rpx; height: 53.435rpx; padding: 5.725rpx; border-radius: 50%; background: var(--cimoa-surface-card); }
.request-audio-pause { display: flex; gap: 5.725rpx; }
.request-audio-pause > view { width: 7.634rpx; height: 26.718rpx; border-radius: 3.817rpx; background: var(--cimoa-text-inverse); }
.request-audio-wave {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 3.817rpx;
  height: 45.802rpx;
  cursor: pointer;
  touch-action: pan-y;
}
.request-audio-wave > view { flex: 1; border-radius: 3.817rpx; background: var(--cimoa-surface-connection-wave); }
.request-audio-wave > view.played { background: var(--cimoa-gradient-primary); }
.request-audio-duration { flex: none; color: var(--cimoa-text-connection-audio); font-size: 28.626rpx; font-variant-numeric: tabular-nums; }
.request-audio-error { display: block; margin-top: 15.267rpx; color: var(--cimoa-status-danger); font-size: 27.672rpx; line-height: 1.4; }
</style>
