<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { create_audio_playback } from '@/utils/audioPlayback.js'
import SourceIcon from './SourceIcon.vue'
import BrandProgressMark from './BrandProgressMark.vue'
const props = defineProps({ src: String, duration: Number, disabled: Boolean, interaction: { type: String, default: 'eventGroup.media.play.click.1' } })
const error = ref(''), playing = ref(false), pending = ref(false), elapsed = ref(0)
let audio, token = 0
const dispose = () => { token++; audio?.destroy(); audio = null; playing.value = false; pending.value = false; elapsed.value = 0 }
const prepare = async () => {
  if (audio || pending.value) return
  const current = ++token; pending.value = true; error.value = ''
  try {
    const player = await create_audio_playback(props.src, { play: () => { if (current === token) playing.value = true }, pause: () => { if (current === token) playing.value = false }, time: value => { if (current === token) elapsed.value = value }, ended: () => { if (current === token) { playing.value = false; elapsed.value = (props.duration || 0) / 1000 } }, error: message => { if (current === token) { playing.value = false; pending.value = false; error.value = message } } })
    if (current !== token) { player.destroy(); return }
    audio = player
  } catch (cause) { if (current === token) error.value = cause.message }
  finally { if (current === token) pending.value = false }
}
watch(() => props.src, () => { dispose(); prepare() }, { immediate: true }); onShow(prepare); onHide(dispose); onUnmounted(dispose)
watch(() => props.disabled, disabled => { if (disabled) audio?.pause() })
const toggle = async () => {
  if (props.disabled) return
  if (pending.value) return
  if (!audio) { await prepare(); return }
  if (playing.value) { audio.pause(); return }
  const current = token; error.value = ''; pending.value = true
  try { await audio.play() } catch (cause) { if (current === token) { playing.value = false; error.value = cause.message } }
  finally { if (current === token) pending.value = false }
}
</script>
<template><view class="event-audio"><slot :playing="playing" :pending="pending" :elapsed="elapsed" :error="error" :toggle="toggle"><view class="event-audio-button" role="button" tabindex="0" :aria-label="pending ? 'Loading voice message' : playing ? 'Pause voice message' : 'Play voice message'" :aria-disabled="pending || disabled" :aria-busy="pending" :data-interaction="interaction" @click="toggle" @keydown.enter="toggle"><view class="event-page-icon"><BrandProgressMark v-if="pending" /><SourceIcon v-else :name="playing ? 'pause' : 'play'" /></view><text>{{ pending ? 'Loading audio…' : `${Math.ceil((duration || 0) / 1000)}s voice message` }}</text></view><text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text></slot></view></template>

<style scoped>
.event-audio-button {
  display: flex;
  align-items: center;
  gap: 15.267rpx;
  padding: 7.634rpx 0;
  font-size: 28.626rpx;
  cursor: pointer;
}
.event-page-icon { flex: none; display: flex; width: 41.985rpx; height: 41.985rpx; }
.event-dialog-error { display: block; margin-top: 11.45rpx; color: var(--cimoa-status-danger); font-size: 24.809rpx; line-height: 1.4; }
</style>
