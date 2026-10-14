<script setup>
import { reactive, ref, watch } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
const frame = ref(null), { context, catalog, error, access_error, is_loading, back, recover, save } = use_onboarding('uni', frame)
const profile = context.value?.profile || {}, form = reactive({ university: profile.university || '', year: profile.year || '', major: profile.major || '', graduation_year: profile.graduation_year || '' })
watch(form, () => { error.value = '' })
</script>
<template>
  <OnboardingFrame ref="frame" step="uni" :busy="is_loading" :error="error" :access-error="access_error" interaction="obUni.goObMajor.click.1" @back="back" @recover="recover" @continue="save({ ...form })">
    <text class="onboarding-title">Your university</text>
    <view class="auth-card university-card"><input v-model="form.university" class="auth-input" aria-label="University" placeholder="Your university" :maxlength="100" :disabled="is_loading" /><text class="university-status">Self-reported · Student verification pending</text></view>
    <view class="onboarding-section"><view class="onboarding-label-row"><text class="onboarding-label">Academic year</text><text class="onboarding-private">Public</text></view><view class="onboarding-chips"><view v-for="year in catalog.years" :key="year" class="onboarding-chip" :class="{ selected: form.year === year }" role="button" tabindex="0" :aria-pressed="form.year === year" @click="form.year = year" @keydown.enter="form.year = year">{{ year }}</view></view></view>
    <view class="auth-field"><view class="onboarding-label-row"><text class="auth-label">Field of study</text><text class="onboarding-private">Optional</text></view><view class="auth-input-box"><input v-model="form.major" class="auth-input" aria-label="Field of study" placeholder="Design" :maxlength="100" :disabled="is_loading" /></view></view>
    <view class="auth-field"><view class="onboarding-label-row"><text class="auth-label">Expected graduation</text><text class="onboarding-private">Optional</text></view><view class="auth-input-box"><input v-model="form.graduation_year" class="auth-input" aria-label="Expected graduation" placeholder="YYYY" type="number" :maxlength="4" :disabled="is_loading" /></view></view>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
<style scoped>
.university-card { margin-top: 34.351rpx; padding: 30.534rpx 34.351rpx; }
.university-card .auth-input { height: 49.618rpx; font-size: 34.351rpx; font-weight: 700; }
.university-status { display: block; margin-top: 1.908rpx; font-size: 27.672rpx; color: var(--cimoa-text-secondary); line-height: 1.4; }
</style>
