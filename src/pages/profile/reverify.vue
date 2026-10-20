<script setup>
import { ref } from 'vue'
import { use_profile_editor } from '@/composables/useProfileEditor.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
const frame = ref(null), { store, error, access_error, is_loading, run_with_loading, back, recover } = use_profile_editor(frame, '/pages/profile/verification')
const start = async () => {
  if (is_loading.value || access_error.value) return
  error.value = ''
  const result = await run_with_loading(() => store.start_student_reverification())
  if (result.reason !== 'cancelled' && !result.success) error.value = result.message
}
</script>
<template>
  <ProfileEditorFrame ref="frame" class="profile-reverify-page" title="Re-verify university" source="reverify" :busy="is_loading" loading-label="Checking verification availability…" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <view class="reverify-body">
      <text class="reverify-introduction">Needed if your university email changed, your last verification expired, or your account needs a status review.</text>
      <view class="reverify-pending"><text>While this is pending</text><text>Your existing conversations stay visible. Discover, Auto Match, and new connection requests are temporarily restricted until verification finishes.</text></view>
      <text class="reverify-note">University verification is currently unavailable. Your saved student status will not change. Account code confirmation does not verify university enrollment.</text>
    </view>
    <template #footer><view v-if="!access_error" class="reverify-footer"><view class="editor-save" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="reverify.goVerEmail.click.1" @click="start" @keydown.enter="start">Start Re-verification</view></view></template>
  </ProfileEditorFrame>
</template>
<style scoped>
.reverify-introduction { display: block; font-size: 30.534rpx; color: var(--cimoa-text-secondary); text-wrap: pretty; }
.reverify-pending { margin-top: 30.534rpx; padding: 34.351rpx; border-radius: 41.985rpx; background: var(--cimoa-surface-profile-pending); }
.reverify-pending > text:first-child { display: block; font-size: 30.534rpx; font-weight: 700; }
.reverify-pending > text:last-child { display: block; margin-top: 11.45rpx; font-size: 29.58rpx; color: var(--cimoa-text-profile-icon); line-height: 1.5; text-wrap: pretty; }
.reverify-note { display: block; margin-top: 26.718rpx; font-size: 26.718rpx; color: var(--cimoa-text-auth-placeholder); line-height: 1.4; }
.reverify-footer { padding: 19.084rpx 38.168rpx 64.885rpx; flex: none; }
</style>
