<script setup>
import { get_locale } from '@/i18n/index.js'

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
const refund = computed(() => detail.value?.mode === 'refund')
const account_scope = use_account_scope(store)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your coin history is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !transaction_id.value || !transaction.value
      ? 'This transaction is unavailable.'
      : !refund.value && (transaction.value.kind !== 'spend' || transaction.value.amount >= 0)
        ? 'This transaction is not a completed coin spend.'
        : '')
const detail_rows = computed(() => access_error.value ? [] : [
  ['Feature', detail.value.feature_label],
  [refund.value ? 'Coins returned' : 'Coins used', Math.abs(transaction.value.amount).toLocaleString(get_locale())],
  ['Date', format_coin_date(transaction.value.created_at)],
  ['Transaction ID', transaction.value.transaction_id],
  ['Status', transaction.value.fixture ? 'Coin activity' : 'Completed'],
])
const navigate = async route => {
  if (navigating.value || route && access_error.value) return
  navigating.value = true; error.value = ''
  try {
    if (!route) await frame.value.navigate_back(coin_child_route(store, COIN_ROUTES.history, return_context_id.value))
    else await frame.value.navigate_forward(require_coin_route_ready(coin_child_route(store, route, return_context_id.value)))
  } catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
onHide(() => { navigating.value = false; error.value = '' })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-spend-detail-page">
    <template #header>
      <view class="spend-header">
        <view class="spend-back" role="button" aria-label="Back" :aria-disabled="navigating" data-interaction="coinSpendDetail.goBack.click.1" @click="navigate()"><SourceIcon name="back" /></view>
        <text>{{ refund ? 'Coin refund' : 'Coin use' }}</text>
      </view>
      <FeedbackToast v-if="error" :message="error" @dismiss="error = String()" />
    </template>

    <view class="spend-content">
      <view v-if="access_error" class="spend-access" role="alert">{{ access_error }}</view>
      <template v-else>
        <view class="spend-hero">
          <view class="spend-icon"><SourceIcon name="lightning" /></view>
          <text>{{ refund ? '+' : '−' }}{{ Math.abs(transaction.amount).toLocaleString(get_locale()) }} Coins</text>
          <text>{{ refund ? 'Returned coins' : transaction.fixture ? 'Coin activity' : 'Completed coin activity' }}</text>
        </view>
        <view class="spend-card">
          <view v-for="row in detail_rows" :key="row[0]" class="spend-row"><text>{{ row[0] }}</text><text>{{ row[1] }}</text></view>
        </view>
        <view class="spend-note"><SourceIcon name="shield" /><text>{{ transaction.fixture ? 'Feature details are unavailable for this activity.' : refund ? 'Returned coins reference the original coin activity. They are not a new App Store purchase.' : 'Coin activity appears only after the linked feature completes.' }}</text></view>
        <view class="spend-support" role="button" :aria-disabled="navigating" data-interaction="coinSpendDetail.openSupport.click.1" @click="navigate(COIN_ROUTES.help)"><SourceIcon name="support" /><text>Coin activity support</text><SourceIcon name="chevron" /></view>
      </template>
    </view>
  </SecondaryPageFrame>
</template>

<style scoped>
.spend-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.spend-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; padding: 22.901rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; }
.spend-header > text { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 800; letter-spacing: -0.025em; pointer-events: none; }
.spend-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.spend-content { padding: 0 38.168rpx 76.336rpx; }
.spend-access { padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 28.626rpx; line-height: 1.45; }
.spend-hero { display: flex; min-height: 274.809rpx; padding: 34.351rpx; flex-direction: column; align-items: center; justify-content: center; border-radius: 49.618rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-coin-hero); box-shadow: var(--cimoa-shadow-coin-hero); }
.spend-icon { display: flex; align-items: center; justify-content: center; width: 106.87rpx; height: 106.87rpx; padding: 28.626rpx 34.351rpx; border-radius: 53.435rpx; color: var(--cimoa-status-coin); background: var(--cimoa-surface-card); }
.spend-hero > text:nth-child(2) { margin-top: 15.267rpx; font-size: 45.802rpx; font-weight: 900; letter-spacing: -0.025em; }
.spend-hero > text:last-child { margin-top: 5.725rpx; font-size: 26.718rpx; font-weight: 600; }
.spend-card { margin-top: 30.534rpx; padding: 7.634rpx 30.534rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.spend-row { display: flex; align-items: flex-start; gap: 30.534rpx; min-height: 95.42rpx; padding: 24.809rpx 0; border-bottom: 1px solid var(--cimoa-surface-event-divider); }
.spend-row:last-child { border-bottom: none; }
.spend-row > text:first-child { width: 190.84rpx; flex: none; color: var(--cimoa-text-secondary); font-size: 26.718rpx; }
.spend-row > text:last-child { flex: 1; min-width: 0; font-size: 28.626rpx; font-weight: 700; text-align: right; overflow-wrap: anywhere; }
.spend-note { display: flex; gap: 22.901rpx; margin-top: 30.534rpx; padding: 30.534rpx; border-radius: 38.168rpx; color: var(--cimoa-text-secondary); background: var(--cimoa-surface-tinted); font-size: 26.718rpx; line-height: 1.45; }
.spend-note .source-icon { width: 41.985rpx; height: 41.985rpx; flex: none; color: var(--cimoa-text-link); }
.spend-support { display: flex; align-items: center; gap: 22.901rpx; min-height: 106.87rpx; margin-top: 30.534rpx; padding: 0 30.534rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); cursor: pointer; }
.spend-support > .source-icon:first-child { width: 45.802rpx; height: 45.802rpx; color: var(--cimoa-text-link); }
.spend-support > text { flex: 1; font-size: 30.534rpx; font-weight: 700; }
.spend-support > .source-icon:last-child { width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-text-profile-chevron); }
</style>
