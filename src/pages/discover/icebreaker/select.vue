<script setup>
import { Teleport, computed, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import IcebreakerHeader from '@/components/IcebreakerHeader.vue'
import IcebreakerPerson from '@/components/IcebreakerPerson.vue'
import IcebreakerIcon from '@/components/IcebreakerIcon.vue'
import { use_icebreaker_motion } from '@/composables/useIcebreakerMotion.js'
import { use_send_surface_target } from '@/composables/useSendSurface.js'
import { use_discover_guide } from '@/composables/useDiscoverGuide.js'
import DiscoverGuide from '@/components/DiscoverGuide.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), user_id = ref(''), question_id = ref(''), mode = ref('text'), error = ref(''), navigating = ref(false)
const is_loading = false
const motion = use_icebreaker_motion({ auth_context: () => store.auth_context, user_id: () => user_id.value, question_id: () => question_id.value, kind: 'select' })
const surface = use_send_surface_target({ identity: () => ({ auth_context: store.auth_context, user_id: user_id.value }), element: () => frame.value?.$el || frame.value })
onLoad(options => { user_id.value = String(options?.user_id || ''); surface.enter(); motion.enter(); if (surface.surface_mode.value) motion.finish() })
const context = computed(() => store.introduction_context(user_id.value))
const user = computed(() => context.value.user), questions = computed(() => context.value.questions)
const access_error = computed(() => context.value.error || context.value.blocker)
const guide_presented = ref(false)
const guide = use_discover_guide('select', {
  ready: computed(() => guide_presented.value && !surface.busy.value && !navigating.value),
  available: () => !access_error.value,
  user_id: () => user_id.value, mode: () => mode.value,
  can_next: () => questions.value.some(question => question.question_id === question_id.value),
  element: () => frame.value?.$el || frame.value,
  return_discover: () => back(), open_answer: () => answer(),
})
onShow(() => { question_id.value = context.value.draft?.payload.question_id || ''; mode.value = context.value.draft?.payload.mode || 'text'; error.value = '' })
const back = async () => { if (is_loading || navigating.value || surface.busy.value) return false; navigating.value = true; try { if (surface.surface_mode.value) return await frame.value.navigate_back_with(dispatch => surface.back(dispatch), '/pages/discover/index'); else return await frame.value.navigate_back('/pages/discover/index') } catch (cause) { error.value = cause.message; return false } finally { navigating.value = false } }
const pick_question = value => { if (navigating.value || surface.busy.value) return; question_id.value = value; error.value = '' }
const pick_mode = value => { if (!navigating.value && !surface.busy.value) mode.value = value }
const answer = async () => {
  if (is_loading || navigating.value || surface.busy.value || access_error.value) return false
  if (!question_id.value) { error.value = 'Pick one question first.'; return false }
  const result = store.stage_introduction_form(user_id.value, question_id.value, mode.value)
  if (!result.success || result.reason === 'cancelled') { if (result.reason !== 'cancelled') error.value = result.message; return false }
  navigating.value = true
  const receipt = motion.arm(mode.value)
  try { const opened = await frame.value.navigate_forward(`/pages/discover/icebreaker/${mode.value}?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(result.data)}&question_id=${encodeURIComponent(question_id.value)}`); if (opened === false) motion.cancel(receipt); return opened } catch (cause) { motion.cancel(receipt); error.value = cause.message; return false }
  finally { navigating.value = false }
}
onHide(() => { navigating.value = false; guide_presented.value = false })
</script>

<template>
  <Teleport to="#cimoa-send-surface-target" :disabled="!surface.borrowed.value">
  <SecondaryPageFrame ref="frame" class="ice-select-page" :content-motion="!surface.surface_mode.value" :surface-motion="surface.surface_mode.value" :style="[motion.style, surface.style.value]" :aria-busy="navigating || surface.busy.value" :inert="surface.busy.value ? '' : undefined" @presented="guide_presented = true">
    <template #header><IcebreakerHeader :title="`Say Hi to ${user?.user_name || ''}`" interaction="ibSelect.goBack.click.1" :busy="is_loading || navigating || surface.busy.value" @back="back" /><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
    <view class="ice-body" :inert="navigating || surface.busy.value ? '' : undefined">
      <template v-if="!access_error && user"><IcebreakerPerson :user="user" :class="{ 'ice-continuity-cue': motion.cue.value }" @animationend="motion.finish" /><text class="ice-title">Pick a question</text><text class="ice-copy">Start the conversation with something fun.</text>
        <view v-if="!questions.length" class="ice-unavailable" role="status">No icebreaker questions are available.</view>
        <view class="ice-questions"><view v-for="question in questions" :key="question.question_id" class="ice-choice" :class="{ 'ice-choice--selected': question_id === question.question_id }" role="button" tabindex="0" :aria-pressed="question_id === question.question_id" :aria-disabled="navigating" data-interaction="ibSelect.q.pick.click.1" @click="pick_question(question.question_id)" @keydown.enter="pick_question(question.question_id)"><text>{{ question.text }}</text><view class="ice-choice-indicator"><view><IcebreakerIcon name="check" /></view></view></view></view>
        <text class="ice-label">Answer with</text><view class="ice-modes"><view class="ice-mode" :class="{ 'ice-mode--selected': mode === 'text' }" role="button" tabindex="0" :aria-pressed="mode === 'text'" :aria-disabled="navigating" data-interaction="ibSelect.pickText.click.1" @click="pick_mode('text')" @keydown.enter="pick_mode('text')"><view><IcebreakerIcon name="keyboard" /></view><text>Text</text></view><view class="ice-mode" :class="{ 'ice-mode--selected': mode === 'voice' }" role="button" tabindex="0" :aria-pressed="mode === 'voice'" :aria-disabled="navigating" data-interaction="ibSelect.pickVoice.click.1" @click="pick_mode('voice')" @keydown.enter="pick_mode('voice')"><view><IcebreakerIcon name="mic" /></view><text>Voice</text></view></view>
        <view class="ice-select-answer"><view class="ice-primary" role="button" tabindex="0" :aria-disabled="is_loading || navigating || surface.busy.value || !question_id" :data-navigation-busy="navigating && !!question_id" data-interaction="ibSelect.answerGo.click.1" @click="answer" @keydown.enter="answer">Answer This Question</view></view><text class="ice-note">Introduction costs 10 coins · balance {{ context.balance }} coins</text>
      </template><view v-else class="ice-unavailable" role="alert">{{ access_error }}</view>
    </view>
    <template #overlays><DiscoverGuide :open="guide.open.value" :step="guide.step.value" :busy="guide.busy.value" :error="guide.error.value" :next-disabled="guide.next_disabled.value" :mode="guide.mode.value" :target-user-id="guide.target_user_id.value" @next="guide.next" @back="guide.back" @skip="guide.skip" /><EventActionLoading :visible="guide.is_loading.value" label="Updating your preferences…" /></template>
  </SecondaryPageFrame>
  </Teleport>
</template>
<style scoped src="./icebreaker.css"></style>
