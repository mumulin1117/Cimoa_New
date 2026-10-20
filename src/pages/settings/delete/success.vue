<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'

const store = use_app_store()
const error = ref('')
const navigating = ref(false)
const cleanup_warning = ref(false)
const deletion = computed(() => store.last_deleted_account)
onLoad(options => { cleanup_warning.value = options?.warning === '1' })
const welcome = async () => { if (navigating.value) return; navigating.value = true; try { await relaunch_route('/pages/auth/welcome') } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
</script>

<template>
  <SecondaryPageFrame class="delete-success-page">
    <view v-if="deletion" class="delete-success-content">
      <view class="delete-success-icon"><view><SourceIcon name="check" :stroke-width="2.4" /></view></view>
      <text class="delete-success-title">Your account was deleted</text>
      <text class="delete-success-copy">Your session and saved private account records have been removed.</text>
      <text v-if="cleanup_warning" class="delete-page-disclosure" role="alert">Some media could not be removed. Clear Cimoa app data before sharing this device.</text>
    </view>
    <view v-else class="delete-page-body delete-success-error" role="alert"><text class="delete-page-title">Account deletion not completed</text><text class="delete-page-copy">This page is available after your account has been deleted.</text></view>
    <template #footer><text v-if="error" class="event-page-error" role="alert">{{ error }}</text><view class="delete-success-footer"><view class="delete-success-return" role="button" tabindex="0" :aria-disabled="navigating" data-interaction="delSuccess.returnToWelcome.click.1" @click="welcome" @keydown.enter="welcome">Return to Welcome</view></view></template>
  </SecondaryPageFrame>
</template>

<style>
@import '../../events/event-pages.css';
@import './delete-pages.css';
</style>
