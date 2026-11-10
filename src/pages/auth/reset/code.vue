<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { valid_local_code } from '@/utils/localVerification.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'

const store = use_app_store(), frame = ref(null), reset_id = ref(''), code = ref(''), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
onLoad(options => { reset_id.value = String(options?.reset_id || '') })
const reset = computed(() => store.auth_draft.password_reset || null)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your account information is unavailable. Please go back and try again.'
  : store.session.is_authenticated
    ? 'Log out before resetting a password.'
    : !reset_id.value || reset.value?.reset_id !== reset_id.value
      ? 'This password reset is unavailable. Start again from the login page.'
      : '')
const leave = () => { active = false; cancel_loading(); code.value = '' }
onShow(() => { active = true })
onHide(leave); onUnmounted(leave)
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/auth/reset/email') } catch (cause) { error.value = cause.message } }
const next = async () => {
  if (is_loading.value || access_error.value) return
  error.value = ''
  if (!valid_local_code(code.value)) { error.value = 'That code is incorrect. Enter the six-digit reset code.'; return }
  try { auth_destination('/pages/auth/reset/new') } catch (cause) { error.value = cause.message; return }
  const result = await run_with_loading(() => store.verify_password_reset_code(code.value, reset_id.value))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  try { await frame.value.navigate_forward(auth_destination(`/pages/auth/reset/new?reset_id=${encodeURIComponent(reset_id.value)}`)) } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <AuthPageFrame ref="frame" class="reset-code-page" title="Reset password" back-interaction="fpCode.goBack.click.1" :busy="is_loading" @back="back">
    <view v-if="access_error" class="auth-error-box" role="alert">{{ auth_message(access_error) }}</view>
    <template v-else>
      <text class="auth-heading">Enter reset code</text>
      <view class="auth-input-box reset-code-box"><input v-model="code" class="auth-input reset-code-input" aria-label="Reset code" inputmode="numeric" placeholder="6-digit code" :maxlength="6" :disabled="is_loading" data-interaction="fpCode.onCode.change.1" /></view>
      <text v-if="error" class="auth-error-box" role="alert">{{ auth_message(error) }}</text>
    </template>
    <template #footer><view v-if="!access_error" class="auth-primary" role="button" :aria-disabled="is_loading || code.length !== 6" data-interaction="fpCode.goFpNew.click.1" @click="next">Continue</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Checking code…" /></template>
  </AuthPageFrame>
</template>

<style>
@import '../auth.css';
.reset-code-box { height: 137.405rpx; margin-top: 38.168rpx; padding: 0 38.168rpx; border-radius: 38.168rpx; }
.reset-code-input { font-size: 38.168rpx; font-weight: 800; letter-spacing: .2em; text-align: center; }
.reset-code-page :deep(.auth-footer) { padding-bottom: 64.885rpx; }
</style>
