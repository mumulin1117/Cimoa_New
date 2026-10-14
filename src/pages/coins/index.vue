<script setup>
import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import { COIN_ROUTES, require_coin_route_ready } from '@/utils/coinNavigation.js'
import { COIN_FEATURES, package_image } from '@/utils/coinPresentation.js'

const store = use_app_store(), frame = ref(null), navigating = ref(false), error = ref('')
const account_id = store.session.account_id
const packages = computed(() => store.coin_packages)
const selected_id = ref(packages.value.find(item => item.coins === 300)?.package_id || packages.value[0]?.package_id || '')
const selected = computed(() => packages.value.find(item => item.package_id === selected_id.value) || null)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved coin data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const storekit_ready = computed(() => packages.value.some(item => !!item.product_id))

const navigate = async route => {
  if (navigating.value) return
  navigating.value = true; error.value = ''
  try {
    if (!route) await frame.value.navigate_back('/pages/profile/index')
    else {
      if (access_error.value) throw Error(access_error.value)
      await frame.value.navigate_forward(require_coin_route_ready(route))
    }
  } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const select_package = package_id => {
  if (navigating.value || access_error.value) return
  selected_id.value = package_id
  error.value = ''
}
const continue_purchase = () => {
  if (!selected.value) { error.value = 'Choose an available coin package first.'; return }
  navigate(`${COIN_ROUTES.purchasing}?package_id=${encodeURIComponent(selected.value.package_id)}`)
}
onHide(() => { error.value = '' })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-center-page">
    <template #header>
      <view class="coin-header">
        <view class="coin-back" role="button" aria-label="Back" :aria-disabled="navigating" data-interaction="coinStore.goBack.click.1" @click="navigate()"><SourceIcon name="back" /></view>
        <text class="coin-title">Coin Center</text>
        <view class="coin-history" role="button" :aria-disabled="navigating" data-interaction="coinStore.openHistory2.click.1" @click="navigate(COIN_ROUTES.history)">History</view>
      </view>
      <text v-if="error" class="coin-error" role="alert">{{ error }}</text>
    </template>

    <view class="coin-content">
      <view v-if="access_error" class="coin-state" role="alert">{{ access_error }}</view>
      <template v-else>
        <view class="coin-hero">
          <view class="coin-orb primary" aria-hidden="true" /><view class="coin-orb secondary" aria-hidden="true" />
          <image class="coin-hero-image" src="/static/assets/coins/store-coin-hero.png" mode="aspectFit" />
          <view class="coin-hero-copy"><text>My Coins</text><text class="coin-balance">{{ store.coin_balance.toLocaleString('en-US') }}</text><text>Use coins for voice introductions and extra features</text></view>
        </view>

        <scroll-view class="coin-packages" scroll-x :show-scrollbar="false">
          <view class="coin-package-row">
            <view v-for="item in packages" :key="item.package_id" class="coin-package" :class="{ selected: selected_id === item.package_id }" role="radio" :aria-checked="selected_id === item.package_id" data-interaction="coinStore.p.pick.click.1" :data-package-id="item.package_id" @click="select_package(item.package_id)">
              <view v-if="item.badge" class="coin-badge">{{ item.badge }}</view>
              <image :src="package_image(item.coins)" mode="aspectFit" />
              <text class="coin-package-amount">{{ item.coins.toLocaleString('en-US') }} Coins</text>
              <view class="coin-package-divider" />
              <view class="coin-price">{{ item.price }}</view>
            </view>
          </view>
        </scroll-view>

        <view class="coin-feature-card">
          <text class="coin-section-title">What can coins do?</text>
          <view v-for="(feature, index) in COIN_FEATURES" :key="feature.feature_id" class="coin-feature" :class="{ last: index === COIN_FEATURES.length - 1 }">
            <image :src="feature.image_url" mode="aspectFill" />
            <view class="coin-feature-copy"><text>{{ feature.title }}</text><text>{{ feature.description }}</text></view>
            <view class="coin-cost"><image v-if="feature.cost !== 'Free'" src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" /><text>{{ feature.cost }}</text></view>
          </view>
        </view>
      </template>
    </view>

    <template #footer>
      <view v-if="!access_error" class="coin-footer">
        <view class="coin-buy" role="button" :aria-disabled="navigating || !selected" data-interaction="coinStore.continuePurchase.click.1" @click="continue_purchase">Get Coins</view>
        <text>{{ storekit_ready ? 'Payment is processed through the App Store' : 'StoreKit products are not configured; purchases cannot complete yet.' }}</text>
      </view>
    </template>
  </SecondaryPageFrame>
</template>

<style scoped>
.coin-header { position: relative; display: flex; align-items: center; gap: 22.901rpx; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.coin-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; flex: none; padding: 22.901rpx; }
.coin-title { position: absolute; inset: 0 198.473rpx 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 800; letter-spacing: -0.02em; pointer-events: none; white-space: nowrap; }
.coin-history { margin-left: auto; display: flex; align-items: center; justify-content: center; height: 72.519rpx; padding: 0 30.534rpx; border-radius: 36.26rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); font-size: 28.626rpx; font-weight: 700; cursor: pointer; flex: none; }
.coin-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.coin-content { padding: 0 38.168rpx 38.168rpx; }
.coin-state { padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); color: var(--cimoa-status-danger); font-size: 28.626rpx; line-height: 1.45; box-shadow: var(--cimoa-shadow-card); }
.coin-hero { position: relative; min-height: 335.878rpx; padding: 45.802rpx 41.985rpx; border-radius: 53.435rpx; background: var(--cimoa-gradient-coin-hero); overflow: hidden; box-shadow: var(--cimoa-shadow-coin-hero); }
.coin-orb { position: absolute; border-radius: 50%; }
.coin-orb.primary { right: -76.336rpx; top: -114.504rpx; width: 381.679rpx; height: 381.679rpx; background: var(--cimoa-surface-coin-hero-orb-primary); }
.coin-orb.secondary { right: 57.252rpx; bottom: -171.756rpx; width: 343.511rpx; height: 343.511rpx; background: var(--cimoa-surface-coin-hero-orb-secondary); }
.coin-hero-image { position: absolute; right: 7.634rpx; top: 50%; transform: translateY(-50%); width: 263.359rpx; height: 238.55rpx; }
.coin-hero-copy { position: relative; display: flex; flex-direction: column; max-width: 400.763rpx; color: var(--cimoa-text-inverse); font-size: 28.626rpx; font-weight: 600; line-height: 1.35; }
.coin-hero-copy > text:last-child { margin-top: 19.084rpx; max-width: 320.611rpx; font-size: 26.718rpx; font-weight: 400; }
.coin-balance { margin-top: 15.267rpx; font-size: 114.504rpx; font-weight: 900; letter-spacing: -0.04em; line-height: 1; }
.coin-packages { width: calc(100% + 76.336rpx); margin-left: -38.168rpx; margin-top: 15.267rpx; white-space: nowrap; }
.coin-package-row { display: inline-flex; gap: 19.084rpx; padding: 26.718rpx 38.168rpx 22.901rpx; }
.coin-package { position: relative; display: flex; flex-direction: column; align-items: center; gap: 19.084rpx; width: 208.015rpx; min-height: 314.885rpx; padding: 41.985rpx 19.084rpx 26.718rpx; border-radius: 41.985rpx; border: 2px solid var(--cimoa-surface-onboarding-border); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); cursor: pointer; }
.coin-package.selected { background: var(--cimoa-gradient-card-fill) padding-box, var(--cimoa-gradient-primary) border-box; border-color: var(--cimoa-surface-transparent); box-shadow: var(--cimoa-shadow-coin-selected); }
.coin-package > image { width: 133.588rpx; height: 110.687rpx; flex: none; }
.coin-badge { position: absolute; top: -22.901rpx; left: 50%; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; height: 45.802rpx; padding: 0 22.901rpx; border-radius: 22.901rpx; background: var(--cimoa-gradient-primary); color: var(--cimoa-text-inverse); font-size: 21.947rpx; font-weight: 700; white-space: nowrap; }
.coin-package-amount { max-width: 100%; font-size: 30.534rpx; font-weight: 700; white-space: nowrap; }
.coin-package-divider { width: 100%; height: 1px; background: var(--cimoa-surface-event-divider); }
.coin-price { display: flex; align-items: center; justify-content: center; width: 100%; height: 76.336rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-tinted); font-size: 34.351rpx; font-weight: 800; }
.coin-feature-card { margin-top: 41.985rpx; padding: 38.168rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.coin-section-title { display: block; font-size: 38.168rpx; font-weight: 800; letter-spacing: -0.02em; }
.coin-feature { display: flex; align-items: center; gap: 26.718rpx; padding: 22.901rpx 0; border-bottom: 1px solid var(--cimoa-surface-event-divider); }
.coin-feature.last { border-bottom: none; }
.coin-feature > image { width: 95.42rpx; height: 95.42rpx; border-radius: 47.71rpx; flex: none; }
.coin-feature-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.coin-feature-copy > text:first-child { font-size: 32.443rpx; font-weight: 700; }
.coin-feature-copy > text:last-child { margin-top: 3.817rpx; color: var(--cimoa-text-auth-placeholder); font-size: 26.718rpx; line-height: 1.35; overflow-wrap: anywhere; }
.coin-cost { display: flex; align-items: center; gap: 11.45rpx; flex: none; font-size: 32.443rpx; font-weight: 800; }
.coin-cost image { width: 45.802rpx; height: 45.802rpx; }
.coin-footer { flex: none; display: flex; flex-direction: column; align-items: center; gap: 19.084rpx; padding: 19.084rpx 38.168rpx 30.534rpx; }
.coin-buy { display: flex; align-items: center; justify-content: center; width: 100%; height: 114.504rpx; border-radius: 57.252rpx; background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-auth-action); color: var(--cimoa-text-inverse); font-size: 36.26rpx; font-weight: 700; cursor: pointer; }
.coin-footer > text { color: var(--cimoa-text-auth-placeholder); font-size: 24.809rpx; line-height: 1.35; text-align: center; }
</style>
