<script setup>
import { ref } from 'vue'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import SourceIcon from './SourceIcon.vue'
import ProfileActionLoading from './ProfileActionLoading.vue'
defineProps({ title: String, source: String, busy: Boolean, error: String, accessError: String, save: Boolean, disabled: Boolean, loadingLabel: String })
const emit = defineEmits(['back', 'save', 'recover']), frame = ref(null)
const save_ids = { editAll: 'eaSave', editBasic: 'saveBasic', editInterests: 'saveInterests', editGoals: 'saveGoals', editIce: 'saveIce' }
defineExpose({ navigate_forward: url => frame.value.navigate_forward(url), navigate_back: url => frame.value.navigate_back(url) })
</script>
<template>
  <SecondaryPageFrame ref="frame">
    <template #header><view class="editor-header"><view class="editor-back" role="button" aria-label="Back" :aria-disabled="busy" :data-interaction="`${source}.goBack.click.1`" @click="!busy && emit('back')"><SourceIcon name="back" /></view><text class="editor-title">{{ title }}</text><slot name="header-action" /></view><text v-if="error" class="editor-error" role="alert">{{ error }}</text></template>
    <view class="editor-body"><view v-if="accessError" class="editor-access" role="alert"><text>{{ accessError }}</text><view class="editor-outline" role="button" @click="emit('recover')">Return to account entry</view></view><slot v-else /></view>
    <template #footer><view v-if="save && !accessError" class="editor-footer"><view class="editor-save" role="button" :aria-disabled="busy || disabled" :data-interaction="`${source}.${save_ids[source] || 'save'}.click.1`" @click="!busy && !disabled && emit('save')">Save</view></view></template>
    <template #overlays><slot name="overlays" /><ProfileActionLoading :visible="busy" :label="loadingLabel" /></template>
  </SecondaryPageFrame>
</template>
