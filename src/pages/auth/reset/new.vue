<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { password_error } from '@/utils/localAuth.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'

const store = use_app_store(), frame = ref(null), reset_id = ref(''), password = ref(''), confirmation = ref(''), shown = ref(false), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
onLoad(options => { reset_id.value = String(options?.reset_id || '') })
const reset = computed(() => store.auth_draft.password_reset || null)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved account data is unavailable. Please return and retry.'
  : store.session.is_authenticated
    ? 'Log out before resetting a password.'
    : !reset_id.value || reset.value?.reset_id !== reset_id.value || !reset.value?.verified_at
      ? 'Verify the local reset code before choosing a new password.'
      : '')
const hint = computed(() => !password.value
  ? 'At least 8 characters with a number'
  : password.value.length < 8
    ? 'Too short — 8 characters minimum'
    : !/\d/.test(password.value)
      ? 'Include at least one number'
      : 'Strong enough')
const clear = () => { active = false; cancel_loading(); password.value = ''; confirmation.value = ''; shown.value = false }
onShow(() => { active = true })
onHide(clear); onUnmounted(clear)
const back = async () => {
  if (is_loading.value) return
  const fallback = reset_id.value ? `/pages/auth/reset/code?reset_id=${encodeURIComponent(reset_id.value)}` : '/pages/auth/reset/email'
  try { await frame.value.navigate_back(fallback) } catch (cause) { error.value = cause.message }
}
const finish = async () => {
  if (is_loading.value || access_error.value) return
  error.value = ''
  const validation = password_error(password.value, confirmation.value)
  if (validation) { error.value = validation; return }
  const next_password = password.value, next_confirmation = confirmation.value
  const result = await run_with_loading(context => store.finish_password_reset(next_password, next_confirmation, reset_id.value, context))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  password.value = ''; confirmation.value = ''; shown.value = false
  try { await relaunch_route('/pages/auth/login') } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <AuthPageFrame ref="frame" class="reset-new-page" title="Reset password" back-interaction="fpNew.goBack.click.1" :busy="is_loading" @back="back">
    <view v-if="access_error" class="auth-error-box" role="alert">{{ access_error }}</view>
    <template v-else>
      <text class="auth-heading">Choose a new password</text>
      <view class="auth-field">
        <text class="auth-label">New password</text>
        <view class="auth-input-box"><input v-model="password" class="auth-input" aria-label="New password" placeholder="At least 8 characters" :password="!shown" :maxlength="128" :disabled="is_loading" autocomplete="new-password" data-interaction="fpNew.onPw.change.1" /><view class="auth-show" role="button" tabindex="0" data-interaction="fpNew.togglePw.click.1" @click="shown = !shown" @keydown.enter="shown = !shown">{{ shown ? 'Hide' : 'Show' }}</view></view>
        <text class="reset-password-hint" :class="{ 'is-valid': hint === 'Strong enough' }">{{ hint }}</text>
      </view>
      <view class="auth-field">
        <text class="auth-label">Confirm new password</text>
        <view class="auth-input-box"><input v-model="confirmation" class="auth-input" aria-label="Confirm new password" placeholder="Repeat it" :password="!shown" :maxlength="128" :disabled="is_loading" autocomplete="new-password" data-interaction="fpNew.onPw2.change.1" @confirm="finish" /></view>
        <text v-if="confirmation && password !== confirmation" class="reset-password-hint is-error">Passwords don’t match yet</text>
      </view>
      <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    </template>
    <template #footer><view v-if="!access_error" class="auth-primary" role="button" :aria-disabled="is_loading" data-interaction="fpNew.finishReset.click.1" @click="finish">Update password</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Securing your local password…" /></template>
  </AuthPageFrame>
</template>

<style>
@import '../auth.css';
.reset-password-hint { display: block; margin-top: 11.45rpx; color: var(--cimoa-text-auth-placeholder); font-size: 26.718rpx; font-weight: 600; }
.reset-password-hint.is-valid { color: var(--cimoa-status-success); }
.reset-password-hint.is-error { color: var(--cimoa-status-danger); }
.reset-new-page :deep(.auth-footer) { padding-bottom: 64.885rpx; }
</style>
