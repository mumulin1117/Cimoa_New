<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'
import DeleteAccountConfirmDialog from '@/components/DeleteAccountConfirmDialog.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const dialog_error = ref('')
const password = ref('')
const shown = ref(false)
const dialog_open = ref(false)
const account_id = store.session.account_id
const draft_target = `account:${account_id || 'none'}`
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const reason = computed(() => store.current_drafts.find(row => row.kind === 'delete-account' && row.target_id === draft_target)?.payload?.reason || 'No reason selected')
const clear_sensitive = () => { password.value = ''; shown.value = false; dialog_open.value = false; dialog_error.value = '' }
onShow(() => {})
onHide(clear_sensitive)
onUnmounted(clear_sensitive)
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { try { await frame.value.navigate_back('/pages/settings/delete/reason') } catch (cause) { error.value = cause.message } }
const keep_account = async () => { clear_sensitive(); try { await relaunch_route('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const open_confirmation = () => {
  if (access_error.value) return
  error.value = ''
  if (!password.value) { error.value = 'Enter your password before continuing.'; return }
  dialog_error.value = ''
  dialog_open.value = true
}
const confirm_delete = () => {
  dialog_error.value = 'The deletion success page is being restored next. Your account remains active.'
}
</script>

<template>
  <SecondaryPageFrame ref="frame" class="event-page delete-final-page" :scroll-locked="dialog_open">
    <template #header><EventPageHeader title="Confirm deletion" back-interaction="delFinal.goBack.click.1" @back="back" /><text v-if="error" class="event-page-error" role="alert">{{ error }}</text></template>
    <view v-if="access_error" class="delete-page-body"><view class="editor-access" role="alert"><text>{{ access_error }}</text><view class="editor-outline" role="button" @click="recover">Return to account entry</view></view></view>
    <view v-else class="delete-page-body">
      <text class="delete-page-title">Delete your account permanently?</text>
      <text class="delete-page-copy">This removes your access to Cimoa and your remaining coin balance from this device. It cannot be undone.</text>
      <text class="delete-final-reason">Optional reason: {{ reason }}</text>
      <view class="delete-password-block"><text class="delete-password-label">Confirm your password to continue</text><view class="delete-password-box"><input v-model="password" class="delete-password-input" aria-label="Password" placeholder="Password" :password="!shown" :maxlength="128" autocomplete="current-password" data-interaction="delFinal.onPw.change.1" /><view class="delete-password-toggle" role="button" :aria-label="shown ? 'Hide password' : 'Show password'" @click="shown = !shown">{{ shown ? 'Hide' : 'Show' }}</view></view></view>
      <text class="delete-page-disclosure">Deletion is local to this device. No remote account-deletion service is configured.</text>
    </view>
    <template #footer><view v-if="!access_error" class="delete-page-footer"><view class="delete-page-action delete-page-action--secondary" role="button" data-interaction="delFinal.keepAccount.click.1" @click="keep_account">Keep My Account</view><view class="delete-page-action delete-page-action--danger" role="button" data-interaction="delFinal.openDeleteConfirm.click.1" @click="open_confirmation">Delete Account</view></view></template>
    <template #overlays><DeleteAccountConfirmDialog :open="dialog_open" :error="dialog_error" @close="dialog_open = false" @confirm="confirm_delete" /></template>
  </SecondaryPageFrame>
</template>

<style>
@import '../../events/event-pages.css';
@import './delete-pages.css';
</style>
