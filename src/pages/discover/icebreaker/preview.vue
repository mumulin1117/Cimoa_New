<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onReady } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import IcebreakerHeader from '@/components/IcebreakerHeader.vue'
import IcebreakerIcon from '@/components/IcebreakerIcon.vue'
import IcebreakerAudio from '@/components/IcebreakerAudio.vue'
import IntroductionConfirmDialog from '@/components/IntroductionConfirmDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), user_id = ref(''), draft_id = ref(''), media_id = ref(''), error = ref(''), removing = ref(false), sheet = ref(''), navigating = ref(false), loading_label = ref('Preparing your request…')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const context = computed(() => store.introduction_context(user_id.value, draft_id.value))
const access_error = computed(() => context.value.error || context.value.blocker || (!context.value.audio || context.value.audio.media_id !== media_id.value ? 'This voice introduction is unavailable. Record it again.' : ''))
onLoad(options => { user_id.value = String(options?.user_id || ''); draft_id.value = String(options?.draft_id || ''); media_id.value = String(options?.media_id || '') })
const voice_url = computed(() => `/pages/discover/icebreaker/voice?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}`)
const back = async () => { if (is_loading.value || navigating.value || sheet.value) return; try { await frame.value.navigate_back(voice_url.value) } catch (cause) { error.value = cause.message } }
const rerecord = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  removing.value = true
}
const remove = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  removing.value = false
  loading_label.value = 'Removing recording…'
  const result = await run_with_loading(scope => store.discard_media(media_id.value, scope))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  navigating.value = true
  try { await frame.value.navigate_back(voice_url.value) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const continue_voice = () => {
  if (is_loading.value || navigating.value || access_error.value) return
  sheet.value = context.value.balance < 10 ? 'insufficient' : 'confirm'; error.value = ''
}
const confirm_voice = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  if (context.value.balance < 10) { sheet.value = 'insufficient'; return }
  loading_label.value = 'Preparing your request…'
  const result = await run_with_loading(() => store.prepare_voice_introduction_spend(draft_id.value))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  sheet.value = ''; navigating.value = true
  try { await frame.value.navigate_forward(`/pages/coins/processing?return_context_id=${encodeURIComponent(result.data)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const coins = async () => {
  if (is_loading.value || navigating.value) return
  sheet.value = ''; navigating.value = true
  try { await frame.value.navigate_forward(`/pages/coins/index?return_context_id=${encodeURIComponent(draft_id.value)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
onReady(() => { if (context.value.completed_request_id) frame.value.navigate_replace(`/pages/connections/sent?request_id=${encodeURIComponent(context.value.completed_request_id)}`) })
const hide = () => { removing.value = false; sheet.value = ''; navigating.value = false; cancel_loading() }
onHide(hide); onUnmounted(hide)
</script>
<template>
  <SecondaryPageFrame ref="frame" class="ice-preview-page" :scroll-locked="!!sheet || removing">
    <template #header><IcebreakerHeader title="Voice preview" interaction="ibPreview.goBack.click.1" :busy="is_loading || navigating" @back="back" /><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
    <view class="ice-body"><template v-if="!access_error"><view class="ice-preview-question"><text>{{ context.user.user_name.toUpperCase() }}’S QUESTION</text><text>{{ context.question.text }}</text></view><view class="ice-preview-audio"><IcebreakerAudio :src="context.audio.media_url" :duration="context.audio.duration_ms" interaction="ibPreview.togglePlay.click.1" /></view><view class="ice-preview-actions"><view role="button" tabindex="0" aria-label="Delete" :aria-disabled="is_loading || navigating" data-interaction="ibPreview.deleteVoice.click.1" @click="!is_loading && !navigating && (removing = true)" @keydown.enter="!is_loading && !navigating && (removing = true)"><IcebreakerIcon name="delete" /></view><view role="button" tabindex="0" aria-label="Re-record" :aria-disabled="is_loading || navigating" data-interaction="ibPreview.reRecord.click.1" @click="rerecord" @keydown.enter="rerecord"><IcebreakerIcon name="rerecord" /></view></view><text class="ice-note">Introduction costs 10 coins · balance {{ context.balance }} coins</text></template><view v-else class="ice-unavailable" role="alert">{{ access_error }}</view></view>
    <template #footer><view v-if="!access_error" class="ice-footer"><view class="ice-primary" role="button" tabindex="0" :aria-disabled="is_loading || navigating" data-interaction="ibPreview.continueVoice.click.1" @click="continue_voice" @keydown.enter="continue_voice">Continue</view></view><view v-else class="ice-footer"><view class="ice-switch" role="button" tabindex="0" @click="back" @keydown.enter="back">Return</view></view></template>
    <template #overlays><IntroductionConfirmDialog :open="!!sheet" :mode="sheet" :busy="is_loading" :balance="context.balance" :user-name="context.user?.user_name" @close="sheet = ''" @confirm="confirm_voice" @coins="coins" /><ConfirmDialog :visible="removing" title="Remove this recording?" message="This audio will be permanently removed." confirm-label="Remove" danger @cancel="removing = false" @confirm="remove" /><EventActionLoading :visible="is_loading" :label="loading_label" /></template>
  </SecondaryPageFrame>
</template>
<style scoped src="./icebreaker.css"></style>
<style scoped>
.ice-preview-question { padding: 30.534rpx 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.ice-preview-question > text:first-child { display: block; color: var(--cimoa-text-connection-muted); font-size: 24.809rpx; font-weight: 700; letter-spacing: 0.08em; }
.ice-preview-question > text:last-child { display: block; margin-top: 11.45rpx; font-size: 34.351rpx; font-weight: 700; letter-spacing: -0.015em; text-wrap: pretty; }
.ice-preview-audio { margin-top: 34.351rpx; padding: 41.985rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.ice-preview-actions { display: flex; justify-content: center; gap: 91.603rpx; margin-top: 34.351rpx; }
.ice-preview-actions > view { display: flex; align-items: center; justify-content: center; width: 114.504rpx; height: 114.504rpx; padding: 32.443rpx; border-radius: 50%; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-connection-chat-input); cursor: pointer; }
.ice-preview-actions > view:first-child { color: var(--cimoa-text-settings-danger); }
</style>
