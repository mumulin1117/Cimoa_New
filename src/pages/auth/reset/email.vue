<script setup>
import { onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { valid_email } from '@/utils/localAuth.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'

const store = use_app_store(), frame = ref(null), email = ref(store.auth_draft.email || ''), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
const leave = () => { active = false; cancel_loading() }
onShow(() => { active = true })
onHide(leave); onUnmounted(leave)
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/auth/login') } catch (cause) { error.value = cause.message } }
const next = async () => {
  if (is_loading.value) return
  error.value = ''
  if (store.hydration_status !== 'ready') { error.value = store.hydration_error || 'Saved account data is unavailable.'; return }
  if (store.session.is_authenticated) { error.value = 'Log out before resetting a password.'; return }
  if (!valid_email(email.value)) { error.value = 'Enter a valid email address.'; return }
  try { auth_destination('/pages/auth/reset/code') } catch (cause) { error.value = cause.message; return }
  const result = await run_with_loading(() => store.begin_password_reset(email.value))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  try { await frame.value.navigate_forward(auth_destination(`/pages/auth/reset/code?reset_id=${encodeURIComponent(result.data.reset_id)}`)) } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <AuthPageFrame ref="frame" class="reset-email-page" title="Reset password" :busy="is_loading" @back="back">
    <text class="auth-heading">Find your local account</text>
    <text class="auth-description">Enter the email for an active account saved on this device. No email will be sent.</text>
    <view class="auth-field"><text class="auth-label">Email</text><view class="auth-input-box"><input v-model="email" class="auth-input" aria-label="Reset email" placeholder="you@university.edu" :maxlength="254" :disabled="is_loading" autocomplete="username" data-interaction="fpEmail.onEmail.change.1" /></view></view>
    <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    <text class="auth-local-note">This reset works only for local or bundled test accounts already stored here. Apple-only accounts are not supported.</text>
    <template #footer><view class="auth-primary" role="button" :aria-disabled="is_loading" data-interaction="fpEmail.goFpCode.click.1" @click="next">Continue</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Checking local account…" /></template>
  </AuthPageFrame>
</template>

<style>
@import '../auth.css';
</style>
