<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const selected = ref('')
const account_id = store.session.account_id
const draft_target = `account:${account_id || 'none'}`
const options = ['I no longer use Cimoa', 'I met the people I wanted to meet', 'Privacy concerns', 'Safety concerns', 'Too many notifications', 'Technical issues', 'Other', 'Prefer not to say']
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const restore = () => {
  const draft = store.current_drafts.find(row => row.kind === 'delete-account' && row.target_id === draft_target)
  selected.value = options.includes(draft?.payload?.reason) ? draft.payload.reason : ''
}
restore()
const leave = () => { active = false; cancel_loading() }
onShow(() => { active = true; restore() })
onHide(leave)
onUnmounted(leave)
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/settings/delete/info') } catch (cause) { error.value = cause.message } }
const save_and_continue = async () => {
  if (is_loading.value || access_error.value) return
  error.value = ''
  const result = await run_with_loading(() => store.save_draft('delete-account', draft_target, { reason: selected.value }))
  if (!active || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message || 'The deletion reason could not be saved.'; return }
  try { await frame.value.navigate_forward('/pages/settings/delete/final') } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="delete-reason-page" title="Before you go" source="delReason" :busy="is_loading" loading-label="Saving deletion reason…" :error="error" :access-error="access_error" action-label="Continue" action-interaction="delReason.openDelFinal.click.1" @back="back" @save="save_and_continue" @recover="recover">
    <text class="delete-reason-intro">Optional — tell us why. You can continue without choosing one.</text>
    <view class="delete-reason-list" role="radiogroup" aria-label="Account deletion reason"><view v-for="option in options" :key="option" class="delete-reason-choice" :class="{ selected: selected === option }" role="radio" tabindex="0" :aria-checked="selected === option" :aria-disabled="is_loading" data-interaction="delReason.r.pick.click.1" @click="!is_loading && (selected = option)" @keydown.enter="!is_loading && (selected = option)">{{ option }}</view></view>
  </ProfileEditorFrame>
</template>

<style>
@import './delete-pages.css';
</style>
