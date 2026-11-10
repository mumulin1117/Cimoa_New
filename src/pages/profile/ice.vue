<script setup>
import { ref } from 'vue'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import { use_profile_editor } from '@/composables/useProfileEditor.js'
import { question_error } from '@/utils/onboardingFlow.js'
const frame = ref(null), { store, context, account_id, error, access_error, is_loading, back, recover, submit } = use_profile_editor(frame, '/pages/profile/edit')
const questions = ref([...(context.value?.questions || [])]), custom = ref('')
const remove = index => { if (is_loading.value) return; error.value = ''; questions.value = questions.value.filter((_, row) => row !== index) }
const choose = (question, own = false) => {
  if (is_loading.value) return
  const value = question.trim(); error.value = question_error(value)
  if (error.value) return
  const index = questions.value.indexOf(value)
  if (index >= 0) { if (own) error.value = 'This question is already selected.'; else remove(index); return }
  if (questions.value.length >= 3) { error.value = 'Three questions is the limit — remove one first.'; return }
  questions.value = [...questions.value, value]; if (own) custom.value = ''
}
const save = () => { const patch = { questions: [...questions.value] }; error.value = store.profile_validation_error('ice', patch); if (!error.value) submit(() => store.save_profile_section('ice', patch, account_id)) }
</script>
<template>
  <ProfileEditorFrame ref="frame" class="profile-ice-page" title="Icebreakers" source="editIce" save :busy="is_loading" :error="error" @dismiss-error="error = String()" :access-error="access_error" @back="back" @recover="recover" @save="save">
    <text class="ice-count">{{ questions.length }}/3 · keep exactly three</text>
    <view class="chosen-list"><view v-for="(question, index) in questions" :key="question" class="chosen-question"><view class="question-number">{{ index + 1 }}</view><text>{{ question }}</text><view class="question-remove" role="button" :aria-label="`Remove question ${index + 1}`" data-interaction="editIce.q.drop.click.1" @click="remove(index)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></view></view></view>
    <text class="ice-label">Question library</text>
    <view class="question-library"><view v-for="question in store.onboarding_catalog.questions" :key="question" class="library-question" :class="{ selected: questions.includes(question) }" role="button" :aria-pressed="questions.includes(question)" data-interaction="editIce.q.pick.click.1" @click="choose(question)">{{ question }}</view></view>
    <text class="ice-label">Write your own</text><view class="custom-question"><input v-model="custom" aria-label="Custom icebreaker" placeholder="Ask something friendly" :maxlength="160" data-interaction="editIce.onObCustom.change.1" @input="error = ''" /><view role="button" data-interaction="editIce.addCustom.click.1" @click="choose(custom, true)">Add</view></view>
  </ProfileEditorFrame>
</template>
<style scoped>
.ice-count { color: var(--cimoa-text-auth-placeholder); font-size: 27.672rpx; font-weight: 700; }
.chosen-list, .question-library { display: flex; flex-direction: column; gap: 19.084rpx; margin-top: 22.901rpx; }
.chosen-question {
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  padding: 30.534rpx 34.351rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.802rpx;
  box-shadow: var(--cimoa-shadow-card);
}
.question-number {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 53.435rpx;
  height: 53.435rpx;
  border-radius: 26.718rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  font-size: 26.718rpx;
  font-weight: 800;
}
.chosen-question > text { flex: 1; min-width: 0; font-size: 31.489rpx; font-weight: 600; }
.question-remove {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 83.969rpx;
  height: 83.969rpx;
  color: var(--cimoa-text-profile-chevron);
}
.question-remove svg { width: 32.443rpx; height: 32.443rpx; }
.ice-label { display: block; font-size: 32.443rpx; font-weight: 700; margin-top: 41.985rpx; }
.library-question {
  padding: 30.534rpx 34.351rpx;
  border-radius: 38.168rpx;
  background: var(--cimoa-surface-card);
  border: 1px solid var(--cimoa-surface-transparent);
  box-shadow: var(--cimoa-shadow-auth-input);
  font-size: 31.489rpx;
}
.library-question.selected { background: var(--cimoa-surface-accent-lavender); border-color: var(--cimoa-brand-purple); font-weight: 700; }
.custom-question {
  display: flex;
  align-items: center;
  gap: 19.084rpx;
  margin-top: 19.084rpx;
  min-height: 106.87rpx;
  padding: 19.084rpx 34.351rpx;
  border-radius: 34.351rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auth-input);
}
.custom-question input { flex: 1; min-width: 0; font-size: 32.443rpx; }
.custom-question > view { flex: none; font-size: 30.534rpx; font-weight: 700; color: var(--cimoa-text-link); }
</style>
