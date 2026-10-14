<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const account_id = store.session.account_id
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const impacts = computed(() => [
  'Your profile and photos',
  'Your connections and chat history',
  'Your event participation',
  'Your Auto Match history',
  `Your remaining coin balance (${store.coin_balance.toLocaleString('en-US')})`,
])
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const continue_deletion = () => {
  if (access_error.value) return
  error.value = 'The reason step is being restored next. Your account has not changed.'
}
</script>

<template>
  <SecondaryPageFrame ref="frame" class="event-page delete-info-page">
    <template #header><EventPageHeader title="Delete account" back-interaction="delInfo.goBack.click.1" @back="back" /><text v-if="error" class="event-page-error" role="alert">{{ error }}</text></template>
    <view v-if="access_error" class="delete-page-body"><view class="editor-access" role="alert"><text>{{ access_error }}</text><view class="editor-outline" role="button" @click="recover">Return to account entry</view></view></view>
    <view v-else class="delete-page-body">
      <text class="delete-page-title">This removes your account</text>
      <text class="delete-page-copy">Logging out keeps your account. Deleting it is different — it permanently affects:</text>
      <view class="delete-impact-card"><text v-for="impact in impacts" :key="impact">{{ impact }}</text></view>
      <text class="delete-page-disclosure">This local build deletes the account and its private data from this device. It does not send a deletion request to a remote service.</text>
    </view>
    <template #footer><view v-if="!access_error" class="delete-page-footer"><view class="delete-page-action" role="button" data-interaction="delInfo.openDelReason.click.1" @click="continue_deletion">Continue Account Deletion</view><view class="delete-page-action delete-page-action--secondary" role="button" data-interaction="delInfo.keepAccount.click.1" @click="back">Keep My Account</view></view></template>
  </SecondaryPageFrame>
</template>

<style>
@import '../../events/event-pages.css';
@import './delete-pages.css';
</style>
