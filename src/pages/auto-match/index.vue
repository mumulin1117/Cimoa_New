<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { push_route } from '@/utils/routeTransition.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import TopSafeArea from '@/components/TopSafeArea.vue'
import AppLoading from '@/components/AppLoading.vue'

const store = use_app_store()
const notice = ref('')
const { is_loading, run_with_loading } = use_write_loading()
const candidate = computed(() => store.user_by_id(store.match.candidate_id))
const update_preference = async () => { const result = await run_with_loading(() => store.update_match_preferences({ distance_max: store.match.preferences.distance_max === 5 ? 10 : 5 })); notice.value = result.success ? `Preference updated to ${store.match.preferences.distance_max} km.` : result.message }
const report_unavailable = async (status) => { const result = await run_with_loading(() => store.set_match_status(status)); notice.value = result.message || 'This matching action is unavailable.' }
const start_queue = () => report_unavailable('searching')
const pause_queue = () => report_unavailable('paused')
const toggle_queue = () => report_unavailable('searching')
const accept_match = () => report_unavailable('connected')
const pass_match = () => report_unavailable('passed')
const open_chat = () => push_route(`/pages/messages/index?view=chat&user_id=${candidate.value?.user_id}`)
</script>

<template>
  <view class="cimoa-page match-page"><TopSafeArea /><view class="sub-header"><view class="back-button" role="button" @click="push_route('/pages/home/index')">Back</view><text class="sub-header__title">Auto Match</text><view class="sub-header__space" /></view><scroll-view class="cimoa-scroll" scroll-y :show-scrollbar="false"><template v-if="store.match.status === 'idle'"><view class="match-intro"><image class="match-intro__image" src="/static/assets/head/maya-full.png" mode="aspectFill" /><text class="cimoa-eyebrow">A small leap</text><text class="match-intro__title">Meet someone outside your usual orbit.</text><text class="match-intro__copy">Cimoa uses your preferences to find one thoughtful connection at a time.</text></view><view class="preference-card cimoa-card"><view><text class="cimoa-eyebrow">Your preferences</text><text class="preference-card__value">{{ store.match.preferences.distance }} · {{ store.match.preferences.university }}</text></view><text class="preference-card__action" role="button" @click="update_preference">Change</text></view><view class="cimoa-button" role="button" @click="start_queue">Start matching</view></template><template v-else-if="store.match.status === 'searching' || store.match.status === 'paused'"><view class="queue-card"><view class="queue-card__ring" /><text class="queue-card__title">{{ store.match.status === 'searching' ? 'Looking for your match...' : 'Matching paused' }}</text><text class="queue-card__copy">{{ store.match.status === 'searching' ? 'You can keep exploring while we search.' : 'Resume when you are ready.' }}</text><view class="cimoa-button ghost" role="button" @click="toggle_queue">{{ store.match.status === 'searching' ? 'Pause queue' : 'Resume queue' }}</view></view><view class="match-note">Your preferences are private and can be changed at any time.</view></template><template v-else-if="store.match.status === 'connected'"><view class="found-card"><text class="cimoa-eyebrow">Connected</text><image class="found-card__image" :src="candidate?.avatar_url" mode="aspectFill" /><text class="found-card__name">{{ candidate?.user_name }}</text><text class="found-card__meta">{{ candidate?.major }} · {{ candidate?.distance }}</text><text class="found-card__bio">{{ candidate?.bio }}</text><view class="cimoa-button" role="button" @click="open_chat">Open conversation</view></view></template><template v-else><view class="found-card"><text class="cimoa-eyebrow">A possible connection</text><image class="found-card__image" :src="candidate?.avatar_url" mode="aspectFill" /><text class="found-card__name">{{ candidate?.user_name }}</text><text class="found-card__meta">{{ candidate?.major }}</text><view class="match-actions"><view class="cimoa-button" role="button" @click="accept_match">Connect</view><view class="cimoa-button ghost" role="button" @click="pass_match">Pass</view></view></view></template><text v-if="notice" class="notice">{{ notice }}</text></scroll-view><AppLoading :visible="is_loading" label="Updating match..." /></view>
</template>

<style scoped>
.match-page { min-height: 100vh; }
.sub-header { display: flex; align-items: center; justify-content: space-between; padding: 12rpx 32rpx 18rpx; }
.back-button { color: var(--cimoa-secondary); font-size: 22rpx; }
.sub-header__title { color: var(--cimoa-title); font-size: 25rpx; font-weight: 700; }
.sub-header__space { width: 64rpx; }
.match-intro { text-align: center; }
.match-intro__image { width: 320rpx; height: 330rpx; border-radius: 34rpx; }
.match-intro__title {
  display: block;
  margin: 24rpx auto 0;
  max-width: 570rpx;
  color: var(--cimoa-title);
  font-size: 35rpx;
  font-weight: 700;
  line-height: 46rpx;
}
.match-intro__copy {
  display: block;
  margin: 14rpx auto 0;
  max-width: 570rpx;
  color: var(--cimoa-secondary);
  font-size: 21rpx;
  line-height: 32rpx;
}
.preference-card { display: flex; align-items: center; justify-content: space-between; margin: 30rpx 0 18rpx; padding: 22rpx; }
.preference-card__value { display: block; margin-top: 10rpx; color: var(--cimoa-title); font-size: 23rpx; font-weight: 700; }
.preference-card__action { color: var(--cimoa-success); font-size: 19rpx; }
.queue-card, .found-card { padding: 30rpx; border-radius: 28rpx; background: var(--cimoa-deep); text-align: center; }
.queue-card__ring {
  width: 110rpx;
  height: 110rpx;
  margin: 12rpx auto 28rpx;
  border: 8rpx solid var(--cimoa-primary);
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 1.2s linear infinite;
}
.queue-card__title, .queue-card__copy { display: block; }
.queue-card__title { color: var(--cimoa-card); font-size: 30rpx; font-weight: 700; }
.queue-card__copy { margin: 10rpx 0 24rpx; color: var(--cimoa-tertiary); font-size: 21rpx; }
.queue-card .ghost { border-color: var(--cimoa-tertiary); color: var(--cimoa-card); }
.match-note, .notice { margin-top: 22rpx; color: var(--cimoa-secondary); font-size: 20rpx; text-align: center; }
.found-card__image { width: 220rpx; height: 240rpx; margin: 24rpx auto 0; border-radius: 26rpx; }
.found-card__name, .found-card__meta, .found-card__bio { display: block; }
.found-card__name { margin-top: 18rpx; color: var(--cimoa-card); font-size: 30rpx; font-weight: 700; }
.found-card__meta, .found-card__bio { margin-top: 8rpx; color: var(--cimoa-tertiary); font-size: 20rpx; }
.found-card__bio { line-height: 30rpx; }
.found-card .cimoa-button { margin-top: 24rpx; }
.match-actions { display: flex; gap: 14rpx; margin-top: 24rpx; }
.match-actions > view { flex: 1; }
.notice { color: var(--cimoa-success); }
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
