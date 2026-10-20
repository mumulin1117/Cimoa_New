<script setup>
import { computed, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import IcebreakerHeader from '@/components/IcebreakerHeader.vue'
import IcebreakerPerson from '@/components/IcebreakerPerson.vue'
import IcebreakerIcon from '@/components/IcebreakerIcon.vue'

const store = use_app_store(), frame = ref(null), user_id = ref(''), question_id = ref(''), mode = ref('text'), error = ref(''), navigating = ref(false)
const is_loading = false
onLoad(options => { user_id.value = String(options?.user_id || '') })
const context = computed(() => store.introduction_context(user_id.value))
const user = computed(() => context.value.user), questions = computed(() => context.value.questions)
const access_error = computed(() => context.value.error || context.value.blocker)
onShow(() => { question_id.value = context.value.draft?.payload.question_id || ''; mode.value = context.value.draft?.payload.mode || 'text'; error.value = '' })
const back = async () => { if (is_loading.value || navigating.value) return; try { await frame.value.navigate_back('/pages/discover/index') } catch (cause) { error.value = cause.message } }
const answer = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  if (!question_id.value) { error.value = 'Pick one question first.'; return }
  const result = store.stage_introduction_form(user_id.value, question_id.value, mode.value)
  if (!result.success || result.reason === 'cancelled') { if (result.reason !== 'cancelled') error.value = result.message; return }
  navigating.value = true
  try { await frame.value.navigate_forward(`/pages/discover/icebreaker/${mode.value}?user_id=${encodeURIComponent(user_id.value)}&draft_id=${encodeURIComponent(result.data)}&question_id=${encodeURIComponent(question_id.value)}`) } catch (cause) { error.value = cause.message }
  finally { navigating.value = false }
}
onHide(() => { navigating.value = false })
</script>

<template>
  <SecondaryPageFrame ref="frame" class="ice-select-page">
    <template #header><IcebreakerHeader :title="`Say Hi to ${user?.user_name || ''}`" interaction="ibSelect.goBack.click.1" :busy="is_loading || navigating" @back="back" /><text v-if="error" class="ice-error" role="alert">{{ error }}</text></template>
    <view class="ice-body">
      <template v-if="!access_error && user"><IcebreakerPerson :user="user" /><text class="ice-title">Pick a question</text><text class="ice-copy">Start the conversation with something fun.</text>
        <view v-if="!questions.length" class="ice-unavailable" role="status">No icebreaker questions are available.</view>
        <view class="ice-questions"><view v-for="question in questions" :key="question.question_id" class="ice-choice" :class="{ 'ice-choice--selected': question_id === question.question_id }" role="button" tabindex="0" :aria-pressed="question_id === question.question_id" data-interaction="ibSelect.q.pick.click.1" @click="question_id = question.question_id; error = ''" @keydown.enter="question_id = question.question_id; error = ''"><text>{{ question.text }}</text><view class="ice-choice-indicator"><view><IcebreakerIcon name="check" /></view></view></view></view>
        <text class="ice-label">Answer with</text><view class="ice-modes"><view class="ice-mode" :class="{ 'ice-mode--selected': mode === 'text' }" role="button" tabindex="0" :aria-pressed="mode === 'text'" data-interaction="ibSelect.pickText.click.1" @click="mode = 'text'" @keydown.enter="mode = 'text'"><view><IcebreakerIcon name="keyboard" /></view><text>Text</text></view><view class="ice-mode" :class="{ 'ice-mode--selected': mode === 'voice' }" role="button" tabindex="0" :aria-pressed="mode === 'voice'" data-interaction="ibSelect.pickVoice.click.1" @click="mode = 'voice'" @keydown.enter="mode = 'voice'"><view><IcebreakerIcon name="mic" /></view><text>Voice</text></view></view>
        <view class="ice-select-answer"><view class="ice-primary" role="button" tabindex="0" :aria-disabled="is_loading || navigating || !question_id" data-interaction="ibSelect.answerGo.click.1" @click="answer" @keydown.enter="answer">Answer This Question</view></view><text class="ice-note">Introduction costs 10 coins · balance {{ context.balance }} coins</text>
      </template><view v-else class="ice-unavailable" role="alert">{{ access_error }}</view>
    </view>
  </SecondaryPageFrame>
</template>
<style scoped src="./icebreaker.css"></style>
