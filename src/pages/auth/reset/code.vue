<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { valid_local_code } from '@/utils/localVerification.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'

const store = use_app_store(), frame = ref(null), reset_id = ref(''), code = ref(''), error = ref(''), notice = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
onLoad(options => { reset_id.value = String(options?.reset_id || '') })
const reset = computed(() => store.auth_draft.password_reset || null)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved account data is unavailable. Please return and retry.'
  : store.session.is_authenticated
    ? 'Log out before resetting a password.'
    : !reset_id.value || reset.value?.reset_id !== reset_id.value
      ? 'This local password reset is unavailable. Start again from the login page.'
      : '')
const leave = () => { active = false; cancel_loading(); code.value = '' }
onShow(() => { active = true })
onHide(leave); onUnmounted(leave)
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/auth/reset/email') } catch (cause) { error.value = cause.message } }
const resend = () => { if (!is_loading.value && !access_error.value) { error.value = ''; notice.value = `No email was sent. The fixed local code remains ${store.local_verification_code}.` } }
const next = async () => {
  if (is_loading.value || access_error.value) return
  error.value = ''; notice.value = ''
  if (!valid_local_code(code.value)) { error.value = 'That code is incorrect. Enter the six-digit local reset code.'; return }
  try { auth_destination('/pages/auth/reset/new') } catch (cause) { error.value = cause.message; return }
  const result = await run_with_loading(() => store.verify_password_reset_code(code.value, reset_id.value))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  try { await frame.value.navigate_forward(auth_destination(`/pages/auth/reset/new?reset_id=${encodeURIComponent(reset_id.value)}`)) } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <AuthPageFrame ref="frame" class="reset-code-page" title="Enter code" :busy="is_loading" @back="back">
    <view v-if="access_error" class="auth-error-box" role="alert">{{ access_error }}</view>
    <template v-else>
      <text class="auth-heading">Use the local reset code</text>
      <text class="auth-description">No email is sent in this build. Enter the fixed six-digit code shown below for {{ reset.email }}.</text>
      <view class="reset-code-disclosure"><text>Local demo code</text><text>{{ store.local_verification_code }}</text></view>
      <view class="auth-field"><text class="auth-label">Verification code</text><view class="auth-input-box"><input v-model="code" class="auth-input reset-code-input" aria-label="Reset code" inputmode="numeric" placeholder="000000" :maxlength="6" :disabled="is_loading" data-interaction="fpCode.onCode.change.1" /></view></view>
      <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
      <text v-if="notice" class="reset-code-notice" role="status">{{ notice }}</text>
      <view class="auth-link reset-resend" role="button" :aria-disabled="is_loading" data-interaction="fpCode.resend.click.1" @click="resend">Resend code</view>
    </template>
    <template #footer><view v-if="!access_error" class="auth-primary" role="button" :aria-disabled="is_loading || code.length !== 6" data-interaction="fpCode.goFpNew.click.1" @click="next">Verify code</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Verifying local code…" /></template>
  </AuthPageFrame>
</template>

<style>
@import '../auth.css';
.reset-code-disclosure { display: flex; margin-top: 34.351rpx; padding: 30.534rpx 34.351rpx; align-items: center; justify-content: space-between; border-radius: 38.168rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-auth-action); }
.reset-code-disclosure > text:first-child { font-size: 28.626rpx; font-weight: 600; }
.reset-code-disclosure > text:last-child { font-size: 41.985rpx; font-weight: 900; letter-spacing: .12em; }
.reset-code-input { font-size: 38.168rpx; font-weight: 800; letter-spacing: .2em; text-align: center; }
.reset-code-notice { display: block; margin-top: 22.901rpx; padding: 26.718rpx; border-radius: 30.534rpx; color: var(--cimoa-text-verification-pill); background: var(--cimoa-surface-verification-pill); font-size: 26.718rpx; line-height: 1.45; }
.reset-resend { margin-top: 30.534rpx; text-align: center; }
</style>
