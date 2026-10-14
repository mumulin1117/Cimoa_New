<script setup>
import { ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { valid_email } from '@/utils/localAuth.js'
import { auth_destination, authenticated_destination } from '@/utils/authNavigation.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { prepare_main_tab_skeleton } from '@/utils/mainTabSkeleton.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const store = use_app_store(), frame = ref(null), email = ref(store.auth_draft.email || ''), password = ref(''), shown = ref(false), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
const hide = () => { active = false; cancel_loading(); password.value = ''; shown.value = false }
onShow(() => { active = true })
onHide(hide); onUnmounted(hide)
const back = async () => { try { await frame.value.navigate_back() } catch (cause) { error.value = cause.message } }
const go = async target => { if (is_loading.value) return; error.value = ''; try { await frame.value.navigate_forward(auth_destination(target)) } catch (cause) { error.value = cause.message } }
const apple = () => { error.value = 'Apple sign-in is not configured. Use your local email and password.' }
const login = async () => {
  if (is_loading.value) return
  error.value = ''
  if (store.hydration_status !== 'ready') { error.value = store.hydration_error || 'Saved data is unavailable.'; return }
  if (store.session.is_authenticated) { try { await relaunch_route(authenticated_destination(store)) } catch (cause) { error.value = cause.message }; return }
  if (!valid_email(email.value) || !password.value) { error.value = 'Enter a valid email and password.'; return }
  const result = await run_with_loading(context => store.login(email.value, password.value, context))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message || 'Sign in failed. Please retry.'; return }
  password.value = ''; prepare_main_tab_skeleton()
  try { await relaunch_route(authenticated_destination(store)) } catch (cause) { error.value = cause.message }
}
</script>
<template>
  <AuthPageFrame ref="frame" class="login-page" title="Log in" :busy="is_loading" @back="back">
    <text class="auth-heading">Welcome back</text>
    <view class="auth-apple" role="button" tabindex="0" data-interaction="login.appleAuth.click.1" @click="apple" @keydown.enter="apple"><SourceIcon name="apple" /><text>Continue with Apple</text></view>
    <view class="auth-divider"><view /><text>or</text><view /></view>
    <view class="auth-field"><text class="auth-label">Email</text><view class="auth-input-box"><input v-model="email" class="auth-input" aria-label="Email" placeholder="you@university.edu" :maxlength="254" :disabled="is_loading" autocomplete="username" /></view></view>
    <view class="auth-field"><text class="auth-label">Password</text><view class="auth-input-box"><input v-model="password" class="auth-input" aria-label="Password" placeholder="Your password" :password="!shown" :maxlength="128" :disabled="is_loading" autocomplete="current-password" @confirm="login" /><view class="auth-show" role="button" tabindex="0" :aria-label="shown ? 'Hide password' : 'Show password'" data-interaction="login.togglePw.click.1" @click="shown = !shown" @keydown.enter="shown = !shown">{{ shown ? 'Hide' : 'Show' }}</view></view></view>
    <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    <view class="auth-link auth-forgot" role="button" tabindex="0" data-interaction="login.goFpEmail.click.1" @click="go('/pages/auth/reset/email')" @keydown.enter="go('/pages/auth/reset/email')">Forgot password?</view>
    <text class="auth-local-note">Local accounts are stored on this device. Signing in does not verify your student status.</text>
    <template #footer><view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="login.loginNow.click.1" @click="login" @keydown.enter="login">{{ store.session.is_authenticated ? (store.requires_local_verification ? 'Continue verification' : store.onboarding && !store.onboarding.completed ? 'Continue profile setup' : 'Continue to Home') : 'Log In' }}</view><view class="auth-secondary" role="button" tabindex="0" data-interaction="login.goAge.click.1" @click="go('/pages/auth/age')" @keydown.enter="go('/pages/auth/age')">New here? Create an account</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" /></template>
  </AuthPageFrame>
</template>
<style>
@import './auth.css';
</style>
