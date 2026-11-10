<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_event_media } from '@/composables/useEventMedia.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import IcebreakerHeader from '@/components/IcebreakerHeader.vue'
import IcebreakerPerson from '@/components/IcebreakerPerson.vue'
import IcebreakerIcon from '@/components/IcebreakerIcon.vue'
import IcebreakerAudio from '@/components/IcebreakerAudio.vue'
import IntroductionConfirmDialog from '@/components/IntroductionConfirmDialog.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import DiscoverGuide from '@/components/DiscoverGuide.vue'
import { use_discover_guide } from '@/composables/useDiscoverGuide.js'
import { use_icebreaker_motion } from '@/composables/useIcebreakerMotion.js'

const store = use_app_store(), frame = ref(null), user_id = ref(''), draft_id = ref(''), error = ref(''), sheet = ref(''), discard = ref(false), navigating = ref(false), active = ref(true)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { draft: recording_draft, recording, busy: media_busy, seconds, clear, start, stop } = use_event_media(error)
const context = computed(() => store.introduction_context(user_id.value, draft_id.value))
const access_error = computed(() => context.value.error || context.value.blocker || (!context.value.question ? 'Choose a question before recording your answer.' : ''))
const motion = use_icebreaker_motion({ auth_context: () => store.auth_context, user_id: () => user_id.value, question_id: () => context.value.question?.question_id || '', kind: 'voice' })
const audio_source = computed(() => recording_draft.value?.url || context.value.audio?.media_url || '')
const audio_duration = computed(() => recording_draft.value?.duration_ms || context.value.audio?.duration_ms || 0)
const question_number = computed(() => context.value.questions.findIndex(q => q.question_id === context.value.question?.question_id) + 1)
const same_university = computed(() => context.value.user?.university === store.current_user.university ? 'Same university' : context.value.user?.university)
const recording_time = computed(() => `${String(Math.floor(seconds.value / 60)).padStart(2, '0')}:${String(seconds.value % 60).padStart(2, '0')}`)
const guide_ready = ref(false)
const { open: guide_open, step: guide_step, busy: guide_busy, error: guide_error, is_loading: guide_loading, next_disabled: guide_next_disabled, next: guide_next, back: guide_back, skip: guide_skip, target_user_id: guide_target, mode: guide_mode } = use_discover_guide('voice', {
  ready: computed(() => guide_ready.value && !is_loading.value && !navigating.value && !media_busy.value && !recording.value && !recording_draft.value && !access_error.value),
  user_id: () => user_id.value,
  mode: () => 'voice',
  available: () => !sheet.value && !discard.value,
  element: () => frame.value?.$el || frame.value,
  return_select: () => back(),
})
onLoad(options => {
  user_id.value = String(options?.user_id || ''); draft_id.value = String(options?.draft_id || '')
  if ((!context.value.draft || context.value.error) && options?.question_id) {
    const opened = store.stage_introduction_form(user_id.value, String(options.question_id), 'voice')
    if (opened.success) draft_id.value = opened.data
  }
  if (context.value.draft && !context.value.completed_request_id) store.edit_introduction_form(draft_id.value, { mode: 'voice' })
  motion.enter()
})
onShow(() => { active.value = true })
const back_now = async () => { if (navigating.value) return false; navigating.value = true; clear(); discard.value = false; try { return await frame.value.navigate_back(`/pages/discover/icebreaker/select?user_id=${encodeURIComponent(user_id.value)}`) } catch (cause) { error.value = cause.message; return false } finally { navigating.value = false } }
const back = () => { if (is_loading.value || navigating.value || media_busy.value || sheet.value) return false; if (recording.value || recording_draft.value) { discard.value = true; return false } return back_now() }
const persist_recording = async () => {
  if (guide_open.value) return null
  if (!recording_draft.value && store.current_drafts.some(row => row.draft_id === draft_id.value && row.payload.mode === 'voice' && row.payload.question_id === context.value.question?.question_id)) return context.value.audio?.media_id || null
  if (!recording_draft.value && !context.value.audio) return null
  const old = context.value.audio?.media_id
  const result = await run_with_loading(scope => {
    const saved = store.persist_introduction_form(draft_id.value)
    if (!saved.success) return saved
    return recording_draft.value ? store.save_media(recording_draft.value.blob, 'audio', recording_draft.value.duration_ms, { ...scope, introduction_draft_id: draft_id.value }) : { success: true, data: { media_id: context.value.audio.media_id } }
  })
  if (!active.value || result.reason === 'cancelled') return null
  if (!result.success) { error.value = result.message; return null }
  clear()
  if (old && old !== result.data.media_id) await store.discard_media(old, { is_current: () => active.value })
  return result.data.media_id
}
const switch_text = async () => {
  if (guide_open.value || is_loading.value || navigating.value || media_busy.value || access_error.value) return
  if (recording.value) { error.value = 'Stop recording before switching to text.'; return }
  navigating.value = true
  let receipt = null
  try {
    if (recording_draft.value && !await persist_recording()) return
    if (!active.value) return
    const result = store.edit_introduction_form(draft_id.value, { mode: 'text' })
    if (result.reason === 'cancelled') return
    if (!result.success) { error.value = result.message; return }
    receipt = motion.arm('text')
    if (await frame.value.navigate_replace(`/pages/discover/icebreaker/text?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}&question_id=${encodeURIComponent(context.value.question.question_id)}`) === false) motion.cancel(receipt)
  } catch (cause) { if (receipt != null) motion.cancel(receipt); error.value = cause.message } finally { navigating.value = false }
}
const record = () => { if (guide_open.value || is_loading.value || navigating.value || media_busy.value || sheet.value || discard.value || access_error.value) return; recording.value ? stop() : sheet.value = 'microphone' }
const allow = async () => { if (guide_open.value || navigating.value || !active.value) return; sheet.value = ''; if (!access_error.value) await start() }
const review = async () => {
  if (guide_open.value || is_loading.value || navigating.value || media_busy.value || recording.value || access_error.value) return
  const id = await persist_recording()
  if (!id) { if (!error.value) error.value = 'Record a playable voice introduction first.'; return }
  navigating.value = true
  try { await frame.value.navigate_forward(`/pages/discover/icebreaker/preview?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}&media_id=${encodeURIComponent(id)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const rerecord = () => { if (guide_open.value) return; sheet.value = ''; clear(); sheet.value = 'microphone' }
const remove_audio = async () => {
  if (guide_open.value) return
  sheet.value = ''; clear()
  if (!context.value.audio) return
  const result = await run_with_loading(scope => store.discard_media(context.value.audio.media_id, scope))
  if (!result.success && result.reason !== 'cancelled') error.value = result.message
}
const hide = () => { guide_ready.value = false; active.value = false; sheet.value = ''; discard.value = false; navigating.value = false; cancel_loading() }
onHide(hide); onUnmounted(() => { hide(); clear() })
</script>
<template>
  <SecondaryPageFrame ref="frame" class="ice-voice-page" content-motion :style="motion.style" :aria-busy="is_loading || navigating || media_busy || guide_busy" :scroll-locked="!!sheet || discard || guide_open" @presented="guide_ready = true">
    <template #header><IcebreakerHeader title="Your answer" variant="voice" interaction="ibVoice.goBack.click.1" :busy="is_loading || navigating || media_busy || guide_open" @back="back" /><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
    <view class="ice-body" :inert="navigating || guide_open ? '' : undefined"><template v-if="!access_error"><IcebreakerPerson :user="context.user" variant="voice" :university="same_university" /><view class="ice-question" :class="{ 'ice-continuity-cue': motion.cue.value }" @animationend="motion.finish"><view class="ice-question-top"><view><view class="ice-question-icon"><SourceIcon name="support" /></view><text>Icebreaker</text></view><text>{{ question_number }}/{{ context.questions.length }}</text></view><text class="ice-question-text">{{ context.question.text }}</text></view>
      <view class="ice-record-card">
        <IcebreakerAudio v-if="audio_source && !recording && !media_busy" :src="audio_source" :duration="audio_duration" voice interaction="ibVoice.toggleVoicePlay.click.1" />
        <view v-else class="ice-record-empty"><view class="ice-wave-space" /><text class="ice-record-time">{{ recording_time }}</text><view class="ice-record-button" role="button" tabindex="0" :aria-label="recording ? 'Stop recording' : 'Start recording'" :aria-disabled="guide_open || media_busy || is_loading || navigating" data-interaction="ibVoice.record.click.1" @click="record" @keydown.enter="record"><view><IcebreakerIcon :name="recording ? 'pause' : 'mic'" /></view></view></view>
        <view class="ice-text-switch" role="button" tabindex="0" :aria-disabled="guide_open || is_loading || media_busy || navigating" data-interaction="ibVoice.switchToTextReply.click.1" @click="switch_text" @keydown.enter="switch_text"><view><IcebreakerIcon name="keyboard" /></view><text>Switch to text</text></view>
      </view><view class="ice-voice-note"><view><IcebreakerIcon name="info" /></view><text>Your answer will be sent with the connection request</text></view>
    </template><view v-else class="ice-unavailable" role="alert">{{ access_error }}</view></view>
    <template #footer><view v-if="!access_error" class="ice-footer" :inert="navigating || guide_open ? '' : undefined"><view class="ice-primary" role="button" tabindex="0" :aria-disabled="guide_open || is_loading || media_busy || navigating || recording || !audio_source" data-interaction="ibVoice.sendVoiceRequest.click.1" @click="review" @keydown.enter="review">Review voice introduction</view></view></template>
    <template #overlays><IntroductionConfirmDialog :open="!!sheet" :mode="sheet" :busy="is_loading || media_busy || navigating" @close="sheet = ''" @confirm="allow" @rerecord="rerecord" @delete="remove_audio" /><IntroductionConfirmDialog :open="discard" mode="discard" :busy="is_loading || media_busy || navigating" @close="discard = false" @confirm="back_now" /><EventActionLoading :visible="is_loading" label="Preparing your voice introduction…" /><DiscoverGuide :open="guide_open" :step="guide_step" :busy="guide_busy" :error="guide_error" :next-disabled="guide_next_disabled" :target-user-id="guide_target" :mode="guide_mode" @next="guide_next" @back="guide_back" @skip="guide_skip" /><EventActionLoading :visible="guide_loading" label="Updating your preferences…" /></template>
  </SecondaryPageFrame>
</template>
<style scoped src="./icebreaker.css"></style>
<style scoped>
.ice-question { margin-top: 34.351rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.ice-question-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--cimoa-text-secondary);
  font-size: 30.534rpx;
  font-weight: 600;
}
.ice-question-top > view { display: flex; align-items: center; gap: 15.267rpx; }
.ice-question-top > text { color: var(--cimoa-text-connection-muted); font-size: 28.626rpx; }
.ice-question-icon {
  width: 53.435rpx;
  height: 53.435rpx;
  padding: 13.359rpx;
  border-radius: 50%;
  background: var(--cimoa-surface-profile-interest-icon);
  color: var(--cimoa-text-profile-interest-icon);
}
.ice-question-text {
  display: block;
  margin-top: 22.901rpx;
  font-size: 43.893rpx;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-wrap: pretty;
}
.ice-record-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30.534rpx;
  margin-top: 26.718rpx;
  padding: 49.618rpx 34.351rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-card);
}
.ice-record-empty { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; width: 100%; }
.ice-wave-space { height: 83.969rpx; width: 100%; }
.ice-record-time { font-size: 38.168rpx; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.ice-record-button {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 160.305rpx;
  height: 160.305rpx;
  border: 3.5px solid var(--cimoa-surface-transparent);
  border-radius: 50%;
  background: var(--cimoa-gradient-card-fill) padding-box, var(--cimoa-gradient-primary) border-box;
  color: var(--cimoa-text-link);
  cursor: pointer;
}
.ice-record-button::before {
  content: '';
  position: absolute;
  inset: -15.267rpx;
  border-radius: 50%;
  background: var(--cimoa-gradient-ice-record-glow);
  filter: blur(7.634rpx);
  z-index: -1;
  pointer-events: none;
}
.ice-record-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--cimoa-surface-card);
  pointer-events: none;
}
.ice-record-button > view { position: relative; z-index: 1; width: 68.702rpx; height: 68.702rpx; }
.ice-text-switch {
  display: flex;
  align-items: center;
  gap: 15.267rpx;
  height: 83.969rpx;
  padding: 0 38.168rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-surface-profile-icon);
  font-size: 30.534rpx;
  font-weight: 600;
  cursor: pointer;
}
.ice-text-switch > view { width: 34.351rpx; height: 34.351rpx; }
.ice-voice-note {
  display: flex;
  align-items: center;
  gap: 19.084rpx;
  margin-top: 26.718rpx;
  padding: 26.718rpx 34.351rpx;
  border-radius: 38.168rpx;
  background: var(--cimoa-surface-profile-icon);
  color: var(--cimoa-text-secondary);
  font-size: 27.672rpx;
  text-wrap: pretty;
}
.ice-voice-note > view { flex: none; width: 34.351rpx; height: 34.351rpx; }
</style>
