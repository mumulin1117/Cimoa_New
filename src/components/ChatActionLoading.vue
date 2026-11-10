<script setup>
import BrandProgressMark from './BrandProgressMark.vue'
defineProps({ visible: Boolean, label: { type: String, required: true } })
</script>

<template>
  <view v-show="visible" class="chat-action-loading" role="status" aria-live="polite" :aria-busy="visible" :aria-label="label"><BrandProgressMark /></view>
</template>

<style scoped>
.chat-action-loading {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--chat-loading-size, 38.168rpx);
  height: var(--chat-loading-size, 38.168rpx);
  color: inherit;
}
</style>
