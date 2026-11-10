<script setup>
import { get_locale } from '@/i18n/index.js'

import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store, make_operation_id } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import CoinActionLoading from '@/components/CoinActionLoading.vue'
import { COIN_ROUTES, require_coin_route_ready } from '@/utils/coinNavigation.js'
import { coin_center_route } from '@/utils/coinReturnContext.js'
import { watch_purchase } from '@/utils/iapBridge.js'
import { create_purchase_page_scope } from '@/utils/nativePurchases.js'

const store = use_app_store(), frame = ref(null), request_id = ref(''), navigating = ref(false), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const account_id = store.session.account_id
onLoad(options => { request_id.value = String(options?.purchase_request_id || '') })
const request = computed(() => store.purchase_by_id(request_id.value))
const pack = computed(() => store.coin_package_by_id(request.value?.package_id))
const account_scope = use_account_scope(store, cancel_loading)
const entry_scope = create_purchase_page_scope(account_scope.is_current)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your purchase details are unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !request_id.value || !request.value
      ? 'This purchase request is unavailable. No coins were added.'
      : !['failure', 'timeout'].includes(request.value.status)
        ? 'This purchase request does not have a failed result. No balance change was made.'
        : !pack.value
          ? 'The package for this purchase is unavailable. No coins were added.'
          : '')
const result_copy = computed(() => request.value?.status === 'timeout'
  ? 'The App Store did not confirm acceptance in time. No coins have been added for this request. If Apple later completes it, Cimoa will check and add the verified coins once.'
  : 'No coins have been added for this request. Check your Apple purchase history before trying again. Any purchase that later completes will be checked when you return.')

const replace = async route => {
  if (navigating.value || is_loading.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_replace(require_coin_route_ready(route)) }
  catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
const retry = async () => {
  if (!entry_scope.is_current() || navigating.value || is_loading.value || access_error.value) return
  const pending = store.current_purchase_requests.find(item => item.status === 'pending')
  if (pending) { replace(`${COIN_ROUTES.purchasing}?purchase_request_id=${encodeURIComponent(pending.request_id)}`); return }
  const token = entry_scope.capture()
  navigating.value = true
  const catalog = await store.load_purchase_catalog()
  if (!entry_scope.is_current(token)) return
  navigating.value = false
  if (!catalog.success || !pack.value?.available) { error.value = 'This coin package is currently unavailable. Please return to the coin store.'; return }
  error.value = ''
  run_with_loading(() => entry_scope.guard(token, () => store.begin_purchase(pack.value.package_id, make_operation_id('purchase-retry'), request.value?.return_context_id || null))).then(result => {
    if (!entry_scope.is_current(token)) return
    if (result.reason === 'cancelled') return
    if (!result.success) { error.value = result.message; return }
    const created = store.purchase_by_id(result.data)
    if (created && !access_error.value) watch_purchase(created, store.coin_package_by_id(created.package_id), true)
    replace(`${COIN_ROUTES.purchasing}?purchase_request_id=${encodeURIComponent(result.data)}`)
  })
}
const open_help = async () => {
  if (navigating.value || is_loading.value || access_error.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_forward(require_coin_route_ready(COIN_ROUTES.help)) }
  catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
const back_to_store = async () => {
  if (navigating.value || is_loading.value) return
  navigating.value = true
  try { await frame.value.navigate_back(coin_center_route(store, request.value?.return_context_id)) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const leave = () => { entry_scope.hide(); navigating.value = false; cancel_loading() }
onShow(entry_scope.show)
onHide(leave)
onUnmounted(leave)
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-failed-page">
    <template #header>
      <view class="failed-header">
        <view class="failed-back" role="button" aria-label="Back to Coin Store" :aria-disabled="navigating || is_loading" data-interaction="coinFailed.backToStore.click.1" @click="back_to_store"><SourceIcon name="back" /></view>
        <text>Coins</text>
      </view>
      <FeedbackToast v-if="error" :message="error" @dismiss="error = String()" />
    </template>

    <view class="failed-content">
      <view v-if="access_error" class="failed-access" role="alert">{{ access_error }}</view>
      <template v-else>
        <view class="failed-icon"><SourceIcon name="blocked" /></view>
        <text class="failed-title">Purchase couldn’t be completed</text>
        <text class="failed-copy">{{ result_copy }}</text>
        <view class="failed-reference">
          <text>{{ (request.coins || pack.coins).toLocaleString(get_locale()) }} Coins · {{ request.display_price || 'Price unavailable' }}</text>
          <text>Request {{ request.request_id }}</text>
        </view>
      </template>
    </view>

    <template #footer>
      <view v-if="!access_error" class="failed-footer">
        <view class="failed-primary" role="button" :aria-disabled="navigating || is_loading" data-interaction="coinFailed.tryAgainPurchase.click.1" @click="retry">Try Again</view>
        <view class="failed-secondary" role="button" :aria-disabled="navigating || is_loading" data-interaction="coinFailed.openCoinHelp.click.1" @click="open_help">Contact Support</view>
        <view class="failed-cancel" role="button" :aria-disabled="navigating || is_loading" data-interaction="coinFailed.backToStore.click.1" @click="back_to_store">Cancel</view>
      </view>
    </template>
    <template #overlays><CoinActionLoading :visible="is_loading" label="Preparing purchase…" /></template>
  </SecondaryPageFrame>
</template>

<style scoped>
.failed-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.failed-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; padding: 22.901rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; }
.failed-header > text { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 700; letter-spacing: -0.025em; pointer-events: none; }
.failed-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.failed-content { display: flex; min-height: 100%; padding: 83.969rpx 49.618rpx 76.336rpx; flex-direction: column; align-items: center; text-align: center; }
.failed-icon { display: flex; align-items: center; justify-content: center; width: 175.572rpx; height: 175.572rpx; padding: 43.893rpx; border-radius: 87.786rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.failed-title { margin-top: 45.802rpx; max-width: 610.687rpx; font-size: 45.802rpx; line-height: 1.15; font-weight: 800; letter-spacing: -0.025em; }
.failed-copy { margin-top: 22.901rpx; max-width: 595.42rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.5; }
.failed-reference { display: flex; width: 100%; margin-top: 45.802rpx; padding: 30.534rpx; flex-direction: column; gap: 9.542rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); text-align: left; }
.failed-reference > text:first-child { font-size: 30.534rpx; font-weight: 700; }
.failed-reference > text:last-child { color: var(--cimoa-text-auth-placeholder); font-size: 22.901rpx; line-height: 1.4; overflow-wrap: anywhere; }
.failed-access { width: 100%; padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 28.626rpx; line-height: 1.45; text-align: left; }
.failed-footer { display: flex; flex: none; padding: 19.084rpx 38.168rpx 30.534rpx; flex-direction: column; gap: 15.267rpx; }
.failed-primary, .failed-secondary, .failed-cancel { display: flex; align-items: center; justify-content: center; width: 100%; height: 106.87rpx; border-radius: 53.435rpx; font-size: 34.351rpx; font-weight: 700; cursor: pointer; }
.failed-primary { background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-auth-action); color: var(--cimoa-text-inverse); }
.failed-secondary { background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.failed-cancel { height: 68.702rpx; color: var(--cimoa-text-secondary); font-weight: 600; }
</style>
