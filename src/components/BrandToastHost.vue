<script setup>
import { computed, onUnmounted, shallowRef } from 'vue'
import { toast, toast_motion_style } from '@/utils/toast.js'
import { auth_notice } from '@/utils/authNotice.js'
import SourceIcon from './SourceIcon.vue'
import BrandProgressMark from './BrandProgressMark.vue'
const notification = shallowRef(null), pending = shallowRef(null)
const current = computed(() => pending.value || notification.value)
const stop = toast.subscribe(value => { notification.value = value })
const stop_pending = auth_notice.subscribe(value => { pending.value = value })
const icons = { success: 'check', info: 'bell', warning: 'flag', error: 'blocked' }
onUnmounted(() => { stop(); stop_pending() })
</script>

<template>
  <view v-if="pending" class="auth-notice-blocker brand-action-blocker" aria-hidden="true" @touchmove.stop.prevent />
  <view class="brand-toast-region" :style="toast_motion_style()">
    <Transition name="brand-toast" mode="out-in">
      <view v-if="current" :key="current.id" class="brand-toast" :class="[`brand-toast--${current.tone}`, { 'brand-action-loading loading': current.busy }, current.busy ? `${current.scope}-action-loading` : '', { 'event-loading': current.busy && current.scope === 'event' }]" :role="current.tone === 'error' ? 'alert' : 'status'" :aria-live="current.tone === 'error' ? 'assertive' : 'polite'" :aria-busy="!!current.busy" aria-atomic="true" :data-toast-id="current.id" :data-toast-tone="current.tone" :data-loading-scope="current.busy ? current.scope : undefined">
        <view class="brand-toast-card">
          <view class="brand-toast-icon"><BrandProgressMark v-if="current.busy" /><SourceIcon v-else :name="icons[current.tone]" /></view>
          <text class="brand-toast-message">{{ current.message }}</text>
          <view v-if="!current.busy" class="brand-toast-close" role="button" tabindex="0" aria-label="Dismiss notification" data-interaction="toast.dismiss.click.1" @click="toast.dismiss(current.id)" @keydown.enter.stop.prevent="toast.dismiss(current.id)" @keydown.space.stop.prevent="toast.dismiss(current.id)"><SourceIcon name="close" /></view>
        </view>
      </view>
    </Transition>
  </view>
</template>

<style scoped>
.auth-notice-blocker { position: fixed; inset: 0; z-index: 9999; }
.brand-toast-region {
  position: fixed;
  z-index: 10000;
  top: calc(var(--app-safe-top) + 22.901rpx);
  left: max(22.901rpx, env(safe-area-inset-left, 0px));
  right: max(22.901rpx, env(safe-area-inset-right, 0px));
  display: flex;
  justify-content: center;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}
.brand-toast {
  width: 673.664rpx;
  max-width: 100%;
  padding: 1px;
  border-radius: 41.985rpx;
  background: var(--cimoa-gradient-toast-border);
  box-shadow: var(--cimoa-shadow-toast);
  backdrop-filter: blur(30.534rpx);
  -webkit-backdrop-filter: blur(30.534rpx);
  pointer-events: auto;
}
.brand-toast-card {
  display: flex;
  align-items: center;
  gap: 19.084rpx;
  min-height: 118.321rpx;
  padding: 15.267rpx 11.45rpx 15.267rpx 22.901rpx;
  border-radius: 40.076rpx;
  background: var(--cimoa-surface-toast);
  color: var(--cimoa-text-title);
}
.brand-toast-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 68.702rpx;
  height: 68.702rpx;
  padding: 17.176rpx;
  border-radius: 24.809rpx;
  background: var(--cimoa-surface-toast-icon);
  color: var(--cimoa-text-settings-purple);
}
.brand-toast--success .brand-toast-icon { background: var(--cimoa-surface-toast-success); color: var(--cimoa-status-success); }
.brand-toast--error .brand-toast-icon { background: var(--cimoa-surface-toast-error); color: var(--cimoa-status-danger); }
.brand-toast--warning .brand-toast-icon { background: var(--cimoa-surface-toast-warning); color: var(--cimoa-status-toast-warning); }
.brand-toast-message {
  flex: 1;
  min-width: 0;
  max-height: calc(100vh - var(--app-safe-top) - var(--app-safe-bottom) - 122.137rpx);
  overflow-y: auto;
  overflow-wrap: anywhere;
  white-space: pre-line;
  font-size: 28.626rpx;
  line-height: 1.45;
  font-weight: 600;
}
.brand-toast--progress .brand-toast-card { padding-right: 22.901rpx; }
.brand-toast--progress .brand-toast-icon { padding: 9.542rpx; }
.brand-toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 83.969rpx;
  height: 83.969rpx;
  padding: 24.809rpx;
  border-radius: 50%;
  color: var(--cimoa-text-secondary);
  cursor: pointer;
}
.brand-toast-close:focus-visible { outline: 2px solid var(--cimoa-button-primary); outline-offset: -5.725rpx; }
.brand-toast-enter-active { transition: opacity var(--toast-enter) ease, transform var(--toast-enter) ease; }
.brand-toast-leave-active { transition: opacity var(--toast-leave) ease, transform var(--toast-leave) ease; pointer-events: none; }
.brand-toast-enter-from, .brand-toast-leave-to { opacity: 0; transform: translateY(-15.267rpx); }
@media (prefers-reduced-motion: reduce) {
  .brand-toast-enter-active, .brand-toast-leave-active { transition: none; }
}
</style>
