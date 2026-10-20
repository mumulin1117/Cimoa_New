<script setup>
import { computed, ref } from 'vue'
import { use_profile_editor } from '@/composables/useProfileEditor.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const frame = ref(null), { store, error, access_error, go, back, recover } = use_profile_editor(frame)
const verification = computed(() => store.profile_verification)
const rows = computed(() => verification.value ? [
  ['University', verification.value.university || 'Not provided'],
  ['Account email', verification.value.masked_email],
  ['Verified on', verification.value.verified_at ? new Date(verification.value.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not recorded'],
  ['Status', verification.value.verified ? 'Active' : ({ pending: 'Pending', expired: 'Expired', required: 'Required' })[verification.value.status] || 'Unavailable'],
] : [])
</script>
<template>
  <ProfileEditorFrame ref="frame" class="profile-verification-page" title="University verification" source="verified" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <template v-if="verification">
      <view class="verification-summary"><view class="verification-badge"><view><SourceIcon :name="verification.verified ? 'check' : 'shield'" :stroke-width="2.6" /></view></view><text>{{ verification.verified ? 'Verified student' : 'Student verification pending' }}</text></view>
      <view class="verification-details"><view v-for="[label, value] in rows" :key="label" class="verification-row"><text>{{ label }}</text><text>{{ value }}</text></view></view>
      <text class="verification-note">Your university email is never shown to other students.</text>
      <text class="verification-note">Account code confirmation does not verify university enrollment. Check your student verification status above.</text>
    </template>
    <template #footer><view v-if="!access_error" class="verification-footer"><view class="verification-cta" role="button" tabindex="0" data-interaction="verified.openReverify.click.1" @click="go('/pages/profile/reverify')" @keydown.enter="go('/pages/profile/reverify')">Re-verify</view></view></template>
  </ProfileEditorFrame>
</template>
<style scoped>
.verification-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22.901rpx;
  padding: 49.618rpx 38.168rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.802rpx;
  box-shadow: var(--cimoa-shadow-card);
}
.verification-badge {
  width: 145.038rpx;
  height: 145.038rpx;
  border-radius: 50%;
  background: var(--cimoa-gradient-primary);
  box-shadow: var(--cimoa-shadow-profile-verification);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cimoa-text-inverse);
}
.verification-badge > view { width: 64.885rpx; height: 64.885rpx; }
.verification-summary > text { font-size: 43.893rpx; font-weight: 800; letter-spacing: -.03em; text-align: center; }
.verification-details { margin-top: 30.534rpx; padding: 11.45rpx 34.351rpx 22.901rpx; background: var(--cimoa-surface-card); border-radius: 45.802rpx; box-shadow: var(--cimoa-shadow-card); }
.verification-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15.267rpx;
  min-height: 99.237rpx;
  padding: 11.45rpx 0;
  border-bottom: 1px solid var(--cimoa-surface-event-divider);
  font-size: 32.443rpx;
}
.verification-row > text:first-child { color: var(--cimoa-text-secondary); flex: none; }
.verification-row > text:last-child { font-weight: 700; min-width: 0; text-align: right; overflow-wrap: anywhere; }
.verification-note {
  display: block;
  font-size: 28.626rpx;
  color: var(--cimoa-text-auth-placeholder);
  margin-top: 26.718rpx;
  text-wrap: pretty;
  line-height: 1.4;
}
.verification-footer { padding: 19.084rpx 38.168rpx 64.885rpx; flex: none; }
.verification-cta {
  height: 106.87rpx;
  border-radius: 53.435rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-connection-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34.351rpx;
  font-weight: 600;
  cursor: pointer;
}
.profile-verification-page :deep(.editor-body) { padding-bottom: 30.534rpx; }
</style>
