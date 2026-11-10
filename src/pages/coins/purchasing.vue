<script setup>
import { get_locale } from '@/i18n/index.js'

import { computed, onUnmounted, ref, watch } from 'vue'
import { onHide, onLoad, onReady, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import CoinActionLoading from '@/components/CoinActionLoading.vue'
import { watch_purchase, suspend_purchase_request } from '@/utils/iapBridge.js'
import { reconcile_purchase_result, refresh_purchase_recovery, abandon_interrupted_purchase } from '@/utils/nativePurchases.js'
import PurchaseRecoveryConfirmDialog from '@/components/PurchaseRecoveryConfirmDialog.vue'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { COIN_ROUTES, require_coin_route_ready } from '@/utils/coinNavigation.js'
import { coin_center_route } from '@/utils/coinReturnContext.js'
import { MOTION } from '@/config/navigation.js'

const store = use_app_store(), frame = ref(null), request_id = ref(''), navigating = ref(false), error = ref(''), resolving = ref(false), release_open = ref(false), account_id = store.session.account_id
const is_loading = computed(() => resolving.value)
let active = true, started = false, ready = false, generation = 0
const leave = () => { active = false; generation++; started = false; resolving.value = false; release_open.value = false; suspend_purchase_request(request_id.value) }
const account_scope = use_account_scope(store, leave)
onLoad(options => { request_id.value = String(options?.purchase_request_id || '') })
const request = computed(() => store.purchase_by_id(request_id.value))
const pack = computed(() => store.coin_package_by_id(request.value?.package_id))
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your purchase details are unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !request_id.value || !request.value
      ? 'This purchase request is unavailable. No coins were added.'
      : '')
