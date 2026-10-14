<script setup>
import { computed, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import { COIN_ROUTES, require_coin_route_ready } from '@/utils/coinNavigation.js'

const store = use_app_store(), frame = ref(null), request_id = ref(''), navigating = ref(false), error = ref('')
const account_id = store.session.account_id
onLoad(options => { request_id.value = String(options?.purchase_request_id || '') })
const request = computed(() => store.purchase_by_id(request_id.value))
const pack = computed(() => store.coin_package_by_id(request.value?.package_id))
const transaction = computed(() => store.coin_transactions.find(item => item.kind === 'purchase' && item.related_id === request_id.value && item.status === 'completed') || null)
const verified = computed(() => !!request.value && request.value.status === 'success' && !!request.value.receipt_id && !!pack.value?.product_id && !!transaction.value && transaction.value.amount === pack.value.coins)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved purchase data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !request_id.value || !request.value
      ? 'A verified purchase request is required. No coins were added.'
      : !verified.value
        ? 'This request has no verified StoreKit success and cannot be shown as a purchase. No coins were added by this page.'
        : '')
const navigate = async route => {
  if (navigating.value) return
  navigating.value = true; error.value = ''
  try { await frame.value.navigate_replace(require_coin_route_ready(route)) }
  catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
const view_transaction = () => navigate(`${COIN_ROUTES.purchaseDetail}?transaction_id=${encodeURIComponent(transaction.value.transaction_id)}`)
onHide(() => { navigating.value = false; error.value = '' })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-success-page">
    <template #header>
      <view class="success-header">
        <view class="success-back" role="button" aria-label="Back to Coin Store" :aria-disabled="navigating" data-interaction="coinSuccess.backToStore.click.1" @click="navigate(COIN_ROUTES.center)"><SourceIcon name="back" /></view>
        <text>Coins</text>
      </view>
      <text v-if="error" class="success-error" role="alert">{{ error }}</text>
    </template>

    <view class="success-content">
      <view v-if="access_error" class="success-access" role="alert"><SourceIcon name="shield" /><view><text>Purchase success unavailable</text><text>{{ access_error }}</text><text>StoreKit product IDs and receipt verification must be configured before a successful purchase can exist.</text></view></view>
      <template v-else>
        <view class="success-icon"><SourceIcon name="check" /></view>
        <text class="success-title">Coins added</text>
        <text class="success-copy">Your verified purchase added {{ transaction.amount.toLocaleString('en-US') }} coins.</text>
        <view class="success-balance"><text>New balance</text><text>{{ store.coin_balance.toLocaleString('en-US') }}</text></view>
      </template>
    </view>

    <template #footer>
      <view class="success-footer">
        <template v-if="verified">
          <view class="success-primary" role="button" :aria-disabled="navigating" data-interaction="coinSuccess.purchaseDone.click.1" @click="navigate(COIN_ROUTES.center)">Done</view>
          <view class="success-secondary" role="button" :aria-disabled="navigating" data-interaction="coinSuccess.viewTxn.click.1" @click="view_transaction">View transaction</view>
        </template>
        <view class="success-store" role="button" :aria-disabled="navigating" data-interaction="coinSuccess.backToStore.click.1" @click="navigate(COIN_ROUTES.center)">Back to Coin Store</view>
      </view>
    </template>
  </SecondaryPageFrame>
</template>

<style scoped>
.success-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.success-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; padding: 22.901rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; }
.success-header > text { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 700; letter-spacing: -0.025em; pointer-events: none; }
.success-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.success-content { display: flex; min-height: 100%; padding: 83.969rpx 49.618rpx 76.336rpx; flex-direction: column; align-items: center; text-align: center; }
.success-access { display: flex; width: 100%; gap: 22.901rpx; padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-text-title); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); text-align: left; }
.success-access > .source-icon { width: 53.435rpx; height: 53.435rpx; flex: none; color: var(--cimoa-status-danger); }
.success-access > view { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.success-access > view > text:first-child { font-size: 32.443rpx; font-weight: 800; }
.success-access > view > text:nth-child(2) { margin-top: 11.45rpx; color: var(--cimoa-status-danger); font-size: 28.626rpx; line-height: 1.45; }
.success-access > view > text:last-child { margin-top: 15.267rpx; color: var(--cimoa-text-secondary); font-size: 24.809rpx; line-height: 1.45; }
.success-icon { display: flex; align-items: center; justify-content: center; width: 175.572rpx; height: 175.572rpx; padding: 49.618rpx; border-radius: 87.786rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-verification-success); }
.success-title { margin-top: 45.802rpx; font-size: 49.618rpx; line-height: 1.15; font-weight: 900; letter-spacing: -0.025em; }
.success-copy { margin-top: 22.901rpx; max-width: 572.519rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.5; }
.success-balance { display: flex; width: 100%; margin-top: 45.802rpx; padding: 30.534rpx 38.168rpx; align-items: center; justify-content: space-between; border-radius: 38.168rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-coin-hero); box-shadow: var(--cimoa-shadow-card); }
.success-balance > text:first-child { font-size: 28.626rpx; font-weight: 600; }
.success-balance > text:last-child { font-size: 45.802rpx; font-weight: 900; }
.success-footer { display: flex; flex: none; padding: 19.084rpx 38.168rpx 30.534rpx; flex-direction: column; gap: 15.267rpx; }
.success-primary, .success-secondary, .success-store { display: flex; align-items: center; justify-content: center; width: 100%; border-radius: 53.435rpx; font-size: 34.351rpx; font-weight: 700; cursor: pointer; }
.success-primary { height: 106.87rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-auth-action); }
.success-secondary { height: 106.87rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.success-store { height: 76.336rpx; color: var(--cimoa-text-secondary); font-weight: 600; }
</style>
