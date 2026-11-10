<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { event_report_fallback } from '@/utils/eventsNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import { FEEDBACK, show_toast } from '@/utils/toast.js'

const store = use_app_store()
const frame = ref(null)
const event_id = ref('')
const origin_conversation_id = ref('')
const target_type = ref('event')
const reason = ref('')
const error = ref('')
const account_id = store.session.account_id
const auth_context = store.auth_context
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
let return_task = null

const is_group = computed(() => target_type.value === 'group')
const target_id = computed(() => is_group.value ? origin_conversation_id.value : event_id.value)
const reasons = computed(() => is_group.value ? store.group_report_reasons : store.event_report_reasons)
const event = computed(() => store.event_by_id(event_id.value))
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || store.auth_context !== auth_context
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !['event', 'group'].includes(target_type.value)
      ? 'This report type is unavailable.'
      : is_group.value && !store.event_group(event_id.value, origin_conversation_id.value)
        ? 'This group chat is unavailable. Reopen it from your joined event.'
        : !event.value
          ? 'This event is no longer available and cannot be reported.'
          : '')
const ready = computed(() => !!reason.value)
onLoad(options => {
  event_id.value = String(options?.event_id || '')
  origin_conversation_id.value = String(options?.origin_conversation_id || '')
  target_type.value = String(options?.target_type || 'event')
})
const leave = () => { active = false; cancel_loading() }
onShow(() => { active = true })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => {
  if (is_loading.value) return false
  try { return await frame.value.navigate_back(event_report_fallback(store, event_id.value, origin_conversation_id.value)) !== false } catch (cause) { error.value = cause.message; return false }
}
async function return_after_report() {
  if (return_task) return return_task
  return_task = (async () => {
    if (!active || !frame.value) return false
    const returned = await back()
    if (returned) show_toast(FEEDBACK.concern_review, { tone: 'info' })
    return returned
  })().finally(() => { return_task = null })
  return return_task
}
const submit = async () => {
  if (is_loading.value || access_error.value || !ready.value) { if (!reason.value) error.value = 'Choose a reason for your report.'; return }
  error.value = ''
  const result = await run_with_loading(() => access_error.value ? { success: false, message: access_error.value } : store.submit_report({ target_type: target_type.value, target_id: target_id.value, context_id: is_group.value ? event_id.value : null, reason: reason.value }))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message || 'Couldn’t complete your report. Please try again.'; return }
  await return_after_report()
}
</script>

<template>
  <SecondaryPageFrame ref="frame" class="event-page event-report-page" :class="{ 'event-group-report-page': is_group }" :data-report-target-type="target_type" :data-report-target-id="target_id" :scroll-locked="is_loading">
    <template #header><EventPageHeader :title="is_group ? 'Report group chat' : 'Report event'" back-interaction="evReport.goBack.click.1" :busy="is_loading" @back="back" /></template>
    <view v-if="access_error" class="event-page-state" role="alert"><text>{{ access_error }}</text><view class="event-page-secondary event-report-recover" role="button" tabindex="0" @click="recover" @keydown.enter="recover">Return to account entry</view></view>
    <view v-else class="event-page-body event-report-body">
      <text class="event-page-copy event-report-intro">{{ is_group ? 'Reports are private. Reporting a group chat does not leave the group or change your attendance.' : 'Reports are private. Reporting an event does not change your attendance.' }}</text>
      <view class="event-report-reasons" role="radiogroup" :aria-label="is_group ? 'Group chat report reason' : 'Event report reason'">
        <view v-for="item in reasons" :key="item" class="event-report-reason" :class="{ selected: reason === item }" role="radio" tabindex="0" :aria-checked="reason === item" data-interaction="evReport.r.pick.click.1" @click="reason = item; error = ''" @keydown.enter="reason = item; error = ''"><view class="event-report-dot" /><text>{{ item }}</text></view>
      </view>
    </view>
    <template #footer>
      <FeedbackToast v-if="error" :message="error" @dismiss="error = String()" />
      <view v-if="!access_error" class="event-page-footer"><view class="event-page-primary" role="button" tabindex="0" :aria-disabled="!ready || is_loading" data-interaction="evReport.submitEvReport.click.1" @click="submit" @keydown.enter="submit">Submit report</view></view>
    </template>
    <template #overlays><EventActionLoading :visible="is_loading" label="Preparing your report…" /></template>
  </SecondaryPageFrame>
</template>

<style scoped>
.event-report-body { padding-top: 0; }
.event-report-intro { margin-top: 0; }
.event-report-reasons { display: flex; flex-direction: column; gap: 19.084rpx; margin-top: 30.534rpx; }
.event-report-reason {
  display: flex;
  align-items: center;
  gap: 26.718rpx;
  min-height: 118.321rpx;
  padding: 22.901rpx 34.351rpx;
  border: 2px solid var(--cimoa-surface-onboarding-border);
  border-radius: 38.168rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auth-secondary);
  cursor: pointer;
}
.event-report-reason.selected { border-color: var(--cimoa-button-primary); background: var(--cimoa-surface-event-report-selected); }
.event-report-dot {
  flex: none;
  width: 41.985rpx;
  height: 41.985rpx;
  border: 0;
  border-radius: 50%;
  background: var(--cimoa-surface-event-report-dot);
}
.event-report-reason.selected .event-report-dot { border-color: var(--cimoa-button-primary); background: var(--cimoa-button-primary); }
.event-report-reason text { font-size: 32.443rpx; font-weight: 600; line-height: 1.35; }
.event-report-recover { margin-top: 30.534rpx; }
.event-report-reason { box-shadow: var(--cimoa-shadow-event-report); }
.event-report-reason text { line-height: normal; }
.event-page-footer { padding-bottom: 64.885rpx; }
.event-page-primary[aria-disabled='true'] { opacity: 1; background: var(--cimoa-surface-event-handle); color: var(--cimoa-text-onboarding-muted); }
</style>