const pending = computed(() => request.value?.status === 'pending')
const interrupted = computed(() => pending.value && request.value?.phase === 'interrupted')
const purchase_title = computed(() => interrupted.value ? 'Purchase needs your attention' : request.value?.accepted_at ? 'Waiting for the App Store…' : 'Connecting to the App Store…')
const purchase_copy = computed(() => interrupted.value ? 'The App Store was interrupted before a final result. Check your Apple purchase history before starting another purchase. The original may still complete.' : request.value?.accepted_at ? 'Your purchase is being handled by Apple. You can leave this page and return later. Verified coins will be added once.' : 'Waiting for the App Store to accept this request. No coins have been added.')
const status_message = computed(() => {
  if (pending.value) return ''
  if (request.value?.status === 'cancelled') return 'This purchase was cancelled. Your balance is unchanged.'
  if (request.value?.status === 'timeout') return 'The App Store did not respond in time. No coins were added.'
  if (request.value?.status === 'failure') return 'This purchase could not be completed. No coins were added.'
  if (request.value?.status === 'success') return 'This purchase was verified and completed.'
  return 'This purchase is no longer pending.'
})
const result_route = status => status === 'success' ? '/pages/coins/success' : status === 'cancelled' ? '/pages/coins/cancelled' : '/pages/coins/failed'
const navigate_result = async status => {
  if (!active || navigating.value || access_error.value || !['success', 'failure', 'cancelled', 'timeout'].includes(status)) return
  navigating.value = true
  try { await frame.value.navigate_replace(require_coin_route_ready(`${result_route(status)}?purchase_request_id=${encodeURIComponent(request_id.value)}`)) }
  catch (cause) { error.value = `${status_message.value} ${cause.message}` }
  finally { navigating.value = false }
}
const finish = async result => {
  if (!active || access_error.value || result.status === 'interrupted') return
  const token = generation
  const settled = await reconcile_purchase_result(store, result)
  if (token !== generation) return
  if (!active || settled.reason === 'cancelled') return
  if (!settled.success) { error.value = settled.message; return }
  if (!pending.value) await navigate_result(request.value.status)
}
const start = async () => {
  if (!ready || !active || started || access_error.value || !pack.value) return
  if (!pending.value) { await navigate_result(request.value.status); return }
  started = true; error.value = ''
  const token = generation
  // Resolve the durable native state before installing an old acknowledgement
  // deadline. A payment sheet may have hidden the app before H5 wrote accepted.
  await refresh_purchase_recovery(store)
  if (token !== generation || !active || access_error.value) return
  if (!pending.value) { await navigate_result(request.value.status); return }
  const result = await watch_purchase(request.value, pack.value)
  if (token !== generation) return
  await finish(result)
}
const cancel = () => {
  if (navigating.value || is_loading.value) return
  if (access_error.value) return
  // Leaving the page never claims to cancel an accepted Apple payment.
  navigate_store()
}
const release = async () => {
  if (resolving.value || !interrupted.value || !request.value.can_abandon_interrupted) return
  resolving.value = true; error.value = ''
  const token = generation, result = await abandon_interrupted_purchase(store, request.value)
  if (token !== generation || !active) return
  resolving.value = false
  if (!result.success) { error.value = result.message || 'This purchase is still being checked. Please try again later.'; return }
  release_open.value = false
  await navigate_store()
}
const navigate_store = async () => {
  if (navigating.value || is_loading.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_back(coin_center_route(store, request.value?.return_context_id)) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
onReady(() => { ready = true; start() })
onShow(() => { active = true; start() })
onHide(() => { navigating.value = false; leave() })
onUnmounted(leave)
watch(() => request.value?.status, status => { if (ready && active && status && status !== 'pending' && request.value?.phase !== 'abandoned') navigate_result(status) })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-purchasing-page" :style="{ '--coin-pulse-duration': `${MOTION.coin_pulse}ms` }">
    <template #header><view class="purchase-header"><view class="purchase-back" role="button" tabindex="0" aria-label="Back" :aria-disabled="is_loading || navigating" data-interaction="coinPurchasing.goBack.click.1" @click="cancel" @keydown.enter="cancel"><SourceIcon name="back" /></view><text>Coins</text></view><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
    <view class="purchase-content">
      <view v-if="access_error" class="purchase-access" role="alert">{{ access_error }}</view>
      <template v-else-if="pack">
        <view class="purchase-package"><image src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" /><view><text>{{ (request.coins || pack.coins).toLocaleString(get_locale()) }} Coins</text><text>Selected package</text></view><text>{{ request.display_price || 'Price unavailable' }}</text></view>
        <view class="purchase-status">
          <view v-if="pending" class="purchase-pulse" aria-hidden="true" />
          <view v-else class="purchase-status-icon"><SourceIcon :name="request.status === 'success' ? 'check' : 'blocked'" /></view>
          <text>{{ pending ? purchase_title : 'Purchase request finished' }}</text>
          <text>{{ pending ? purchase_copy : status_message }}</text>
          <view v-if="interrupted && request.can_abandon_interrupted" class="purchase-cancel" role="button" tabindex="0" :aria-disabled="resolving" data-interaction="coinPurchasing.reviewInterrupted.click.1" @click="!resolving && (release_open = true)" @keydown.enter="!resolving && (release_open = true)">Review interrupted request</view>
          <text v-if="pending && !pack.product_id" class="purchase-note">This purchase is currently unavailable. Your balance will not change if it fails or times out.</text>
        </view>
      </template>
    </view>
    <template #footer><view v-if="!access_error" class="purchase-footer"><view class="purchase-cancel" role="button" tabindex="0" :aria-disabled="is_loading || navigating" data-interaction="coinPurchasing.backToStore.click.1" @click="cancel" @keydown.enter="cancel">Back to Coin Store</view></view></template>
    <template #overlays><PurchaseRecoveryConfirmDialog :open="release_open" :busy="resolving" :error="error" @close="!resolving && (release_open = false)" @confirm="release" /><CoinActionLoading :visible="is_loading" label="Checking purchase…" /></template>
  </SecondaryPageFrame>
</template>

<style scoped>
.purchase-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.purchase-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; padding: 22.901rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; }
.purchase-header > text { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 700; letter-spacing: -0.025em; pointer-events: none; }
.purchase-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.purchase-content { padding: 61.069rpx 38.168rpx 76.336rpx; }
.purchase-package { display: flex; align-items: center; gap: 26.718rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.purchase-package > image { width: 80.153rpx; height: 80.153rpx; flex: none; }
.purchase-package > view { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.purchase-package > view > text:first-child { font-size: 38.168rpx; font-weight: 800; letter-spacing: -0.025em; }
.purchase-package > view > text:last-child { margin-top: 3.817rpx; color: var(--cimoa-text-secondary); font-size: 28.626rpx; }
.purchase-package > text { font-size: 34.351rpx; font-weight: 700; }
.purchase-status { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; margin-top: 76.336rpx; text-align: center; }
.purchase-pulse { width: 141.221rpx; height: 141.221rpx; border-radius: 70.611rpx; background: var(--cimoa-gradient-primary); opacity: .9; animation: coin-pulse var(--coin-pulse-duration) ease-in-out infinite; }
.purchase-status-icon { display: flex; align-items: center; justify-content: center; width: 141.221rpx; height: 141.221rpx; padding: 38.168rpx; border-radius: 70.611rpx; color: var(--cimoa-text-secondary); background: var(--cimoa-surface-skeleton); }
.purchase-status > text:nth-of-type(1) { font-size: 36.26rpx; font-weight: 700; }
.purchase-status > text:nth-of-type(2) { max-width: 534.351rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.45; }
.purchase-status > .purchase-note { max-width: 572.519rpx; padding: 22.901rpx; border-radius: 30.534rpx; color: var(--cimoa-text-auth-placeholder); background: var(--cimoa-surface-card); font-size: 24.809rpx; line-height: 1.4; }
.purchase-access { padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 28.626rpx; line-height: 1.45; }
.purchase-footer { flex: none; padding: 19.084rpx 38.168rpx 64.885rpx; }
.purchase-cancel { display: flex; align-items: center; justify-content: center; height: 106.87rpx; border-radius: 53.435rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 34.351rpx; font-weight: 600; cursor: pointer; }
@keyframes coin-pulse { 0%, 100% { transform: scale(.94); opacity: .16; } 50% { transform: scale(1.04); opacity: .3; } }
</style>
