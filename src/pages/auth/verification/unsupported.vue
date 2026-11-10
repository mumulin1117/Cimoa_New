<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { is_source_supported_university_email } from '@/utils/localAuth.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import LogoutConfirmDialog from '@/components/LogoutConfirmDialog.vue'

const store = use_app_store(), frame = ref(null), flow_id = ref(''), error = ref(''), dialog_error = ref(''), confirm_open = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const context = computed(() => store.local_verification)
const is_current_flow = computed(() => {
  const draft = store.auth_draft
  return Boolean(context.value && flow_id.value && flow_id.value === draft.flow_id && draft.pending_registration_account_id === context.value.account_id && !context.value.verified && !is_source_supported_university_email(context.value.email))
})
let active = true
onLoad(options => { flow_id.value = String(options.auth_flow_id || '') })
onShow(() => { active = true })
const leave = () => { active = false; cancel_loading() }
onHide(leave); onUnmounted(leave)

const back = async () => {
  if (is_loading.value) return
  error.value = ''
  try { await frame.value.navigate_back('/pages/auth/verification/email') } catch (cause) { error.value = cause.message }
}
const contact_support = () => {
  if (is_loading.value) return
  const result = store.submit_support()
  error.value = result.message || 'Support is unavailable right now. Please try again later.'
}
const request_logout = () => {
  if (is_loading.value) return
  error.value = ''; dialog_error.value = ''; confirm_open.value = true
}
const confirm_logout = async () => {
  if (is_loading.value) return
  dialog_error.value = ''
  const result = await run_with_loading(() => store.logout())
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { dialog_error.value = result.message; return }
  confirm_open.value = false
  try { await frame.value.navigate_relaunch(auth_destination('/pages/auth/welcome')) } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <AuthPageFrame ref="frame" class="verification-unsupported-page" title="University verification" back-interaction="verUnsupported.goBack.click.1" :busy="is_loading" @back="back">
    <view v-if="is_current_flow" class="unsupported-hero">
      <view class="unsupported-emblem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2.5" y="5" width="19" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></svg></view>
      <text class="unsupported-title">That university isn’t supported yet</text>
      <text class="unsupported-description">Try another university email to continue.</text>
      <text v-if="error" class="auth-error-box unsupported-error" role="alert">{{ auth_message(error) }}</text>
    </view>
    <view v-else class="unsupported-invalid">
      <text class="auth-error-box" role="alert">This university-email check is no longer available. Return to your current verification step.</text>
    </view>
    <template #footer>
      <view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="verUnsupported.changeEmail.click.1" @click="back" @keydown.enter="back">Try Another University Email</view>
      <view v-if="is_current_flow" class="unsupported-support" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="verUnsupported.supportUni.click.1" @click="contact_support" @keydown.enter="contact_support">Contact Support</view>
      <view v-if="is_current_flow" class="unsupported-logout" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="verUnsupported.logOut.click.1" @click="request_logout" @keydown.enter="request_logout">Log Out</view>
    </template>
    <template #overlays>
      <LogoutConfirmDialog :open="confirm_open" :busy="is_loading" :error="dialog_error && auth_message(dialog_error)" @close="!is_loading && (confirm_open = false)" @confirm="confirm_logout" />
      <AuthActionLoading :visible="is_loading" label="Logging out…" />
    </template>
  </AuthPageFrame>
</template>

<style>
@import '../auth.css';
</style>
<style scoped>
.verification-unsupported-page :deep(.auth-content) { min-height: 100%; }
.verification-unsupported-page :deep(.auth-footer) { gap: 19.084rpx; padding-bottom: 57.252rpx; }
.unsupported-hero { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; padding-top: 106.87rpx; }
.unsupported-emblem { display: flex; align-items: center; justify-content: center; width: 175.573rpx; height: 175.573rpx; border-radius: 87.786rpx; background: var(--cimoa-surface-skeleton); color: var(--cimoa-text-auth-muted); }
.unsupported-emblem svg { width: 76.336rpx; height: 76.336rpx; }
.unsupported-title { max-width: 100%; font-size: 51.527rpx; font-weight: 800; letter-spacing: -.035em; line-height: 1.15; text-align: center; text-wrap: pretty; }
.unsupported-description { max-width: 572.519rpx; color: var(--cimoa-text-secondary); font-size: 32.443rpx; line-height: 1.4; text-align: center; text-wrap: pretty; }
.unsupported-error { width: 100%; margin-top: 0; }
.unsupported-invalid { padding-top: 106.87rpx; }
.unsupported-support { display: flex; align-items: center; justify-content: center; height: 106.87rpx; border-radius: 53.435rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-auth-secondary); color: var(--cimoa-text-title); font-size: 34.351rpx; font-weight: 600; }
.unsupported-logout { display: flex; align-items: center; justify-content: center; height: 87.786rpx; color: var(--cimoa-text-auth-muted); font-size: 30.534rpx; font-weight: 600; }
</style>
