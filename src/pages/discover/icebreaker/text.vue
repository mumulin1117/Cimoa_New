<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onReady } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_visual_viewport } from '@/composables/useEventViewport.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import IcebreakerHeader from '@/components/IcebreakerHeader.vue'
import IcebreakerPerson from '@/components/IcebreakerPerson.vue'
import IntroductionConfirmDialog from '@/components/IntroductionConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import DiscoverGuide from '@/components/DiscoverGuide.vue'
import { use_discover_guide } from '@/composables/useDiscoverGuide.js'
import { use_icebreaker_motion } from '@/composables/useIcebreakerMotion.js'

const store = use_app_store(), frame = ref(null), user_id = ref(''), draft_id = ref(''), reply = ref(''), error = ref(''), navigating = ref(false), sheet = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { height: viewport_height, keyboard_open } = use_visual_viewport()
const context = computed(() => store.introduction_context(user_id.value, draft_id.value))
const access_error = computed(() => context.value.error || context.value.blocker || (!context.value.question ? 'Choose a question before writing your answer.' : ''))
const motion = use_icebreaker_motion({ auth_context: () => store.auth_context, user_id: () => user_id.value, question_id: () => context.value.question?.question_id || '', kind: 'text' })
const guide_ready = ref(false)
const { open: guide_open, step: guide_step, busy: guide_busy, error: guide_error, is_loading: guide_loading, next_disabled: guide_next_disabled, next: guide_next, back: guide_back, skip: guide_skip, target_user_id: guide_target, mode: guide_mode } = use_discover_guide('text', {
  ready: computed(() => guide_ready.value && !is_loading.value && !navigating.value && !keyboard_open.value && !access_error.value),
  user_id: () => user_id.value,
  mode: () => 'text',
  available: () => !sheet.value,
  element: () => frame.value?.$el || frame.value,
  return_select: () => back(),
})
onLoad(options => {
  user_id.value = String(options?.user_id || ''); draft_id.value = String(options?.draft_id || '')
  if ((!context.value.draft || context.value.error) && options?.question_id) {
    const opened = store.stage_introduction_form(user_id.value, String(options.question_id), 'text')
    if (opened.success) draft_id.value = opened.data
  }
  if (context.value.draft && !context.value.completed_request_id) store.edit_introduction_form(draft_id.value, { mode: 'text' })
  reply.value = context.value.draft?.payload.text || ''
  motion.enter()
})
const stage = (mode = 'text') => {
  if (access_error.value) return false
  const result = store.edit_introduction_form(draft_id.value, { text: reply.value, mode })
  if (!result.success) error.value = result.message
  return result.success
}
const edit = event => {
  if (guide_open.value || is_loading.value || navigating.value || sheet.value) return
  reply.value = String(event.detail.value).slice(0, 300); error.value = ''; stage()
}
const back = async () => {
  if (is_loading.value || navigating.value || sheet.value) return false
  navigating.value = true
  try { return await frame.value.navigate_back(`/pages/discover/icebreaker/select?user_id=${encodeURIComponent(user_id.value)}`) } catch (cause) { error.value = cause.message; return false } finally { navigating.value = false }
}
const switch_voice = async () => {
  if (guide_open.value || is_loading.value || navigating.value || sheet.value || access_error.value || !stage('voice')) return
  navigating.value = true
  const receipt = motion.arm('voice')
  try { if (await frame.value.navigate_replace(`/pages/discover/icebreaker/voice?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}&question_id=${encodeURIComponent(context.value.question.question_id)}`) === false) motion.cancel(receipt) } catch (cause) { motion.cancel(receipt); error.value = cause.message } finally { navigating.value = false }
}
const open_result = async request_id => {
  navigating.value = true
  try { await frame.value.navigate_replace(`/pages/connections/sent?request_id=${encodeURIComponent(request_id)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const send = async () => {
  if (guide_open.value || is_loading.value || navigating.value || sheet.value || access_error.value) return
  if (!reply.value.trim() || reply.value.length > 300) { error.value = 'Write an introduction up to 300 characters.'; return }
  if (!stage()) return
  error.value = ''; sheet.value = context.value.balance < 10 ? 'insufficient' : 'confirm'
}
const confirm_text = async () => {
  if (guide_open.value || is_loading.value || navigating.value || access_error.value || sheet.value !== 'confirm') return
  if (context.value.balance < 10) { sheet.value = 'insufficient'; return }
  const result = await run_with_loading(() => {
    const saved = store.persist_introduction_form(draft_id.value)
    return saved.success ? store.prepare_introduction_spend(draft_id.value, 'text') : saved
  })
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  sheet.value = ''; navigating.value = true
  try { await frame.value.navigate_forward(`/pages/coins/processing?return_context_id=${encodeURIComponent(result.data)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const coins = async () => {
  if (guide_open.value || is_loading.value || navigating.value || access_error.value) return
  const result = await run_with_loading(() => store.persist_introduction_form(draft_id.value))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  sheet.value = ''; navigating.value = true
  try { await frame.value.navigate_forward(`/pages/coins/index?return_context_id=${encodeURIComponent(draft_id.value)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
onReady(() => {
  if (context.value.completed_request_id) open_result(context.value.completed_request_id)
  else if (context.value.primary?.disabled) frame.value.navigate_replace(context.value.primary.destination).catch(cause => { error.value = cause.message })
})
const leave = () => { guide_ready.value = false; sheet.value = ''; navigating.value = false; cancel_loading() }
onHide(leave); onUnmounted(leave)
</script>

<template>
  <SecondaryPageFrame ref="frame" class="ice-text-page" content-motion :class="{ 'ice-text-page--keyboard': keyboard_open }" :aria-busy="is_loading || navigating || guide_busy" :scroll-locked="!!sheet || guide_open" :style="{ ...motion.style, height: viewport_height, '--app-safe-bottom': keyboard_open ? '0px' : undefined }" @presented="guide_ready = true">
    <template #header><IcebreakerHeader title="Your answer" variant="text" interaction="ibText.goBack.click.1" :busy="is_loading || navigating || guide_open" @back="back" /><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
    <view class="ice-body" :inert="navigating || guide_open ? '' : undefined"><template v-if="!access_error"><IcebreakerPerson :user="context.user" :question="context.question.text" variant="text" :class="{ 'ice-continuity-cue': motion.cue.value }" @animationend="motion.finish" /><text class="ice-write-title">Write something real</text><view class="ice-reply-card"><textarea :value="reply" class="ice-textarea" :disabled="guide_open || is_loading || navigating || !!sheet" :maxlength="300" aria-label="Your introduction" :placeholder="`Write your reply to ${context.user.user_name}…`" placeholder-style="color:var(--cimoa-text-chat-placeholder);opacity:1" data-interaction="ibText.onReply.change.1" @input="edit" /><text class="ice-counter">{{ reply.length }} / 300</text></view></template><view v-else class="ice-unavailable" role="alert">{{ access_error }}</view></view>
    <template #footer><view v-if="!access_error" class="ice-footer" :inert="navigating || guide_open ? '' : undefined"><view class="ice-primary ice-text-send" role="button" tabindex="0" :aria-disabled="guide_open || is_loading || navigating || !!sheet || !reply.trim()" data-interaction="ibText.continueText.click.1" @click="send" @keydown.enter="send"><text>Send text introduction</text><text>· 10 Coins</text></view><view class="ice-switch" role="button" tabindex="0" :aria-disabled="guide_open || is_loading || navigating || !!sheet" data-interaction="ibText.switchToVoice.click.1" @click="switch_voice" @keydown.enter="switch_voice">Switch to voice</view></view></template>
    <template #overlays><IntroductionConfirmDialog :open="!!sheet" :mode="sheet" kind="text" :busy="is_loading" :balance="context.balance" :user-name="context.user?.user_name" @close="sheet = ''" @confirm="confirm_text" @coins="coins" /><EventActionLoading :visible="is_loading" label="Preparing your text introduction…" /><DiscoverGuide :open="guide_open" :step="guide_step" :busy="guide_busy" :error="guide_error" :next-disabled="guide_next_disabled" :target-user-id="guide_target" :mode="guide_mode" @next="guide_next" @back="guide_back" @skip="guide_skip" /><EventActionLoading :visible="guide_loading" label="Updating your preferences…" /></template>
  </SecondaryPageFrame>
</template>
<style scoped src="./icebreaker.css"></style>
<style scoped>
.ice-write-title {
  display: block;
  margin-top: 45.802rpx;
  font-size: 41.985rpx;
  font-weight: 600;
  line-height: 53.435rpx;
  letter-spacing: -0.02em;
}
.ice-reply-card { margin-top: 26.718rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.ice-textarea {
  display: inline-block;
  vertical-align: top;
  width: 100%;
  height: 324.427rpx;
  min-height: 324.427rpx;
  padding: 3.817rpx;
  margin-bottom: 7.634rpx;
  font-family: inherit;
  font-size: 32.443rpx;
  font-weight: 400;
  line-height: 49.618rpx;
  letter-spacing: normal;
  word-break: normal;
  overflow-wrap: break-word;
  color: var(--cimoa-text-title);
}
.ice-textarea :deep(.uni-textarea-textarea),
.ice-textarea :deep(.uni-textarea-placeholder) { word-break: normal; overflow-wrap: break-word; }
.ice-counter {
  display: block;
  margin-top: 15.267rpx;
  text-align: right;
  font-size: 22.901rpx;
  font-weight: 400;
  line-height: 34.351rpx;
  color: var(--cimoa-text-connection-muted);
}
.ice-text-page--keyboard .ice-footer { padding-bottom: 15.267rpx; }
.ice-text-send {
  height: auto;
  min-height: 114.504rpx;
  flex-wrap: wrap;
  align-content: center;
  gap: 7.634rpx;
  padding: 11.45rpx;
  font-size: 30.534rpx;
  font-weight: 600;
  line-height: 41.985rpx;
}
.ice-text-page .ice-switch { font-size: 26.718rpx; font-weight: 500; line-height: 38.168rpx; }
</style>
