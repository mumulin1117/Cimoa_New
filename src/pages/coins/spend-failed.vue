<script setup>
import { computed, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'

const store = use_app_store(), frame = ref(null), context_id = ref(''), error = ref(''), navigating = ref(false)
const account_scope = use_account_scope(store, () => { navigating.value = false })
onLoad(options => { context_id.value = String(options?.return_context_id || '') })
const context = computed(() => account_scope.is_current() ? store.current_drafts.find(row => row.draft_id === context_id.value && row.kind === 'coin_spend') : null)
const access_error = computed(() => account_scope.access_error.value || (!context.value ? 'This failed operation is no longer available.' : !['voice_introduction', 'priority_match'].includes(context.value.payload?.kind) ? 'This coin operation is invalid.' : ''))
const destination = computed(() => {
  const p = context.value?.payload
  if (p?.kind === 'voice_introduction') return '/pages/discover/icebreaker/preview?user_id=' + encodeURIComponent(p.user_id) + '&draft_id=' + encodeURIComponent(p.introduction_draft_id) + '&media_id=' + encodeURIComponent(p.audio_id)
  if (p?.kind === 'priority_match') return '/pages/auto-match/searching?match_id=' + encodeURIComponent(p.match_id)
  return '/pages/home/index'
})
const go = async (route, forward = false) => {
  if (navigating.value || access_error.value && route !== '/pages/home/index') return
  navigating.value = true; error.value = ''
  try { if (forward) await frame.value.navigate_forward(route); else await frame.value.navigate_replace(route) }
  catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
const retry = () => go('/pages/coins/processing?return_context_id=' + encodeURIComponent(context_id.value))
const help = () => go('/pages/coins/help', true)
onHide(() => { navigating.value = false })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-spend-failed-page">
    <view class="spend-failed-content">
      <view class="spend-failed-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 7v7M12 17.5v.5" /></svg></view>
      <text class="spend-failed-title">We couldn’t complete that</text>
      <text class="spend-failed-copy">{{ access_error || ('No coins were deducted. Your balance is ' + store.coin_balance + '.') }}</text>
      <text v-if="error" class="flow-error" role="alert">{{ error }}</text>
      <text v-if="access_error" class="flow-error" role="alert">{{ access_error }}</text>
    </view>
    <template #footer>
      <view v-if="!access_error" class="spend-failed-footer">
        <view class="spend-failed-primary" role="button" tabindex="0" :aria-disabled="navigating" data-interaction="coinSpendFailed.retrySpend.click.1" @click="retry" @keydown.enter="retry">Try Again</view>
        <view class="spend-failed-secondary" role="button" tabindex="0" :aria-disabled="navigating" data-interaction="coinSpendFailed.goBack.click.1" @click="go(destination)" @keydown.enter="go(destination)">Return</view>
        <view class="spend-failed-support" role="button" tabindex="0" :aria-disabled="navigating" data-interaction="coinSpendFailed.openCoinHelp.click.1" @click="help" @keydown.enter="help">Contact Support</view>
      </view>
      <view v-else class="spend-failed-footer"><view class="spend-failed-secondary" role="button" tabindex="0" @click="go('/pages/home/index')" @keydown.enter="go('/pages/home/index')">Return Home</view></view>
    </template>
  </SecondaryPageFrame>
</template>

<style scoped>
.spend-failed-content { display: flex; align-items: center; flex-direction: column; gap: 26.718rpx; padding: 251.908rpx 38.168rpx 45.802rpx; text-align: center; }
.spend-failed-icon { display: flex; align-items: center; justify-content: center; flex: none; width: 175.573rpx; height: 175.573rpx; border-radius: 87.786rpx; background: var(--cimoa-surface-coin-spend-error); color: var(--cimoa-text-settings-danger); }
.spend-failed-icon svg { width: 76.336rpx; height: 76.336rpx; }
.spend-failed-title { font-size: 53.435rpx; font-weight: 800; letter-spacing: -.035em; text-wrap: pretty; }
.spend-failed-copy { max-width: 572.519rpx; color: var(--cimoa-text-secondary); font-size: 32.443rpx; text-wrap: pretty; }
.spend-failed-footer { display: flex; flex: none; flex-direction: column; gap: 19.084rpx; padding: 19.084rpx 38.168rpx 57.252rpx; }
.spend-failed-primary, .spend-failed-secondary, .spend-failed-support { display: flex; align-items: center; justify-content: center; flex: none; cursor: pointer; }
.spend-failed-primary { height: 114.504rpx; border-radius: 57.252rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-event-confirm); font-size: 36.26rpx; font-weight: 700; }
.spend-failed-secondary { height: 106.87rpx; border-radius: 53.435rpx; color: var(--cimoa-text-title); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 34.351rpx; font-weight: 600; }
.spend-failed-support { height: 87.786rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; font-weight: 600; }
</style>
