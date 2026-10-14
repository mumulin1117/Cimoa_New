<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onReady } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import CoinActionLoading from '@/components/CoinActionLoading.vue'
import { request_purchase, cancel_purchase_request } from '@/utils/iapBridge.js'
import { COIN_ROUTES, require_coin_route_ready } from '@/utils/coinNavigation.js'

const store = use_app_store(), frame = ref(null), request_id = ref(''), navigating = ref(false), error = ref(''), resolving = ref(false), account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true, started = false
onLoad(options => { request_id.value = String(options?.purchase_request_id || '') })
const request = computed(() => store.purchase_by_id(request_id.value))
const pack = computed(() => store.coin_package_by_id(request.value?.package_id))
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved purchase data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !request_id.value || !request.value
      ? 'This purchase request is unavailable. No coins were added.'
      : '')
const pending = computed(() => request.value?.status === 'pending')
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
  try { await frame.value.navigate_replace(require_coin_route_ready(`${result_route(status)}?purchase_request_id=${encodeURIComponent(request_id.value)}`)) }
  catch (cause) { error.value = `${status_message.value} ${cause.message}` }
}
const finish = async result => {
  if (!active || resolving.value || !pending.value) return
  resolving.value = true
  const settled = await run_with_loading(() => store.settle_purchase(request_id.value, result))
  resolving.value = false
  if (!active || settled.reason === 'cancelled') return
  if (!settled.success) { error.value = settled.message; return }
  await navigate_result(settled.data.status)
}
const start = async () => {
  if (started || access_error.value || !pending.value || !pack.value) return
  started = true; error.value = ''
  const result = await request_purchase({ request_id: request_id.value, package_id: pack.value.package_id, owner_user_id: store.current_user.user_id, product_id: pack.value.product_id })
  await finish(result)
}
const cancel = () => {
  if (navigating.value || is_loading.value) return
  if (pending.value) { cancel_purchase_request(request_id.value); return }
  navigate_store()
}
const navigate_store = async () => {
  if (navigating.value || is_loading.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_replace(COIN_ROUTES.center) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
onReady(() => { if (!pending.value && !access_error.value) navigate_result(request.value.status); else start() })
onHide(() => { navigating.value = false })
onUnmounted(() => { active = false; cancel_loading() })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-purchasing-page">
    <template #header><view class="purchase-header"><view class="purchase-back" role="button" aria-label="Back" :aria-disabled="is_loading || navigating" data-interaction="coinPurchasing.goBack.click.1" @click="cancel"><SourceIcon name="back" /></view><text>Coins</text></view><text v-if="error" class="purchase-error" role="alert">{{ error }}</text></template>
    <view class="purchase-content">
      <view v-if="access_error" class="purchase-access" role="alert">{{ access_error }}</view>
      <template v-else-if="pack">
        <view class="purchase-package"><image src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" /><view><text>{{ pack.coins.toLocaleString('en-US') }} Coins</text><text>Selected package</text></view><text>{{ pack.price }}</text></view>
        <view class="purchase-status">
          <view v-if="pending" class="purchase-pulse" aria-hidden="true" />
          <view v-else class="purchase-status-icon"><SourceIcon :name="request.status === 'success' ? 'check' : 'blocked'" /></view>
          <text>{{ pending ? 'Connecting to the App Store…' : 'Purchase request finished' }}</text>
          <text>{{ pending ? 'Nothing has been charged yet and no coins have been added.' : status_message }}</text>
          <text v-if="pending && !pack.product_id" class="purchase-note">This build has no StoreKit product ID. The native host will return failure; a browser will wait for the full timeout.</text>
        </view>
      </template>
    </view>
    <template #footer><view v-if="!access_error" class="purchase-footer"><view class="purchase-cancel" role="button" :aria-disabled="is_loading || navigating" data-interaction="coinPurchasing.backToStore.click.1" @click="cancel">{{ pending ? 'Cancel' : 'Back to Coin Store' }}</view></view></template>
    <template #overlays><CoinActionLoading :visible="is_loading" label="Finalizing purchase result…" /></template>
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
.purchase-pulse { width: 141.221rpx; height: 141.221rpx; border-radius: 70.611rpx; background: var(--cimoa-gradient-primary); opacity: .9; animation: coin-pulse 1800ms ease-in-out infinite; }
.purchase-status-icon { display: flex; align-items: center; justify-content: center; width: 141.221rpx; height: 141.221rpx; padding: 38.168rpx; border-radius: 70.611rpx; color: var(--cimoa-text-secondary); background: var(--cimoa-surface-skeleton); }
.purchase-status > text:nth-of-type(1) { font-size: 36.26rpx; font-weight: 700; }
.purchase-status > text:nth-of-type(2) { max-width: 534.351rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.45; }
.purchase-status > .purchase-note { max-width: 572.519rpx; padding: 22.901rpx; border-radius: 30.534rpx; color: var(--cimoa-text-auth-placeholder); background: var(--cimoa-surface-card); font-size: 24.809rpx; line-height: 1.4; }
.purchase-access { padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 28.626rpx; line-height: 1.45; }
.purchase-footer { flex: none; padding: 19.084rpx 38.168rpx 64.885rpx; }
.purchase-cancel { display: flex; align-items: center; justify-content: center; height: 106.87rpx; border-radius: 53.435rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 34.351rpx; font-weight: 600; cursor: pointer; }
@keyframes coin-pulse { 0%, 100% { transform: scale(.86); opacity: .58; } 50% { transform: scale(1); opacity: .92; } }
</style>
