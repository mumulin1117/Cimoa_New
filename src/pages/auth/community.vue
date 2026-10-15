<script setup>
import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import AgreementSheet from '@/components/AgreementSheet.vue'
const store = use_app_store(), frame = ref(null), agreed = ref({ ...store.auth_draft.agreements }), error = ref(''), document = ref(null)
const catalog = computed(() => store.registration_catalog), ready = computed(() => catalog.value.agreements.every(row => agreed.value[row.key]))
const toggle_interactions = { terms: 'agree.tTerms.click.1', privacy: 'agree.tPrivacy.click.1', community: 'agree.tGuides.click.1' }
const read_interactions = { terms: 'agree.readTerms.click.1', privacy: 'agree.readPrivacy.click.1', community: 'agree.readGuides.click.1' }
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onHide(() => { cancel_loading(); document.value = null })
const back = async () => { try { await frame.value.navigate_back('/pages/auth/age') } catch (cause) { error.value = cause.message } }
const toggle = key => {
  if (is_loading.value) return
  error.value = ''
  agreed.value[key] = !agreed.value[key]
}
const read = row => {
  if (is_loading.value) return
  error.value = ''
  document.value = row
}
const next = async () => {
  if (is_loading.value) return
  if (!ready.value) { error.value = 'Please confirm all three community agreements.'; return }
  error.value = ''
  const result = await run_with_loading(() => store.save_registration_agreements(agreed.value))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  try { await frame.value.navigate_forward(auth_destination('/pages/auth/signup')) } catch (cause) { error.value = cause.message }
}
</script>
<template>
  <AuthPageFrame ref="frame" class="community-page" title="Community" back-interaction="agree.goBack.click.1" :busy="is_loading" @back="back">
    <text class="auth-heading">How Cimoa works</text>
    <view class="auth-card community-rules"><text v-for="rule in catalog.rules" :key="rule">{{ rule }}</text></view>
    <view v-for="row in catalog.agreements" :key="row.key" class="auth-card community-row">
      <view class="community-check-area" role="checkbox" tabindex="0" :aria-label="row.label" :aria-checked="!!agreed[row.key]" :aria-disabled="is_loading" :data-agreement="row.key" :data-interaction="toggle_interactions[row.key]" @click="toggle(row.key)" @keydown.enter="toggle(row.key)" @keydown.space.prevent="toggle(row.key)">
        <view class="community-box" :class="{ selected: agreed[row.key] }"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></view><text>{{ row.label }}</text>
      </view><view class="community-read" role="button" tabindex="0" :aria-label="`Read ${row.title}`" :aria-disabled="is_loading" :data-interaction="read_interactions[row.key]" @click.stop="read(row)" @keydown.enter.stop="read(row)" @keydown.space.stop.prevent="read(row)">Read</view>
    </view>
    <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    <template #footer><view class="auth-primary" :class="{ 'is-disabled': !ready }" role="button" tabindex="0" :aria-disabled="!ready || is_loading" data-interaction="agree.goSignup.click.1" @click="next" @keydown.enter="next">Continue</view></template>
    <template #overlays><AgreementSheet :open="!!document" :document="document" @close="document = null" /><AuthActionLoading :visible="is_loading" label="Saving agreements…" /></template>
  </AuthPageFrame>
</template>
<style>
@import './auth.css';
</style>
<style scoped>
.community-page :deep(.auth-footer) { padding-bottom: 64.885rpx; }
.community-rules { display: flex; flex-direction: column; gap: 17.176rpx; margin-top: 30.534rpx; font-size: 31.489rpx; color: var(--cimoa-text-profile-bio); }
.community-row { display: flex; align-items: center; gap: 26.718rpx; padding: 30.534rpx 34.351rpx; margin-top: 19.084rpx; }
.community-check-area { flex: 1; display: flex; align-items: center; gap: 26.718rpx; font-size: 31.489rpx; font-weight: 600; }
.community-check-area > text { text-wrap: pretty; }
.community-box { flex: none; width: 53.435rpx; height: 53.435rpx; box-sizing: border-box; border: 3.817rpx solid var(--cimoa-surface-outline); border-radius: 17.176rpx; display: flex; align-items: center; justify-content: center; color: var(--cimoa-text-inverse); }
.community-box.selected { background: var(--cimoa-gradient-primary); border-color: var(--cimoa-surface-transparent); color: var(--cimoa-text-inverse); }
.community-box svg { width: 30.534rpx; height: 30.534rpx; }
.community-read { color: var(--cimoa-text-link); font-size: 28.626rpx; font-weight: 600; }
</style>
