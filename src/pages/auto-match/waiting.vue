<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import FlowStatePanel from '@/components/FlowStatePanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
const store = use_app_store(), frame = ref(null), match_id = ref(''), error = ref(''), cancelling = ref(false), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { match_id.value = String(options?.match_id || '') })
const match = computed(() => store.match_detail(match_id.value)), access_error = computed(() => !match.value ? 'This match request is unavailable.' : match.value.status !== 'waiting' ? `This match is now ${match.value.status}.` : '')
const go = async (url, replace = true) => { if (navigating.value || is_loading.value) return; navigating.value = true; try { await (replace ? frame.value.navigate_replace(url) : frame.value.navigate_forward(url)) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
watch(() => match.value?.status, status => { if (status === 'connected') go(`/pages/auto-match/connected?match_id=${encodeURIComponent(match_id.value)}`) })
const cancel = async () => { cancelling.value = false; const result = await run_with_loading(() => store.transition_match(match_id.value, 'left')); if (result.reason === 'cancelled') return; if (!result.success) { error.value = result.message; return } await go('/pages/home/index') }
onHide(() => { cancelling.value = false; navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>
<template><SecondaryPageFrame ref="frame" :scroll-locked="cancelling"><template #header><FlowPageHeader title="Auto Match" interaction="amWaiting.goBack.click.1" :busy="is_loading || navigating" @back="go('/pages/home/index')" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><template v-if="!access_error"><FlowStatePanel icon="send" title="Request sent" :copy="`Waiting for ${match.candidate.user_name}. You can leave this screen — the request remains active.`" :person="match.candidate"><text class="flow-note">Chat unlocks only when the matching service confirms that both of you accepted.</text></FlowStatePanel></template><view v-else class="flow-body"><view class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" data-interaction="amWaiting.returnHome.click.1" @click="go('/pages/home/index')">Return Home</view><view class="flow-danger" role="button" data-interaction="amWaiting.cancelRequest.click.1" @click="cancelling = true">Cancel Request</view></view></template><template #overlays><ConfirmDialog :visible="cancelling" title="Cancel this match request?" message="No connection will be created." confirm-label="Cancel Request" danger @cancel="cancelling = false" @confirm="cancel" /><EventActionLoading :visible="is_loading" label="Cancelling your request…" /></template></SecondaryPageFrame></template>
