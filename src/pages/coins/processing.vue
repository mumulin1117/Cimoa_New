<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onReady } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowStatePanel from '@/components/FlowStatePanel.vue'
import CoinActionLoading from '@/components/CoinActionLoading.vue'

const store = use_app_store(), frame = ref(null), context_id = ref(''), error = ref(''), started = ref(false), active = ref(true)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { context_id.value = String(options?.return_context_id || '') })
const context = computed(() => store.current_drafts.find(row => row.draft_id === context_id.value && row.kind === 'coin_spend'))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !context.value ? 'This coin operation is unavailable. No coins were deducted.' : !['voice_introduction', 'priority_match'].includes(context.value.payload?.kind) ? 'This coin operation is invalid. No coins were deducted.' : '')
const run = async () => {
  if (started.value || access_error.value) return
  started.value = true; const payload = context.value.payload
  const result = await run_with_loading(scope => store.complete_coin_spend(context_id.value, scope))
  if (!active.value || result.reason === 'cancelled') return
  if (!result.success) {
    error.value = result.message
    try { await frame.value.navigate_replace(`/pages/coins/spend-failed?return_context_id=${encodeURIComponent(context_id.value)}`) } catch (cause) { error.value = `${result.message} ${cause.message}` }
    return
  }
  if (payload.kind === 'voice_introduction') {
    try { await frame.value.navigate_replace(`/pages/connections/sent?request_id=${encodeURIComponent(result.data.destination_id)}`) } catch (cause) { error.value = cause.message }
  } else {
    try { await frame.value.navigate_replace(`/pages/auto-match/searching?match_id=${encodeURIComponent(result.data.destination_id)}`) } catch (cause) { error.value = cause.message }
  }
}
onReady(run)
onHide(() => { active.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template><SecondaryPageFrame ref="frame"><FlowStatePanel icon="sparkle" title="Confirming your coin balance…" copy="Hold on a moment. Coins are deducted only if the feature and ledger update are both confirmed." /><text v-if="access_error || error" class="flow-error" role="alert">{{ access_error || error }}</text><template #footer><view v-if="access_error" class="flow-footer"><view class="flow-secondary" role="button" @click="frame.navigate_back('/pages/coins/index')">Return</view></view></template><template #overlays><CoinActionLoading :visible="is_loading" label="Confirming your coin balance…" /></template></SecondaryPageFrame></template>
