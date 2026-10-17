<script setup>
import { computed, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import { COIN_ROUTES } from '@/utils/coinNavigation.js'
import { coin_center_route } from '@/utils/coinReturnContext.js'
import { legal_document_route } from '@/utils/legalNavigation.js'

const faqs = Object.freeze([
  ['What are coins?', 'Coins are a virtual currency inside Cimoa. They have no cash value. Text introductions are free; coins are used for voice introductions and Priority Match.'],
  ['How do I get coins?', 'Coin packages are intended to use Apple In-App Purchase. This build has no StoreKit product IDs or receipt-verification service, so purchase attempts fail or time out without adding coins.'],
  ['What can coins be used for?', 'A text introduction is free. A voice introduction costs 10 coins. Priority Match costs 20 coins for 15 minutes.'],
  ['Can coins be transferred?', 'No. Coins stay on your account and cannot be sent to another student, withdrawn, or exchanged for money.'],
  ['Can coins be refunded?', 'A coin action writes its deduction only when the action completes, so a failed action must not keep a debit. Verified App Store refund handling is not configured in this build.'],
  ['What happens if a purchase fails?', 'No coins are added and your balance is unchanged. You can retry from the coin store or keep a local support draft.'],
  ['How do I contact support?', 'Purchase support opens the local Help and Support flow. It can save a private draft on this device, but no delivery service or support ticket is configured.'],
])
const links = Object.freeze([
  { label: 'Terms of Use', icon: 'legal', route: '/pages/legal/terms', interaction: 'coinHelp.openTerms.click.1' },
  { label: 'Privacy Policy', icon: 'shield', route: '/pages/legal/privacy', interaction: 'coinHelp.openPrivacy.click.1' },
  { label: 'Purchase support', icon: 'support', route: '/pages/settings/support?context_type=general&context_id=coins', interaction: 'coinHelp.openSupport.click.1' },
])
const store = use_app_store(), frame = ref(null), open_faq = ref(-1), navigating = ref(false), error = ref('')
const account_id = store.session.account_id
const return_context_id = ref('')
onLoad(options => { return_context_id.value = String(options?.return_context_id || '') })
const account_scope = use_account_scope(store)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved coin data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const toggle_faq = index => { if (!navigating.value) { open_faq.value = open_faq.value === index ? -1 : index; error.value = '' } }
const navigate = async route => {
  if (navigating.value || route && access_error.value) return
  navigating.value = true; error.value = ''
  try {
    if (!route) await frame.value.navigate_back(coin_center_route(store, return_context_id.value))
    else await frame.value.navigate_forward(route === '/pages/legal/terms' ? legal_document_route(store, 'terms', 'coins', return_context_id.value) : route)
  } catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
onHide(() => { navigating.value = false; error.value = '' })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-help-page">
    <template #header>
      <view class="help-header">
        <view class="help-back" role="button" aria-label="Back" :aria-disabled="navigating" data-interaction="coinHelp.goBack.click.1" @click="navigate()"><SourceIcon name="back" /></view>
        <text>About coins</text>
      </view>
      <text v-if="error" class="help-error" role="alert">{{ error }}</text>
    </template>

    <view class="help-content">
      <view v-if="access_error" class="help-access" role="alert">{{ access_error }}</view>
      <template v-else>
        <view class="help-notice"><image src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" /><view><text>Local coin mode</text><text>Balance and history work locally. Apple purchases cannot complete until StoreKit products and verification are configured.</text></view></view>
        <view class="help-faqs">
          <view v-for="(item, index) in faqs" :key="item[0]" class="help-faq">
            <view class="help-question" role="button" :aria-expanded="open_faq === index" data-interaction="coinHelp.h.toggle.click.1" :data-faq-index="index" @click="toggle_faq(index)"><text>{{ item[0] }}</text><view class="help-chevron" :class="{ open: open_faq === index }"><SourceIcon name="chevron" /></view></view>
            <text v-if="open_faq === index" class="help-answer">{{ item[1] }}</text>
          </view>
        </view>
        <view class="help-links">
          <view v-for="link in links" :key="link.label" class="help-link" role="button" :aria-disabled="navigating" :data-interaction="link.interaction" @click="navigate(link.route)"><SourceIcon :name="link.icon" /><text>{{ link.label }}</text><SourceIcon name="chevron" /></view>
        </view>
      </template>
    </view>
  </SecondaryPageFrame>
</template>

<style scoped>
.help-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 22.901rpx; }
.help-back { display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; padding: 22.901rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); cursor: pointer; }
.help-header > text { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; font-size: 40.076rpx; font-weight: 800; letter-spacing: -0.025em; pointer-events: none; }
.help-error { display: block; margin: -7.634rpx 38.168rpx 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.help-content { padding: 0 38.168rpx 76.336rpx; }
.help-access { padding: 34.351rpx; border-radius: 45.802rpx; color: var(--cimoa-status-danger); background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); font-size: 28.626rpx; line-height: 1.45; }
.help-notice { display: flex; align-items: center; gap: 26.718rpx; padding: 30.534rpx; border-radius: 45.802rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-coin-hero); box-shadow: var(--cimoa-shadow-coin-hero); }
.help-notice image { width: 91.603rpx; height: 91.603rpx; flex: none; }
.help-notice > view { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.help-notice > view > text:first-child { font-size: 32.443rpx; font-weight: 800; }
.help-notice > view > text:last-child { margin-top: 5.725rpx; font-size: 24.809rpx; line-height: 1.4; }
.help-faqs { display: flex; margin-top: 30.534rpx; flex-direction: column; gap: 15.267rpx; }
.help-faq { padding: 26.718rpx 30.534rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.help-question { display: flex; align-items: center; gap: 22.901rpx; cursor: pointer; }
.help-question > text { flex: 1; min-width: 0; font-size: 30.534rpx; font-weight: 700; line-height: 1.35; }
.help-chevron { width: 30.534rpx; height: 30.534rpx; flex: none; color: var(--cimoa-text-profile-chevron); transform: rotate(90deg); transition: transform 180ms ease; }
.help-chevron.open { transform: rotate(-90deg); }
.help-answer { display: block; margin-top: 19.084rpx; color: var(--cimoa-text-profile-bio); font-size: 28.626rpx; line-height: 1.5; }
.help-links { margin-top: 30.534rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); overflow: hidden; }
.help-link { display: flex; align-items: center; gap: 22.901rpx; min-height: 106.87rpx; padding: 22.901rpx 30.534rpx; border-bottom: 1px solid var(--cimoa-surface-event-divider); cursor: pointer; }
.help-link:last-child { border-bottom: none; }
.help-link > .source-icon:first-child { width: 45.802rpx; height: 45.802rpx; color: var(--cimoa-text-link); }
.help-link > text { flex: 1; font-size: 30.534rpx; font-weight: 700; }
.help-link > .source-icon:last-child { width: 30.534rpx; height: 30.534rpx; color: var(--cimoa-text-profile-chevron); }
</style>
