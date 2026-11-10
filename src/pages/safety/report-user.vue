<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SettingsSwitch from '@/components/SettingsSwitch.vue'
import { FEEDBACK, show_toast } from '@/utils/toast.js'

const store = use_app_store()
const frame = ref(null)
const target_id = ref('')
const context_id = ref(null)
const target_name = ref('this account')
const reason = ref('')
const description = ref('')
const also_block = ref(false)
const error = ref('')
const account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
let return_task = null

const reasons = ['Fake profile', 'Harassment', 'Inappropriate content', 'Spam or scam', 'Underage user', 'Other']
const target = computed(() => store.user_by_id(target_id.value))
const account_scope = use_account_scope(store, () => { cancel_loading(); reason.value = ''; description.value = ''; target_name.value = 'this account' })
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !target_id.value || target_id.value === store.session.current_user_id || !target.value
      ? 'This account is unavailable and cannot be reported.'
      : '')
const ready = computed(() => !!reason.value)
onLoad(options => {
  target_id.value = String(options?.target_user_id || options?.user_id || '')
  context_id.value = options?.context_id ? String(options.context_id) : null
  const user = store.user_by_id(target_id.value)
  if (user?.user_name) target_name.value = user.user_name
})
const leave = () => { active = false; cancel_loading() }
onShow(() => { active = true; const user = store.user_by_id(target_id.value); if (user?.user_name) target_name.value = user.user_name })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { if (is_loading.value) return false; try { return await frame.value.navigate_back('/pages/messages/index') !== false } catch (cause) { error.value = cause.message; return false } }
async function return_after_report() {
  if (return_task) return return_task
  return_task = (async () => {
    if (!active || !frame.value) return false
    const returned = also_block.value
      ? await frame.value.navigate_replace('/pages/messages/index') !== false
      : await back()
    if (returned) show_toast(FEEDBACK.concern_review, { tone: 'info' })
    return returned
  })().catch(cause => { error.value = cause.message; return false }).finally(() => { return_task = null })
  return return_task
}
const submit = async () => {
  if (is_loading.value || access_error.value || !ready.value) { if (!reason.value) error.value = 'Choose a reason for your report.'; return }
  error.value = ''
  const input = { target_type: 'user', target_id: target_id.value, reason: reason.value, description: description.value.trim(), context_id: context_id.value, also_block: also_block.value }
  const result = await run_with_loading(() => store.submit_report(input))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message || 'Couldn’t complete your report. Please try again.'; return }
  await return_after_report()
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="safety-report-user-page" :title="`Report ${target_name}`" source="safetyReport" :busy="is_loading" loading-label="Preparing your report…" :error="error" @dismiss-error="error = String()" :access-error="access_error" action-label="Submit report" action-interaction="safetyReport.submitReport.click.1" :disabled="!ready" @back="back" @recover="recover" @save="submit">
    <text class="report-intro">Choose the reason that best describes your concern. You can also block this account.</text>
    <view class="report-reasons" role="radiogroup" aria-label="Report reason">
      <view v-for="item in reasons" :key="item" class="report-reason" :class="{ selected: reason === item }" role="radio" tabindex="0" :aria-checked="reason === item" data-interaction="safetyReport.r.pick.click.1" @click="reason = item; error = ''" @keydown.enter="reason = item; error = ''">
        <view class="report-dot" /><text>{{ item }}</text>
      </view>
    </view>
    <text class="editor-label">Optional details</text>
    <textarea v-model="description" class="report-description" aria-label="Report details" placeholder="Add details about your concern" :maxlength="500" :disabled="is_loading" />
    <view class="settings-page-row report-block-row"><view class="report-block-copy"><text>Also block {{ target_name }}</text><text>Removes your connection, pending requests, match and private chat.</text></view><SettingsSwitch :checked="also_block" :disabled="is_loading" :label="`Also block ${target_name}`" interaction="safetyReport.alsoBlock.click.1" @toggle="also_block = !also_block" /></view>
  </ProfileEditorFrame>
</template>

<style>
@import '../settings/settings-pages.css';
</style>
<style scoped>
.report-intro { display: block; color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.45; }
.report-reasons { display: flex; flex-direction: column; gap: 19.084rpx; margin-top: 30.534rpx; }
.report-reason { display: flex; align-items: center; gap: 26.718rpx; min-height: 118.321rpx; padding: 0 34.351rpx; border: 2px solid var(--cimoa-surface-onboarding-border); border-radius: 38.168rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); cursor: pointer; }
.report-reason.selected { border-color: var(--cimoa-button-primary); background: var(--cimoa-surface-verification-pill); }
.report-dot { flex: none; width: 41.985rpx; height: 41.985rpx; border: 7.634rpx solid var(--cimoa-surface-onboarding-dashed); border-radius: 20.992rpx; background: var(--cimoa-surface-card); }
.report-reason.selected .report-dot { border-color: var(--cimoa-button-primary); background: var(--cimoa-button-primary); }
.report-reason text { font-size: 32.443rpx; font-weight: 600; }
.report-description { display: block; width: 100%; min-height: 213.74rpx; padding: 30.534rpx 34.351rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-auth-input); color: var(--cimoa-text-title); font-size: 30.534rpx; line-height: 1.45; }
.report-block-row { margin-top: 30.534rpx; }
.report-block-copy { flex: 1; min-width: 0; }
.report-block-copy text { display: block; font-size: 30.534rpx; font-weight: 700; }
.report-block-copy text + text { margin-top: 7.634rpx; color: var(--cimoa-text-secondary); font-size: 25.763rpx; font-weight: 400; line-height: 1.4; }
</style>
