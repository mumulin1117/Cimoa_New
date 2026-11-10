<script setup>
import { computed, onUnmounted, reactive, ref, toRefs, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { open_app_settings, permission_statuses, request_media_permission } from '@/utils/nativePermissions.js'
import { create_media_permission_flow } from '@/utils/mediaPermissionFlow.js'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import FlowPageHeader from './FlowPageHeader.vue'
import SourceIcon from './SourceIcon.vue'
import EventActionLoading from './EventActionLoading.vue'

const props = defineProps({ kind: { type: String, required: true }, fallback: { type: String, required: true } })
const store = use_app_store(), frame = ref(null)
const state = reactive({ status: 'checking', error: '', requesting: false, navigating: false })
const { status, error, requesting, navigating } = toRefs(state)
const camera = computed(() => props.kind === 'camera'), prefix = computed(() => camera.value ? 'permCamera' : 'permMic')
const title = computed(() => camera.value ? 'Take a profile photo' : 'Record a voice introduction')
const copy = computed(() => camera.value ? 'The camera is used only while you take a photo. Cimoa does not record in the background.' : 'The microphone is used only while you record a voice reply. Recording stops when you leave the page.')
const flow = create_media_permission_flow({
  state, kind: () => props.kind, context: () => store.auth_context,
  read: permission_statuses, request: request_media_permission,
  navigate: () => frame.value.navigate_back(props.fallback), open_settings: open_app_settings,
})
const { back, allow, settings } = flow
onShow(flow.show); onHide(flow.hide); onUnmounted(flow.hide)
watch(() => store.auth_context, flow.context_changed, { flush: 'sync' })
</script>

<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Permission" :interaction="`${prefix}.goBack.click.1`" :busy="requesting || navigating" @back="back" /></template><view class="permission-flow"><view class="permission-flow-icon"><SourceIcon :name="camera ? 'photo' : 'mic'" /></view><text class="flow-title">{{ title }}</text><text class="flow-copy">{{ copy }}</text><view class="flow-card permission-status"><view class="flow-status-line"><text>System status</text><text>{{ status.replace('_', ' ') }}</text></view><text v-if="error" class="flow-copy" role="alert">{{ error }}</text><view v-if="['denied', 'unavailable'].includes(status)" class="flow-secondary" role="button" :data-interaction="`${prefix}.openSettings.click.1`" @click="settings">Open Settings</view></view></view><template #footer><view class="flow-footer"><view class="flow-primary" role="button" tabindex="0" :aria-disabled="requesting || navigating" :aria-busy="requesting" :data-interaction="camera ? 'permCamera.allowPhotos.click.1' : 'permMic.allowMic.click.1'" @click="allow" @keydown.enter="allow" @keydown.space.prevent="allow">Continue</view><view class="flow-secondary" role="button" tabindex="0" :aria-disabled="requesting || navigating" :data-interaction="camera ? 'permCamera.denyPhotos.click.1' : 'permMic.denyMic.click.1'" @click="back" @keydown.enter="back" @keydown.space.prevent="back">Cancel</view></view></template><template #overlays><EventActionLoading :visible="requesting" :label="`Waiting for system ${camera ? 'camera' : 'microphone'} permission…`" /></template></SecondaryPageFrame></template>

<style scoped>.permission-flow { display: flex; flex-direction: column; align-items: center; padding: 114.504rpx 45.802rpx 61.069rpx; text-align: center; }.permission-flow-icon { display: flex; align-items: center; justify-content: center; width: 175.572rpx; height: 175.572rpx; margin-bottom: 38.168rpx; padding: 45.802rpx; border-radius: 50%; color: var(--cimoa-text-inverse); background: var(--cimoa-surface-deep); box-shadow: var(--cimoa-shadow-auth-action); }.permission-status { width: 100%; text-align: left; }</style>
