<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { open_app_settings, permission_statuses, request_media_permission } from '@/utils/nativePermissions.js'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import FlowPageHeader from './FlowPageHeader.vue'
import SourceIcon from './SourceIcon.vue'
import EventActionLoading from './EventActionLoading.vue'

const props = defineProps({ kind: { type: String, required: true }, fallback: { type: String, required: true } })
const frame = ref(null), status = ref('checking'), error = ref(''), requesting = ref(false), navigating = ref(false)
const camera = computed(() => props.kind === 'camera'), prefix = computed(() => camera.value ? 'permCamera' : 'permMic')
const title = computed(() => camera.value ? 'Take a profile photo' : 'Record a voice introduction')
const copy = computed(() => camera.value ? 'The camera is used only while you take a photo. Cimoa does not record in the background.' : 'The microphone is used only while you record a voice reply. Recording stops when you leave the page.')
let active = false, generation = 0
onShow(async () => { active = true; const token = ++generation; try { const rows = await permission_statuses(); if (active && token === generation) status.value = rows[props.kind] } catch (cause) { if (active && token === generation) { status.value = 'unavailable'; error.value = cause.message } } })
const back = async () => { if (requesting.value || navigating.value) return; navigating.value = true; try { await frame.value.navigate_back(props.fallback) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const allow = async () => { if (requesting.value || navigating.value) return; requesting.value = true; error.value = ''; const token = generation; try { status.value = await request_media_permission(props.kind); if (active && token === generation) await back() } catch (cause) { if (active && token === generation) { status.value = /denied/i.test(cause.message) ? 'denied' : 'unavailable'; error.value = cause.message } } finally { if (token === generation) requesting.value = false } }
const settings = async () => { try { await open_app_settings() } catch (cause) { error.value = cause.message } }
const hide = () => { active = false; generation++; requesting.value = false; navigating.value = false }
onHide(hide); onUnmounted(hide)
</script>

<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Permission" :interaction="`${prefix}.goBack.click.1`" :busy="requesting || navigating" @back="back" /></template><view class="permission-flow"><view class="permission-flow-icon"><SourceIcon :name="camera ? 'photo' : 'mic'" /></view><text class="flow-title">{{ title }}</text><text class="flow-copy">{{ copy }}</text><view class="flow-card permission-status"><view class="flow-status-line"><text>System status</text><text>{{ status.replace('_', ' ') }}</text></view><text v-if="error" class="flow-copy" role="alert">{{ error }}</text><view v-if="['denied', 'unavailable'].includes(status)" class="flow-secondary" role="button" :data-interaction="`${prefix}.openSettings.click.1`" @click="settings">Open Settings</view></view></view><template #footer><view class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="requesting || navigating" :data-interaction="camera ? 'permCamera.allowPhotos.click.1' : 'permMic.allowMic.click.1'" @click="allow">Allow {{ camera ? 'Camera' : 'Microphone' }}</view><view class="flow-secondary" role="button" :aria-disabled="requesting || navigating" :data-interaction="camera ? 'permCamera.denyPhotos.click.1' : 'permMic.denyMic.click.1'" @click="back">Not Now</view></view></template><template #overlays><EventActionLoading :visible="requesting" :label="`Waiting for system ${camera ? 'camera' : 'microphone'} permission…`" /></template></SecondaryPageFrame></template>

<style scoped>.permission-flow { display: flex; flex-direction: column; align-items: center; padding: 114.504rpx 45.802rpx 61.069rpx; text-align: center; }.permission-flow-icon { display: flex; align-items: center; justify-content: center; width: 175.572rpx; height: 175.572rpx; margin-bottom: 38.168rpx; padding: 45.802rpx; border-radius: 50%; color: var(--cimoa-text-inverse); background: var(--cimoa-surface-deep); box-shadow: var(--cimoa-shadow-auth-action); }.permission-status { width: 100%; text-align: left; }</style>
