<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store, make_operation_id } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), error = ref(''), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const active = computed(() => store.active_match)
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !store.social_eligible ? 'Complete account verification and profile setup before joining Auto Match.' : store.current_settings.privacy?.auto_match_visible === false ? 'Enable Auto Match visibility in Privacy before joining the pool.' : '')
const go = async url => { if (navigating.value || is_loading.value) return; navigating.value = true; error.value = ''; try { await frame.value.navigate_forward(url) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const back = async () => { if (navigating.value || is_loading.value) return; try { await frame.value.navigate_back('/pages/home/index') } catch (cause) { error.value = cause.message } }
const join = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  if (active.value) { await go(`/pages/auto-match/${active.value.status}?match_id=${encodeURIComponent(active.value.match_id)}`); return }
  const result = await run_with_loading(() => store.start_match(make_operation_id('auto-match')))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  await go(`/pages/auto-match/searching?match_id=${encodeURIComponent(result.data)}`)
}
onHide(() => { navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Auto Match" interaction="amEntry.goBack.click.1" :busy="is_loading || navigating" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view class="flow-body"><text class="flow-title">Meet someone new</text><text class="flow-copy">Join the pool and Cimoa will introduce you to a compatible verified student who is also available.</text><view class="flow-card"><view class="flow-status-line"><text>1</text><text>Join the pool</text></view><view class="flow-status-line"><text>2</text><text>Get matched by the service</text></view><view class="flow-status-line"><text>3</text><text>Both choose to connect</text></view></view><view class="flow-card"><view class="flow-status-line"><text>Free matches today</text><text>{{ store.free_matches_remaining }} / 3</text></view><view class="flow-status-line"><text>After free matches</text><text>10 coins each</text></view><view class="flow-status-line"><text>Service status</text><text>{{ active ? `Active · ${active.status}` : 'Waiting for service' }}</text></view></view><text class="flow-note">A match never unlocks chat by itself. Both students must accept. Queue size and wait time are shown only when the matching service supplies them.</text><view v-if="access_error" class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="is_loading || navigating || !!access_error" data-interaction="amEntry.joinPool.click.1" @click="join">{{ active ? 'Open Active Match' : 'Join the Pool' }}</view><view class="flow-secondary" role="button" :aria-disabled="is_loading || navigating" data-interaction="amEntry.openPrefs.click.1" @click="go('/pages/auto-match/preferences')">Match Preferences</view><view class="flow-secondary" role="button" :aria-disabled="is_loading || navigating" data-interaction="amEntry.openHistory.click.1" @click="go('/pages/auto-match/history')">Match History</view></view></template><template #overlays><EventActionLoading :visible="is_loading" label="Joining the matching pool…" /></template></SecondaryPageFrame></template>
