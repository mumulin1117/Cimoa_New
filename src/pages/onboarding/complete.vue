<script setup>
import { ref } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { prepare_main_tab_skeleton } from '@/utils/mainTabSkeleton.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
const frame = ref(null), { store, context, allowed, access_error, error, is_loading, run_with_loading, recover } = use_onboarding('complete', frame)
const enter = async () => {
  if (is_loading.value) return
  error.value = ''
  if (!context.value?.completed) {
    if (!allowed.value) return
    const id = context.value.account_id
    const result = await run_with_loading(scope => store.save_onboarding_step('complete', {}, id, scope))
    if (result.reason === 'cancelled') return
    if (!result.success) { error.value = result.message; return }
    prepare_main_tab_skeleton()
  }
  try { await relaunch_route('/pages/home/index') } catch (cause) { error.value = cause.message }
}
</script>
<template>
  <SecondaryPageFrame ref="frame" class="onboarding-complete-page">
    <view class="notice-content"><view class="notice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></view><text class="notice-title">Your profile is ready</text><text class="notice-copy">Say hi to someone, join the matching pool, or find an event happening this week.</text>
      <text v-if="error || (access_error && !context?.completed)" class="auth-error-box" role="alert">{{ error || access_error }}</text>
    </view>
    <template #footer><view class="notice-footer"><view v-if="!access_error || context?.completed" class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="obComplete.enterApp.click.1" @click="enter" @keydown.enter="enter">Explore Cimoa</view><view v-else class="auth-primary" role="button" tabindex="0" @click="recover" @keydown.enter="recover">Continue account setup</view></view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Finishing your profile…" /></template>
  </SecondaryPageFrame>
</template>
<style>
@import './notice.css';
</style>
<style scoped>
.notice-content { padding-top: 290.076rpx; }
.notice-icon { width: 183.206rpx; height: 183.206rpx; border-radius: 91.603rpx; box-shadow: var(--cimoa-shadow-verification-success); }
.notice-icon svg { width: 83.969rpx; height: 83.969rpx; }
.notice-title { font-size: 59.16rpx; }
.notice-copy { max-width: 553.435rpx; }
.notice-footer { padding-bottom: 64.885rpx; }
</style>
