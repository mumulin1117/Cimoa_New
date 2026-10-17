<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onReady, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { MOTION } from '@/config/navigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import CoinActionLoading from '@/components/CoinActionLoading.vue'

const store = use_app_store(), frame = ref(null), context_id = ref(''), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true, ready = false, started = false, generation = 0
const leave = () => { active = false; generation++; started = false; cancel_loading() }
const account_scope = use_account_scope(store, leave)
onLoad(options => { context_id.value = String(options?.return_context_id || '') })
const context = computed(() => account_scope.is_current() ? store.current_drafts.find(row => row.draft_id === context_id.value && row.kind === 'coin_spend') : null)
const access_error = computed(() => account_scope.access_error.value || (!context.value ? 'This coin operation is unavailable. No coins were deducted.' : !['voice_introduction', 'priority_match'].includes(context.value.payload?.kind) ? 'This coin operation is invalid. No coins were deducted.' : ''))
const run = async () => {
  if (!ready || !active || started || access_error.value) return
  started = true; error.value = ''
  const token = generation, payload = context.value.payload
  const result = await run_with_loading(scope => store.complete_coin_spend(context_id.value, { is_current: () => scope.is_current() && active && account_scope.is_current() }))
  if (token !== generation || !active || !account_scope.is_current() || result.reason === 'cancelled') return
  let route
  if (!result.success) {
    error.value = result.message
    route = '/pages/coins/spend-failed?return_context_id=' + encodeURIComponent(context_id.value)
  } else if (payload.kind === 'voice_introduction') {
    route = '/pages/connections/sent?request_id=' + encodeURIComponent(result.data.destination_id)
  } else {
    route = '/pages/auto-match/searching?match_id=' + encodeURIComponent(result.data.destination_id)
  }
  try { await frame.value.navigate_replace(route) } catch (cause) { error.value = cause.message }
}
const back = async () => { try { await frame.value.navigate_back('/pages/coins/index') } catch (cause) { error.value = cause.message } }
onReady(() => { ready = true; run() })
onShow(() => { active = true; run() })
onHide(leave)
onUnmounted(leave)
</script>

<template>
  <SecondaryPageFrame ref="frame" class="coin-processing-page" :style="{ '--spend-pulse-duration': MOTION.coin_spend_pulse + 'ms' }">
    <view class="spend-processing-content">
      <view class="spend-processing-pulse" aria-hidden="true" />
      <text class="spend-processing-title">Confirming your coin balance…</text>
      <text class="spend-processing-copy">Hold on a moment. We only deduct coins once this is confirmed.</text>
      <text v-if="access_error || error" class="flow-error" role="alert">{{ access_error || error }}</text>
    </view>
    <template #footer><view v-if="access_error || error" class="flow-footer"><view class="flow-secondary" role="button" tabindex="0" @click="back" @keydown.enter="back">Return</view></view></template>
    <template #overlays><CoinActionLoading :visible="is_loading" label="Confirming your coin balance…" /></template>
  </SecondaryPageFrame>
</template>

<style scoped>
.spend-processing-content { display: flex; align-items: center; flex-direction: column; gap: 30.534rpx; padding: 469.466rpx 38.168rpx 76.336rpx; text-align: center; }
.spend-processing-pulse { width: 141.221rpx; height: 141.221rpx; flex: none; border-radius: 70.611rpx; background: var(--cimoa-gradient-primary); opacity: .9; animation: spend-pulse var(--spend-pulse-duration) ease-in-out infinite; }
.spend-processing-title { font-size: 38.168rpx; font-weight: 700; }
.spend-processing-copy { max-width: 515.267rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; text-wrap: pretty; }
@keyframes spend-pulse { 0%, 100% { transform: scale(.94); opacity: .16; } 50% { transform: scale(1.04); opacity: .3; } }
</style>
