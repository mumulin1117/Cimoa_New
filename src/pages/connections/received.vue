<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import ConnectionPageHeader from '@/components/ConnectionPageHeader.vue'
import ConnectionRequestProfile from '@/components/ConnectionRequestProfile.vue'
import RequestAudioPlayer from '@/components/RequestAudioPlayer.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import SafetyActionsMiniSheet from '@/components/SafetyActionsMiniSheet.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), request_id = ref(''), match_id = ref(''), error = ref(''), decision = ref(''), navigating = ref(false)
const sheet = ref(''), pending_action = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { request_id.value = String(options?.request_id || ''); match_id.value = String(options?.match_id || '') })
const request = computed(() => match_id.value ? store.match_invitation(match_id.value) : store.request_detail(request_id.value)), person = computed(() => request.value?.other)
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !!request_id.value === !!match_id.value || !request.value || request.value.recipient_id !== store.session.current_user_id ? 'This request is unavailable.' : request.value.status !== 'pending' ? 'This request has already been handled.' : '')
const back = async () => { if (is_loading.value || navigating.value) return; try { await frame.value.navigate_back('/pages/home/index') } catch (cause) { error.value = cause.message } }
const resolve = async () => {
  if (!decision.value || is_loading.value || access_error.value) return
  const next = decision.value; decision.value = ''; pending_action.value = next
  const operation_id = `request:${request_id.value}:${next}`
  const result = await run_with_loading(() => match_id.value ? store.respond_to_match(match_id.value, next === 'accept' ? 'accepted' : 'declined') : next === 'accept' ? store.accept_request(request_id.value, operation_id) : store.decline_request(request_id.value, operation_id))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  navigating.value = true
  try { await frame.value.navigate_replace(`/pages/connections/${next === 'accept' ? 'accepted' : 'declined'}?${match_id.value ? `match_id=${encodeURIComponent(match_id.value)}` : `request_id=${encodeURIComponent(request_id.value)}`}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const not_now = async () => { if (is_loading.value || navigating.value || sheet.value) return; try { await frame.value.navigate_relaunch('/pages/home/index') } catch (cause) { error.value = cause.message } }
const choose = value => { if (!is_loading.value && !navigating.value && !access_error.value) { sheet.value = ''; decision.value = value } }
const report = async () => { if (is_loading.value || !person.value) return; sheet.value = ''; try { await frame.value.navigate_forward(`/pages/safety/report-user?target_user_id=${encodeURIComponent(person.value.user_id)}&context_id=${encodeURIComponent(request_id.value || match_id.value)}`) } catch (cause) { error.value = cause.message } }
const block = async () => {
  if (is_loading.value || !person.value) return
  pending_action.value = 'block'; const id = person.value.user_id
  const result = await run_with_loading(() => store.block_user(id))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  sheet.value = ''; await not_now()
}
onHide(() => { decision.value = ''; sheet.value = ''; navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template>
  <SecondaryPageFrame ref="frame" class="connection-received-page" :scroll-locked="!!decision || !!sheet || is_loading">
    <template #header><ConnectionPageHeader compact interaction="reqReceived.goBack.click.1" :busy="is_loading || navigating" @back="back"><text class="received-name">{{ person ? `${person.user_name}${person.age === null ? '' : `, ${person.age}`}` : 'Introduction' }}</text><view v-if="person?.verified" class="received-verified"><SourceIcon name="verified" :stroke-width="2.6" /></view><template #right><view v-if="person && !access_error" class="received-more" role="button" tabindex="0" aria-label="Request actions" :aria-disabled="is_loading" data-interaction="reqReceived.openReqMenu.click.1" @click="!is_loading && (sheet = 'safety')" @keydown.enter="!is_loading && (sheet = 'safety')"><view><SourceIcon name="more" /></view></view></template></ConnectionPageHeader></template>
    <view v-if="access_error" class="connection-unavailable" role="alert">{{ access_error }}</view><ConnectionRequestProfile v-else :user-id="person.user_id" />
    <template #footer>
      <view v-if="!access_error" class="received-footer">
        <view class="received-fade" />
        <view class="received-answer-card"><scroll-view scroll-y class="received-answer-scroll"><text class="received-question">{{ request.kind === 'match' ? 'Auto Match' : request.question }}</text><text v-if="request.kind === 'match'" class="connection-answer">You both found a match. Choose whether you would like to connect.</text><text v-else-if="request.kind === 'text'" class="connection-answer">{{ request.text }}</text><RequestAudioPlayer v-else-if="request.audio" :src="request.audio.media_url" :duration="request.audio.duration_ms" /><text v-else class="connection-answer" role="alert">This voice recording is unavailable on this device.</text></scroll-view></view>
        <text v-if="error && !sheet" class="received-error" role="alert">{{ error }}</text>
        <view class="received-actions"><view class="connection-secondary" role="button" tabindex="0" :aria-disabled="is_loading || navigating" data-interaction="reqReceived.notNow.click.1" @click="not_now" @keydown.enter="not_now">Not Now</view><view class="connection-primary" role="button" tabindex="0" :aria-disabled="is_loading || navigating" data-interaction="reqReceived.accept.click.1" @click="choose('accept')" @keydown.enter="choose('accept')">Accept</view></view>
      </view>
      <text v-else-if="error" class="connection-error" role="alert">{{ error }}</text>
    </template>
    <template #overlays>
      <SafetyActionsMiniSheet :open="!!sheet" :mode="sheet === 'block' ? 'block' : 'menu'" :user-name="person?.user_name" :busy="is_loading" :error="error" @close="!is_loading && (sheet = '')" @report="report" @open-block="sheet = 'block'" @confirm-block="block"><template #actions><view class="received-decline" role="button" tabindex="0" data-interaction="reqReceived.openDecline.click.1" @click="choose('decline')" @keydown.enter="choose('decline')">Decline introduction</view></template></SafetyActionsMiniSheet>
      <ConfirmDialog :visible="decision === 'accept'" title="Accept this introduction?" :message="`You and ${person?.user_name || 'this student'} will be connected and chat will unlock.`" confirm-label="Accept" @cancel="decision = ''" @confirm="resolve" />
      <ConfirmDialog :visible="decision === 'decline'" title="Close this request?" message="No reason is shared, and no connection will be created." confirm-label="Close Request" danger @cancel="decision = ''" @confirm="resolve" />
      <EventActionLoading :visible="is_loading" :label="pending_action === 'accept' ? 'Creating your connection…' : pending_action === 'block' ? 'Blocking account…' : 'Closing the request…'" />
    </template>
  </SecondaryPageFrame>
</template>
<style scoped>
@import './connections.css';
.received-name {
  overflow: hidden;
  font-size: 43.893rpx;
  font-weight: 700;
  letter-spacing: -.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.received-verified { flex: none; width: 38.168rpx; height: 38.168rpx; }
.received-more {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 50%;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  cursor: pointer;
}
.received-more > view { width: 38.168rpx; height: 38.168rpx; }
.received-footer {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 30.534rpx;
  padding: 0 38.168rpx 64.885rpx;
}
.received-fade {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 0;
  height: 572.519rpx;
  background: var(--cimoa-gradient-connection-footer);
  pointer-events: none;
}
.received-answer-card {
  position: relative;
  z-index: 1;
  padding: 30.534rpx 34.351rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-connection-answer);
}
.received-answer-scroll { max-height: 30vh; }
.received-question { display: block; font-size: 31.489rpx; font-weight: 700; letter-spacing: -.015em; overflow-wrap: anywhere; }
.received-actions { position: relative; z-index: 1; display: flex; gap: 22.901rpx; }
.received-actions > view {
  flex: 1;
  min-width: 0;
  min-height: 110.687rpx;
  border-radius: 55.344rpx;
  font-size: 34.351rpx;
  font-weight: 700;
}
.received-error { position: relative; z-index: 1; color: var(--cimoa-status-danger); font-size: 27.672rpx; line-height: 1.4; }
.received-decline {
  display: flex;
  align-items: center;
  min-height: 106.87rpx;
  padding: 0 30.534rpx;
  color: var(--cimoa-text-settings-danger);
  font-size: 32.443rpx;
  font-weight: 600;
  cursor: pointer;
}
</style>
