<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onReady } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_visual_viewport } from '@/composables/useEventViewport.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import IcebreakerHeader from '@/components/IcebreakerHeader.vue'
import IcebreakerPerson from '@/components/IcebreakerPerson.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), user_id = ref(''), draft_id = ref(''), reply = ref(''), error = ref(''), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { height: viewport_height, keyboard_open } = use_visual_viewport()
const context = computed(() => store.introduction_context(user_id.value, draft_id.value))
const access_error = computed(() => context.value.error || context.value.blocker)
let save_timer
const cancel_save = () => { clearTimeout(save_timer); save_timer = null }
onLoad(options => { user_id.value = String(options?.user_id || ''); draft_id.value = String(options?.draft_id || ''); reply.value = context.value.draft?.payload.text || '' })
const persist = async (mode = 'text') => {
  cancel_save()
  if (access_error.value) return false
  if (context.value.draft.payload.text === reply.value && context.value.draft.payload.mode === mode) return true
  const result = await run_with_loading(() => store.update_introduction_draft(draft_id.value, { text: reply.value, mode }))
  if (!result.success && result.reason !== 'cancelled') error.value = result.message
  return result.success
}
const edit = event => {
  reply.value = String(event.detail.value).slice(0, 300); error.value = ''; cancel_save()
  save_timer = setTimeout(() => { if (!is_loading.value && !navigating.value) persist() }, 800)
}
const back = async () => {
  if (is_loading.value || navigating.value) return
  if (!access_error.value && !await persist()) return
  navigating.value = true
  try { await frame.value.navigate_back(`/pages/discover/icebreaker/select?user_id=${encodeURIComponent(user_id.value)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const switch_voice = async () => {
  if (is_loading.value || navigating.value || access_error.value || !await persist('voice')) return
  navigating.value = true
  try { await frame.value.navigate_replace(`/pages/discover/icebreaker/voice?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(draft_id.value)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const open_result = async request_id => {
  navigating.value = true
  try { await frame.value.navigate_replace(`/pages/connections/sent?request_id=${encodeURIComponent(request_id)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const send = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  cancel_save()
  if (!reply.value.trim() || reply.value.length > 300) { error.value = 'Write an introduction up to 300 characters.'; return }
  const result = await run_with_loading(scope => store.send_introduction({ user_id: user_id.value, question_id: context.value.question.question_id, kind: 'text', text: reply.value, operation_id: context.value.draft.payload.operation_id, draft_id: draft_id.value }, scope))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  await open_result(result.data)
}
onReady(() => { if (context.value.completed_request_id) open_result(context.value.completed_request_id) })
const leave = () => { cancel_save(); navigating.value = false; cancel_loading() }
onHide(leave); onUnmounted(leave)
</script>

<template>
  <SecondaryPageFrame ref="frame" class="ice-text-page" :class="{ 'ice-text-page--keyboard': keyboard_open }" :style="{ height: viewport_height, '--app-safe-bottom': keyboard_open ? '0px' : undefined }">
    <template #header><IcebreakerHeader title="Your answer" variant="text" interaction="ibText.goBack.click.1" :busy="is_loading || navigating" @back="back" /><text v-if="error" class="ice-error" role="alert">{{ error }}</text></template>
    <view class="ice-body"><template v-if="!access_error"><IcebreakerPerson :user="context.user" :question="context.question.text" variant="text" /><text class="ice-write-title">Write something real</text><view class="ice-reply-card"><textarea :value="reply" class="ice-textarea" :disabled="is_loading || navigating" :maxlength="300" aria-label="Your introduction" :placeholder="`Write your reply to ${context.user.user_name}…`" placeholder-style="color:var(--cimoa-text-chat-placeholder);opacity:1" data-interaction="ibText.onReply.change.1" @input="edit" /><text class="ice-counter">{{ reply.length }} / 300</text></view></template><view v-else class="ice-unavailable" role="alert">{{ access_error }}</view></view>
    <template #footer><view v-if="!access_error" class="ice-footer"><view class="ice-primary" role="button" tabindex="0" :aria-disabled="is_loading || navigating || !reply.trim()" data-interaction="ibText.continueText.click.1" @click="send" @keydown.enter="send"><text>Continue</text><view><SourceIcon name="arrow-right" :stroke-width="2.4" /></view></view><view class="ice-switch" role="button" tabindex="0" :aria-disabled="is_loading || navigating" data-interaction="ibText.switchToVoice.click.1" @click="switch_voice" @keydown.enter="switch_voice">Switch to voice</view></view></template>
    <template #overlays><EventActionLoading :visible="is_loading" label="Saving your introduction…" /></template>
  </SecondaryPageFrame>
</template>
<style scoped src="./icebreaker.css"></style>
<style scoped>
.ice-write-title { display: block; font-size: 61.069rpx; font-weight: 800; letter-spacing: -0.03em; margin-top: 45.802rpx; }
.ice-reply-card { margin-top: 26.718rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.ice-textarea { display: inline-block; vertical-align: top; width: 100%; height: 324.427rpx; min-height: 324.427rpx; padding: 3.817rpx; margin-bottom: 7.634rpx; font-family: inherit; font-size: 43.893rpx; line-height: 1.4; color: var(--cimoa-text-title); }
.ice-counter { display: block; margin-top: 15.267rpx; text-align: right; font-size: 30.534rpx; color: var(--cimoa-text-connection-muted); }
.ice-text-page--keyboard .ice-footer { padding-bottom: 15.267rpx; }
</style>
