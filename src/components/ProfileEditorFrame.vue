<script setup>
import { ref } from 'vue'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import SourceIcon from './SourceIcon.vue'
import ProfileActionLoading from './ProfileActionLoading.vue'
defineProps({ title: String, source: String, busy: Boolean, error: String, accessError: String, save: Boolean, disabled: Boolean, loadingLabel: String, actionLabel: String, actionInteraction: String })
const emit = defineEmits(['back', 'save', 'recover']), frame = ref(null)
const save_ids = { editAll: 'eaSave', editBasic: 'saveBasic', editInterests: 'saveInterests', editGoals: 'saveGoals', editIce: 'saveIce' }
defineExpose({ navigate_forward: url => frame.value.navigate_forward(url), navigate_replace: url => frame.value.navigate_replace(url), navigate_back: url => frame.value.navigate_back(url) })
</script>
<template>
  <SecondaryPageFrame ref="frame">
    <template #header><view class="editor-header"><view class="editor-back" role="button" tabindex="0" aria-label="Back" :aria-disabled="busy" :data-interaction="`${source}.goBack.click.1`" @click="!busy && emit('back')" @keydown.enter="!busy && emit('back')" @keydown.space.prevent="!busy && emit('back')"><SourceIcon name="back" /></view><text class="editor-title">{{ title }}</text><slot name="header-action" /></view><text v-if="error" class="editor-error" role="alert">{{ error }}</text></template>
    <view class="editor-body"><view v-if="accessError" class="editor-access" role="alert"><text>{{ accessError }}</text><view class="editor-outline" role="button" tabindex="0" @click="emit('recover')" @keydown.enter="emit('recover')">Return to account entry</view></view><slot v-else /></view>
    <template #footer><view v-if="(save || actionLabel) && !accessError" class="editor-footer"><view class="editor-save" role="button" tabindex="0" :aria-disabled="busy || disabled" :data-interaction="actionInteraction || `${source}.${save_ids[source] || 'save'}.click.1`" @click="!busy && !disabled && emit('save')" @keydown.enter="!busy && !disabled && emit('save')" @keydown.space.prevent="!busy && !disabled && emit('save')">{{ actionLabel || 'Save' }}</view></view></template>
    <template #overlays><slot name="overlays" /><ProfileActionLoading :visible="busy" :label="loadingLabel" /></template>
  </SecondaryPageFrame>
</template>
