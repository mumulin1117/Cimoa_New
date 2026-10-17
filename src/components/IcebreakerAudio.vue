<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { create_audio_playback } from '@/utils/audioPlayback.js'
import IcebreakerIcon from './IcebreakerIcon.vue'
const props = defineProps({ src: String, duration: Number, voice: Boolean, interaction: String })
const error = ref(''), playing = ref(false), pending = ref(false), seconds = ref(0)
const mmss = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
const length = computed(() => mmss(Math.ceil((props.duration || 0) / 1000)))
const progress = computed(() => `${Math.min(100, seconds.value * 100000 / (props.duration || 1))}%`)
let player, token = 0
const dispose = () => { token++; player?.destroy(); player = null; playing.value = false; pending.value = false; seconds.value = 0 }
const prepare = async () => {
  if (player || pending.value || !props.src) return
  const current = ++token; pending.value = true; error.value = ''
  try {
    const next = await create_audio_playback(props.src, { play: () => { if (current === token) playing.value = true }, pause: () => { if (current === token) playing.value = false }, ended: () => { if (current === token) { playing.value = false; seconds.value = (props.duration || 0) / 1000 } }, time: value => { if (current === token) seconds.value = value }, error: message => { if (current === token) { playing.value = false; error.value = message } } })
    if (current !== token) { next.destroy(); return }; player = next
  } catch (cause) { if (current === token) error.value = cause.message } finally { if (current === token) pending.value = false }
}
const toggle = async () => {
  if (pending.value) return
  if (!player) { await prepare(); return }
  if (playing.value) { player.pause(); return }
  const current = token; error.value = ''
  try { await player.play() } catch (cause) { if (current === token) error.value = cause.message }
}
watch(() => props.src, () => { dispose(); prepare() }, { immediate: true }); onShow(prepare); onHide(dispose); onUnmounted(dispose)
</script>
<template><view class="ice-audio" :class="{ 'ice-audio--voice': voice }" :data-playing="playing">
  <template v-if="voice"><view class="ice-wave-space" /><text class="ice-audio-length">{{ length }}</text></template>
  <view class="ice-audio-play" role="button" tabindex="0" :aria-label="playing ? 'Pause voice message' : 'Play voice message'" :aria-disabled="pending" :data-interaction="interaction" @click="toggle" @keydown.enter="toggle"><view><IcebreakerIcon :name="playing ? 'pause' : 'play'" /></view></view>
  <view v-if="!voice" class="ice-audio-details"><view class="ice-audio-track"><view :style="{ width: progress }" /></view><view class="ice-audio-labels"><text>{{ pending ? 'Loading audio…' : playing ? 'Playing' : seconds ? 'Paused' : 'Ready to play' }}</text><text>{{ length }}</text></view></view>
  <text v-if="error" class="ice-audio-error" role="alert">{{ error }}</text>
</view></template>
<style scoped>
.ice-audio { display: flex; align-items: center; gap: 34.351rpx; width: 100%; }
.ice-audio-play { display: flex; align-items: center; justify-content: center; flex: none; width: 122.137rpx; height: 122.137rpx; border-radius: 50%; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); cursor: pointer; }
.ice-audio-play > view { width: 57.252rpx; height: 57.252rpx; }
.ice-audio-details { flex: 1; min-width: 0; }
.ice-audio-track { height: 15.267rpx; border-radius: 7.634rpx; background: var(--cimoa-surface-ice-track); overflow: hidden; }
.ice-audio-track > view { height: 100%; border-radius: inherit; background: var(--cimoa-gradient-primary); transition: width 300ms ease; }
.ice-audio-labels { display: flex; justify-content: space-between; gap: 7.634rpx; margin-top: 17.176rpx; color: var(--cimoa-text-auth-muted); font-size: 28.626rpx; }
.ice-audio-labels > text:first-child { font-weight: 600; }
.ice-audio-labels > text:last-child { font-variant-numeric: tabular-nums; }
.ice-audio--voice { flex-direction: column; gap: 30.534rpx; }
.ice-wave-space { width: 100%; height: 83.969rpx; }
.ice-audio-length { font-size: 38.168rpx; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.ice-audio--voice .ice-audio-play { position: relative; isolation: isolate; width: 160.305rpx; height: 160.305rpx; border: 3.5px solid var(--cimoa-surface-transparent); background: var(--cimoa-gradient-card-fill) padding-box, var(--cimoa-gradient-primary) border-box; color: var(--cimoa-text-link); }
.ice-audio--voice .ice-audio-play::before { content: ''; position: absolute; inset: -15.267rpx; border-radius: 50%; background: var(--cimoa-gradient-ice-record-glow); filter: blur(7.634rpx); z-index: -1; pointer-events: none; }
.ice-audio--voice .ice-audio-play::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--cimoa-surface-card); pointer-events: none; }
.ice-audio--voice .ice-audio-play > view { position: relative; z-index: 1; width: 72.519rpx; height: 72.519rpx; }
.ice-audio-error { color: var(--cimoa-status-danger); font-size: 26.718rpx; overflow-wrap: anywhere; }
</style>
