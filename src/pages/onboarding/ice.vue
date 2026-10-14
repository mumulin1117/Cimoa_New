<script setup>
import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_onboarding } from '@/composables/useOnboarding.js'
import { question_error } from '@/utils/onboardingFlow.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
import IceLibrarySheet from '@/components/IceLibrarySheet.vue'
import IceCustomSheet from '@/components/IceCustomSheet.vue'
const frame = ref(null), { context, catalog, error, access_error, is_loading, back, recover, save } = use_onboarding('ice', frame)
const selected = ref([...(context.value?.profile.questions || [])]), sheet = ref(''), sheet_error = ref(''), editing = ref(null), custom = ref('')
const empty_slots = computed(() => 3 - selected.value.length)
const open = (type, index = null) => { error.value = ''; sheet_error.value = ''; editing.value = index; custom.value = index == null ? '' : selected.value[index]; sheet.value = type }
const close = () => { sheet.value = ''; sheet_error.value = ''; editing.value = null; custom.value = '' }
const choose = (question, is_custom = false) => {
  sheet_error.value = ''
  const value = question.trim(), message = question_error(value)
  if (message) { sheet_error.value = message; return }
  const existing = selected.value.indexOf(value)
  if (editing.value != null) {
    if (existing >= 0 && existing !== editing.value) { sheet_error.value = 'Choose a different question for each slot.'; return }
    selected.value = selected.value.map((item, index) => index === editing.value ? value : item); close(); return
  }
  if (existing >= 0) { if (is_custom) { sheet_error.value = 'This question is already selected.'; return }; selected.value = selected.value.filter(item => item !== value); return }
  if (selected.value.length >= 3) { sheet_error.value = 'Three questions is the limit — remove one first.'; return }
  selected.value = [...selected.value, value]
  if (is_custom) close()
}
const edit = index => open(catalog.value.questions.includes(selected.value[index]) ? 'library' : 'custom', index)
const remove = index => { error.value = ''; selected.value = selected.value.filter((_, row) => row !== index) }
onHide(close)
</script>
<template>
  <OnboardingFrame ref="frame" step="ice" :busy="is_loading" :error="error" :access-error="access_error" :disabled="selected.length !== 3" interaction="obIce.goObNotif.click.1" @back="back" @recover="recover" @continue="save({ questions: [...selected] })">
    <text class="auth-heading">Your icebreakers</text><text class="auth-description">Choose three questions people can answer when they say hi.</text>
    <view class="ice-list"><view v-for="(question, index) in selected" :key="index" class="ice-question"><view class="ice-number">{{ index + 1 }}</view><text class="ice-text">{{ question }}</text><view class="ice-icon" role="button" tabindex="0" :aria-label="`Edit question ${index + 1}`" data-interaction="obIce.q.edit.click.1" @click="edit(index)" @keydown.enter="edit(index)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3.5 20 8l-11 11H4.5v-4.5z" /></svg></view><view class="ice-icon ice-remove" role="button" tabindex="0" :aria-label="`Remove question ${index + 1}`" data-interaction="obIce.q.drop.click.1" @click="remove(index)" @keydown.enter="remove(index)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></view></view>
      <view v-for="index in empty_slots" :key="`empty-${index}`" class="ice-question ice-empty" role="button" tabindex="0" data-interaction="obIce.e.tap.click.1" @click="open('library')" @keydown.enter="open('library')"><view class="ice-number">{{ selected.length + index }}</view><text class="ice-text">Choose a question</text><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></view>
    </view>
    <view class="ice-browse" role="button" tabindex="0" data-interaction="obIce.browseQuestions.click.1" @click="open('library')" @keydown.enter="open('library')">Browse more questions</view><view class="ice-custom" role="button" tabindex="0" data-interaction="obIce.writeOwnQuestion.click.1" @click="open('custom')" @keydown.enter="open('custom')">Write my own</view>
    <template #overlays><IceLibrarySheet :open="sheet === 'library'" :questions="catalog.questions" :selected="selected" :error="sheet_error" @close="close" @choose="choose" /><IceCustomSheet v-model="custom" :open="sheet === 'custom'" :editing="editing != null" :error="sheet_error" @close="close" @add="choose(custom, true)" /></template>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
<style scoped>
.ice-list { display: flex; flex-direction: column; gap: 26.718rpx; margin-top: 41.985rpx; }
.ice-question { display: flex; align-items: center; gap: 26.718rpx; padding: 34.351rpx; background: var(--cimoa-surface-card); border-radius: 45.802rpx; box-shadow: var(--cimoa-shadow-card); }
.ice-number { flex: none; display: flex; align-items: center; justify-content: center; width: 72.519rpx; height: 72.519rpx; border-radius: 36.26rpx; background: var(--cimoa-gradient-ice-badge); font-size: 32.443rpx; font-weight: 800; color: var(--cimoa-text-inverse); }
.ice-text { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 34.351rpx; font-weight: 700; letter-spacing: -.01em; }
.ice-icon { flex: none; display: flex; align-items: center; justify-content: center; width: 76.336rpx; height: 76.336rpx; color: var(--cimoa-text-secondary); }
.ice-icon svg { width: 40.076rpx; height: 40.076rpx; }
.ice-remove { color: var(--cimoa-text-onboarding-muted); }
.ice-empty { min-height: 145.038rpx; background: var(--cimoa-surface-onboarding-empty); border: 2.863rpx dashed var(--cimoa-surface-onboarding-dashed); box-shadow: none; }
.ice-empty .ice-number { background: var(--cimoa-surface-onboarding-counter); color: var(--cimoa-text-onboarding-muted); }
.ice-empty .ice-text { color: var(--cimoa-text-auth-placeholder); font-size: 32.443rpx; font-weight: 600; }
.ice-empty > svg { flex: none; width: 41.985rpx; height: 41.985rpx; color: var(--cimoa-text-onboarding-muted); }
.ice-browse { display: flex; align-items: center; justify-content: center; height: 110.687rpx; margin-top: 38.168rpx; border-radius: 55.344rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-auth-secondary); font-size: 32.443rpx; font-weight: 700; }
.ice-custom { margin-top: 26.718rpx; text-align: center; font-size: 30.534rpx; font-weight: 600; color: var(--cimoa-text-auth-muted); text-decoration: underline; }
</style>
