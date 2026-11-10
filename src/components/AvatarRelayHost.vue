<script setup>
import { computed, nextTick, onUnmounted, ref, shallowRef } from 'vue'
import { avatar_relay } from '@/utils/avatarRelay.js'

const cue = shallowRef(null), travelling = ref(false), image_ready = ref(false), travel_duration = ref(0)
let frame = null, generation = 0
const stop = avatar_relay.subscribe(async value => {
  const token = ++generation
  if (frame !== null) cancelAnimationFrame(frame)
  cue.value = value; travelling.value = false; image_ready.value = false; travel_duration.value = value?.duration || 0
  if (!value) return
  await nextTick()
  if (token !== generation) return
  frame = requestAnimationFrame(() => {
    frame = null
    if (token !== generation) return
    travel_duration.value = Math.max(0, value.duration - Math.max(0, Date.now() - value.started_at))
    travelling.value = true
  })
})
const placement = computed(() => {
  if (!cue.value) return {}
  const scale = 750 / uni.getWindowInfo().windowWidth
  const rect = cue.value.reduced || travelling.value ? cue.value.to : cue.value.from
  return { left: `${rect.left * scale}rpx`, top: `${rect.top * scale}rpx`, width: `${rect.width * scale}rpx`, height: `${rect.height * scale}rpx`, '--avatar-relay-duration': `${cue.value.duration}ms`, '--avatar-relay-travel': `${travel_duration.value}ms` }
})
onUnmounted(() => { generation++; stop(); if (frame !== null) cancelAnimationFrame(frame) })
</script>

<template>
  <view v-if="cue" :key="`${cue.id}-${cue.direction}`" class="avatar-relay" :class="{ 'avatar-relay--reduced': cue.reduced, 'avatar-relay--image-pending': !image_ready }" :style="placement" :data-relay-direction="cue.direction" aria-hidden="true">
    <image class="avatar-relay-image" :src="cue.url" mode="aspectFill" :draggable="false" @load="image_ready = true" @error="avatar_relay.clear()" />
  </view>
</template>

<style scoped>
.avatar-relay {
  position: fixed;
  z-index: 1090;
  overflow: hidden;
  border-radius: 50%;
  pointer-events: none;
  background: var(--cimoa-surface-tinted);
  box-shadow: var(--cimoa-shadow-connection-chat-avatar);
  transition: left var(--avatar-relay-travel) ease, top var(--avatar-relay-travel) ease, width var(--avatar-relay-travel) ease, height var(--avatar-relay-travel) ease;
  animation: avatar-relay-presence var(--avatar-relay-duration) ease both;
}
.avatar-relay-image { display: block; width: 100%; height: 100%; pointer-events: none; }
.avatar-relay--image-pending { visibility: hidden; }
.avatar-relay--reduced { transition: none; animation-name: avatar-relay-fade; }
@keyframes avatar-relay-presence { 0% { opacity: .6; } 20% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; } }
@keyframes avatar-relay-fade { from { opacity: .35; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .avatar-relay { transition: none; animation-name: avatar-relay-fade; } }
</style>
