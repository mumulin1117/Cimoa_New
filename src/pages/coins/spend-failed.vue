<script setup>
import { computed, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import FlowStatePanel from '@/components/FlowStatePanel.vue'

const store = use_app_store(), frame = ref(null), context_id = ref(''), error = ref(''), navigating = ref(false)
onLoad(options => { context_id.value = String(options?.return_context_id || '') })
const context = computed(() => store.current_drafts.find(row => row.draft_id === context_id.value && row.kind === 'coin_spend'))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !context.value ? 'This failed operation is no longer available.' : '')
const destination = computed(() => {
  const p = context.value?.payload
  if (p?.kind === 'voice_introduction') return `/pages/discover/icebreaker/preview?user_id=${encodeURIComponent(p.user_id)}&draft_id=${encodeURIComponent(p.introduction_draft_id)}&media_id=${encodeURIComponent(p.audio_id)}`
  if (p?.kind === 'priority_match') return `/pages/auto-match/searching?match_id=${encodeURIComponent(p.match_id)}`
  return '/pages/home/index'
})
const go = async route => { if (navigating.value) return; navigating.value = true; error.value = ''; try { await frame.value.navigate_replace(route) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const retry = () => go(`/pages/coins/processing?return_context_id=${encodeURIComponent(context_id.value)}`)
onHide(() => { navigating.value = false })
</script>

<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Coins" interaction="coinSpendFailed.goBack.click.1" :busy="navigating" @back="go(destination)" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><FlowStatePanel icon="blocked" title="We couldn’t complete that" :copy="access_error || `No coins were deducted. Your balance is ${store.coin_balance}. Your draft is still available.`" /><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="navigating" data-interaction="coinSpendFailed.retrySpend.click.1" @click="retry">Try Again</view><view class="flow-secondary" role="button" :aria-disabled="navigating" data-interaction="coinSpendFailed.goBack.click.1" @click="go(destination)">Return</view><view class="flow-secondary" role="button" :aria-disabled="navigating" data-interaction="coinSpendFailed.openCoinHelp.click.1" @click="frame.navigate_forward('/pages/coins/help')">Contact Support</view></view><view v-else class="flow-footer"><view class="flow-secondary" role="button" @click="go('/pages/home/index')">Return Home</view></view></template></SecondaryPageFrame></template>
