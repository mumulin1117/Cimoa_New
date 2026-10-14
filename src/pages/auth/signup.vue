<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { signup_error } from '@/utils/localAuth.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const store = use_app_store(), frame = ref(null), email = ref(store.auth_draft.email || ''), password = ref(''), confirmation = ref(''), shown = ref(false), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
const clear = () => { active = false; cancel_loading(); password.value = ''; confirmation.value = ''; shown.value = false }
onShow(() => { active = true }); onHide(clear); onUnmounted(clear)
const form = computed(() => ({ email: email.value, password: password.value, confirmation: confirmation.value, date_of_birth: store.auth_draft.profile_draft.date_of_birth, agreements: store.auth_draft.agreements }))
const hint = computed(() => !password.value ? 'At least 8 characters with a number' : password.value.length < 8 ? 'Too short — 8 characters minimum' : !/\d/.test(password.value) ? 'Include at least one number' : 'Strong enough')
const ready = computed(() => !signup_error(form.value, store.clock_ms))
const back = async () => { try { await frame.value.navigate_back('/pages/auth/community') } catch (cause) { error.value = cause.message } }
const go = async target => { if (is_loading.value) return; try { await frame.value.navigate_forward(auth_destination(target)) } catch (cause) { error.value = cause.message } }
const submit = async () => {
  if (is_loading.value) return
  error.value = ''
  if (store.local_verification) { await go('/pages/auth/verification/email'); return }
  const message = signup_error(form.value, store.clock_ms)
  if (message) { error.value = message; return }
  const input = { ...form.value, agreements: { ...form.value.agreements } }
  const result = await run_with_loading(context => store.register_local_account(input, context))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  password.value = ''; confirmation.value = ''
  await go('/pages/auth/verification/email')
}
</script>
<template>
  <AuthPageFrame ref="frame" class="signup-page" title="Sign up" :busy="is_loading" @back="back">
    <text class="auth-heading">Create your account</text>
    <view class="auth-apple" role="button" tabindex="0" data-interaction="signup.appleAuth.click.1" @click="error = 'Apple sign-in is not configured. Create a local account with email and password.'" @keydown.enter="error = 'Apple sign-in is not configured. Create a local account with email and password.'"><SourceIcon name="apple" /><text>Continue with Apple</text></view>
    <view class="auth-divider"><view /><text>or</text><view /></view>
    <view class="auth-field"><text class="auth-label">University email</text><view class="auth-input-box"><input v-model="email" class="auth-input" aria-label="University email" placeholder="you@university.edu" :maxlength="254" :disabled="is_loading || !!store.local_verification" autocomplete="username" /></view></view>
    <view class="auth-field"><text class="auth-label">Password</text><view class="auth-input-box"><input v-model="password" class="auth-input" aria-label="Password" placeholder="At least 8 characters" :password="!shown" :maxlength="128" :disabled="is_loading" autocomplete="new-password" /><view class="auth-show" role="button" tabindex="0" data-interaction="signup.togglePw.click.1" @click="shown = !shown" @keydown.enter="shown = !shown">{{ shown ? 'Hide' : 'Show' }}</view></view><text class="signup-hint" :class="{ 'signup-valid': hint === 'Strong enough' }">{{ hint }}</text></view>
    <view class="auth-field"><text class="auth-label">Confirm password</text><view class="auth-input-box"><input v-model="confirmation" class="auth-input" aria-label="Confirm password" placeholder="Repeat your password" :password="!shown" :maxlength="128" :disabled="is_loading" autocomplete="new-password" @confirm="submit" /></view><text v-if="confirmation && password !== confirmation" class="signup-hint signup-mismatch">Passwords don’t match yet</text></view>
    <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    <text class="signup-note">Your account is stored on this device. No email is sent, and the local code does not verify your student status. Your email is never shown on your profile.</text>
    <template #footer><view class="auth-primary" :class="{ 'is-disabled': !ready && !store.local_verification }" role="button" tabindex="0" :aria-disabled="is_loading || (!ready && !store.local_verification)" data-interaction="signup.createAccount.click.1" @click="submit" @keydown.enter="submit">{{ store.local_verification ? 'Continue verification' : 'Create Account' }}</view><view class="auth-secondary" role="button" tabindex="0" data-interaction="signup.goLogin.click.1" @click="go('/pages/auth/login')" @keydown.enter="go('/pages/auth/login')">Already have an account? Log in</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Creating your local account…" /></template>
  </AuthPageFrame>
</template>
<style>
@import './auth.css';
</style>
<style scoped>
.signup-hint { display: block; margin-top: 11.45rpx; font-size: 26.718rpx; font-weight: 600; color: var(--cimoa-text-auth-placeholder); }
.signup-valid { color: var(--cimoa-status-success); }
.signup-mismatch { color: var(--cimoa-status-danger); }
.signup-note { display: block; margin-top: 30.534rpx; font-size: 28.626rpx; color: var(--cimoa-text-auth-muted); line-height: 1.45; }
</style>
