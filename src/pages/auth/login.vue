<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { valid_email } from '@/utils/localAuth.js'
import { auth_destination, authenticated_destination } from '@/utils/authNavigation.js'
import { prepare_main_tab_skeleton } from '@/utils/mainTabSkeleton.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_visual_viewport } from '@/composables/useEventViewport.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const store = use_app_store(), frame = ref(null), email = ref(store.auth_draft.email || ''), password = ref(''), shown = ref(false), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { height: viewport_height, keyboard_open } = use_visual_viewport()
const show_test_states = import.meta.env.DEV
let active = true
const hide = () => { active = false; cancel_loading(); password.value = ''; shown.value = false }
onShow(() => { active = true })
onHide(hide); onUnmounted(hide)
const back = async () => { try { await frame.value.navigate_back() } catch (cause) { error.value = cause.message } }
const go = async target => { if (is_loading.value) return; error.value = ''; try { await frame.value.navigate_forward(auth_destination(target)) } catch (cause) { error.value = cause.message } }
const apply_test_state = async kind => {
  if (is_loading.value) return
  error.value = ''
  const result = await store.inspect_login_test_state(kind)
  if (!active) return
  if (!result.success) { error.value = result.message; return }
  error.value = result.data.message
  if (kind === 'unverified_account') {
    try { await frame.value.navigate_forward(auth_destination('/pages/auth/verification/email')) } catch (cause) { error.value = cause.message }
  }
}
const login = async () => {
  if (is_loading.value) return
  error.value = ''
  if (store.hydration_status !== 'ready') { error.value = store.hydration_error || 'Your account information is unavailable. Please try again.'; return }
  if (store.session.is_authenticated) { try { await frame.value.navigate_relaunch(authenticated_destination(store)) } catch (cause) { error.value = cause.message }; return }
  if (!valid_email(email.value) || !password.value) { error.value = 'Enter a valid email and password.'; return }
  const result = await run_with_loading(context => store.login(email.value, password.value, context))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message || 'Sign in failed. Please retry.'; return }
  password.value = ''; prepare_main_tab_skeleton(store.auth_context)
  try { await frame.value.navigate_relaunch(authenticated_destination(store)) } catch (cause) { error.value = cause.message }
}
</script>
<template>
  <AuthPageFrame ref="frame" class="login-page" :class="{ 'login-page--keyboard': keyboard_open }" title="Log in" back-interaction="login.goBack.click.1" :busy="is_loading" :style="{ height: viewport_height }" @back="back">
    <text class="auth-heading">Welcome back</text>
    <view class="auth-field"><text class="auth-label">Email</text><view class="auth-input-box"><input v-model="email" class="auth-input" aria-label="Email" placeholder="you@university.edu" data-interaction="login.onEmail.change.1" :maxlength="254" :disabled="is_loading" autocomplete="username" /></view></view>
    <view class="auth-field"><text class="auth-label">Password</text><view class="auth-input-box"><input v-model="password" class="auth-input" aria-label="Password" placeholder="Your password" data-interaction="login.onPw.change.1" :password="!shown" :maxlength="128" :disabled="is_loading" autocomplete="current-password" @confirm="login" /><view class="auth-show" role="button" tabindex="0" :aria-label="shown ? 'Hide password' : 'Show password'" data-interaction="login.togglePw.click.1" @click="shown = !shown" @keydown.enter="shown = !shown">{{ shown ? 'Hide' : 'Show' }}</view></view></view>
    <text v-if="error" class="auth-error-box" role="alert">{{ auth_message(error) }}</text>
    <view class="auth-link auth-forgot" role="button" tabindex="0" data-interaction="login.goFpEmail.click.1" @click="go('/pages/auth/reset/email')" @keydown.enter="go('/pages/auth/reset/email')">Forgot password?</view>
    <view v-if="show_test_states" class="auth-test-states">
      <text class="auth-test-title">TEST STATES</text>
      <view class="auth-test-chips">
        <view class="auth-test-chip" role="button" tabindex="0" data-interaction="login.loginWrong.click.1" @click="apply_test_state('wrong_password')" @keydown.enter="apply_test_state('wrong_password')">Wrong password</view>
        <view class="auth-test-chip" role="button" tabindex="0" data-interaction="login.loginUnverified.click.1" @click="apply_test_state('unverified_account')" @keydown.enter="apply_test_state('unverified_account')">Unverified account</view>
      </view>
    </view>
    <text class="auth-local-note">Keep your account details private. Manage your profile and privacy in Settings.</text>
    <template #footer><view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="login.loginNow.click.1" @click="login" @keydown.enter="login"><text>Log In</text><SourceIcon name="arrow-right" :stroke-width="2.4" /></view><view class="auth-secondary" role="button" tabindex="0" data-interaction="login.goAge.click.1" @click="go('/pages/auth/age')" @keydown.enter="go('/pages/auth/age')">New here? Create an account</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" /></template>
  </AuthPageFrame>
</template>
<style>
@import './auth.css';
</style>
