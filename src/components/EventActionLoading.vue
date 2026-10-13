<script setup>
defineProps({ visible: Boolean, label: String })
</script>
<template>
  <view v-show="visible" class="event-loading" role="status" aria-live="polite" @touchmove.stop.prevent><view class="event-loading-card"><view class="event-loading-ring" /><text>{{ label }}</text></view></view>
</template>
<style scoped>
.event-loading {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cimoa-surface-event-scrim);
}
.event-loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22.901rpx;
  max-width: 572.519rpx;
  padding: 45.802rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-surface-card);
  color: var(--cimoa-text-title);
  font-size: 30.534rpx;
}
.event-loading-ring {
  width: 57.252rpx;
  height: 57.252rpx;
  border: 3px solid var(--cimoa-surface-border);
  border-top-color: var(--cimoa-button-primary);
  border-radius: 50%;
  animation: event-spin 600ms linear infinite;
}
@keyframes event-spin {
  to { transform: rotate(360deg); }
}
</style>
