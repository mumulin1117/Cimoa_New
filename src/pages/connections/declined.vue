<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import ConnectionIcon from '@/components/ConnectionIcon.vue'
const store = use_app_store(), frame = ref(null), request_id = ref(''), match_id = ref(''), error = ref('')
onLoad(options => { request_id.value = String(options?.request_id || ''); match_id.value = String(options?.match_id || '') })
const request = computed(() => match_id.value ? store.match_invitation(match_id.value) : store.request_detail(request_id.value)), access_error = computed(() => !!request_id.value === !!match_id.value || !request.value || request.value.status !== 'declined' ? 'This closed request is unavailable.' : '')
const discover = async () => { try { await frame.value.navigate_relaunch('/pages/discover/index') } catch (cause) { error.value = cause.message } }
</script>
<template>
  <SecondaryPageFrame ref="frame" class="connection-declined-page">
    <view v-if="access_error" class="connection-unavailable" role="alert">{{ access_error }}</view>
    <view v-else class="declined-content"><view class="declined-icon"><view><ConnectionIcon name="closed" /></view></view><text class="declined-title">Request closed</text><text class="declined-copy">No connection was created and no reason is passed on. There are plenty of other students to meet.</text></view>
    <template #footer><text v-if="error" class="connection-error" role="alert">{{ error }}</text><view class="connection-footer"><view class="connection-primary" role="button" tabindex="0" data-interaction="reqDeclined.backToDiscover.click.1" @click="discover" @keydown.enter="discover">Back to Discover</view><view class="connection-secondary" role="button" tabindex="0" data-interaction="reqDeclined.backToDiscover.click.2" @click="discover" @keydown.enter="discover">View Other People</view></view></template>
  </SecondaryPageFrame>
</template>
<style scoped>
@import './connections.css';
.declined-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30.534rpx;
  margin-top: 221.374rpx;
  padding: 0 38.168rpx 45.802rpx;
}
.declined-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 167.939rpx;
  height: 167.939rpx;
  border-radius: 50%;
  background: var(--cimoa-surface-connection-waiting);
  color: var(--cimoa-text-connection-audio);
}
.declined-icon > view { width: 68.702rpx; height: 68.702rpx; }
.declined-title { font-size: 57.252rpx; font-weight: 800; letter-spacing: -.035em; text-align: center; }
.declined-copy { max-width: 572.519rpx; color: var(--cimoa-text-secondary); font-size: 32.443rpx; text-align: center; text-wrap: pretty; }
</style>
