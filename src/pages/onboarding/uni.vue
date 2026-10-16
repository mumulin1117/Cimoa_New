<script setup>
import { reactive, ref, watch } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const frame = ref(null), { context, catalog, error, access_error, is_loading, back, recover, save } = use_onboarding('uni', frame)
const form = reactive({ university: '', year: '', major: '', graduation_year: '' }), restored_account_id = ref('')
watch(context, value => {
  if (!value?.account_id || restored_account_id.value === value.account_id) return
  const profile = value.profile || {}
  form.university = profile.university || ''
  form.year = profile.year || ''
  form.major = profile.major || ''
  form.graduation_year = profile.graduation_year || '2027'
  restored_account_id.value = value.account_id
}, { immediate: true })
watch(form, () => { error.value = '' })
</script>
<template>
  <OnboardingFrame ref="frame" step="uni" :busy="is_loading" :error="error" :access-error="access_error" interaction="obUni.goObMajor.click.1" back-interaction="obUni.goBack.click.1" :source-index="2" :source-total="8" :source-progress="26" @back="back" @recover="recover" @continue="save({ ...form })">
    <text class="onboarding-title">Your university</text>
    <view class="university-card"><view class="university-mark"><SourceIcon name="university" :stroke-width="2" /></view><view class="university-copy"><input v-model="form.university" class="university-input" aria-label="University" placeholder="Your university" :maxlength="100" :disabled="is_loading" /><text class="university-status">Self-reported · verification pending</text></view></view>
    <view class="onboarding-section university-year"><view class="onboarding-label-row"><text class="onboarding-label">Academic year</text><text class="onboarding-private">Public</text></view><view class="onboarding-chips"><view v-for="year in catalog.years" :key="year" class="onboarding-chip" :class="{ selected: form.year === year }" role="button" tabindex="0" :aria-pressed="form.year === year" data-interaction="obUni.o.pick.click.1" @click="form.year = year" @keydown.enter="form.year = year">{{ year }}</view></view></view>
    <view class="auth-field university-major"><view class="onboarding-label-row"><text class="auth-label">Field of study</text><text class="onboarding-private">Optional</text></view><view class="auth-input-box"><input v-model="form.major" class="auth-input" aria-label="Field of study" placeholder="Design" :maxlength="100" :disabled="is_loading" data-interaction="obUni.onObField.change.1" /></view></view>
    <text class="university-graduation">Expected graduation · {{ form.graduation_year }}</text>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
<style scoped>
.university-card { display: flex; align-items: center; gap: 22.901rpx; margin-top: 34.351rpx; padding: 30.534rpx 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.university-mark { flex: none; width: 38.168rpx; height: 38.168rpx; color: var(--cimoa-status-verified); }
.university-copy { flex: 1; min-width: 0; }
.university-input { display: block; width: 100%; height: 41.221rpx; color: var(--cimoa-text-title); font-size: 34.351rpx; font-weight: 700; line-height: 41.221rpx; }
.university-input :deep(.uni-input-wrapper), .university-input :deep(.uni-input-input) { height: 100%; line-height: 41.221rpx; }
.university-status { display: block; margin-top: 1.908rpx; overflow: hidden; color: var(--cimoa-text-secondary); font-size: 27.672rpx; line-height: 33.206rpx; text-overflow: ellipsis; white-space: nowrap; }
.university-year { margin-top: 41.985rpx; }
.university-major { margin-top: 30.534rpx; }
.university-graduation { display: block; margin-top: 30.534rpx; color: var(--cimoa-text-auth-placeholder); font-size: 28.626rpx; }
</style>
