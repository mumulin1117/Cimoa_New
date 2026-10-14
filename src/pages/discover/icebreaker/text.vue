<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onReady } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), user_id = ref(''), draft_id = ref(''), reply = ref(''), error = ref(''), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { user_id.value = String(options?.user_id || ''); draft_id.value = String(options?.draft_id || '') })
const draft = computed(() => store.current_drafts.find(row => row.draft_id === draft_id.value && row.kind === 'introduction' && row.target_id === user_id.value))
const user = computed(() => store.user_by_id(user_id.value)), question = computed(() => store.data.icebreakers.find(row => row.question_id === draft.value?.payload.question_id && row.user_id === user_id.value))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !user.value || !draft.value || !question.value ? 'This introduction draft is unavailable. Choose a question again.' : store.introduction_blocker(user_id.value))
const back = async () => { if (is_loading.value || navigating.value) return; try { await frame.value.navigate_back(`/pages/discover/icebreaker/select?user_id=${encodeURIComponent(user_id.value)}`) } catch (cause) { error.value = cause.message } }
const switch_voice = async () => { if (is_loading.value || navigating.value || access_error.value) return; navigating.value = true; try { await frame.value.navigate_replace(`/pages/discover/icebreaker/voice?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const open_result = async request_id => { navigating.value = true; try { await frame.value.navigate_replace(`/pages/connections/sent?request_id=${encodeURIComponent(request_id)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const send = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  if (!reply.value.trim()) { error.value = 'Write an introduction first.'; return }
  const result = await run_with_loading(() => store.send_introduction({ user_id: user_id.value, question_id: question.value.question_id, kind: 'text', text: reply.value, operation_id: draft.value.payload.operation_id, draft_id: draft_id.value }))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  await open_result(result.data)
}
onReady(() => { if (draft.value?.payload.completed_request_id) open_result(draft.value.payload.completed_request_id) })
onHide(() => { navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Your answer" interaction="ibText.goBack.click.1" :busy="is_loading || navigating" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view class="flow-body"><template v-if="!access_error"><text class="flow-eyebrow">{{ user.user_name }}’s question</text><view class="flow-card"><text class="flow-title">{{ question.text }}</text></view><text class="flow-label">Write something real</text><textarea v-model="reply" class="flow-textarea" maxlength="1000" aria-label="Your introduction" placeholder="Your answer…" data-interaction="ibText.onReply.change.1" /><text class="flow-note">Text introductions are free. Your answer is sent with a pending connection request.</text></template><view v-else class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="is_loading || navigating || !reply.trim()" data-interaction="ibText.continueText.click.1" @click="send">Send Introduction · Free</view><view class="flow-secondary" role="button" :aria-disabled="is_loading || navigating" data-interaction="ibText.switchToVoice.click.1" @click="switch_voice">Switch to voice</view></view></template><template #overlays><EventActionLoading :visible="is_loading" label="Sending your introduction…" /></template></SecondaryPageFrame></template>
