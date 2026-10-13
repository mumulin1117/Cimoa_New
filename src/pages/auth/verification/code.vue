<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { auth_destination } from '@/utils/authNavigation.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import VerificationEmblem from '@/components/VerificationEmblem.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const store = use_app_store(), frame = ref(null), code = ref(''), error = ref('')
const context = computed(() => store.local_verification)
const cells = computed(() => Array.from({ length: 6 }, (_, index) => code.value[index] || ''))
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
onShow(() => { active = true; store.tick() })
const hide = () => { active = false; cancel_loading(); code.value = '' }
onHide(hide); onUnmounted(hide)
const back = async () => { try { await frame.value.navigate_back('/pages/auth/login') } catch (cause) { error.value = cause.message } }
const go = async route => { if (is_loading.value) return; error.value = ''; try { await frame.value.navigate_forward(auth_destination(route)) } catch (cause) { error.value = cause.message } }
const verify = async () => {
  if (is_loading.value) return
  error.value = ''; store.tick()
  if (!context.value) { error.value = 'Log in or create a local account first.'; return }
  if (context.value.verified) { await go('/pages/auth/verification/success'); return }
  if (!/^[0-9]{6}$/.test(code.value)) { error.value = 'Enter exactly six digits, including the leading zeroes.'; return }
  const account_id = context.value.account_id, value = code.value
  const result = await run_with_loading(() => store.apply_verification(value, account_id))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message || 'Local verification could not be saved. Please retry.'; return }
  code.value = ''; await go('/pages/auth/verification/success')
}
</script>
<template>
  <AuthPageFrame ref="frame" class="verification-page" title="Local verification" :busy="is_loading" @back="back">
    <view class="verification-hero"><VerificationEmblem /></view>
    <text class="auth-heading verification-heading">Enter your code</text>
    <template v-if="context">
      <text class="verification-description">Verify this local account on this device.<text class="verification-email">{{ context.email }}</text></text>
      <view v-if="!context.verified" class="verification-input-region">
        <view class="verification-cells" aria-hidden="true"><view v-for="(digit, index) in cells" :key="index" class="verification-cell">{{ digit }}</view></view>
        <input v-model="code" class="verification-input" type="text" :maxlength="7" aria-label="Six-digit local verification code" :disabled="is_loading" @input="error = ''" @confirm="verify" />
      </view>
      <text v-else class="verification-saved" role="status">Local verification complete.</text>
      <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
      <text class="verification-code-hint">Local code: {{ store.local_verification_code }} · No email is sent.</text>
      <view class="auth-link verification-change" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="verCode.changeEmail.click.1" @click="go('/pages/auth/verification/email')" @keydown.enter="go('/pages/auth/verification/email')">Change email</view>
      <view class="verification-info"><SourceIcon name="university" /><view class="verification-info-copy"><text class="verification-info-title">Local verification</text><text>This fixed code does not confirm email ownership or student status.</text></view></view>
    </template>
    <text v-else class="auth-error-box" role="alert">{{ store.hydration_error || 'Log in or create a local account first. No verification has been saved.' }}</text>
    <template #footer><view v-if="context" class="auth-primary verification-submit" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="verCode.goVerSuccess.click.1" @click="verify" @keydown.enter="verify"><text>{{ context.verified ? 'Continue' : 'Verify Code' }}</text><SourceIcon name="arrow-right" :stroke-width="2.4" /></view><view v-else class="auth-primary" role="button" tabindex="0" @click="go('/pages/auth/login')" @keydown.enter="go('/pages/auth/login')">Log In</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Verifying on this device…" /></template>
  </AuthPageFrame>
</template>
<style>
@import '../auth.css';
</style>
<style scoped>
.verification-page :deep(.auth-header-title) { font-size: 30.534rpx; color: var(--cimoa-text-secondary); font-weight: 600; }
.verification-page :deep(.auth-footer) { padding-bottom: 64.885rpx; }
.verification-hero { display: flex; justify-content: center; margin-top: 11.45rpx; }
.verification-heading { margin-top: 15.267rpx; text-align: center; }
.verification-description {
  display: block;
  margin-top: 19.084rpx;
  color: var(--cimoa-text-secondary);
  font-size: 32.443rpx;
  line-height: 1.4;
  text-align: center;
}
.verification-email { display: block; overflow-wrap: anywhere; }
.verification-input-region { position: relative; margin-top: 41.985rpx; }
.verification-cells { display: flex; justify-content: center; gap: 19.084rpx; }
.verification-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 83.969rpx;
  height: 114.504rpx;
  border-radius: 30.534rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-verification-cell);
  font-size: 49.618rpx;
  font-weight: 800;
}
.verification-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; }
.verification-code-hint {
  display: block;
  margin-top: 34.351rpx;
  color: var(--cimoa-text-auth-muted);
  font-size: 30.534rpx;
  line-height: 1.4;
  text-align: center;
}
.verification-change { text-align: center; margin-top: 11.45rpx; text-decoration: underline; }
.verification-info {
  display: flex;
  align-items: center;
  gap: 30.534rpx;
  margin-top: 41.985rpx;
  padding: 34.351rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-card);
}
.verification-info > .source-icon { flex: none; width: 87.786rpx; height: 87.786rpx; }
.verification-info-copy {
  min-width: 0;
  padding-left: 30.534rpx;
  border-left: 1px solid var(--cimoa-surface-border);
  color: var(--cimoa-text-secondary);
  font-size: 28.626rpx;
  line-height: 1.4;
}
.verification-info-title { display: block; margin-bottom: 7.634rpx; color: var(--cimoa-text-title); font-size: 36.26rpx; font-weight: 800; }
.verification-submit { gap: 15.267rpx; }
.verification-submit .source-icon { width: 34.351rpx; height: 34.351rpx; }
.verification-saved { display: block; margin-top: 41.985rpx; color: var(--cimoa-status-success); font-size: 32.443rpx; text-align: center; }
</style>
