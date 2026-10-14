<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import FlowStatePanel from '@/components/FlowStatePanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
const store = use_app_store(), frame = ref(null), match_id = ref(''), error = ref(''), leaving = ref(false), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { match_id.value = String(options?.match_id || '') })
const match = computed(() => store.match_detail(match_id.value)), access_error = computed(() => !match.value || match.value.status !== 'paused' ? 'This paused match session is unavailable.' : '')
const go = async (url, replace = false) => { navigating.value = true; try { await (replace ? frame.value.navigate_replace(url) : frame.value.navigate_forward(url)) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const change = async status => { leaving.value = false; const result = await run_with_loading(() => store.transition_match(match_id.value, status)); if (result.reason === 'cancelled') return; if (!result.success) { error.value = result.message; return } await go(status === 'searching' ? `/pages/auto-match/searching?match_id=${encodeURIComponent(match_id.value)}` : '/pages/home/index', true) }
onHide(() => { leaving.value = false; navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>
<template><SecondaryPageFrame ref="frame" :scroll-locked="leaving"><template #header><FlowPageHeader title="Auto Match" interaction="amPaused.goBack.click.1" :busy="is_loading || navigating" @back="go('/pages/home/index', true)" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><template v-if="!access_error"><FlowStatePanel icon="pause" title="Matching paused" copy="You’re not visible as available right now. Your saved preferences and service-provided queue details are preserved."><view class="flow-card paused-card"><view class="flow-status-line"><text>Saved queue position</text><text>{{ match.queue_position || 'Not supplied' }}</text></view><view class="flow-status-line"><text>Preferences</text><text>Saved</text></view></view></FlowStatePanel></template><view v-else class="flow-body"><view class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" data-interaction="amPaused.resumeQueue.click.1" @click="change('searching')">Resume Matching</view><view class="flow-secondary" role="button" data-interaction="amPaused.openPrefs.click.1" @click="go('/pages/auto-match/preferences')">Preferences</view><view class="flow-danger" role="button" data-interaction="amPaused.askLeave.click.1" @click="leaving = true">Leave Pool</view></view></template><template #overlays><ConfirmDialog :visible="leaving" title="Leave the matching pool?" message="This ends the current session." confirm-label="Leave Pool" danger @cancel="leaving = false" @confirm="change('left')" /><EventActionLoading :visible="is_loading" label="Updating your match session…" /></template></SecondaryPageFrame></template>
<style scoped>.paused-card { width: 100%; text-align: left; }</style>
