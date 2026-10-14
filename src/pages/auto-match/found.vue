<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), match_id = ref(''), error = ref(''), decision = ref(''), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onLoad(options => { match_id.value = String(options?.match_id || '') })
const match = computed(() => store.match_detail(match_id.value)), person = computed(() => match.value?.candidate), seconds = computed(() => Math.max(0, Math.ceil(((match.value?.expires_at || store.clock_ms) - store.clock_ms) / 1000)))
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !match.value ? 'This match is unavailable.' : match.value.status !== 'found' ? `This match is now ${match.value.status}.` : !person.value ? 'This matched profile is unavailable.' : '')
const go = async (url, replace = false) => { if (navigating.value || is_loading.value) return; navigating.value = true; try { await (replace ? frame.value.navigate_replace(url) : frame.value.navigate_forward(url)) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
watch(() => match.value?.status, status => { if (status === 'expired' && !navigating.value) go(`/pages/auto-match/expired?match_id=${encodeURIComponent(match_id.value)}`, true) })
const resolve = async () => {
  const next = decision.value; decision.value = ''
  const status = next === 'connect' ? 'waiting' : 'passed'
  const result = await run_with_loading(() => store.transition_match(match_id.value, status))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  await go(`/pages/auto-match/${status}?match_id=${encodeURIComponent(match_id.value)}`, true)
}
onHide(() => { decision.value = ''; navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template><SecondaryPageFrame ref="frame" :scroll-locked="!!decision"><template #header><FlowPageHeader title="Match found" interaction="amFound.askLeaveMatch.click.1" :busy="is_loading || navigating" @back="decision = 'pass'" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view class="flow-body"><template v-if="!access_error && person"><view class="match-found-avatar"><UserAvatar :src="person.avatar_url" :name="person.user_name" /></view><text class="flow-title found-title">You have a lot in common</text><text class="flow-copy found-copy">{{ person.user_name }}, {{ person.age }} · {{ person.university }}</text><view class="flow-chip-row found-chips"><text v-for="item in person.interests" :key="item" class="flow-chip">{{ item }}</text></view><view class="flow-card"><view class="flow-status-line"><text>Response window</text><text>{{ seconds }}s</text></view><view class="flow-status-line"><text>Chat access</text><text>Locked until both accept</text></view></view><text class="flow-note">For privacy, the full profile unlocks only after both students connect.</text><view class="flow-secondary limited-profile" role="button" data-interaction="amFound.openLimitedProfile.click.1" @click="error = 'The full profile unlocks after both students connect.'">View limited profile</view></template><view v-else class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" data-interaction="amFound.connectAsk.click.1" @click="decision = 'connect'">Connect</view><view class="flow-secondary" role="button" data-interaction="amFound.passMatch.click.1" @click="decision = 'pass'">Pass</view></view><view v-else class="flow-footer"><view class="flow-secondary" role="button" @click="go('/pages/home/index', true)">Return Home</view></view></template><template #overlays><ConfirmDialog :visible="decision === 'connect'" title="Connect with this match?" message="Your choice is saved. Chat unlocks only after the other student also accepts." confirm-label="Connect" @cancel="decision = ''" @confirm="resolve" /><ConfirmDialog :visible="decision === 'pass'" title="Pass on this match?" message="Nothing will be shared and no connection will be created." confirm-label="Pass" danger @cancel="decision = ''" @confirm="resolve" /><EventActionLoading :visible="is_loading" :label="decision === 'connect' ? 'Saving your request…' : 'Closing this match…'" /></template></SecondaryPageFrame></template>

<style scoped>.match-found-avatar { width: 244.275rpx; height: 244.275rpx; margin: 30.534rpx auto; border: 7.634rpx solid var(--cimoa-surface-card); border-radius: 50%; box-shadow: var(--cimoa-shadow-profile-avatar); }.found-title, .found-copy { text-align: center; }.found-chips { justify-content: center; }.limited-profile { margin-top: 30.534rpx; }</style>
