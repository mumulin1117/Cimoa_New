<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { media_cache } from '@/utils/mediaRepository.js'
import SourceIcon from './SourceIcon.vue'
const props = defineProps({ src: String, duration: Number })
const error = ref(''), playing = ref(false), pending = ref(false)
let audio, handle, token = 0
const dispose = () => { token++; audio?.stop(); audio?.destroy(); audio = null; handle?.release(); handle = null; playing.value = false; pending.value = false }
watch(() => props.src, dispose); onHide(dispose); onUnmounted(dispose)
const toggle = async () => {
  if (pending.value) return
  if (playing.value) { audio.pause(); return }
  const current = ++token; pending.value = true; error.value = ''
  try {
    if (!audio) {
      const acquired = await media_cache.acquire(props.src)
      if (current !== token) { acquired.release(); return }
      handle = acquired; audio = uni.createInnerAudioContext(); audio.src = handle.url
      audio.onPlay(() => { playing.value = true; pending.value = false }); audio.onPause(() => { playing.value = false }); audio.onEnded(() => { playing.value = false })
      audio.onError(() => { dispose(); error.value = 'This audio could not be played. Please retry.' })
    }
    audio.play()
  } catch (cause) { if (current === token) { dispose(); error.value = cause.message } }
  finally { if (current === token) pending.value = false }
}
</script>
<template><view class="event-audio"><view class="event-audio-button" role="button" tabindex="0" :aria-label="playing ? 'Pause voice message' : 'Play voice message'" :aria-disabled="pending" data-interaction="eventGroup.media.play.click.1" @click="toggle" @keydown.enter="toggle"><view class="event-page-icon"><SourceIcon :name="playing ? 'pause' : 'play'" /></view><text>{{ pending ? 'Loading audio…' : `${Math.ceil((duration || 0) / 1000)}s voice message` }}</text></view><text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text></view></template>
