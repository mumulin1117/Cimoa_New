<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import FlowStatePanel from '@/components/FlowStatePanel.vue'
import EventAudio from '@/components/EventAudio.vue'

const store = use_app_store(), frame = ref(null), request_id = ref(''), error = ref('')
onLoad(options => { request_id.value = String(options?.request_id || '') })
const request = computed(() => store.request_detail(request_id.value))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !request.value || request.value.sender_id !== store.session.current_user_id ? 'This sent request is unavailable.' : '')
const done = async () => { try { await frame.value.navigate_replace('/pages/discover/index') } catch (cause) { error.value = cause.message } }
const back = async () => { try { await frame.value.navigate_back('/pages/discover/index') } catch (cause) { error.value = cause.message } }
</script>

<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Request sent" interaction="reqSent.goBack.click.1" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><template v-if="!access_error"><FlowStatePanel title="Introduction sent" :copy="`Your introduction was sent to ${request.other.user_name}. Chat and video calls unlock only after they accept.`" :person="request.other"><view class="flow-card"><text class="flow-eyebrow">Icebreaker</text><text class="flow-copy">{{ request.question }}</text><text class="flow-eyebrow answer-label">Your answer</text><text v-if="request.kind === 'text'" class="flow-copy">{{ request.text }}</text><EventAudio v-else-if="request.audio" :src="request.audio.media_url" :duration="request.audio.duration_ms" interaction="reqSent.togglePlay.click.1" /><text v-else class="flow-copy" role="alert">This voice recording is unavailable on this device.</text></view><text class="flow-note">Status: {{ request.status === 'pending' ? `Waiting for ${request.other.user_name.split(' ')[0]}` : request.status }}</text></FlowStatePanel></template><view v-else class="flow-body"><view class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view class="flow-footer"><view class="flow-primary" role="button" data-interaction="reqSent.doneSent.click.1" @click="done">Done</view></view></template></SecondaryPageFrame></template>

<style scoped>.answer-label { margin-top: 30.534rpx; }</style>
