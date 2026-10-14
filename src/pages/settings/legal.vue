<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import AgreementSheet from '@/components/AgreementSheet.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const document = ref(null)
const navigating = ref(false)
const account_id = store.session.account_id
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const rows = [
  { label: 'Terms of Use', kind: 'terms', interaction: 'setLegal.openTerms.click.1' },
  { label: 'Privacy Policy', kind: 'privacy', interaction: 'setLegal.openPrivacy.click.1' },
  { label: 'Community Guidelines', kind: 'community', interaction: 'setLegal.openAgreeInfo.click.1' },
  { label: 'Coin and Purchase Information', kind: 'coins', interaction: 'setLegal.openCoinHelp.click.1' },
]

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => {
  if (navigating.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const open_row = row => {
  if (navigating.value || access_error.value) return
  error.value = ''
  if (row.kind === 'community') { document.value = store.registration_catalog.agreements.find(item => item.key === 'community'); return }
  error.value = row.kind === 'coins'
    ? 'Coin and Purchase Information has not been restored yet. No purchase was started.'
    : `${row.label} is the next independent legal page in this restoration flow.`
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-legal-page" title="Legal" source="setLegal" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <text class="legal-local-note">These documents describe this local build only. They are not published production terms and do not identify a configured operator or legal contact.</text>
    <view class="legal-list">
      <view v-for="row in rows" :key="row.kind" class="legal-row" role="button" tabindex="0" :data-interaction="row.interaction" @click="open_row(row)" @keydown.enter="open_row(row)"><text>{{ row.label }}</text><view class="legal-chevron"><SourceIcon name="chevron" /></view></view>
    </view>
    <template #overlays><AgreementSheet :open="!!document" :document="document" @close="document = null" /></template>
  </ProfileEditorFrame>
</template>

<style scoped>
.legal-local-note { display: block; color: var(--cimoa-text-secondary); font-size: 28.626rpx; line-height: 1.5; }
.legal-list { display: flex; flex-direction: column; gap: 19.084rpx; margin-top: 30.534rpx; }
.legal-row { display: flex; align-items: center; gap: 22.901rpx; min-height: 114.504rpx; padding: 22.901rpx 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); cursor: pointer; }
.legal-row > text { flex: 1; min-width: 0; font-size: 32.443rpx; font-weight: 600; }
.legal-chevron { flex: none; width: 30.534rpx; height: 30.534rpx; color: var(--cimoa-text-profile-chevron); }
</style>
