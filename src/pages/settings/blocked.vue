<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import EventConfirmDialog from '@/components/EventConfirmDialog.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const dialog_error = ref('')
const target_id = ref(null)
const account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true

const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const blocked = computed(() => store.blocked_accounts)
const target = computed(() => blocked.value.find(user => user.user_id === target_id.value) || null)
const leave = () => { active = false; target_id.value = null; dialog_error.value = ''; cancel_loading() }
onShow(() => { active = true })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const open_unblock = user => { if (is_loading.value || access_error.value) return; error.value = ''; dialog_error.value = ''; target_id.value = user.user_id }
const close_unblock = () => { if (!is_loading.value) { target_id.value = null; dialog_error.value = '' } }
const confirm_unblock = async () => {
  if (is_loading.value || !target.value || access_error.value) return
  dialog_error.value = ''
  const id = target.value.user_id
  const result = await run_with_loading(() => store.unblock_user(id))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { dialog_error.value = result.message || 'This account could not be unblocked.'; return }
  target_id.value = null
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-blocked-page" title="Blocked accounts" source="blockedList" :busy="is_loading" loading-label="Unblocking account…" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <view v-if="blocked.length" class="settings-page-stack blocked-stack">
      <view v-for="user in blocked" :key="user.user_id" class="blocked-card">
        <view class="blocked-avatar"><ProfilePhoto :src="user.avatar_url" :name="user.user_name" portrait /></view>
        <view class="blocked-copy"><text class="blocked-name">{{ user.user_name }}</text><text class="blocked-university">{{ user.university || 'University not shown' }}</text></view>
        <view class="blocked-action" role="button" tabindex="0" :aria-label="`Unblock ${user.user_name}`" data-interaction="blockedList.b.unblock.click.1" @click="open_unblock(user)" @keydown.enter="open_unblock(user)">Unblock</view>
      </view>
    </view>
    <view v-else class="settings-page-empty"><text class="settings-page-empty-title">No blocked accounts</text><text class="settings-page-empty-copy">Accounts you unblock can appear again where their privacy settings allow, but old connections and chats stay deleted.</text></view>
    <template #overlays>
      <EventConfirmDialog :open="!!target" :busy="is_loading" :label="target ? `Unblock ${target.user_name}?` : 'Unblock account'" close-interaction="unblockOpen.closeUnblock.click.1" style="--event-dialog-bottom: var(--app-safe-bottom);" @close="close_unblock">
        <text class="event-dialog-title">Unblock {{ target?.user_name }}?</text>
        <text class="event-dialog-copy">This does not restore your previous connection, chat history, pending request, or Auto Match record.</text>
        <text v-if="dialog_error" class="event-dialog-error" role="alert">{{ dialog_error }}</text>
        <view class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="unblockOpen.confirmUnblock.click.1" @click="confirm_unblock" @keydown.enter="confirm_unblock">Unblock</view>
        <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="unblockOpen.closeUnblock.click.2" @click="close_unblock" @keydown.enter="close_unblock">Cancel</view>
      </EventConfirmDialog>
    </template>
  </ProfileEditorFrame>
</template>

<style>
@import './settings-pages.css';
</style>
<style scoped>
.blocked-stack { margin-top: 0; gap: 22.901rpx; }
.blocked-card { display: flex; align-items: center; gap: 22.901rpx; min-height: 152.672rpx; padding: 26.718rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.blocked-avatar { position: relative; flex: none; width: 99.237rpx; height: 99.237rpx; border-radius: 49.618rpx; overflow: hidden; }
.blocked-copy { flex: 1; min-width: 0; }
.blocked-name, .blocked-university { display: block; overflow-wrap: anywhere; }
.blocked-name { font-size: 34.351rpx; font-weight: 800; letter-spacing: -0.02em; }
.blocked-university { margin-top: 3.817rpx; color: var(--cimoa-text-secondary); font-size: 27.672rpx; }
.blocked-action { flex: none; min-height: 76.336rpx; display: flex; align-items: center; padding: 0 30.534rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-profile-icon); font-size: 28.626rpx; font-weight: 700; cursor: pointer; }
</style>
