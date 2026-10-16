<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { use_visual_viewport } from '@/composables/useEventViewport.js'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import SourceIcon from './SourceIcon.vue'
import AuthActionLoading from './AuthActionLoading.vue'
const props = defineProps({ step: String, busy: Boolean, error: String, accessError: String, interaction: String, backInteraction: String, sourceIndex: Number, sourceTotal: Number, sourceProgress: Number, disabled: Boolean, button: { type: String, default: 'Continue' } })
const emit = defineEmits(['back', 'continue', 'recover']), store = use_app_store(), frame = ref(null)
const steps = computed(() => store.onboarding_catalog.steps), index = computed(() => steps.value.indexOf(props.step) + 1)
const display_index = computed(() => props.sourceIndex ?? index.value), display_total = computed(() => props.sourceTotal ?? steps.value.length)
const progress = computed(() => props.sourceProgress ?? display_index.value / display_total.value * 100)
const { height: viewport_height, keyboard_open } = use_visual_viewport()
defineExpose({ navigate_forward: url => frame.value.navigate_forward(url), navigate_back: fallback => frame.value.navigate_back(fallback) })
</script>
<template>
  <SecondaryPageFrame ref="frame" class="onboarding-page" :class="[`onboarding-${step}-page`, { 'onboarding-page--keyboard': keyboard_open }]" :style="{ height: viewport_height }">
    <template #header><view class="onboarding-header" :class="{ 'onboarding-header--ice': step === 'ice' }"><view class="onboarding-back" role="button" tabindex="0" aria-label="Back" :aria-disabled="busy" :data-interaction="backInteraction" @click="!busy && emit('back')" @keydown.enter="!busy && emit('back')"><SourceIcon name="back" /></view><text v-if="step === 'ice'" class="ice-progress">Profile setup · {{ display_index }} of {{ display_total }}</text><view class="onboarding-track"><view :style="{ width: `${progress}%` }" /></view><text v-if="step !== 'ice'" class="onboarding-step">{{ display_index }} / {{ display_total }}</text></view></template>
    <view class="onboarding-content"><template v-if="!accessError"><slot /><text v-if="error" class="auth-error-box" role="alert">{{ error }}</text></template><text v-else class="auth-error-box" role="alert">{{ accessError }}</text></view>
    <template #footer><view class="onboarding-footer"><slot name="hint" /><view v-if="!accessError" class="auth-primary" :class="{ 'is-disabled': disabled }" role="button" tabindex="0" :aria-disabled="busy || disabled" :data-interaction="interaction" @click="!busy && emit('continue')" @keydown.enter="!busy && emit('continue')">{{ button }}</view><view v-else class="auth-primary" role="button" tabindex="0" @click="emit('recover')" @keydown.enter="emit('recover')">Continue account setup</view></view></template>
    <template #overlays><slot name="overlays" /><AuthActionLoading :visible="busy" label="Saving profile…" /></template>
  </SecondaryPageFrame>
</template>
<style>
@import '../pages/auth/auth.css';
</style>
<style scoped>
.onboarding-header { display: flex; align-items: center; gap: 26.718rpx; height: 91.603rpx; margin: 7.634rpx 38.168rpx 34.351rpx; }
.onboarding-back { flex: none; width: 87.786rpx; height: 87.786rpx; border-radius: 43.893rpx; display: flex; align-items: center; justify-content: center; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); }
.onboarding-back .source-icon { width: 41.985rpx; height: 41.985rpx; }
.onboarding-track { flex: 1; height: 11.45rpx; border-radius: 5.725rpx; background: var(--cimoa-surface-splash-track); overflow: hidden; }
.onboarding-track view { height: 100%; border-radius: inherit; background: var(--cimoa-gradient-primary); }
.onboarding-step { font-size: 25.763rpx; font-weight: 700; color: var(--cimoa-text-auth-placeholder); }
.onboarding-header--ice { position: relative; height: 133.588rpx; }
.onboarding-header--ice .onboarding-back { position: absolute; top: 0; left: 0; z-index: 1; }
.ice-progress { position: absolute; top: 0; width: 100%; text-align: center; font-size: 30.534rpx; font-weight: 500; color: var(--cimoa-text-secondary); }
.onboarding-header--ice .onboarding-track { position: absolute; bottom: 26.718rpx; left: 0; width: 100%; }
.onboarding-content { padding: 0 38.168rpx 45.802rpx; }
.onboarding-footer { display: flex; flex-direction: column; gap: 22.901rpx; padding: 0 38.168rpx 64.885rpx; }
.onboarding-page.onboarding-page--keyboard .onboarding-footer { display: none; }
</style>
