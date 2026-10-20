<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SettingsSwitch from '@/components/SettingsSwitch.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true

const account_scope = use_account_scope(store, cancel_loading)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const visibility = computed(() => store.privacy_visibility)
const privacy = computed(() => store.current_settings.privacy || {})
const visibility_options = [
  { value: 'discover', label: 'Visible in Discover' },
  { value: 'auto_match', label: 'Auto Match only' },
  { value: 'hidden', label: 'Temporarily hidden' },
]
const visibility_note = computed(() => visibility.value === 'hidden'
  ? 'Your profile won’t appear in Discover or Auto Match. Existing chats and joined events stay open.'
  : visibility.value === 'auto_match'
    ? 'You won’t appear in Discover browsing, but Auto Match can still suggest you.'
    : 'Visible in Discover and Auto Match. Student verification status is shown on your profile.')
const toggles = [
  ['show_online', 'Show online status'],
  ['show_year', 'Show academic year'],
  ['show_field', 'Show field of study'],
  ['show_mutual', 'Show mutual interests'],
  ['allow_voice', 'Allow voice introductions'],
  ['allow_video', 'Allow video-call invitations'],
  ['event_visible', 'Visible to other event participants'],
].map(([key, label]) => ({ key, label }))

const leave = () => { active = false; cancel_loading() }
onShow(() => { active = true })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const persist = async action => {
  if (!active || is_loading.value || access_error.value) return
  error.value = ''
  const result = await run_with_loading(action)
  if (!active || result.reason === 'cancelled') return
  if (!result.success) error.value = result.message || 'Privacy settings could not be saved.'
}
const select_visibility = value => {
  if (value === visibility.value) return
  persist(() => store.set_privacy_visibility(value))
}
const toggle = key => persist(() => store.update_settings('privacy', { [key]: !privacy.value[key] }))
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-privacy-page" title="Privacy" source="setPrivacy" :busy="is_loading" loading-label="Saving privacy…" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <text class="settings-page-section-title">Discover profile visibility</text>
    <view class="settings-page-stack">
      <view v-for="option in visibility_options" :key="option.value" class="settings-page-choice" :class="{ selected: visibility === option.value }" role="radio" tabindex="0" :aria-checked="visibility === option.value" :aria-disabled="is_loading" data-interaction="setPrivacy.o.pick.click.1" @click="select_visibility(option.value)" @keydown.enter="select_visibility(option.value)">
        <text>{{ option.label }}</text>
      </view>
    </view>
    <text class="settings-page-note">{{ visibility_note }}</text>
    <view class="settings-page-stack privacy-toggle-stack">
      <view v-for="item in toggles" :key="item.key" class="settings-page-row">
        <text>{{ item.label }}</text>
        <SettingsSwitch :checked="!!privacy[item.key]" :disabled="is_loading" :label="item.label" interaction="setPrivacy.p.toggle.click.1" @toggle="toggle(item.key)" />
      </view>
    </view>
  </ProfileEditorFrame>
</template>

<style>
@import './settings-pages.css';
</style>
<style scoped>
.privacy-toggle-stack { margin-top: 38.168rpx; }
</style>
