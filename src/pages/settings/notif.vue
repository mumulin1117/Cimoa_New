<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { notification_permission, open_app_settings } from '@/utils/nativePermissions.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SettingsSwitch from '@/components/SettingsSwitch.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const system_status = ref('unavailable')
const reading = ref(false)
const account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
let generation = 0

const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const notifications = computed(() => store.current_settings.notifications || {})
const rows = [
  ['requests', 'New connection requests'],
  ['accepted', 'Accepted requests'],
  ['messages', 'Messages'],
  ['auto_match', 'Auto Match'],
  ['events', 'Event reminders'],
  ['organizer', 'Organizer updates'],
  ['calls', 'Video calls'],
  ['product', 'Product updates'],
].map(([key, label]) => ({ key, label }))
const system_copy = computed(() => ({
  denied: 'Notifications are disabled in device or browser settings.',
  not_requested: 'System notification permission has not been requested yet.',
  unavailable: 'System notifications are unavailable in this environment.',
  granted: '',
})[system_status.value])

const leave = () => { active = false; generation += 1; reading.value = false; cancel_loading() }
const read_status = async () => {
  const token = ++generation
  if (access_error.value) return
  reading.value = true
  error.value = ''
  try { const status = await notification_permission(false); if (token === generation) system_status.value = status }
  catch (cause) { if (token === generation) error.value = cause.message || 'Notification permission could not be read.' }
  finally { if (token === generation) reading.value = false }
}
onShow(() => { active = true; read_status() })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const persist = async action => {
  if (is_loading.value || access_error.value) return
  error.value = ''
  const result = await run_with_loading(action)
  if (!active || result.reason === 'cancelled') return
  if (!result.success) error.value = result.message || 'Notification preferences could not be saved.'
}
const toggle_master = async () => {
  if (is_loading.value || reading.value || access_error.value) return
  error.value = ''
  if (!notifications.value.master) {
    try {
      const status = await notification_permission(true)
      system_status.value = status
      if (status !== 'granted') { error.value = status === 'denied' ? 'Notification permission was denied. Your preference remains off.' : 'System notifications are unavailable. Your preference remains off.'; return }
    } catch (cause) { error.value = cause.message || 'Notification permission could not be requested.'; return }
  }
  await persist(() => store.update_settings('notifications', { master: !notifications.value.master }))
}
const toggle_row = row => {
  if (!notifications.value.master) { error.value = 'Turn on All notifications before changing individual notification types.'; return }
  persist(() => store.update_settings('notifications', { [row.key]: !notifications.value[row.key] }))
}
const open_settings = async () => { error.value = ''; try { await open_app_settings() } catch (cause) { error.value = cause.message || 'Device Settings could not be opened.' } }
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-notifications-page" title="Notifications" source="setNotif" :busy="is_loading" loading-label="Saving notifications…" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <view v-if="system_copy" class="notification-system" :class="`notification-system--${system_status}`" role="status">
      <text>{{ reading ? 'Checking system notification permission…' : system_copy }}</text>
      <view role="button" tabindex="0" data-interaction="setNotif.openSettings.click.1" @click="open_settings" @keydown.enter="open_settings">Open Settings</view>
    </view>
    <view class="settings-page-row notification-master">
      <text>All notifications</text>
      <SettingsSwitch :checked="!!notifications.master" :disabled="is_loading || reading" label="All notifications" interaction="setNotif.toggleNotifMaster.click.1" @toggle="toggle_master" />
    </view>
    <view class="settings-page-stack">
      <view v-for="row in rows" :key="row.key" class="settings-page-row">
        <text>{{ row.label }}</text>
        <SettingsSwitch :checked="!!notifications.master && !!notifications[row.key]" :disabled="is_loading || !notifications.master" :label="row.label" interaction="setNotif.n.toggle.click.1" @toggle="toggle_row(row)" />
      </view>
    </view>
    <view class="notification-refresh" role="button" tabindex="0" :aria-disabled="reading" data-interaction="setNotif.simulateSystemOff.click.1" @click="read_status" @keydown.enter="read_status">{{ reading ? 'Checking system status…' : 'Refresh system notification status' }}</view>
  </ProfileEditorFrame>
</template>

<style>
@import './settings-pages.css';
</style>
<style scoped>
.notification-system { padding: 30.534rpx 34.351rpx; border-radius: 38.168rpx; margin-bottom: 26.718rpx; background: var(--cimoa-surface-verification-pill); color: var(--cimoa-text-verification-pill); }
.notification-system--denied { background: var(--cimoa-surface-auth-error); color: var(--cimoa-text-auth-error); }
.notification-system text { display: block; font-size: 30.534rpx; font-weight: 700; line-height: 1.4; }
.notification-system > view { margin-top: 11.45rpx; font-size: 29.58rpx; font-weight: 700; text-decoration: underline; cursor: pointer; }
.notification-master { min-height: 114.504rpx; }
.notification-refresh { margin-top: 30.534rpx; color: var(--cimoa-text-onboarding-muted); font-size: 27.672rpx; font-weight: 600; cursor: pointer; }
</style>
