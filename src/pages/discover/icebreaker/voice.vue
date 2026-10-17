<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_event_media } from '@/composables/useEventMedia.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import EventAudio from '@/components/EventAudio.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), user_id = ref(''), draft_id = ref(''), error = ref(''), confirm_discard = ref(false), navigating = ref(false), active = ref(true)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { draft: recording_draft, recording, busy: media_busy, seconds, clear, start, stop } = use_event_media(error)
onLoad(options => { user_id.value = String(options?.user_id || ''); draft_id.value = String(options?.draft_id || '') })
onShow(() => { active.value = true })
const draft = computed(() => store.current_drafts.find(row => row.draft_id === draft_id.value && row.kind === 'introduction' && row.target_id === user_id.value))
const user = computed(() => store.user_by_id(user_id.value)), question = computed(() => store.data.icebreakers.find(row => row.question_id === draft.value?.payload.question_id && row.user_id === user_id.value))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !user.value || !draft.value || !question.value ? 'This introduction draft is unavailable. Choose a question again.' : store.introduction_blocker(user_id.value))
const back_now = async () => { clear(); try { await frame.value.navigate_back(`/pages/discover/icebreaker/select?user_id=${encodeURIComponent(user_id.value)}`) } catch (cause) { error.value = cause.message } }
const back = () => { if (is_loading.value || navigating.value || media_busy.value) return; recording.value || recording_draft.value ? confirm_discard.value = true : back_now() }
const switch_text = async () => { if (is_loading.value || navigating.value || media_busy.value || access_error.value) return; clear(); navigating.value = true; try { await frame.value.navigate_replace(`/pages/discover/icebreaker/text?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const review = async () => {
  if (is_loading.value || navigating.value || media_busy.value || !recording_draft.value) return
  const result = await run_with_loading(scope => store.save_media(recording_draft.value.blob, 'audio', recording_draft.value.duration_ms, scope))
  if (!active.value || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  clear(); navigating.value = true
  try { await frame.value.navigate_forward(`/pages/discover/icebreaker/preview?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}&media_id=${encodeURIComponent(result.data.media_id)}`) } catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
const hide = () => { active.value = false; confirm_discard.value = false; navigating.value = false; cancel_loading() }
onHide(hide); onUnmounted(() => { hide(); clear() })
</script>

<template><SecondaryPageFrame ref="frame" :scroll-locked="confirm_discard"><template #header><FlowPageHeader title="Voice answer" interaction="ibVoice.goBack.click.1" :busy="is_loading || navigating || media_busy" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view class="flow-body"><template v-if="!access_error"><text class="flow-eyebrow">{{ user.user_name }}’s icebreaker</text><view class="flow-card"><text class="flow-title">{{ question.text }}</text></view><view class="flow-card"><text class="flow-label">Record your answer</text><text class="flow-copy">{{ recording ? `Recording · ${seconds}s / 120s` : 'Use your real voice. You can review it before sending.' }}</text><EventAudio v-if="recording_draft" :src="recording_draft.url" :duration="recording_draft.duration_ms" interaction="ibVoice.toggleVoicePlay.click.1" /><view class="flow-secondary" role="button" :aria-disabled="media_busy || is_loading" data-interaction="ibVoice.openVoiceMenu.click.1" @click="recording ? stop() : start()">{{ media_busy ? 'Opening microphone…' : recording ? 'Stop recording' : recording_draft ? 'Record again' : 'Start recording' }}</view></view><text class="flow-note">Voice introductions cost 10 coins only after the request is confirmed and saved.</text></template><view v-else class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="is_loading || media_busy || navigating || !recording_draft" data-interaction="ibVoice.sendVoiceRequest.click.1" @click="review">Review Recording</view><view class="flow-secondary" role="button" :aria-disabled="is_loading || media_busy || navigating" data-interaction="ibVoice.switchToTextReply.click.1" @click="switch_text">Switch to text</view></view></template><template #overlays><ConfirmDialog :visible="confirm_discard" title="Discard this recording?" message="The unsent recording will be removed." confirm-label="Discard" danger @cancel="confirm_discard = false" @confirm="confirm_discard = false; back_now()" /><EventActionLoading :visible="is_loading" label="Saving your recording…" /></template></SecondaryPageFrame></template>
