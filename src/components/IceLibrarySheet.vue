<script setup>
import OnboardingSheet from './OnboardingSheet.vue'
defineProps({ open: Boolean, questions: Array, selected: Array, error: String })
const emit = defineEmits(['close', 'choose'])
</script>
<template>
  <OnboardingSheet class="ice-library" :open="open" label="Question library" @close="emit('close')">
    <text class="event-dialog-title">Question library</text>
    <view class="library-list"><view v-for="question in questions" :key="question" class="library-question" :class="{ selected: selected.includes(question) }" role="button" tabindex="0" :aria-pressed="selected.includes(question)" data-interaction="sheetIceLibrary.q.pick.click.1" @click="emit('choose', question)" @keydown.enter="emit('choose', question)">{{ question }}</view></view>
    <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
    <view class="event-dialog-secondary" role="button" tabindex="0" data-interaction="sheetIceLibrary.closeSheet.click.1" @click="emit('close')" @keydown.enter="emit('close')">Done</view>
  </OnboardingSheet>
</template>
<style scoped>
.ice-library :deep(.event-dialog-panel) { top: calc(var(--app-safe-top, 0px) + 145.038rpx); }
.library-list { display: flex; flex-direction: column; gap: 19.084rpx; margin-top: 30.534rpx; }
.library-question { padding: 30.534rpx 34.351rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-card); border: 3.817rpx solid var(--cimoa-surface-onboarding-border); box-shadow: var(--cimoa-shadow-auth-input); font-size: 31.489rpx; font-weight: 600; line-height: 1.4; }
.library-question.selected { background: var(--cimoa-gradient-card-fill) padding-box, var(--cimoa-gradient-primary) border-box; border-color: var(--cimoa-surface-transparent); font-weight: 700; }
</style>
