<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import FlowPageHeader from './FlowPageHeader.vue'
import FlowStatePanel from './FlowStatePanel.vue'

const props = defineProps({ status: { type: String, required: true } })
const store = use_app_store(), frame = ref(null), match_id = ref(''), error = ref(''), navigating = ref(false)
onLoad(options => { match_id.value = String(options?.match_id || '') })
const match = computed(() => store.match_detail(match_id.value))
const conversation = computed(() => store.current_conversations.find(row => row.participant_id === match.value?.candidate_id))
const copy = computed(() => ({
  connected: ['You both connected', `You and ${match.value?.candidate?.user_name || 'your match'} can now start a conversation.`],
  passed: ['Match skipped', 'Nothing was shared and no connection was made. We’ll keep looking whenever you’re ready.'],
  expired: ['This match has expired', 'The response window closed. No connection was made.'],
  no_match: ['No compatible matches are available right now', 'Adjust your preferences or try again when the matching service has new availability.'],
}[props.status]))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !match.value || match.value.status !== props.status ? `This ${props.status.replace('_', ' ')} match result is unavailable.` : props.status === 'connected' && !conversation.value ? 'The connected conversation is unavailable.' : '')
const go = async (url, replace = true) => { if (navigating.value) return; navigating.value = true; error.value = ''; try { if (url === '/pages/home/index') await frame.value.navigate_relaunch(url); else await (replace ? frame.value.navigate_replace(url) : frame.value.navigate_forward(url)) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const interaction = computed(() => `am${props.status === 'no_match' ? 'NoMatch' : props.status[0].toUpperCase() + props.status.slice(1)}`)
</script>

<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Auto Match" :interaction="`${interaction}.goBack.click.1`" :busy="navigating" @back="go('/pages/home/index')" /><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template><template v-if="!access_error"><FlowStatePanel :icon="status === 'connected' ? 'check' : 'blocked'" :title="copy[0]" :copy="copy[1]" :person="match.candidate" /></template><view v-else class="flow-body"><view class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view class="flow-footer"><template v-if="!access_error && status === 'connected'"><view class="flow-primary" role="button" :aria-disabled="navigating" data-interaction="amConnected.startChat.click.1" @click="go(`/pages/messages/chat?conversation_id=${encodeURIComponent(conversation.conversation_id)}`, false)">Start Chatting</view><view class="flow-secondary" role="button" :aria-disabled="navigating" data-interaction="amConnected.viewProfile.click.1" @click="go(`/pages/discover/profile?user_id=${encodeURIComponent(match.candidate_id)}`, false)">View Profile</view></template><template v-else-if="!access_error"><view class="flow-primary" role="button" :aria-disabled="navigating" :data-interaction="status === 'no_match' ? 'amNoMatch.findAnother.click.1' : `am${status[0].toUpperCase() + status.slice(1)}.findAnother.click.1`" @click="go('/pages/auto-match/index')">{{ status === 'no_match' ? 'Stay in Pool' : 'Find Another Match' }}</view><view v-if="status === 'no_match'" class="flow-secondary" role="button" :aria-disabled="navigating" data-interaction="amNoMatch.adjustPrefs.click.1" @click="go('/pages/auto-match/preferences', false)">Adjust Preferences</view><view class="flow-secondary" role="button" :aria-disabled="navigating" :data-interaction="status === 'no_match' ? 'amNoMatch.returnHome.click.1' : `am${status[0].toUpperCase() + status.slice(1)}.returnHome.click.1`" @click="go('/pages/home/index')">Return Home</view></template><view v-else class="flow-secondary" role="button" @click="go('/pages/home/index')">Return Home</view></view></template></SecondaryPageFrame></template>
