<script setup>
import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { valid_email, normalize_email } from '@/utils/localAuth.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
const store = use_app_store(), frame = ref(null), error = ref(''), context = computed(() => store.local_verification), email = ref(context.value?.email || '')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onHide(cancel_loading)
const back = async () => { try { await frame.value.navigate_back('/pages/auth/signup') } catch (cause) { error.value = cause.message } }
const next = async () => {
  if (is_loading.value) return
  error.value = ''
  if (!context.value) { try { await frame.value.navigate_forward('/pages/auth/login') } catch (cause) { error.value = cause.message }; return }
  if (!valid_email(email.value)) { error.value = 'Enter a valid email address.'; return }
  if (normalize_email(email.value) !== context.value.email) {
    const id = context.value.account_id, value = email.value
    const result = await run_with_loading(() => store.change_registration_email(value, id))
    if (result.reason === 'cancelled') return
    if (!result.success) { error.value = result.message; return }
  }
  try { await frame.value.navigate_forward(auth_destination(context.value.verified ? '/pages/auth/verification/success' : '/pages/auth/verification/code')) } catch (cause) { error.value = cause.message }
}
</script>
<template>
  <AuthPageFrame ref="frame" class="verification-email-page" title="Local verification" :busy="is_loading" @back="back">
    <text class="auth-heading">Confirm your email</text>
    <text class="auth-description">This local account uses the fixed code {{ store.local_verification_code }}. No email is sent. This does not verify your university or student identity.</text>
    <view v-if="context" class="auth-field"><text class="auth-label">University email</text><view class="auth-input-box"><input v-model="email" class="auth-input" aria-label="University email" placeholder="name@university.edu" :maxlength="254" :disabled="is_loading || context.verified" @confirm="next" /></view></view>
    <text v-else class="auth-error-box" role="alert">Log in or create a local account first. No account has been changed.</text>
    <view class="email-info"><text>Your address identifies your account on this device. It stays private and is never shown on your profile.</text></view>
    <text class="email-example">Example · a.chan@connect.hkust.edu</text>
    <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    <template #footer><view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="verEmail.goVerCode.click.1" @click="next" @keydown.enter="next">{{ context ? 'Continue to Local Code' : 'Log In' }}</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Updating local email…" /></template>
  </AuthPageFrame>
</template>
<style>
@import '../auth.css';
</style>
<style scoped>
.email-info { margin-top: 30.534rpx; padding: 34.351rpx; border-radius: 41.985rpx; background: var(--cimoa-surface-empty); color: var(--cimoa-text-auth-legal); font-size: 29.58rpx; line-height: 1.5; }
.email-example { display: block; margin-top: 26.718rpx; font-size: 27.672rpx; color: var(--cimoa-text-auth-placeholder); }
</style>
