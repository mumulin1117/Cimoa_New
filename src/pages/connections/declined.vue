<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import FlowStatePanel from '@/components/FlowStatePanel.vue'
const store = use_app_store(), frame = ref(null), request_id = ref(''), match_id = ref(''), error = ref('')
onLoad(options => { request_id.value = String(options?.request_id || ''); match_id.value = String(options?.match_id || '') })
const request = computed(() => match_id.value ? store.match_invitation(match_id.value) : store.request_detail(request_id.value)), access_error = computed(() => !request.value || request.value.status !== 'declined' ? 'This closed request is unavailable.' : '')
const discover = async () => { try { await frame.value.navigate_replace('/pages/discover/index') } catch (cause) { error.value = cause.message } }
</script>
<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Request closed" interaction="reqDeclined.backToDiscover.click.1" @back="discover" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view v-if="access_error" class="flow-body"><view class="flow-card" role="alert">{{ access_error }}</view></view><FlowStatePanel v-else icon="blocked" title="Request closed" copy="The request is closed. No connection was created." /><template #footer><view class="flow-footer"><view class="flow-primary" role="button" data-interaction="reqDeclined.backToDiscover.click.1" @click="discover">Back to Discover</view><view class="flow-secondary" role="button" data-interaction="reqDeclined.backToDiscover.click.2" @click="discover">View Other People</view></view></template></SecondaryPageFrame></template>
