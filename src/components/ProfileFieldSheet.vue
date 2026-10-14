<script setup>
import { computed, ref, watch } from 'vue'
import { use_app_store } from '@/stores/store.js'
import OnboardingSheet from './OnboardingSheet.vue'
import { country_emoji, major_emoji } from '@/utils/profilePresentation.js'
const props = defineProps({ field: String, title: String, value: [String, Number, Array], busy: Boolean })
const emit = defineEmits(['close', 'select']), store = use_app_store(), selection = ref(null)
const variant = computed(() => props.field === 'mbti' ? 3 : ['major', 'country'].includes(props.field) ? 2 : 1)
const heading = computed(() => ({ height_cm: 'Select height', major: 'Select degree', clubs: 'Select club', mbti: 'Select MBTI type', religion: 'Select religion' })[props.field] || props.title)
watch(() => props.field, () => { selection.value = Array.isArray(props.value) ? [...props.value] : props.value })
const options = computed(() => props.field === 'height_cm' ? Array.from({ length: 51 }, (_, index) => index + 150) : store.profile_catalog[({ major: 'majors', country: 'countries' })[props.field] || props.field] || [])
const selected = value => Array.isArray(selection.value) ? selection.value.includes(value) : selection.value === value
const choose = value => {
  if (props.busy) return
  if (props.field === 'country') { const ids = Array.isArray(selection.value) ? selection.value : []; selection.value = ids.includes(value) ? ids.filter(id => id !== value) : ids.length < 2 ? [...ids, value] : [ids[1], value] }
  else if (props.field === 'height_cm') selection.value = value
  else emit('select', value)
}
</script>
<template>
  <OnboardingSheet class="profile-field-sheet" :open="!!field" :busy="busy" :label="heading || 'Profile field'" :close-interaction="`editAll.eaClose.click.${variant * 2 - 1}`" @close="emit('close')">
    <view class="field-title"><text>{{ heading }}</text><view class="field-close" role="button" aria-label="Close profile field" :data-interaction="`editAll.eaClose.click.${variant * 2}`" @click="emit('close')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M6 6l12 12M18 6 6 18" /></svg></view></view>
    <text v-if="field === 'country'" class="editor-copy">Pick up to 2</text>
    <view class="field-options" :class="{ grid: ['major', 'country'].includes(field), mbti: field === 'mbti' }"><view v-for="option in options" :key="option" class="field-option" :class="{ selected: selected(option) }" role="button" :aria-label="String(option)" :aria-pressed="selected(option)" :data-interaction="`editAll.o.pick.click.${variant}`" @click="choose(option)"><text v-if="field === 'country' || field === 'major'" class="field-emoji">{{ field === 'country' ? country_emoji(option) : major_emoji(option) }}</text><text>{{ option }}{{ field === 'height_cm' ? ' cm' : '' }}</text></view></view>
    <view v-if="field === 'mbti'" class="field-option" role="button" data-interaction="editAll.eaMbtiNone.click.1" @click="choose('Prefer not to say')">Prefer not to say</view>
    <view v-if="['height_cm', 'country'].includes(field)" class="editor-save field-done" role="button" :data-interaction="`editAll.eaCommit.click.${variant}`" @click="emit('select', selection)">{{ field === 'country' ? 'Save' : 'Done' }}</view>
  </OnboardingSheet>
</template>
<style scoped>
.profile-field-sheet :deep(.event-dialog-panel) { background: var(--cimoa-surface-profile-picker); }
.profile-field-sheet :deep(.event-dialog-handle) { display: none; }
.field-title { display: flex; align-items: center; gap: 22.901rpx; font-size: 43.893rpx; font-weight: 800; }
.field-title > text { flex: 1; }
.field-close {
  width: 76.336rpx;
  height: 76.336rpx;
  padding: 22.901rpx;
  border-radius: 38.168rpx;
  background: var(--cimoa-surface-tinted);
  cursor: pointer;
}
.field-close svg { width: 100%; height: 100%; }
.field-options { display: flex; flex-direction: column; gap: 19.084rpx; margin-top: 30.534rpx; }
.field-options.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.field-options.mbti { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.field-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 15.267rpx;
  min-height: 106.87rpx;
  border-radius: 53.435rpx;
  border: 1px solid var(--cimoa-surface-border);
  background: var(--cimoa-surface-card);
  font-size: 32.443rpx;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}
.grid .field-option { flex-direction: column; gap: 15.267rpx; aspect-ratio: 1; border-radius: 45.802rpx; font-size: 27.672rpx; }
.field-emoji { font-size: 64.885rpx; line-height: 1; }
.mbti .field-option { font-size: 31.489rpx; padding: 7.634rpx; }
.selected { background: var(--cimoa-gradient-primary); color: var(--cimoa-text-inverse); border-color: var(--cimoa-surface-transparent); }
.field-done { margin-top: 30.534rpx; }
</style>
