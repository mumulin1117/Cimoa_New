<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store, make_operation_id } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import EventAudio from '@/components/EventAudio.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), user_id = ref(''), draft_id = ref(''), media_id = ref(''), error = ref(''), confirming = ref(false), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { user_id.value = String(options?.user_id || ''); draft_id.value = String(options?.draft_id || ''); media_id.value = String(options?.media_id || '') })
const draft = computed(() => store.current_drafts.find(row => row.draft_id === draft_id.value && row.kind === 'introduction' && row.target_id === user_id.value))
const user = computed(() => store.user_by_id(user_id.value)), question = computed(() => store.data.icebreakers.find(row => row.question_id === draft.value?.payload.question_id && row.user_id === user_id.value)), media = computed(() => store.media_by_id(media_id.value))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !user.value || !draft.value || !question.value || !media.value ? 'This voice introduction is unavailable. Record it again.' : store.introduction_blocker(user_id.value))
const voice_url = computed(() => `/pages/discover/icebreaker/voice?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}`)
const back = async () => { if (is_loading.value || navigating.value) return; try { await frame.value.navigate_back(voice_url.value) } catch (cause) { error.value = cause.message } }
const remove = async () => {
  confirming.value = false
  const result = await run_with_loading(() => store.discard_media(media_id.value))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  navigating.value = true
  try { await frame.value.navigate_replace(voice_url.value) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const continue_voice = async () => {
  if (store.coin_balance < 10) { error.value = 'You need 10 coins for a voice introduction. No coins were deducted.'; return }
  const result = await run_with_loading(() => store.save_draft('coin_spend', draft_id.value, { kind: 'voice_introduction', introduction_draft_id: draft_id.value, user_id: user_id.value, question_id: question.value.question_id, audio_id: media_id.value, operation_id: make_operation_id('intro-voice') }))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  navigating.value = true
  try { await frame.value.navigate_forward(`/pages/coins/processing?return_context_id=${encodeURIComponent(result.data)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
onHide(() => { confirming.value = false; navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template><SecondaryPageFrame ref="frame" :scroll-locked="confirming"><template #header><FlowPageHeader title="Voice preview" interaction="ibPreview.goBack.click.1" :busy="is_loading || navigating" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view class="flow-body"><template v-if="!access_error"><text class="flow-eyebrow">{{ user.user_name }}’s question</text><view class="flow-card"><text class="flow-title">{{ question.text }}</text></view><view class="flow-card"><EventAudio :src="media.media_url" :duration="media.duration_ms" interaction="ibPreview.togglePlay.click.1" /><view class="flow-chip-row"><view class="flow-chip" role="button" data-interaction="ibPreview.reRecord.click.1" @click="confirming = true">Re-record</view><view class="flow-chip" role="button" data-interaction="ibPreview.deleteVoice.click.1" @click="confirming = true">Delete voice</view></view></view><text class="flow-note">Voice introduction: 10 coins · balance {{ store.coin_balance }}. The deduction and request are committed together.</text></template><view v-else class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="is_loading || navigating" data-interaction="ibPreview.continueVoice.click.1" @click="continue_voice">Continue · 10 Coins</view><view v-if="store.coin_balance < 10" class="flow-secondary" role="button" @click="frame.navigate_forward('/pages/coins/index')">Get Coins</view></view></template><template #overlays><ConfirmDialog :visible="confirming" title="Remove this recording?" message="The saved draft audio will be permanently removed." confirm-label="Remove" danger @cancel="confirming = false" @confirm="remove" /><EventActionLoading :visible="is_loading" :label="media ? 'Preparing your request…' : 'Removing recording…'" /></template></SecondaryPageFrame></template>
