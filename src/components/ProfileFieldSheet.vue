<script setup>
import { computed, ref, watch } from 'vue'
import { use_app_store } from '@/stores/store.js'
import OnboardingSheet from './OnboardingSheet.vue'
import SourceIcon from './SourceIcon.vue'
const props = defineProps({ field: String, title: String, value: [String, Number, Array], busy: Boolean })
const emit = defineEmits(['close', 'select']), store = use_app_store(), selection = ref(null)
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
  <OnboardingSheet :open="!!field" :busy="busy" :label="title || 'Profile field'" @close="emit('close')">
    <view class="field-title"><text>{{ title }}</text><view class="field-close" role="button" aria-label="Close profile field" data-interaction="editAll.eaClose.click.1" @click="emit('close')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M6 6l12 12M18 6 6 18" /></svg></view></view>
    <text v-if="field === 'country'" class="editor-copy">Pick up to 2</text>
    <view class="field-options" :class="{ grid: ['major', 'country'].includes(field), mbti: field === 'mbti' }"><view v-for="option in options" :key="option" class="field-option" :class="{ selected: selected(option) }" role="button" :aria-pressed="selected(option)" data-interaction="editAll.o.pick.click.1" @click="choose(option)">{{ option }}{{ field === 'height_cm' ? ' cm' : '' }}</view></view>
    <view v-if="field === 'mbti'" class="field-option" role="button" data-interaction="editAll.eaMbtiNone.click.1" @click="choose('Prefer not to say')">Prefer not to say</view>
    <view v-if="['height_cm', 'country'].includes(field)" class="editor-save field-done" role="button" data-interaction="editAll.eaCommit.click.1" @click="emit('select', selection)">Done</view>
  </OnboardingSheet>
</template>
<style scoped>
.field-title { display: flex; align-items: center; gap: 22.901rpx; font-size: 43.893rpx; font-weight: 800; }
.field-title > text { flex: 1; }
.field-close { width: 76.336rpx; height: 76.336rpx; padding: 22.901rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-tinted); cursor: pointer; }
.field-close svg { width: 100%; height: 100%; }
.field-options { display: flex; flex-direction: column; gap: 19.084rpx; margin-top: 30.534rpx; }
.field-options.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.field-options.mbti { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.field-option { display: flex; align-items: center; justify-content: center; padding: 15.267rpx; min-height: 106.87rpx; border-radius: 53.435rpx; border: 1px solid var(--cimoa-surface-border); background: var(--cimoa-surface-card); font-size: 32.443rpx; font-weight: 600; cursor: pointer; text-align: center; }
.grid .field-option { aspect-ratio: 1; border-radius: 45.802rpx; font-size: 27.672rpx; }
.mbti .field-option { font-size: 31.489rpx; padding: 7.634rpx; }
.selected { background: var(--cimoa-gradient-primary); color: var(--cimoa-text-inverse); border-color: var(--cimoa-surface-transparent); }
.field-done { margin-top: 30.534rpx; }
</style>
