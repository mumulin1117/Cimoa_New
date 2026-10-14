<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store, make_operation_id } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), user_id = ref(''), question_id = ref(''), mode = ref('text'), error = ref(''), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { user_id.value = String(options?.user_id || '') })
const user = computed(() => store.user_by_id(user_id.value))
const questions = computed(() => store.questions_for_user(user_id.value))
const access_error = computed(() => store.hydration_status !== 'ready' ? 'Saved data is unavailable. Please retry.' : !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !user.value ? 'This profile is unavailable.' : store.introduction_blocker(user_id.value))
const back = async () => { if (is_loading.value || navigating.value) return; try { await frame.value.navigate_back('/pages/discover/index') } catch (cause) { error.value = cause.message } }
const answer = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  if (!question_id.value) { error.value = 'Pick one question first.'; return }
  const result = await run_with_loading(() => store.save_draft('introduction', user_id.value, { user_id: user_id.value, question_id: question_id.value, mode: mode.value, operation_id: make_operation_id('intro') }))
  if (!result.success || result.reason === 'cancelled') { if (result.reason !== 'cancelled') error.value = result.message; return }
  navigating.value = true
  try { await frame.value.navigate_forward(`/pages/discover/icebreaker/${mode.value}?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(result.data)}`) } catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
onHide(() => { navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template>
  <SecondaryPageFrame ref="frame">
    <template #header><FlowPageHeader title="Say Hi" interaction="ibSelect.goBack.click.1" :busy="is_loading || navigating" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template>
    <view class="flow-body">
      <template v-if="!access_error && user"><text class="flow-title">Say Hi to {{ user.user_name.split(' ')[0] }}</text><text class="flow-copy">{{ [user.user_name, user.age, user.university, user.year].filter(Boolean).join(' · ') }}</text><text class="flow-label">Pick a question</text><text class="flow-copy">Start the conversation with something real.</text>
        <view v-if="!questions.length" class="flow-card" role="status">No icebreaker questions are available.</view>
        <view v-for="question in questions" :key="question.question_id" class="flow-choice" :class="{ 'flow-choice--selected': question_id === question.question_id }" role="button" :aria-pressed="question_id === question.question_id" data-interaction="ibSelect.q.pick.click.1" @click="question_id = question.question_id; error = ''">{{ question.text }}</view>
        <text class="flow-label">Answer with</text><view class="flow-chip-row"><view class="flow-chip" :class="{ 'flow-chip--selected': mode === 'text' }" role="button" data-interaction="ibSelect.pickText.click.1" @click="mode = 'text'">Text · Free</view><view class="flow-chip" :class="{ 'flow-chip--selected': mode === 'voice' }" role="button" data-interaction="ibSelect.pickVoice.click.1" @click="mode = 'voice'">Voice · 10 coins</view></view>
      </template><view v-else class="flow-card" role="alert">{{ access_error }}</view>
    </view>
    <template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="is_loading || navigating || !question_id" data-interaction="ibSelect.answerGo.click.1" @click="answer">Answer This Question</view></view></template>
    <template #overlays><EventActionLoading :visible="is_loading" label="Saving your question…" /></template>
  </SecondaryPageFrame>
</template>
