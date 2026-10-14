<script setup>
import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import { COIN_ROUTES, require_coin_route_ready } from '@/utils/coinNavigation.js'
import { build_coin_history } from '@/utils/coinHistory.js'

const filters = Object.freeze([{ id: 'all', label: 'All' }, { id: 'purchases', label: 'Purchases' }, { id: 'used', label: 'Used' }])
const store = use_app_store(), frame = ref(null), active_filter = ref('all'), navigating = ref(false), error = ref('')
const account_id = store.session.account_id
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved coin data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const history = computed(() => build_coin_history(store.coin_transactions, store.current_purchase_requests, store.coin_packages))
const visible_history = computed(() => active_filter.value === 'all' ? history.value : history.value.filter(item => item.filter === active_filter.value))
const choose_filter = id => { if (!navigating.value) { active_filter.value = id; error.value = '' } }
const navigate = async route => {
  if (navigating.value) return
  navigating.value = true; error.value = ''
  try {
    if (!route) await frame.value.navigate_back(COIN_ROUTES.center)
    else await frame.value.navigate_forward(require_coin_route_ready(route))
  } catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
onHide(() => { navigating.value = false; error.value = '' })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-history-page">
    <template #header>
      <view class="history-header">
        <view class="history-back" role="button" aria-label="Back" :aria-disabled="navigating" data-interaction="coinHistory.goBack.click.1" @click="navigate()"><SourceIcon name="back" /></view>
        <text>Transactions</text>
      </view>
      <text v-if="error" class="history-error" role="alert">{{ error }}</text>
    </template>

    <view class="history-content">
      <view v-if="access_error" class="history-access" role="alert">{{ access_error }}</view>
      <template v-else>
        <view class="history-balance">
          <view><text>Current balance</text><text>{{ store.coin_balance.toLocaleString('en-US') }}</text></view>
          <image src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" />
        </view>
        <view class="history-filters" role="tablist">
          <view v-for="filter in filters" :key="filter.id" role="tab" :aria-selected="active_filter === filter.id" class="history-filter" :class="{ active: active_filter === filter.id }" data-interaction="coinHistory.h.pick.click.1" :data-filter="filter.id" @click="choose_filter(filter.id)">{{ filter.label }}</view>
        </view>
        <view v-if="visible_history.length" class="history-list">
          <view v-for="item in visible_history" :key="`${item.entity_type}:${item.record_id}`" class="history-row" role="button" :data-record-id="item.record_id" :data-record-type="item.entity_type" data-interaction="coinHistory.t.go.click.1" @click="navigate(item.route)">
            <view class="history-row-copy"><text>{{ item.title }}</text><text>{{ item.subtitle }}</text><text>{{ item.when }} · {{ item.status }}</text></view>
            <view class="history-row-value" :class="{ positive: item.positive }"><text>{{ item.amount }}</text><SourceIcon name="chevron" /></view>
          </view>
        </view>
        <view v-else class="history-empty"><image src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" /><text>No coin activity yet</text><text>{{ active_filter === 'all' ? 'Purchases and coin use will appear here.' : `No ${active_filter} records are available.` }}</text></view>
      </template>
    </view>
  </SecondaryPageFrame>
</template>

<style scoped>
.history-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.history-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; padding: 22.901rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; }
.history-header > text { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 800; letter-spacing: -0.025em; pointer-events: none; }
.history-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.history-content { padding: 0 38.168rpx 76.336rpx; }
.history-access { padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 28.626rpx; line-height: 1.45; }
.history-balance { display: flex; align-items: center; min-height: 213.74rpx; padding: 34.351rpx 41.985rpx; border-radius: 49.618rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-coin-hero); box-shadow: var(--cimoa-shadow-coin-hero); overflow: hidden; }
.history-balance > view { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.history-balance > view > text:first-child { font-size: 28.626rpx; font-weight: 600; }
.history-balance > view > text:last-child { margin-top: 7.634rpx; font-size: 76.336rpx; line-height: 1; font-weight: 900; letter-spacing: -0.04em; }
.history-balance > image { width: 137.405rpx; height: 137.405rpx; flex: none; }
.history-filters { display: flex; gap: 11.45rpx; margin-top: 30.534rpx; padding: 7.634rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.history-filter { display: flex; align-items: center; justify-content: center; flex: 1; height: 72.519rpx; border-radius: 36.26rpx; color: var(--cimoa-text-secondary); font-size: 28.626rpx; font-weight: 700; cursor: pointer; }
.history-filter.active { color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); }
.history-list { margin-top: 30.534rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); overflow: hidden; }
.history-row { display: flex; align-items: center; gap: 22.901rpx; min-height: 148.855rpx; padding: 26.718rpx 30.534rpx; border-bottom: 1px solid var(--cimoa-surface-event-divider); cursor: pointer; }
.history-row:last-child { border-bottom: none; }
.history-row-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.history-row-copy > text:first-child { font-size: 30.534rpx; font-weight: 800; }
.history-row-copy > text:nth-child(2) { margin-top: 3.817rpx; color: var(--cimoa-text-secondary); font-size: 24.809rpx; overflow-wrap: anywhere; }
.history-row-copy > text:last-child { margin-top: 7.634rpx; color: var(--cimoa-text-auth-placeholder); font-size: 22.901rpx; text-transform: capitalize; }
.history-row-value { display: flex; align-items: center; gap: 11.45rpx; flex: none; color: var(--cimoa-text-secondary); font-size: 28.626rpx; font-weight: 800; }
.history-row-value.positive { color: var(--cimoa-status-success); }
.history-row-value .source-icon { width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-text-profile-chevron); }
.history-empty { display: flex; margin-top: 30.534rpx; min-height: 362.595rpx; padding: 45.802rpx; flex-direction: column; align-items: center; justify-content: center; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); text-align: center; }
.history-empty image { width: 106.87rpx; height: 106.87rpx; opacity: .55; }
.history-empty > text:nth-child(2) { margin-top: 26.718rpx; font-size: 34.351rpx; font-weight: 800; }
.history-empty > text:last-child { margin-top: 11.45rpx; color: var(--cimoa-text-secondary); font-size: 26.718rpx; line-height: 1.45; }
</style>
