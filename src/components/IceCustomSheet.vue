<script setup>
import OnboardingSheet from './OnboardingSheet.vue'
import FeedbackToast from './FeedbackToast.vue'
defineProps({ open: Boolean, modelValue: String, error: String, notice: String, resetKey: Number })
const emit = defineEmits(['close', 'add', 'update:modelValue', 'dismiss-notice'])
</script>
<template>
  <OnboardingSheet class="ice-custom-sheet" :open="open" label="Write my own question" close-interaction="sheetIceCustom.closeSheet.click.1" @close="emit('close')">
    <text class="event-dialog-title">Write my own</text>
    <view class="custom-question-box"><input :key="resetKey" :value="modelValue" aria-label="Custom question" placeholder="Ask something friendly" :maxlength="160" data-interaction="sheetIceCustom.onObCustom.change.1" @input="emit('update:modelValue', $event.detail.value)" @confirm="emit('add')" /></view>
    <text class="custom-question-note">Custom questions are checked automatically. Nothing that asks for private details or crosses the guidelines.</text>
    <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
    <FeedbackToast v-if="open && notice" :message="notice" tone="success" @dismiss="emit('dismiss-notice')" />
    <view class="event-dialog-primary" role="button" tabindex="0" data-interaction="sheetIceCustom.addCustom.click.1" @click="emit('add')" @keydown.enter="emit('add')">Add Question</view>
  </OnboardingSheet>
</template>
<style scoped>
.custom-question-box { display: flex; align-items: center; margin-top: 30.534rpx; height: 106.87rpx; padding: 0 34.351rpx; border-radius: 34.351rpx; background: var(--cimoa-surface-tinted); }
.custom-question-box input { flex: 1; height: 100%; min-width: 0; font-size: 32.443rpx; color: var(--cimoa-text-title); }
.custom-question-note { display: block; margin-top: 15.267rpx; font-size: 27.672rpx; line-height: 1.45; color: var(--cimoa-text-auth-placeholder); }
</style>
