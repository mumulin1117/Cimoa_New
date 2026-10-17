<script setup>
import { computed, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import { COIN_ROUTES } from '@/utils/coinNavigation.js'
import { coin_center_route } from '@/utils/coinReturnContext.js'

const store = use_app_store(), frame = ref(null), request_id = ref(''), navigating = ref(false), error = ref('')
const account_id = store.session.account_id
onLoad(options => { request_id.value = String(options?.purchase_request_id || '') })
const request = computed(() => store.purchase_by_id(request_id.value))
const pack = computed(() => store.coin_package_by_id(request.value?.package_id))
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved purchase data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : !request_id.value || !request.value
      ? 'This purchase request is unavailable. No balance change was made.'
      : request.value.status !== 'cancelled'
        ? 'This purchase request is not cancelled. No balance change was made.'
        : !pack.value
          ? 'The package for this purchase is unavailable. No balance change was made.'
          : '')

const navigate_store = async use_back => {
  if (navigating.value) return
  navigating.value = true; error.value = ''
  try {
    await frame.value.navigate_back(coin_center_route(store, request.value?.return_context_id))
  } catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
onHide(() => { navigating.value = false })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-cancelled-page">
    <template #header>
      <view class="cancelled-header">
        <view class="cancelled-back" role="button" aria-label="Close" :aria-disabled="navigating" data-interaction="coinCancelled.goBack.click.1" @click="navigate_store(true)"><SourceIcon name="back" /></view>
        <text>Coins</text>
      </view>
      <text v-if="error" class="cancelled-error" role="alert">{{ error }}</text>
    </template>

    <view class="cancelled-content">
      <view v-if="access_error" class="cancelled-access" role="alert">{{ access_error }}</view>
      <template v-else>
        <view class="cancelled-icon"><SourceIcon name="blocked" /></view>
        <text class="cancelled-title">Purchase cancelled</text>
        <text class="cancelled-copy">Nothing was charged and your balance is unchanged.</text>
        <view class="cancelled-reference">
          <text>{{ pack.coins.toLocaleString('en-US') }} Coins · {{ pack.price }}</text>
          <text>Cancelled request {{ request.request_id }}</text>
        </view>
      </template>
    </view>

    <template #footer>
      <view v-if="!access_error" class="cancelled-footer">
        <view class="cancelled-primary" role="button" :aria-disabled="navigating" data-interaction="coinCancelled.backToStore.click.1" @click="navigate_store(false)">Back to Coin Store</view>
        <view class="cancelled-close" role="button" :aria-disabled="navigating" data-interaction="coinCancelled.goBack.click.1" @click="navigate_store(true)">Close</view>
      </view>
    </template>
  </SecondaryPageFrame>
</template>

<style scoped>
.cancelled-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.cancelled-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; padding: 22.901rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; }
.cancelled-header > text { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 700; letter-spacing: -0.025em; pointer-events: none; }
.cancelled-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.cancelled-content { display: flex; min-height: 100%; padding: 99.237rpx 49.618rpx 76.336rpx; flex-direction: column; align-items: center; text-align: center; }
.cancelled-icon { display: flex; align-items: center; justify-content: center; width: 175.572rpx; height: 175.572rpx; padding: 43.893rpx; border-radius: 87.786rpx; color: var(--cimoa-text-secondary); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.cancelled-title { margin-top: 45.802rpx; font-size: 45.802rpx; line-height: 1.15; font-weight: 800; letter-spacing: -0.025em; }
.cancelled-copy { margin-top: 22.901rpx; max-width: 572.519rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.5; }
.cancelled-reference { display: flex; width: 100%; margin-top: 45.802rpx; padding: 30.534rpx; flex-direction: column; gap: 9.542rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); text-align: left; }
.cancelled-reference > text:first-child { font-size: 30.534rpx; font-weight: 700; }
.cancelled-reference > text:last-child { color: var(--cimoa-text-auth-placeholder); font-size: 22.901rpx; line-height: 1.4; overflow-wrap: anywhere; }
.cancelled-access { width: 100%; padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 28.626rpx; line-height: 1.45; text-align: left; }
.cancelled-footer { display: flex; flex: none; padding: 19.084rpx 38.168rpx 30.534rpx; flex-direction: column; gap: 15.267rpx; }
.cancelled-primary, .cancelled-close { display: flex; align-items: center; justify-content: center; width: 100%; border-radius: 53.435rpx; font-size: 34.351rpx; font-weight: 700; cursor: pointer; }
.cancelled-primary { height: 106.87rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-auth-action); }
.cancelled-close { height: 76.336rpx; color: var(--cimoa-text-secondary); font-weight: 600; }
</style>
