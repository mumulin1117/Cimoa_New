<script setup>
import { computed, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { permission_statuses, open_app_settings } from '@/utils/nativePermissions.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const reading = ref(false)
const statuses = ref({ camera: 'unavailable', microphone: 'unavailable', photos: 'unavailable', notifications: 'unavailable', location: 'unavailable' })
const account_id = store.session.account_id
let generation = 0

const account_scope = use_account_scope(store, () => { generation += 1; reading.value = false })
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const rows = [
  ['camera', 'Camera'],
  ['microphone', 'Microphone'],
  ['photos', 'Photos'],
  ['notifications', 'Notifications'],
  ['location', 'Location'],
].map(([key, label]) => ({ key, label }))
const labels = { granted: 'Allowed', denied: 'Denied', not_requested: 'Not Requested', unavailable: 'Unavailable' }

const refresh = async () => {
  const token = ++generation
  if (access_error.value) return
  reading.value = true
  error.value = ''
  try {
    const next = await permission_statuses()
    if (token === generation) statuses.value = next
  } catch (cause) { if (token === generation) error.value = cause.message || 'Permission status could not be read.' }
  finally { if (token === generation) reading.value = false }
}
onShow(refresh)
onHide(() => { generation += 1; reading.value = false })
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const open_settings = async () => {
  if (reading.value || access_error.value) return
  error.value = ''
  try { await open_app_settings() } catch (cause) { error.value = cause.message || 'Device Settings could not be opened.' }
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-permissions-page" title="Permissions" source="setPerm" :busy="false" :error="error" @dismiss-error="error = String()" :access-error="access_error" @back="back" @recover="recover">
    <view class="settings-page-stack permissions-stack" :aria-busy="reading">
      <view v-for="row in rows" :key="row.key" class="settings-page-row permission-row" role="button" tabindex="0" data-interaction="setPerm.p.openSettings.click.1" @click="open_settings" @keydown.enter="open_settings">
        <text>{{ row.label }}</text>
        <view class="permission-pill" :class="`permission-pill--${statuses[row.key]}`"><text>{{ reading ? 'Checking…' : labels[statuses[row.key]] }}</text></view>
      </view>
    </view>
    <text class="settings-page-note">Tap any row to open device Settings. Cimoa can read the current status but can’t change system permissions here.</text>
  </ProfileEditorFrame>
</template>

<style>
@import './settings-pages.css';
</style>
<style scoped>
.permissions-stack { margin-top: 0; }
.permission-row { padding: 30.534rpx 34.351rpx; }
.permission-row > text { font-size: 32.443rpx; }
.settings-page-note { font-size: 28.626rpx; margin-top: 26.718rpx; color: var(--cimoa-text-auth-placeholder); }
.permission-pill { flex: none; padding: 11.45rpx 22.901rpx; border-radius: 26.718rpx; background: var(--cimoa-surface-profile-icon); }
.permission-pill text { font-size: 25.763rpx; font-weight: 700; color: var(--cimoa-text-secondary); }
.permission-pill--granted { background: var(--cimoa-status-connected-bg); }
.permission-pill--granted text { color: var(--cimoa-status-connected-ink); }
.permission-pill--denied { background: var(--cimoa-surface-auth-error); }
.permission-pill--denied text { color: var(--cimoa-text-auth-error); }
</style>
