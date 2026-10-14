<script setup>
import { ref, watch } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
const frame = ref(null), { context, catalog, error, access_error, is_loading, back, recover, save } = use_onboarding('major', frame)
const major = ref(context.value?.profile.major || '')
watch(major, () => { error.value = '' })
</script>
<template>
  <OnboardingFrame ref="frame" step="major" :busy="is_loading" :error="error" :access-error="access_error" interaction="obMajor.goObPhotos.click.1" @back="back" @recover="recover" @continue="save({ major })">
    <text class="onboarding-title">I am studying…</text><text class="auth-description">Pick the major closest to yours.</text>
    <view class="major-grid"><view v-for="row in catalog.majors" :key="row.label" class="major-card" :class="{ selected: major === row.label }" role="button" tabindex="0" :aria-label="row.label" :aria-pressed="major === row.label" data-interaction="obMajor.m.pick.click.1" @click="major = row.label" @keydown.enter="major = row.label"><text class="major-emoji">{{ row.emoji }}</text><text class="major-label">{{ row.label }}</text></view></view>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
<style scoped>
.major-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22.901rpx; margin-top: 38.168rpx; }
.major-card { aspect-ratio: 1; border-radius: 41.985rpx; padding: 15.267rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15.267rpx; background: var(--cimoa-surface-card); border: 3.817rpx solid var(--cimoa-surface-onboarding-border); box-shadow: var(--cimoa-shadow-auth-input); text-align: center; }
.major-card.selected { background: var(--cimoa-gradient-card-fill) padding-box, var(--cimoa-gradient-primary) border-box; border-color: var(--cimoa-surface-transparent); }
.major-emoji { font-size: 57.252rpx; line-height: 1; }
.major-label { font-size: 27.672rpx; font-weight: 700; line-height: 1.2; }
</style>
