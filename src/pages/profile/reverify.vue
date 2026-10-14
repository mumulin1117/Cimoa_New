<script setup>
import { onUnmounted, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
const store = use_app_store(), frame = ref(null), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const back = async () => { try { await frame.value.navigate_back('/pages/profile/verification') } catch (cause) { error.value = cause.message } }
const start = async () => { const result = await run_with_loading(() => store.start_student_reverification()); if (result.reason !== 'cancelled' && !result.success) error.value = result.message }
onHide(cancel_loading); onUnmounted(cancel_loading)
</script>
<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Re-verify university" interaction="reverify.goBack.click.1" :busy="is_loading" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view class="flow-body"><text class="flow-title">Re-verify university</text><text class="flow-copy">Needed if your university email changed, your previous verification expired, or your account needs a status review.</text><view class="flow-card"><text class="flow-label">While verification is pending</text><text class="flow-copy">Your existing conversations stay visible. Discover, Auto Match, and new connection requests remain restricted until a real verification service confirms your status.</text></view><text class="flow-note">University verification service is not configured in this local build. The fixed local account code does not verify student status.</text></view><template #footer><view class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="is_loading" data-interaction="reverify.goVerEmail.click.1" @click="start">Start Re-verification</view><view class="flow-secondary" role="button" :aria-disabled="is_loading" @click="back">Return</view></view></template><template #overlays><EventActionLoading :visible="is_loading" label="Contacting university verification…" /></template></SecondaryPageFrame></template>
