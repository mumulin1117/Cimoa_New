<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import EventAudio from '@/components/EventAudio.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), request_id = ref(''), error = ref(''), decision = ref(''), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { request_id.value = String(options?.request_id || '') })
const request = computed(() => store.request_detail(request_id.value)), person = computed(() => request.value?.other)
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !request.value || request.value.recipient_id !== store.session.current_user_id ? 'This request is unavailable.' : request.value.status !== 'pending' ? 'This request has already been handled.' : '')
const back = async () => { if (is_loading.value || navigating.value) return; try { await frame.value.navigate_back('/pages/home/index') } catch (cause) { error.value = cause.message } }
const resolve = async () => {
  if (!decision.value || is_loading.value || access_error.value) return
  const next = decision.value; decision.value = ''
  const result = await run_with_loading(() => next === 'accept' ? store.accept_request(request_id.value) : store.decline_request(request_id.value))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  navigating.value = true
  try { await frame.value.navigate_replace(`/pages/connections/${next === 'accept' ? 'accepted' : 'declined'}?request_id=${encodeURIComponent(request_id.value)}`) } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
onHide(() => { decision.value = ''; navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template><SecondaryPageFrame ref="frame" :scroll-locked="!!decision"><template #header><FlowPageHeader title="Introduction" interaction="reqReceived.goBack.click.1" :busy="is_loading || navigating" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view class="flow-body"><template v-if="!access_error && person"><view class="request-person"><view class="request-avatar"><UserAvatar :src="person.avatar_url" :name="person.user_name" /></view><text class="flow-title">{{ person.user_name }}, {{ person.age }}</text><text class="flow-copy">{{ [person.university, person.major, person.mbti].filter(Boolean).join(' · ') }}</text></view><view class="flow-card"><text class="flow-eyebrow">Your icebreaker</text><text class="flow-copy">{{ request.question }}</text><text class="flow-eyebrow answer-label">{{ person.user_name.split(' ')[0] }}’s answer</text><text v-if="request.kind === 'text'" class="flow-copy">{{ request.text }}</text><EventAudio v-else-if="request.audio" :src="request.audio.media_url" :duration="request.audio.duration_ms" interaction="reqReceived.togglePlay.click.1" /><text v-else class="flow-copy" role="alert">This fixture voice recording has no audio resource, so it cannot be played.</text></view><view class="flow-card"><text class="flow-copy">{{ person.bio }}</text><view class="flow-chip-row"><text v-for="item in person.interests" :key="item" class="flow-chip">{{ item }}</text></view></view></template><view v-else class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="is_loading || navigating" data-interaction="reqReceived.accept.click.1" @click="decision = 'accept'">Accept</view><view class="flow-secondary" role="button" :aria-disabled="is_loading || navigating" data-interaction="reqReceived.notNow.click.1" @click="decision = 'decline'">Not Now</view></view></template><template #overlays><ConfirmDialog :visible="decision === 'accept'" title="Accept this introduction?" :message="`You and ${person?.user_name || 'this student'} will be connected and chat will unlock.`" confirm-label="Accept" @cancel="decision = ''" @confirm="resolve" /><ConfirmDialog :visible="decision === 'decline'" title="Close this request?" message="No reason is shared, and no connection will be created." confirm-label="Close Request" danger @cancel="decision = ''" @confirm="resolve" /><EventActionLoading :visible="is_loading" :label="decision === 'accept' ? 'Creating your connection…' : 'Closing the request…'" /></template></SecondaryPageFrame></template>

<style scoped>.request-person { display: flex; flex-direction: column; align-items: center; text-align: center; }.request-avatar { width: 194.656rpx; height: 194.656rpx; border: 7.634rpx solid var(--cimoa-surface-card); border-radius: 50%; box-shadow: var(--cimoa-shadow-profile-avatar); margin-bottom: 30.534rpx; }.answer-label { margin-top: 30.534rpx; }</style>
