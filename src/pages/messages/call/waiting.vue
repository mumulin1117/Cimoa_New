<script setup>
import { computed, nextTick, ref, watch, onUnmounted } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { create_waiting_call } from '@/utils/waitingCall.js'
import PageTransition from '@/components/PageTransition.vue'
import TopSafeArea from '@/components/TopSafeArea.vue'
import BottomSafeArea from '@/components/BottomSafeArea.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import SafetyActionsMiniSheet from '@/components/SafetyActionsMiniSheet.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import { route_depth } from '@/utils/routeTransition.js'

const store = use_app_store(), frame = ref(null), conversation_id = ref(''), call_id = ref('')
const dots = ref(''), error = ref(''), ending = ref(false), sheet = ref(''), active = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let waiting = null
const conversation = computed(() => store.direct_conversation(conversation_id.value))
const call = computed(() => store.waiting_call(call_id.value))
const participant = computed(() => conversation.value?.participant)
const photo = computed(() => store.photos_for_user(participant.value?.user_id)[0]?.media_url || participant.value?.avatar_url || '')
const own_photo = computed(() => store.current_photos[0]?.media_url || store.current_user.avatar_url || '')
const access_error = computed(() => store.hydration_status !== 'ready' ? 'Saved data is unavailable. Return and retry.'
  : !store.session.is_authenticated ? 'Your session has expired. Please sign in again.'
    : !conversation.value ? 'This conversation is unavailable, so the call cannot be started.'
      : conversation.value.call_blocker || (!call.value || call.value.conversation_id !== conversation_id.value ? 'This call is no longer available. Return to the conversation to try again.' : ''))
const dispose = () => { waiting?.dispose(); waiting = null }
const leave = () => { active.value = false; dispose(); cancel_loading(); sheet.value = '' }
onHide(leave); onUnmounted(leave)
onLoad(options => { conversation_id.value = String(options?.conversation_id || ''); call_id.value = String(options?.call_id || '') })

const return_to_chat = async () => {
  if (ending.value || !active.value) return
  ending.value = true; dispose(); sheet.value = ''
  await nextTick()
  if (!active.value) return
  const fallback = conversation.value ? '/pages/messages/chat?conversation_id=' + encodeURIComponent(conversation_id.value) : '/pages/home/index'
  try { if (route_depth() > 1) await frame.value.navigate_back(); else await frame.value.navigate_replace(fallback) }
  catch (cause) { error.value = cause.message; ending.value = false }
}
const resume = () => {
  dispose(); store.tick()
  if (!active.value || access_error.value || ending.value || is_loading.value) return
  if (call.value.status !== 'waiting') { return_to_chat(); return }
  waiting = create_waiting_call({ started_at: call.value.started_at, expires_at: call.value.expires_at, on_dots: value => { store.tick(); dots.value = value }, on_end: () => { store.tick(); if (!is_loading.value) return_to_chat() } })
}
onShow(() => { active.value = true; ending.value = false; resume() })
watch(access_error, value => { if (value) { dispose(); if (!(sheet.value === 'block' && is_loading.value)) cancel_loading(); sheet.value = '' } })
watch(() => call.value?.status, status => { if (active.value && status && status !== 'waiting' && !is_loading.value && !ending.value) return_to_chat() })

const end_call = async () => {
  if (ending.value || is_loading.value) return
  if (access_error.value || call.value?.status !== 'waiting') { await return_to_chat(); return }
  dispose(); error.value = ''
  const result = await run_with_loading(() => store.end_waiting_call(call_id.value))
  if (!active.value || result.reason === 'cancelled') return
  if (result.success) await return_to_chat()
  else { error.value = result.message; resume() }
}
const report = async () => {
  if (is_loading.value || ending.value || access_error.value) return
  ending.value = true; dispose(); error.value = ''
  const result = await run_with_loading(() => store.end_waiting_call(call_id.value))
  if (!active.value || result.reason === 'cancelled') return
  if (!result.success) { ending.value = false; error.value = result.message; resume(); return }
  sheet.value = ''
  try { await frame.value.navigate_forward('/pages/safety/report-user?target_user_id=' + encodeURIComponent(participant.value.user_id) + '&context_id=' + encodeURIComponent(conversation_id.value)) }
  catch (cause) { ending.value = false; error.value = cause.message }
}
const block = async () => {
  if (is_loading.value || ending.value || access_error.value) return
  dispose(); error.value = ''
  const target = participant.value.user_id
  const result = await run_with_loading(() => store.block_user(target))
  if (!active.value || result.reason === 'cancelled') return
  if (result.success) { ending.value = true; await frame.value.navigate_relaunch('/pages/home/index') }
  else { error.value = result.message; resume() }
}
</script>

