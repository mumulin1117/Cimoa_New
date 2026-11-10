<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { signup_error } from '@/utils/localAuth.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_visual_viewport } from '@/composables/useEventViewport.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const store = use_app_store(), frame = ref(null), email = ref(store.auth_draft.email || ''), password = ref(''), confirmation = ref(''), shown = ref(false), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { height: viewport_height, keyboard_open } = use_visual_viewport()
let active = true
const clear = () => { active = false; cancel_loading(); password.value = ''; confirmation.value = ''; shown.value = false }
onShow(() => { active = true }); onHide(clear); onUnmounted(clear)
const form = computed(() => ({ email: email.value, password: password.value, confirmation: confirmation.value, date_of_birth: store.auth_draft.profile_draft.date_of_birth, agreements: store.auth_draft.agreements }))
const hint = computed(() => !password.value ? 'At least 8 characters with a number' : password.value.length < 8 ? 'Too short — 8 characters minimum' : !/\d/.test(password.value) ? 'Include at least one number' : 'Strong enough')
const strength = computed(() => !password.value ? 0 : password.value.length < 8 ? 1 : !/\d/.test(password.value) ? 2 : 3)
const ready = computed(() => !signup_error(form.value, store.clock_ms))
const back = async () => { try { await frame.value.navigate_back('/pages/auth/community') } catch (cause) { error.value = cause.message } }
const go = async target => { if (is_loading.value) return; try { await frame.value.navigate_forward(auth_destination(target)) } catch (cause) { error.value = cause.message } }
const clear_error = () => { error.value = '' }
const toggle_password = () => { if (!is_loading.value) shown.value = !shown.value }
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
const trigger_submit = () => {
  if (is_loading.value || (!ready.value && !store.local_verification)) return
  return submit()
}
</script>
<template>
  <AuthPageFrame ref="frame" class="signup-page" :class="{ 'signup-page--keyboard': keyboard_open }" title="Sign up" back-interaction="signup.goBack.click.1" :busy="is_loading" :style="{ height: viewport_height }" @back="back">
    <text class="auth-heading">Create your account</text>
    <view class="auth-field"><text class="auth-label">University email</text><view class="auth-input-box"><input v-model="email" class="auth-input" aria-label="University email" placeholder="you@university.edu" data-interaction="signup.onEmail.change.1" :maxlength="254" :disabled="is_loading || !!store.local_verification" autocomplete="username" @input="clear_error" /></view></view>
    <view class="auth-field"><text class="auth-label">Password</text><view class="auth-input-box"><input v-model="password" class="auth-input" aria-label="Password" placeholder="At least 8 characters" data-interaction="signup.onPw.change.1" :password="!shown" :maxlength="128" :disabled="is_loading" autocomplete="new-password" @input="clear_error" /><view class="auth-show" role="button" tabindex="0" :aria-label="shown ? 'Hide passwords' : 'Show passwords'" :aria-disabled="is_loading" data-interaction="signup.togglePw.click.1" @click="toggle_password" @keydown.enter="toggle_password" @keydown.space.prevent="toggle_password">{{ shown ? 'Hide' : 'Show' }}</view></view><view class="signup-strength" aria-hidden="true"><view v-for="step in 3" :key="step" class="signup-strength-segment" :class="{ 'is-active': strength >= step, 'is-complete': strength === 3 }" /></view><text class="signup-hint" :class="{ 'signup-valid': hint === 'Strong enough' }">{{ hint }}</text></view>
    <view class="auth-field"><text class="auth-label">Confirm password</text><view class="auth-input-box"><input v-model="confirmation" class="auth-input" aria-label="Confirm password" placeholder="Repeat your password" data-interaction="signup.onPw2.change.1" :password="!shown" :maxlength="128" :disabled="is_loading" autocomplete="new-password" @input="clear_error" @confirm="trigger_submit" /><view v-if="confirmation && password === confirmation" class="signup-confirmed" aria-hidden="true"><SourceIcon name="check" :stroke-width="2.8" /></view></view><text v-if="confirmation && password !== confirmation" class="signup-hint signup-mismatch">Passwords don’t match yet</text></view>
    <text v-if="error" class="auth-error-box" role="alert">{{ auth_message(error) }}</text>
    <text class="signup-note">Your university email is used for account access and is never shown on your profile.</text>
    <template #footer><view class="auth-primary" :class="{ 'is-disabled': !ready && !store.local_verification }" role="button" tabindex="0" :aria-disabled="is_loading || (!ready && !store.local_verification)" data-interaction="signup.createAccount.click.1" @click="trigger_submit" @keydown.enter="trigger_submit"><text>{{ store.local_verification ? 'Continue verification' : 'Create Account' }}</text><SourceIcon name="arrow-right" :stroke-width="2.4" /></view><view class="auth-secondary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="signup.goLogin.click.1" @click="go('/pages/auth/login')" @keydown.enter="go('/pages/auth/login')">Already have an account? Log in</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Creating your account…" /></template>
  </AuthPageFrame>
</template>
<style>
@import './auth.css';
</style>
<style scoped>
.signup-hint { display: block; margin-top: 11.45rpx; font-size: 26.718rpx; font-weight: 600; color: var(--cimoa-text-auth-placeholder); }
.signup-valid { color: var(--cimoa-status-success); }
.signup-mismatch { color: var(--cimoa-status-danger); }
.signup-strength { display: flex; gap: 9.542rpx; margin-top: 15.267rpx; }
.signup-strength-segment { flex: 1; height: 5.725rpx; overflow: hidden; border-radius: 5.725rpx; background: var(--cimoa-surface-auth-check-track); transition: transform var(--auth-press-out) ease,background var(--auth-press-out) ease; transform-origin: left center; }
.signup-strength-segment.is-active { background: var(--cimoa-gradient-auth-heading-mark); animation: signup-strength-fill var(--auth-press-out) ease-out both; }
.signup-strength-segment.is-complete { background: var(--cimoa-status-success); }
.signup-confirmed { display: flex; align-items: center; justify-content: center; flex: none; width: 45.802rpx; height: 45.802rpx; border-radius: 22.901rpx; background: var(--cimoa-surface-auth-check-track); color: var(--cimoa-status-success); animation: signup-confirm-pop var(--auth-press-out) ease-out both; }
.signup-confirmed .source-icon { width: 30.534rpx; height: 30.534rpx; }
.signup-note { display: block; margin-top: 30.534rpx; font-size: 28.626rpx; color: var(--cimoa-text-auth-muted); text-wrap: pretty; }
.signup-page :deep(.auth-error-box) { line-height: normal; }
.signup-page.signup-page--keyboard :deep(.auth-footer) { display: none; }
@keyframes signup-strength-fill { from { opacity: .35; transform: scaleX(.35); } to { opacity: 1; transform: scaleX(1); } }
@keyframes signup-confirm-pop { from { opacity: 0; transform: scale(.65) rotate(-10deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
@media (prefers-reduced-motion: reduce) { .signup-strength-segment.is-active, .signup-confirmed { animation: none; } }
</style>
