<script setup>
defineProps({ checked: Boolean, disabled: Boolean, interaction: String, label: String })
const emit = defineEmits(['toggle'])
</script>

<template>
  <view
    class="settings-switch"
    :class="{ 'settings-switch--on': checked, 'settings-switch--disabled': disabled }"
    role="switch"
    tabindex="0"
    :aria-checked="checked"
    :aria-label="label"
    :aria-disabled="disabled"
    :data-interaction="interaction"
    @click="!disabled && emit('toggle')"
    @keydown.enter="!disabled && emit('toggle')"
    @keydown.space.prevent="!disabled && emit('toggle')"
  >
    <view class="settings-switch-track"><view class="settings-switch-dot" /></view>
  </view>
</template>

<style scoped>
.settings-switch {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 95.42rpx;
  min-width: var(--app-touch-target, 83.969rpx);
  min-height: var(--app-touch-target, 83.969rpx);
  cursor: pointer;
}
.settings-switch-track {
  position: relative;
  flex: none;
  width: 95.42rpx;
  height: 57.252rpx;
  border-radius: 28.626rpx;
  background: var(--cimoa-surface-event-handle);
  transition: background 160ms ease;
}
.settings-switch--on .settings-switch-track { background: var(--cimoa-gradient-primary); }
.settings-switch--disabled { opacity: 0.5; cursor: default; }
.settings-switch-dot {
  position: absolute;
  top: 3.817rpx;
  left: 3.817rpx;
  width: 49.618rpx;
  height: 49.618rpx;
  border-radius: 24.809rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-badge);
  transition: transform 160ms ease;
}
.settings-switch--on .settings-switch-dot { transform: translateX(38.168rpx); }
</style>
