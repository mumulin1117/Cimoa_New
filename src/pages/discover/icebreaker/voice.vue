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

const store = use_app_store(), frame = ref(null), user_id = ref(''), draft_id = ref(''), error = ref(''), sheet = ref(''), discard = ref(false), navigating = ref(false), active = ref(true)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { draft: recording_draft, recording, busy: media_busy, seconds, clear, start, stop } = use_event_media(error)
const context = computed(() => store.introduction_context(user_id.value, draft_id.value))
const access_error = computed(() => context.value.error || context.value.blocker)
const audio_source = computed(() => recording_draft.value?.url || context.value.audio?.media_url || '')
const audio_duration = computed(() => recording_draft.value?.duration_ms || context.value.audio?.duration_ms || 0)
const question_number = computed(() => context.value.questions.findIndex(q => q.question_id === context.value.question?.question_id) + 1)
const same_university = computed(() => context.value.user?.university === store.current_user.university ? 'Same university' : context.value.user?.university)
const recording_time = computed(() => `${String(Math.floor(seconds.value / 60)).padStart(2, '0')}:${String(seconds.value % 60).padStart(2, '0')}`)
onLoad(options => { user_id.value = String(options?.user_id || ''); draft_id.value = String(options?.draft_id || '') })
onShow(() => { active.value = true })
const back_now = async () => { clear(); discard.value = false; try { await frame.value.navigate_back(`/pages/discover/icebreaker/select?user_id=${encodeURIComponent(user_id.value)}`) } catch (cause) { error.value = cause.message } }
const back = () => { if (is_loading.value || navigating.value || media_busy.value || sheet.value) return; recording.value || recording_draft.value ? discard.value = true : back_now() }
const persist_recording = async () => {
  if (!recording_draft.value) return context.value.audio?.media_id || null
  const old = context.value.audio?.media_id
  const result = await run_with_loading(scope => store.save_media(recording_draft.value.blob, 'audio', recording_draft.value.duration_ms, { ...scope, introduction_draft_id: draft_id.value }))
  if (!active.value || result.reason === 'cancelled') return null
  if (!result.success) { error.value = result.message; return null }
  clear()
  if (old && old !== result.data.media_id) await store.discard_media(old, { is_current: () => active.value })
  return result.data.media_id
}
const switch_text = async () => {
  if (is_loading.value || navigating.value || media_busy.value || access_error.value) return
  if (recording.value) { error.value = 'Stop recording before switching to text.'; return }
  if (recording_draft.value && !await persist_recording()) return
  const result = await run_with_loading(() => store.update_introduction_draft(draft_id.value, { mode: 'text' }))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  navigating.value = true
  try { await frame.value.navigate_replace(`/pages/discover/icebreaker/text?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const record = () => { if (is_loading.value || media_busy.value || access_error.value) return; recording.value ? stop() : sheet.value = 'microphone' }
const allow = async () => { sheet.value = ''; if (!access_error.value) await start() }
const review = async () => {
  if (is_loading.value || navigating.value || media_busy.value || recording.value || access_error.value) return
  const id = await persist_recording()
  if (!id) { if (!error.value) error.value = 'Record a playable voice introduction first.'; return }
  navigating.value = true
  try { await frame.value.navigate_forward(`/pages/discover/icebreaker/preview?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}&media_id=${encodeURIComponent(id)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const rerecord = () => { sheet.value = ''; clear(); sheet.value = 'microphone' }
const remove_audio = async () => {
  sheet.value = ''; clear()
  if (!context.value.audio) return
  const result = await run_with_loading(scope => store.discard_media(context.value.audio.media_id, scope))
  if (!result.success && result.reason !== 'cancelled') error.value = result.message
}
const hide = () => { active.value = false; sheet.value = ''; discard.value = false; navigating.value = false; cancel_loading() }
onHide(hide); onUnmounted(() => { hide(); clear() })
</script>
<template>
  <SecondaryPageFrame ref="frame" class="ice-voice-page" :scroll-locked="!!sheet || discard">
    <template #header><IcebreakerHeader title="Answer an Icebreaker" variant="voice" menu interaction="ibVoice.goBack.click.1" :busy="is_loading || navigating || media_busy" @back="back" @menu="sheet = 'options'" /><text v-if="error" class="ice-error" role="alert">{{ error }}</text></template>
    <view class="ice-body"><template v-if="!access_error"><IcebreakerPerson :user="context.user" variant="voice" :university="same_university" /><view class="ice-question"><view class="ice-question-top"><view><view class="ice-question-icon"><SourceIcon name="support" /></view><text>Icebreaker</text></view><text>{{ question_number }}/{{ context.questions.length }}</text></view><text class="ice-question-text">{{ context.question.text }}</text></view>
      <view class="ice-record-card">
        <IcebreakerAudio v-if="audio_source && !recording && !media_busy" :src="audio_source" :duration="audio_duration" voice interaction="ibVoice.toggleVoicePlay.click.1" />
        <view v-else class="ice-record-empty"><view class="ice-wave-space" /><text class="ice-record-time">{{ recording_time }}</text><view class="ice-record-button" role="button" tabindex="0" :aria-label="recording ? 'Stop recording' : 'Start recording'" :aria-disabled="media_busy || is_loading" data-interaction="ibVoice.record.click.1" @click="record" @keydown.enter="record"><view><IcebreakerIcon :name="recording ? 'pause' : 'mic'" /></view></view></view>
        <view class="ice-text-switch" role="button" tabindex="0" :aria-disabled="is_loading || media_busy || navigating" data-interaction="ibVoice.switchToTextReply.click.1" @click="switch_text" @keydown.enter="switch_text"><view><IcebreakerIcon name="keyboard" /></view><text>Switch to text</text></view>
      </view><view class="ice-voice-note"><view><IcebreakerIcon name="info" /></view><text>Your answer will be sent with the connection request</text></view>
    </template><view v-else class="ice-unavailable" role="alert">{{ access_error }}</view></view>
    <template #footer><view v-if="!access_error" class="ice-footer"><view class="ice-primary" role="button" tabindex="0" :aria-disabled="is_loading || media_busy || navigating || recording || !audio_source" data-interaction="ibVoice.sendVoiceRequest.click.1" @click="review" @keydown.enter="review">Send Request · 10 Coins</view></view></template>
    <template #overlays><IntroductionConfirmDialog :open="!!sheet" :mode="sheet" :busy="is_loading || media_busy" @close="sheet = ''" @confirm="allow" @rerecord="rerecord" @delete="remove_audio" /><IntroductionConfirmDialog :open="discard" mode="discard" :busy="is_loading || media_busy" @close="discard = false" @confirm="back_now" /><EventActionLoading :visible="is_loading" label="Saving your voice introduction…" /></template>
  </SecondaryPageFrame>
</template>
<style scoped src="./icebreaker.css"></style>
<style scoped>
.ice-question { margin-top: 34.351rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.ice-question-top { display: flex; align-items: center; justify-content: space-between; color: var(--cimoa-text-secondary); font-size: 30.534rpx; font-weight: 600; }
.ice-question-top > view { display: flex; align-items: center; gap: 15.267rpx; }
.ice-question-top > text { color: var(--cimoa-text-connection-muted); font-size: 28.626rpx; }
.ice-question-icon { width: 53.435rpx; height: 53.435rpx; padding: 13.359rpx; border-radius: 50%; background: var(--cimoa-surface-profile-interest-icon); color: var(--cimoa-text-profile-interest-icon); }
.ice-question-text { display: block; margin-top: 22.901rpx; font-size: 43.893rpx; font-weight: 800; letter-spacing: -0.02em; text-wrap: pretty; }
.ice-record-card { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; margin-top: 26.718rpx; padding: 49.618rpx 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.ice-record-empty { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; width: 100%; }
.ice-wave-space { height: 83.969rpx; width: 100%; }
.ice-record-time { font-size: 38.168rpx; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.ice-record-button { position: relative; isolation: isolate; display: flex; align-items: center; justify-content: center; width: 160.305rpx; height: 160.305rpx; border: 3.5px solid var(--cimoa-surface-transparent); border-radius: 50%; background: var(--cimoa-gradient-card-fill) padding-box, var(--cimoa-gradient-primary) border-box; color: var(--cimoa-text-link); cursor: pointer; }
.ice-record-button::before { content: ''; position: absolute; inset: -15.267rpx; border-radius: 50%; background: var(--cimoa-gradient-ice-record-glow); filter: blur(7.634rpx); z-index: -1; pointer-events: none; }
.ice-record-button::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--cimoa-surface-card); pointer-events: none; }
.ice-record-button > view { position: relative; z-index: 1; width: 68.702rpx; height: 68.702rpx; }
.ice-text-switch { display: flex; align-items: center; gap: 15.267rpx; height: 83.969rpx; padding: 0 38.168rpx; border-radius: 41.985rpx; background: var(--cimoa-surface-profile-icon); font-size: 30.534rpx; font-weight: 600; cursor: pointer; }
.ice-text-switch > view { width: 34.351rpx; height: 34.351rpx; }
.ice-voice-note { display: flex; align-items: center; gap: 19.084rpx; margin-top: 26.718rpx; padding: 26.718rpx 34.351rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-profile-icon); color: var(--cimoa-text-secondary); font-size: 27.672rpx; text-wrap: pretty; }
.ice-voice-note > view { flex: none; width: 34.351rpx; height: 34.351rpx; }
</style>