<template>
  <view class="waiting-call-page" :data-call-id="call_id" :data-page-depth="route_depth()">
    <PageTransition ref="frame">
      <view v-if="!access_error" class="waiting-call-background" aria-label="Profile photo preview"><ProfilePhoto :src="photo" :name="participant?.user_name || 'Student'" position="50% 18%" /><view class="waiting-call-top-gradient" /><view class="waiting-call-bottom-gradient" /></view>
      <TopSafeArea />
      <view class="waiting-call-header">
        <view class="waiting-call-round" role="button" tabindex="0" aria-label="Back" :aria-disabled="is_loading || ending" data-interaction="callActive.goBack.click.1" @click="end_call" @keydown.enter="end_call"><view><SourceIcon name="back" /></view></view>
        <view v-if="!access_error" class="waiting-call-round" role="button" tabindex="0" aria-label="Safety actions" :aria-disabled="is_loading || ending" data-interaction="callActive.openSafetyMini.click.1" @click="!is_loading && !ending && (sheet = 'menu')" @keydown.enter="!is_loading && !ending && (sheet = 'menu')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg></view>
      </view>
      <view v-if="access_error" class="waiting-call-error" role="alert">{{ access_error }}</view>
      <template v-else>
        <view class="waiting-call-identity"><text class="waiting-call-name">{{ participant?.user_name }}</text></view>
        <view class="waiting-call-own" aria-label="Your profile photo preview"><ProfilePhoto :src="own_photo" :name="store.current_user.user_name || 'You'" portrait /></view>
        <text class="waiting-call-state" aria-live="polite">Waiting for {{ participant?.user_name }}{{ dots }}</text>
        <text v-if="error" class="waiting-call-action-error" role="alert">{{ error }}</text>
        <view class="waiting-call-controls"><view class="waiting-call-end" role="button" tabindex="0" aria-label="End call" :aria-disabled="is_loading || ending" data-interaction="callActive.endCall.click.1" @click="end_call" @keydown.enter="end_call"><svg viewBox="0 0 24 24"><path d="M12 9.2c-3.3 0-6.3 1-8.6 2.8-.6.5-.9 1.2-.8 2l.3 1.8c.1.8.9 1.3 1.7 1.1l3-.8c.6-.2 1-.7 1-1.3v-1.6c1.1-.4 2.2-.5 3.4-.5s2.3.1 3.4.5v1.6c0 .6.4 1.1 1 1.3l3 .8c.8.2 1.6-.3 1.7-1.1l.3-1.8c.1-.8-.2-1.5-.8-2-2.3-1.8-5.3-2.8-8.6-2.8z" /></svg></view></view>
      </template>
      <view class="waiting-call-spacer" /><BottomSafeArea />
    </PageTransition>
    <SafetyActionsMiniSheet :open="!!sheet" :mode="sheet === 'block' ? 'block' : 'menu'" :user-name="participant?.user_name" :busy="is_loading || ending" :error="error" @close="!is_loading && (sheet = '')" @report="report" @open-block="sheet = 'block'; error = ''" @confirm-block="block" />
    <EventActionLoading :visible="is_loading" label="Ending call…" />
  </view>
</template>

<style scoped>
.waiting-call-page { position: relative; height: 100vh; overflow: hidden; color: var(--cimoa-text-inverse); background: var(--cimoa-surface-call); }
.waiting-call-page :deep(.page-transition) { height: 100%; position: relative; }
.waiting-call-background { position: absolute; inset: 0; }
.waiting-call-top-gradient { position: absolute; inset: 0 0 auto; height: 343.511rpx; background: var(--cimoa-gradient-call-top); pointer-events: none; }
.waiting-call-bottom-gradient { position: absolute; inset: auto 0 0; height: 496.183rpx; background: var(--cimoa-gradient-call-bottom); pointer-events: none; }
.waiting-call-header {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  flex: none;
  height: 83.969rpx;
  margin: 7.634rpx 38.168rpx 0;
}
.waiting-call-round {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 83.969rpx;
  height: 83.969rpx;
  border-radius: 41.985rpx;
  border: 1px solid var(--cimoa-surface-call-control-border);
  background: var(--cimoa-surface-call-control);
  backdrop-filter: blur(22.901rpx);
  cursor: pointer;
}
.waiting-call-round > view { width: 41.985rpx; height: 41.985rpx; }
.waiting-call-round > svg { width: 40.076rpx; height: 40.076rpx; }
.waiting-call-identity { position: absolute; top: calc(var(--app-safe-top) + 22.901rpx); left: 145.038rpx; right: 145.038rpx; text-align: center; }
.waiting-call-name { display: block; font-size: 36.26rpx; font-weight: 700; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.waiting-call-own {
  position: absolute;
  top: calc(var(--app-safe-top) + 118.321rpx);
  right: 38.168rpx;
  width: 198.473rpx;
  height: 270.992rpx;
  border-radius: 38.168rpx;
  overflow: hidden;
  border: 3.817rpx solid var(--cimoa-surface-call-preview-border);
  background: var(--cimoa-surface-deep);
}
.waiting-call-state {
  position: absolute;
  left: 38.168rpx;
  right: 38.168rpx;
  bottom: calc(var(--app-safe-bottom) + 248.092rpx);
  text-align: center;
  color: var(--cimoa-text-call-waiting);
  font-size: 28.626rpx;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.waiting-call-controls {
  position: absolute;
  left: 38.168rpx;
  right: 38.168rpx;
  bottom: calc(var(--app-safe-bottom) + 83.969rpx);
  display: flex;
  justify-content: center;
}
.waiting-call-end {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 122.137rpx;
  height: 122.137rpx;
  border-radius: 61.069rpx;
  background: var(--cimoa-status-danger);
  box-shadow: var(--cimoa-shadow-call-end);
  cursor: pointer;
}
.waiting-call-end svg { width: 57.252rpx; height: 57.252rpx; fill: var(--cimoa-text-inverse); }
.waiting-call-end[aria-disabled="true"], .waiting-call-round[aria-disabled="true"] { opacity: 0.55; cursor: default; }
.waiting-call-error {
  position: relative;
  margin: 76.336rpx 38.168rpx;
  padding: 38.168rpx;
  border-radius: 38.168rpx;
  background: var(--cimoa-surface-card);
  color: var(--cimoa-status-danger);
  font-size: 28.626rpx;
  line-height: 1.45;
}
.waiting-call-action-error {
  position: absolute;
  left: 38.168rpx;
  right: 38.168rpx;
  bottom: calc(var(--app-safe-bottom) + 305.344rpx);
  padding: 22.901rpx;
  border-radius: 22.901rpx;
  background: var(--cimoa-surface-call-control);
  font-size: 26.718rpx;
  text-align: center;
}
.waiting-call-spacer { flex: 1; }
</style>
