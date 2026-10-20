<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { report_date_label, report_status_label } from '@/utils/reportPresentation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const navigating = ref(false)
const account_id = store.session.account_id
const account_scope = use_account_scope(store)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const rows = computed(() => [...store.current_reports].sort((a, b) => b.created_at - a.created_at).map(report => ({ ...report, subject: store.report_subject(report), when: report_date_label(report.created_at), status_label: report_status_label(report.status) })))

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => {
  if (navigating.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const open_report = async row => {
  if (navigating.value || access_error.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_forward(`/pages/safety/report-detail?report_id=${encodeURIComponent(row.report_id)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="safety-reports-page" title="Your reports" source="reportsSubmitted" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <text class="reports-local-note">View your report history and the details you provided.</text>
    <view v-if="rows.length" class="reports-list">
      <view v-for="row in rows" :key="row.report_id" class="report-row" role="button" tabindex="0" :aria-label="`${row.subject?.name || 'Unavailable subject'}, ${row.reason}, ${row.status_label}`" data-interaction="reportsSubmitted.r.open.click.1" @click="open_report(row)" @keydown.enter="open_report(row)">
        <view class="report-row-top"><text class="report-target">{{ row.subject?.name || 'Unavailable subject' }}</text><text class="report-status">{{ row.status_label }}</text></view>
        <view class="report-row-bottom"><text>{{ row.reason }} · {{ row.when }}</text><view class="report-chevron"><SourceIcon name="chevron" /></view></view>
      </view>
    </view>
    <view v-else class="settings-page-empty" role="status"><text class="settings-page-empty-title">No reports submitted</text><text class="settings-page-empty-copy">Your saved reports will appear here.</text></view>
  </ProfileEditorFrame>
</template>

<style>
@import '../settings/settings-pages.css';
</style>
<style scoped>
.reports-local-note { display: block; color: var(--cimoa-text-secondary); font-size: 28.626rpx; line-height: 1.45; }
.reports-list { display: flex; flex-direction: column; gap: 22.901rpx; margin-top: 30.534rpx; }
.report-row { padding: 30.534rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); cursor: pointer; overflow-wrap: anywhere; }
.report-row-top, .report-row-bottom { display: flex; align-items: center; justify-content: space-between; gap: 19.084rpx; }
.report-target { flex: 1; min-width: 0; color: var(--cimoa-text-title); font-size: 34.351rpx; font-weight: 800; letter-spacing: -0.02em; }
.report-status { flex: none; padding: 9.542rpx 19.084rpx; border-radius: 26.718rpx; background: var(--cimoa-surface-verification-pill); color: var(--cimoa-text-verification-pill); font-size: 23.855rpx; font-weight: 700; }
.report-row-bottom { margin-top: 11.45rpx; color: var(--cimoa-text-secondary); font-size: 28.626rpx; }
.report-row-bottom > text { flex: 1; min-width: 0; }
.report-chevron { flex: none; width: 30.534rpx; height: 30.534rpx; color: var(--cimoa-text-profile-chevron); }
</style>
