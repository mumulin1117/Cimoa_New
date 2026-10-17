<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import FlowStatePanel from '@/components/FlowStatePanel.vue'

const store = use_app_store(), frame = ref(null), request_id = ref(''), match_id = ref(''), error = ref('')
onLoad(options => { request_id.value = String(options?.request_id || ''); match_id.value = String(options?.match_id || '') })
const request = computed(() => match_id.value ? store.match_invitation(match_id.value) : store.request_detail(request_id.value)), conversation = computed(() => store.current_conversations.find(row => row.participant_id === request.value?.other?.user_id))
const access_error = computed(() => !request.value || request.value.status !== 'accepted' || !conversation.value ? 'This accepted connection is unavailable.' : '')
const go = async url => { try { await frame.value.navigate_replace(url) } catch (cause) { error.value = cause.message } }
</script>
<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Connected" interaction="reqAccepted.closeAccepted.click.1" @back="go('/pages/home/index')" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><template v-if="!access_error"><FlowStatePanel title="You’re connected" :copy="`You and ${request.other.user_name} can now start a conversation.`" :person="request.other"><view class="flow-chip-row"><text v-for="item in request.other.interests" :key="item" class="flow-chip">{{ item }}</text></view></FlowStatePanel></template><view v-else class="flow-body"><view class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" data-interaction="reqAccepted.startChat.click.1" @click="go(`/pages/messages/chat?conversation_id=${encodeURIComponent(conversation.conversation_id)}`)">Start Chatting</view><view class="flow-secondary" role="button" data-interaction="reqAccepted.viewProfile.click.1" @click="go(`/pages/discover/profile?user_id=${encodeURIComponent(request.other.user_id)}`)">View Profile</view></view></template></SecondaryPageFrame></template>
