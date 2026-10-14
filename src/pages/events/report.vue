<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store()
const frame = ref(null)
const event_id = ref('')
const reason = ref('')
const error = ref('')
const submitted_id = ref('')
const account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true

const reasons = ['Misleading event information', 'Unsafe activity', 'Harassment or discrimination', 'Inappropriate content', 'Spam or scam', 'Underage safety concern', 'Other']
const event = computed(() => store.event_by_id(event_id.value))
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !submitted_id.value && !event.value
      ? 'This event is no longer available and cannot be reported.'
      : '')
const ready = computed(() => !!reason.value && !submitted_id.value)

const restore_saved_report = preferred_id => {
  const existing = preferred_id
    ? store.report_by_id(String(preferred_id))
    : store.current_reports.find(row => row.target_type === 'event' && row.target_id === event_id.value)
  if (existing?.target_type === 'event' && existing.target_id === event_id.value) submitted_id.value = existing.report_id
}
onLoad(options => {
  event_id.value = String(options?.event_id || '')
  restore_saved_report(options?.report_id)
})
const leave = () => { active = false; cancel_loading() }
onShow(() => { active = true; restore_saved_report() })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => {
  if (is_loading.value) return
  try { await frame.value.navigate_back(`/pages/events/detail?event_id=${encodeURIComponent(event_id.value)}`) } catch (cause) { error.value = cause.message }
}
const submit = async () => {
  if (is_loading.value || access_error.value || !ready.value) { if (!reason.value) error.value = 'Choose a reason before saving this report.'; return }
  error.value = ''
  const result = await run_with_loading(() => store.submit_report({ target_type: 'event', target_id: event_id.value, reason: reason.value }))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message || 'This report could not be saved.'; return }
  submitted_id.value = result.data
}
</script>

<template>
  <SecondaryPageFrame ref="frame" class="event-page event-report-page" :scroll-locked="is_loading">
    <template #header><EventPageHeader title="Report event" back-interaction="evReport.goBack.click.1" :busy="is_loading" @back="back" /></template>
    <view v-if="access_error" class="event-page-state" role="alert"><text>{{ access_error }}</text><view class="event-page-secondary event-report-recover" role="button" tabindex="0" @click="recover" @keydown.enter="recover">Return to account entry</view></view>
    <view v-else-if="!submitted_id" class="event-page-body event-report-body">
      <text class="event-page-copy event-report-intro">Reports are private. Your attendance stays as it is. In this local build, the report is saved only on this device and is not sent to a safety team.</text>
      <view class="event-report-reasons" role="radiogroup" aria-label="Event report reason">
        <view v-for="item in reasons" :key="item" class="event-report-reason" :class="{ selected: reason === item }" role="radio" tabindex="0" :aria-checked="reason === item" data-interaction="evReport.r.pick.click.1" @click="reason = item; error = ''" @keydown.enter="reason = item; error = ''"><view class="event-report-dot" /><text>{{ item }}</text></view>
      </view>
    </view>
    <view v-else class="event-report-saved" role="status">
      <text class="event-report-saved-title">Report saved locally</text>
      <text>Your attendance is unchanged. This report was not sent to a moderation service.</text>
      <text class="event-report-id">Reference: {{ submitted_id }}</text>
      <view class="event-page-secondary" role="button" tabindex="0" data-interaction="evReport.goBack.click.2" @click="back" @keydown.enter="back">Return to event</view>
    </view>
    <template #footer>
      <text v-if="error" class="event-page-error" role="alert">{{ error }}</text>
      <view v-if="!access_error && !submitted_id" class="event-page-footer"><view class="event-page-primary" role="button" tabindex="0" :aria-disabled="!ready || is_loading" data-interaction="evReport.submitEvReport.click.1" @click="submit" @keydown.enter="submit">Save report locally</view></view>
    </template>
    <template #overlays><EventActionLoading :visible="is_loading" label="Saving report locally…" /></template>
  </SecondaryPageFrame>
</template>

<style scoped>
.event-report-body { padding-top: 7.634rpx; }
.event-report-intro { margin-top: 0; }
.event-report-reasons { display: flex; flex-direction: column; gap: 19.084rpx; margin-top: 30.534rpx; }
.event-report-reason { display: flex; align-items: center; gap: 26.718rpx; min-height: 118.321rpx; padding: 22.901rpx 34.351rpx; border: 2px solid var(--cimoa-surface-onboarding-border); border-radius: 38.168rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); cursor: pointer; }
.event-report-reason.selected { border-color: var(--cimoa-button-primary); background: var(--cimoa-surface-verification-pill); }
.event-report-dot { flex: none; width: 41.985rpx; height: 41.985rpx; border: 7.634rpx solid var(--cimoa-surface-onboarding-dashed); border-radius: 50%; background: var(--cimoa-surface-card); }
.event-report-reason.selected .event-report-dot { border-color: var(--cimoa-button-primary); background: var(--cimoa-button-primary); }
.event-report-reason text { font-size: 32.443rpx; font-weight: 600; line-height: 1.35; }
.event-report-saved { margin: 76.336rpx 38.168rpx; padding: 45.802rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.5; text-align: center; }
.event-report-saved-title { display: block; margin-bottom: 19.084rpx; color: var(--cimoa-status-success); font-size: 41.985rpx; font-weight: 800; }
.event-report-id { display: block; margin: 19.084rpx 0 30.534rpx; font-size: 24.809rpx; overflow-wrap: anywhere; }
.event-report-recover { margin-top: 30.534rpx; }
</style>
