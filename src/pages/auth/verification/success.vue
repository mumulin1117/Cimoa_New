<script setup>
import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { auth_destination } from '@/utils/authNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { onboarding_route } from '@/utils/onboardingFlow.js'
const store = use_app_store(), frame = ref(null), error = ref('')
const context = computed(() => store.local_verification)
const go = async route => { error.value = ''; try { await frame.value.navigate_forward(auth_destination(route)) } catch (cause) { error.value = cause.message } }
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onHide(cancel_loading)
const continue_setup = async () => {
  if (!context.value?.verified || is_loading.value) return
  const id = context.value.account_id
  const result = store.session.is_authenticated && store.onboarding ? { success: true, data: store.onboarding.completed ? 'home' : store.onboarding.step } : await run_with_loading(() => store.begin_onboarding(id))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  await go(result.data === 'home' ? '/pages/home/index' : onboarding_route(result.data))
}
</script>
<template>
  <SecondaryPageFrame ref="frame" class="verification-success-page">
    <view class="verification-success-content">
      <template v-if="context?.verified">
        <view class="verification-success-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></view>
        <text class="verification-success-heading" role="status">Local verification complete</text>
        <view class="verification-success-pill"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="11" class="verification-badge-fill" /><path d="m7.5 12.4 3 3 6-6.4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg><text>Local account · This device</text></view>
      </template>
      <text v-else class="auth-error-box" role="alert">{{ store.hydration_error || 'Local verification has not been completed for this account.' }}</text>
      <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    </view>
    <template #footer><view class="verification-success-footer"><view v-if="context?.verified" class="auth-primary" role="button" tabindex="0" data-interaction="verSuccess.goObBasic.click.1" @click="continue_setup" @keydown.enter="continue_setup">Continue Profile Setup</view><view v-else class="auth-primary" role="button" tabindex="0" @click="go(context ? '/pages/auth/verification/code' : '/pages/auth/login')" @keydown.enter="go(context ? '/pages/auth/verification/code' : '/pages/auth/login')">{{ context ? 'Enter Code' : 'Log In' }}</view></view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Starting profile setup…" /></template>
  </SecondaryPageFrame>
</template>
<style>
@import '../auth.css';
</style>
<style scoped>
.verification-success-content { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; padding: 270.992rpx 38.168rpx 38.168rpx; }
.verification-success-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 183.206rpx;
  height: 183.206rpx;
  border-radius: 91.603rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  box-shadow: var(--cimoa-shadow-verification-success);
}
.verification-success-icon svg { width: 83.969rpx; height: 83.969rpx; }
.verification-success-heading { font-size: 57.252rpx; font-weight: 800; letter-spacing: -2.004rpx; line-height: 1.2; text-align: center; }
.verification-success-pill {
  display: flex;
  align-items: center;
  gap: 15.267rpx;
  min-height: 80.153rpx;
  padding: 0 30.534rpx;
  border-radius: 40.076rpx;
  background: var(--cimoa-surface-verification-pill);
  color: var(--cimoa-text-verification-pill);
  font-size: 30.534rpx;
  font-weight: 700;
}
.verification-success-pill svg { flex: none; width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-text-inverse); }
.verification-badge-fill { fill: var(--cimoa-status-verified); }
.verification-success-footer { flex: none; padding: 0 38.168rpx 64.885rpx; }
.verification-success-content .auth-error-box { margin: 0; }
</style>
