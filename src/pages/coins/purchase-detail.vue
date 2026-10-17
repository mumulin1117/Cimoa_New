<script setup>
import { computed, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import { COIN_ROUTES, require_coin_route_ready } from '@/utils/coinNavigation.js'
import { format_coin_date } from '@/utils/coinHistory.js'
import { coin_child_route } from '@/utils/coinReturnContext.js'

const store = use_app_store(), frame = ref(null), transaction_id = ref(''), navigating = ref(false), error = ref('')
const account_id = store.session.account_id
const return_context_id = ref('')
onLoad(options => { transaction_id.value = String(options?.transaction_id || ''); return_context_id.value = String(options?.return_context_id || '') })
const detail = computed(() => store.coin_ledger_detail(transaction_id.value))
const transaction = computed(() => detail.value?.transaction)
const request = computed(() => detail.value?.request)
const pack = computed(() => detail.value?.pack)
const is_verified_purchase = computed(() => detail.value?.verified_purchase)
const account_scope = use_account_scope(store)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved coin data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !transaction_id.value || !transaction.value
      ? 'This purchase record is unavailable.'
      : transaction.value.kind !== 'purchase' || transaction.value.amount <= 0
        ? 'This record is not a coin purchase.'
        : '')
const detail_rows = computed(() => access_error.value ? [] : [
  ['Package', pack.value ? `${pack.value.coins.toLocaleString('en-US')} Coins` : `${transaction.value.amount.toLocaleString('en-US')} Coins`],
  ['Amount paid', is_verified_purchase.value ? pack.value.price : 'No Apple payment recorded'],
  ['Date', format_coin_date(transaction.value.created_at)],
  ['Transaction ID', transaction.value.transaction_id],
  ['Status', is_verified_purchase.value ? 'Verified purchase' : 'Recorded credit'],
])
const navigate = async route => {
  if (navigating.value || route && access_error.value) return
  navigating.value = true; error.value = ''
  try {
    const context_id = return_context_id.value || request.value?.return_context_id
    if (!route) await frame.value.navigate_back(coin_child_route(store, COIN_ROUTES.history, context_id))
    else await frame.value.navigate_forward(require_coin_route_ready(coin_child_route(store, route, context_id)))
  } catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
onHide(() => { navigating.value = false; error.value = '' })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-purchase-detail-page">
    <template #header>
      <view class="detail-header">
        <view class="detail-back" role="button" aria-label="Back" :aria-disabled="navigating" data-interaction="coinPurchaseDetail.goBack.click.1" @click="navigate()"><SourceIcon name="back" /></view>
        <text>{{ detail?.mode === 'credit' ? 'Coin credit' : 'Purchase' }}</text>
      </view>
      <text v-if="error" class="detail-error" role="alert">{{ error }}</text>
    </template>

    <view class="detail-content">
      <view v-if="access_error" class="detail-access" role="alert">{{ access_error }}</view>
      <template v-else>
        <view class="detail-hero">
          <image src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" />
          <text>{{ transaction.amount.toLocaleString('en-US') }} Coins</text>
          <text>{{ is_verified_purchase ? 'Verified App Store purchase' : 'Starting coin balance' }}</text>
        </view>
        <view class="detail-card">
          <view v-for="row in detail_rows" :key="row[0]" class="detail-row"><text>{{ row[0] }}</text><text>{{ row[1] }}</text></view>
        </view>
        <view class="detail-note"><SourceIcon name="shield" /><text>{{ is_verified_purchase ? 'Payment is handled by Apple. Cimoa does not store card or Apple account details.' : 'This balance entry does not represent an Apple charge and has no StoreKit receipt.' }}</text></view>
        <view class="detail-support" role="button" :aria-disabled="navigating" data-interaction="coinPurchaseDetail.openSupport.click.1" @click="navigate(COIN_ROUTES.help)"><SourceIcon name="support" /><text>Purchase support</text><SourceIcon name="chevron" /></view>
      </template>
    </view>
  </SecondaryPageFrame>
</template>

<style scoped>
.detail-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.detail-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; padding: 22.901rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; }
.detail-header > text { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 800; letter-spacing: -0.025em; pointer-events: none; }
.detail-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.detail-content { padding: 0 38.168rpx 76.336rpx; }
.detail-access { padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 28.626rpx; line-height: 1.45; }
.detail-hero { display: flex; min-height: 274.809rpx; padding: 34.351rpx; flex-direction: column; align-items: center; justify-content: center; border-radius: 49.618rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-coin-hero); box-shadow: var(--cimoa-shadow-coin-hero); }
.detail-hero image { width: 106.87rpx; height: 106.87rpx; }
.detail-hero > text:nth-child(2) { margin-top: 11.45rpx; font-size: 45.802rpx; font-weight: 900; letter-spacing: -0.025em; }
.detail-hero > text:last-child { margin-top: 5.725rpx; font-size: 26.718rpx; font-weight: 600; }
.detail-card { margin-top: 30.534rpx; padding: 7.634rpx 30.534rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.detail-row { display: flex; align-items: flex-start; gap: 30.534rpx; min-height: 95.42rpx; padding: 24.809rpx 0; border-bottom: 1px solid var(--cimoa-surface-event-divider); }
.detail-row:last-child { border-bottom: none; }
.detail-row > text:first-child { width: 190.84rpx; flex: none; color: var(--cimoa-text-secondary); font-size: 26.718rpx; }
.detail-row > text:last-child { flex: 1; min-width: 0; font-size: 28.626rpx; font-weight: 700; text-align: right; overflow-wrap: anywhere; }
.detail-note { display: flex; gap: 22.901rpx; margin-top: 30.534rpx; padding: 30.534rpx; border-radius: 38.168rpx; color: var(--cimoa-text-secondary); background: var(--cimoa-surface-tinted); font-size: 26.718rpx; line-height: 1.45; }
.detail-note .source-icon { width: 41.985rpx; height: 41.985rpx; flex: none; color: var(--cimoa-text-link); }
.detail-support { display: flex; align-items: center; gap: 22.901rpx; min-height: 106.87rpx; margin-top: 30.534rpx; padding: 0 30.534rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); cursor: pointer; }
.detail-support > .source-icon:first-child { width: 45.802rpx; height: 45.802rpx; color: var(--cimoa-text-link); }
.detail-support > text { flex: 1; font-size: 30.534rpx; font-weight: 700; }
.detail-support > .source-icon:last-child { width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-text-profile-chevron); }
</style>
