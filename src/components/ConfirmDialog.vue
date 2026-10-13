<script setup>
defineProps({ visible: Boolean, title: { type: String, default: 'Please confirm' }, message: { type: String, default: '' }, confirmLabel: { type: String, default: 'Confirm' }, danger: Boolean })
defineEmits(['confirm', 'cancel'])
</script>

<template>
  <view v-if="visible" class="dialog-layer" @click.self="$emit('cancel')"><view class="dialog" role="dialog" aria-modal="true"><text class="dialog__title">{{ title }}</text><text v-if="message" class="dialog__message">{{ message }}</text><view class="dialog__actions"><view class="dialog__cancel" role="button" @click="$emit('cancel')">Cancel</view><view class="dialog__confirm" :class="{ danger }" role="button" @click="$emit('confirm')">{{ confirmLabel }}</view></view></view></view>
</template>

<style scoped>
.dialog-layer { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-end; background: var(--cimoa-scrim); padding: 24rpx; }.dialog { width: 100%; padding: 36rpx; border-radius: 32rpx; background: var(--cimoa-card); }.dialog__title { display: block; color: var(--cimoa-title); font-size: 34rpx; font-weight: 700; }.dialog__message { display: block; margin-top: 12rpx; color: var(--cimoa-secondary); font-size: 24rpx; line-height: 34rpx; }.dialog__actions { display: flex; gap: 16rpx; margin-top: 30rpx; }.dialog__cancel, .dialog__confirm { flex: 1; padding: 20rpx; border-radius: 100rpx; text-align: center; font-size: 23rpx; }.dialog__cancel { border: 1px solid var(--cimoa-outline); color: var(--cimoa-secondary); }.dialog__confirm { background: var(--cimoa-primary); color: var(--cimoa-primary-text); }.dialog__confirm.danger { background: var(--cimoa-danger); color: var(--cimoa-card); }
</style>
