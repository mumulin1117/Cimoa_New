<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SettingsSwitch from '@/components/SettingsSwitch.vue'

const store = use_app_store()
const frame = ref(null)
const target_id = ref('')
const context_id = ref(null)
const target_name = ref('this account')
const reason = ref('')
const description = ref('')
const also_block = ref(false)
const error = ref('')
const submitted_id = ref('')
const account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true

const reasons = ['Fake profile', 'Harassment', 'Inappropriate content', 'Spam or scam', 'Underage user', 'Other']
const target = computed(() => store.user_by_id(target_id.value))
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !submitted_id.value && (!target_id.value || target_id.value === store.session.current_user_id || !target.value)
      ? 'This account is unavailable and cannot be reported.'
      : '')
const ready = computed(() => !!reason.value && !submitted_id.value)

const restore_saved_report = preferred_id => {
  const existing = preferred_id ? store.report_by_id(String(preferred_id)) : store.current_reports.find(row => row.target_type === 'user' && row.target_id === target_id.value && row.context_id === context_id.value)
  if (existing?.target_type === 'user' && existing.target_id === target_id.value) submitted_id.value = existing.report_id
  const subject = store.report_subject(existing)
  if (subject?.name) target_name.value = subject.name
}
onLoad(options => {
  target_id.value = String(options?.target_user_id || options?.user_id || '')
  context_id.value = options?.context_id ? String(options.context_id) : null
  restore_saved_report(options?.report_id)
  const user = store.user_by_id(target_id.value)
  if (user?.user_name) target_name.value = user.user_name
})
const leave = () => { active = false; cancel_loading() }
onShow(() => { active = true; restore_saved_report(); const user = store.user_by_id(target_id.value); if (user?.user_name) target_name.value = user.user_name })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/messages/index') } catch (cause) { error.value = cause.message } }
const submit = async () => {
  if (is_loading.value || access_error.value || !ready.value) { if (!reason.value) error.value = 'Choose a reason before saving this report.'; return }
  error.value = ''
  const input = { target_type: 'user', target_id: target_id.value, reason: reason.value, description: description.value.trim(), context_id: context_id.value, also_block: also_block.value }
  const result = await run_with_loading(() => store.submit_report(input))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message || 'This report could not be saved.'; return }
  submitted_id.value = result.data
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="safety-report-user-page" :title="`Report ${target_name}`" source="safetyReport" :busy="is_loading" loading-label="Saving report locally…" :error="error" :access-error="access_error" :action-label="submitted_id ? '' : 'Save report locally'" action-interaction="safetyReport.submitReport.click.1" :disabled="!ready" @back="back" @recover="recover" @save="submit">
    <template v-if="!submitted_id">
      <text class="report-intro">Choose the reason that fits best. This local build saves reports only on this device; it does not send them to a safety team.</text>
      <view class="report-reasons" role="radiogroup" aria-label="Report reason">
        <view v-for="item in reasons" :key="item" class="report-reason" :class="{ selected: reason === item }" role="radio" tabindex="0" :aria-checked="reason === item" data-interaction="safetyReport.r.pick.click.1" @click="reason = item; error = ''" @keydown.enter="reason = item; error = ''">
          <view class="report-dot" /><text>{{ item }}</text>
        </view>
      </view>
      <text class="editor-label">Optional details</text>
      <textarea v-model="description" class="report-description" aria-label="Report details" placeholder="Add context that will help you remember this report" :maxlength="500" :disabled="is_loading" />
      <view class="settings-page-row report-block-row"><view class="report-block-copy"><text>Also block {{ target_name }}</text><text>Removes your connection, pending requests, match and private chat.</text></view><SettingsSwitch :checked="also_block" :disabled="is_loading" :label="`Also block ${target_name}`" interaction="safetyReport.alsoBlock.click.1" @toggle="also_block = !also_block" /></view>
    </template>
    <view v-else class="report-saved" role="status">
      <text class="report-saved-title">Report saved locally</text>
      <text>This report was not sent to a moderation service. You can review it under Settings → Submitted Reports.</text>
      <text class="report-id">Reference: {{ submitted_id }}</text>
      <view class="editor-outline" role="button" tabindex="0" data-interaction="safetyReport.goBack.click.2" @click="back" @keydown.enter="back">Return</view>
    </view>
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
.report-saved { margin-top: 76.336rpx; padding: 45.802rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.5; text-align: center; }
.report-saved-title { display: block; margin-bottom: 19.084rpx; color: var(--cimoa-status-success); font-size: 41.985rpx; font-weight: 800; }
.report-id { display: block; margin-top: 19.084rpx; font-size: 24.809rpx; overflow-wrap: anywhere; }
</style>
