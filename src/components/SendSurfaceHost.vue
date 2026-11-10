<script setup>
import { computed, onUnmounted, shallowRef } from 'vue'
import { send_surface } from '@/utils/sendSurface.js'

const props = defineProps({ controller: { type: Object, default: () => send_surface } })
const { source_id, target_id, attribute_prefix } = props.controller.presentation
const state = shallowRef(props.controller.current)
const attributes = computed(() => Object.fromEntries(['phase', 'direction', 'user', 'issue'].map(key => [`data-${attribute_prefix}-${key}`, state.value[key === 'user' ? 'user_id' : key] || undefined])))
const stop = props.controller.subscribe(value => { state.value = value })
onUnmounted(stop)
</script>

<template>
  <view class="send-surface-host" v-bind="attributes">
    <view :id="source_id" class="send-surface-slot send-surface-slot--source" inert aria-hidden="true" />
    <view :id="target_id" class="send-surface-slot send-surface-slot--target" inert aria-hidden="true" />
  </view>
</template>

<style scoped>
.send-surface-host {
  position: fixed;
  z-index: 1050;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  color: var(--cimoa-text-title);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}
.send-surface-slot { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
.send-surface-slot--source { z-index: 0; }
.send-surface-slot--target { z-index: 1; }
</style>
