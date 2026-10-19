<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import EventConfirmDialog from '@/components/EventConfirmDialog.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const dialog_error = ref('')
const target_id = ref(null)
const target_kind = ref('user')
const account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true

const account_scope = use_account_scope(store, () => { cancel_loading(); target_id.value = null; target_kind.value = 'user'; dialog_error.value = '' })
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const blocked = computed(() => store.blocked_accounts)
const organizers = computed(() => account_scope.is_current() ? store.blocked_organizers : [])
const target = computed(() => target_kind.value === 'organizer' ? organizers.value.find(row => row.organizer_id === target_id.value) || null : blocked.value.find(user => user.user_id === target_id.value) || null)
const target_name = computed(() => target_kind.value === 'organizer' ? target.value?.name : target.value?.user_name)
const leave = () => { active = false; target_id.value = null; target_kind.value = 'user'; dialog_error.value = ''; cancel_loading() }
onShow(() => { active = true })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const open_unblock = (row, kind = 'user') => { if (is_loading.value || access_error.value) return; error.value = ''; dialog_error.value = ''; target_kind.value = kind; target_id.value = kind === 'organizer' ? row.organizer_id : row.user_id }
const close_unblock = () => { if (!is_loading.value) { target_id.value = null; dialog_error.value = '' } }
const confirm_unblock = async () => {
  if (is_loading.value || !target.value || access_error.value) return
  dialog_error.value = ''
  const kind = target_kind.value, id = target_id.value
  const result = await run_with_loading(() => kind === 'organizer' ? store.unblock_organizer(id) : store.unblock_user(id))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { dialog_error.value = result.message || (kind === 'organizer' ? 'This organizer could not be unblocked.' : 'This account could not be unblocked.'); return }
  target_id.value = null
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-blocked-page" title="Blocked accounts" source="blockedList" :busy="is_loading" :loading-label="target_kind === 'organizer' ? 'Unblocking organizer…' : 'Unblocking account…'" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <view v-if="blocked.length" class="settings-page-stack blocked-stack">
      <view v-for="user in blocked" :key="user.user_id" class="blocked-card">
        <view class="blocked-avatar"><ProfilePhoto :src="user.avatar_url" :name="user.user_name" portrait /></view>
        <view class="blocked-copy"><text class="blocked-name">{{ user.user_name }}</text><text class="blocked-university">{{ user.university || 'University not shown' }}</text></view>
        <view class="blocked-action" role="button" tabindex="0" :aria-label="`Unblock ${user.user_name}`" data-interaction="blockedList.b.unblock.click.1" @click="open_unblock(user)" @keydown.enter="open_unblock(user)">Unblock</view>
      </view>
    </view>
    <view v-else-if="!organizers.length" class="settings-page-empty"><text class="settings-page-empty-title">No blocked accounts</text><text class="settings-page-empty-copy">Accounts you unblock can appear again where their privacy settings allow, but old connections and chats stay deleted.</text></view>
    <template v-if="organizers.length">
      <text class="settings-page-section-title blocked-organizers-title">Blocked organizers</text>
      <view class="settings-page-stack blocked-stack">
        <view v-for="organizer in organizers" :key="organizer.organizer_id" class="blocked-card blocked-organizer-card" :data-organizer-id="organizer.organizer_id">
          <view class="blocked-avatar blocked-organizer-icon"><SourceIcon name="university" /></view>
          <view class="blocked-copy"><text class="blocked-name">{{ organizer.name }}</text><text class="blocked-university">Event organizer</text></view>
          <view class="blocked-action" role="button" tabindex="0" :aria-label="`Unblock ${organizer.name}`" :aria-disabled="is_loading" data-interaction="blockedList.organizer.unblock.click.1" @click="open_unblock(organizer, 'organizer')" @keydown.enter="open_unblock(organizer, 'organizer')">Unblock</view>
        </view>
      </view>
    </template>
    <template #overlays>
      <EventConfirmDialog :open="!!target" :busy="is_loading" :label="target ? `Unblock ${target_name}?` : 'Unblock account'" close-interaction="unblockOpen.closeUnblock.click.1" style="--event-dialog-bottom: var(--app-safe-bottom);" @close="close_unblock">
        <text class="event-dialog-title">Unblock {{ target_name }}?</text>
        <text class="event-dialog-copy">{{ target_kind === 'organizer' ? 'Events from this organizer can be recommended again. Your event attendance and group chats will not change.' : 'This does not restore your previous connection, chat history, pending request, or Auto Match record.' }}</text>
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
.blocked-organizers-title { margin: 38.168rpx 0 19.084rpx; }
.blocked-card { display: flex; align-items: center; gap: 22.901rpx; min-height: 152.672rpx; padding: 26.718rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.blocked-avatar { position: relative; flex: none; width: 99.237rpx; height: 99.237rpx; border-radius: 49.618rpx; overflow: hidden; }
.blocked-organizer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22.901rpx;
  background: var(--cimoa-surface-profile-icon);
  color: var(--cimoa-text-title);
}
.blocked-copy { flex: 1; min-width: 0; }
.blocked-name, .blocked-university { display: block; overflow-wrap: anywhere; }
.blocked-name { font-size: 34.351rpx; font-weight: 800; letter-spacing: -0.02em; }
.blocked-university { margin-top: 3.817rpx; color: var(--cimoa-text-secondary); font-size: 27.672rpx; }
.blocked-action { flex: none; min-height: 76.336rpx; display: flex; align-items: center; padding: 0 30.534rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-profile-icon); font-size: 28.626rpx; font-weight: 700; cursor: pointer; }
</style>
