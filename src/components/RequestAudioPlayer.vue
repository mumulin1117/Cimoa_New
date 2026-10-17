<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { create_audio_playback } from '@/utils/audioPlayback.js'
const props = defineProps({ src: String, duration: Number })
const playing = ref(false), pending = ref(false), error = ref(''), current_time = ref(0)
const bars = [8,14,22,12,26,16,20,10,24,14,18,8,22,12,16,10,20,14]
const label = computed(() => { const seconds = Math.ceil((props.duration || 0) / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` })
let audio, token = 0
const dispose = () => { token++; audio?.destroy(); audio = null; playing.value = false; pending.value = false; current_time.value = 0 }
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
watch(() => props.src, () => { dispose(); prepare() }, { immediate: true }); onShow(prepare); onHide(dispose); onUnmounted(dispose)
const toggle = async () => {
  if (pending.value) return
  if (!audio) { await prepare(); return }
  if (playing.value) { audio.pause(); return }
  const current = token; pending.value = true; error.value = ''
  try { await audio.play() } catch (cause) { if (current === token) { playing.value = false; error.value = cause.message } }
  finally { if (current === token) pending.value = false }
}
const seek = event => { if (!audio || !Number.isFinite(audio.duration) || !audio.duration) return; const rect = event.currentTarget?.getBoundingClientRect?.(); if (rect) audio.seek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * audio.duration) }
</script>
<template>
  <view class="request-audio">
    <view class="request-audio-row"><view class="request-audio-play" role="button" tabindex="0" :aria-label="playing ? 'Pause voice introduction' : 'Play voice introduction'" :aria-disabled="pending" data-interaction="reqReceived.togglePlay.click.1" @click="toggle" @keydown.enter="toggle"><svg v-if="!playing" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M7.5 5 18.5 12 7.5 19z" /></svg><view v-else class="request-audio-pause"><view /><view /></view></view><view class="request-audio-wave" role="slider" tabindex="0" aria-label="Voice introduction progress" :aria-valuemin="0" :aria-valuemax="Math.ceil((duration || 0) / 1000)" :aria-valuenow="Math.floor(current_time)" data-interaction="reqReceived.seekLiam.click.1" @click="seek" @keydown.left="audio && audio.seek(Math.max(0, current_time - 5))" @keydown.right="audio && audio.seek(Math.min(audio.duration, current_time + 5))"><view v-for="(height,index) in bars" :key="index" :style="{ height: `${height * 750 / 393}rpx` }" :class="{ played: current_time > 0 && index / bars.length < current_time / (duration / 1000) }" /></view><text class="request-audio-duration">{{ pending ? '…' : label }}</text></view>
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
.request-audio-pause { display: flex; gap: 5.725rpx; }
.request-audio-pause > view { width: 7.634rpx; height: 26.718rpx; border-radius: 3.817rpx; background: var(--cimoa-text-inverse); }
.request-audio-wave {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 3.817rpx;
  height: 45.802rpx;
  cursor: pointer;
}
.request-audio-wave > view { flex: 1; border-radius: 3.817rpx; background: var(--cimoa-surface-connection-wave); }
.request-audio-wave > view.played { background: var(--cimoa-gradient-primary); }
.request-audio-duration { flex: none; color: var(--cimoa-text-connection-audio); font-size: 28.626rpx; font-variant-numeric: tabular-nums; }
.request-audio-error { display: block; margin-top: 15.267rpx; color: var(--cimoa-status-danger); font-size: 27.672rpx; line-height: 1.4; }
</style>
