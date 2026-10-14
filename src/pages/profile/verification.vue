<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import FlowStatePanel from '@/components/FlowStatePanel.vue'
const store = use_app_store(), frame = ref(null), error = ref(''), navigating = ref(false)
const user = computed(() => store.current_user), account = computed(() => store.data.accounts.find(row => row.account_id === store.session.account_id))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : '')
const go = async url => { if (navigating.value) return; navigating.value = true; try { await frame.value.navigate_forward(url) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const back = async () => { try { await frame.value.navigate_back('/pages/profile/index') } catch (cause) { error.value = cause.message } }
</script>
<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="University verification" interaction="verified.goBack.click.1" :busy="navigating" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><template v-if="!access_error"><FlowStatePanel :icon="user.verified ? 'verified' : 'shield'" :title="user.verified ? 'Verified student' : 'Student verification pending'" :copy="user.verified ? 'Your fixture student status is active in this local build.' : 'Your local account is verified only on this device. It is not student verification.'"><view class="flow-card verification-card"><view class="flow-status-line"><text>University</text><text>{{ user.university || 'Not provided' }}</text></view><view class="flow-status-line"><text>Account email</text><text>{{ account?.email || 'Unavailable' }}</text></view><view class="flow-status-line"><text>Student status</text><text>{{ user.verification_status }}</text></view><view class="flow-status-line"><text>Local code check</text><text>{{ account?.local_verification?.status || (account?.auth_provider === 'fixture' ? 'Fixture account' : 'Not completed') }}</text></view></view><text class="flow-note">Local code 009789 validates this device account only. It never changes student verification.</text></FlowStatePanel></template><view v-else class="flow-body"><view class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" data-interaction="verified.openReverify.click.1" @click="go('/pages/profile/reverify')">Re-verify</view></view></template></SecondaryPageFrame></template>
<style scoped>.verification-card { width: 100%; text-align: left; }</style>
