<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { report_date_label, report_status_label } from '@/utils/reportPresentation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'

const store = use_app_store()
const frame = ref(null)
const report_id = ref('')
const error = ref('')
const navigating = ref(false)
const account_id = store.session.account_id
const report = computed(() => store.report_by_id(report_id.value))
const subject = computed(() => store.report_subject(report.value))
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !report.value
      ? 'This report is unavailable for the current account.'
      : '')

onLoad(options => { report_id.value = String(options?.report_id || '') })
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => {
  if (navigating.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_back('/pages/safety/reports') } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const support = () => {
  if (navigating.value || access_error.value) return
  error.value = 'Help & Support has not been restored yet. No support request was created.'
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="safety-report-detail-page" title="Report detail" source="reportDetail" :error="error" :access-error="access_error" action-label="Contact Support" action-interaction="reportDetail.openSetSupport.click.1" @back="back" @recover="recover" @save="support">
    <template v-if="report">
      <view class="report-detail-card">
        <view class="report-detail-row"><text>Subject</text><text>{{ subject?.name || 'Unavailable subject' }}</text></view>
        <view class="report-detail-row"><text>Category</text><text>{{ report.reason }}</text></view>
        <view class="report-detail-row"><text>Submitted</text><text>{{ report_date_label(report.created_at) }}</text></view>
        <view class="report-detail-row"><text>Status</text><text class="report-detail-status">{{ report_status_label(report.status) }}</text></view>
        <view class="report-detail-row"><text>Reference</text><text class="report-detail-reference">{{ report.report_id }}</text></view>
      </view>
      <text class="report-detail-heading">Your description</text>
      <text class="report-detail-description">{{ report.description || 'No additional description was saved.' }}</text>
      <text class="report-detail-note">This report is stored only on this device and was not sent to a moderation service. No moderation decision or other user’s private information is available.</text>
    </template>
  </ProfileEditorFrame>
</template>

<style scoped>
.report-detail-card { padding: 11.45rpx 34.351rpx 22.901rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); overflow-wrap: anywhere; }
.report-detail-row { display: flex; align-items: center; justify-content: space-between; gap: 22.901rpx; min-height: 99.237rpx; border-bottom: 1px solid var(--cimoa-surface-event-divider); }
.report-detail-row:last-child { border-bottom: 0; }
.report-detail-row > text:first-child { flex: none; color: var(--cimoa-text-secondary); font-size: 30.534rpx; }
.report-detail-row > text:last-child { min-width: 0; max-width: 62%; text-align: right; font-size: 30.534rpx; font-weight: 700; }
.report-detail-status { color: var(--cimoa-text-verification-pill); }
.report-detail-reference { font-size: 22.901rpx !important; overflow-wrap: anywhere; }
.report-detail-heading { display: block; margin-top: 34.351rpx; font-size: 32.443rpx; font-weight: 700; }
.report-detail-description { display: block; margin-top: 15.267rpx; color: var(--cimoa-text-profile-bio); font-size: 31.489rpx; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.report-detail-note { display: block; margin-top: 30.534rpx; color: var(--cimoa-text-auth-placeholder); font-size: 28.626rpx; line-height: 1.5; }
</style>
