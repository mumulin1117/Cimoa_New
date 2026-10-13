<script setup>
defineProps({ visible: Boolean, label: { type: String, default: 'Working...' } })
</script>

<template>
  <view v-if="visible" class="loading" role="status" aria-label="Loading"><view class="loading__dot" /><text class="loading__text">{{ label }}</text></view>
</template>

<style scoped>
.loading { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--cimoa-scrim); }.loading__dot { width: 58rpx; height: 58rpx; border: 6rpx solid var(--cimoa-border); border-top-color: var(--cimoa-title); border-radius: 50%; animation: spin 760ms linear infinite; }.loading__text { margin-top: 18rpx; padding: 10rpx 18rpx; border-radius: 100rpx; color: var(--cimoa-title); background: var(--cimoa-card); font-size: 22rpx; }@keyframes spin { to { transform: rotate(360deg); } }
</style>
