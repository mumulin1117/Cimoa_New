<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow, onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { choose_images } from '@/utils/mediaCapabilities.js'
import { open_app_settings } from '@/utils/nativePermissions.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
const store = use_app_store(), frame = ref(null), error = ref(''), selecting = ref(false), navigating = ref(false), replace_id = ref('')
const context = computed(() => store.onboarding), allowed = computed(() => context.value && !context.value.completed && store.onboarding_catalog.steps.indexOf(context.value.step) >= store.onboarding_catalog.steps.indexOf('photos'))
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true, generation = 0
onLoad(options => { replace_id.value = options.replace_id || '' })
const hide = () => { active = false; generation++; selecting.value = false; navigating.value = false; cancel_loading() }
onShow(() => { active = true }); onHide(hide); onUnmounted(hide)
const back = async () => {
  if (!active || navigating.value) return
  navigating.value = true
  const token = generation
  try { await frame.value.navigate_back('/pages/onboarding/photos') }
  catch (cause) { if (active && token === generation) error.value = cause.message }
  finally { if (token === generation) navigating.value = false }
}
const cancel = () => { if (!is_loading.value && !selecting.value) return back() }
const settings = async () => { try { await open_app_settings() } catch (cause) { error.value = cause.message } }
const choose = async () => {
  if (!active || is_loading.value || selecting.value || navigating.value) return
  error.value = ''
  if (!allowed.value) { error.value = 'Complete your account and profile steps before choosing photos.'; return }
  const account_id = context.value.account_id, count = replace_id.value ? 1 : 3 - store.current_photos.length
  if (count < 1) { error.value = 'Your three photo slots are full. Go back and choose a photo to replace.'; return }
  selecting.value = true
  const token = generation
  try {
    const files = await choose_images(count)
    if (!active || token !== generation) return
    const result = await run_with_loading(scope => store.add_onboarding_photos(files, replace_id.value || null, account_id, scope))
    if (!active || token !== generation || result.reason === 'cancelled') return
    if (!result.success) { error.value = result.message; return }
    await back()
  } catch (cause) { if (active && token === generation) error.value = cause.message }
  finally { if (token === generation) selecting.value = false }
}
</script>
<template>
  <SecondaryPageFrame ref="frame" class="permission-photos-page">
    <view class="permission-content"><view class="permission-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="2.5" y="5" width="19" height="15" rx="3" /><circle cx="12" cy="12" r="3.6" /></svg></view><text class="permission-title">Choose photos from your library</text><text class="permission-copy">Cimoa only sees the photos you pick for your profile. Nothing else is read.</text>
      <view v-if="error" class="auth-card permission-error"><text class="permission-error-title">Photos were not added</text><text class="permission-copy" role="alert">{{ auth_message(error) }}</text><view class="permission-settings" role="button" tabindex="0" data-interaction="permPhotos.openSettings.click.1" @click="settings" @keydown.enter="settings">Open Settings</view><view class="permission-settings" role="button" tabindex="0" data-interaction="permPhotos.back.click.1" @click="back" @keydown.enter="back">Back to Photos</view></view>
    </view>
    <template #footer><view class="permission-footer"><view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading || selecting || navigating" :aria-busy="is_loading || selecting" data-interaction="permPhotos.allowPhotos.click.1" @click="choose" @keydown.enter="choose" @keydown.space.prevent="choose">Continue</view><view class="auth-secondary" role="button" tabindex="0" :aria-disabled="is_loading || selecting || navigating" data-interaction="permPhotos.denyPhotos.click.1" @click="cancel" @keydown.enter="cancel" @keydown.space.prevent="cancel">Cancel</view></view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Adding your photos…" /></template>
  </SecondaryPageFrame>
</template>
<style>
@import '../auth/auth.css';
</style>
<style scoped>
.permission-content { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; padding: 225.191rpx 45.802rpx 45.802rpx; }
.permission-icon { display: flex; align-items: center; justify-content: center; width: 175.572rpx; height: 175.572rpx; flex: none; border-radius: 87.786rpx; background: var(--cimoa-surface-deep); color: var(--cimoa-text-inverse); box-shadow: var(--cimoa-shadow-auth-action); }
.permission-icon svg { width: 76.336rpx; height: 76.336rpx; }
.permission-title { font-size: 51.527rpx; font-weight: 800; letter-spacing: -.035em; line-height: 1.15; text-align: center; }
.permission-copy { display: block; font-size: 32.443rpx; line-height: 1.45; color: var(--cimoa-text-secondary); text-align: center; }
.permission-error { margin-top: 7.634rpx; }
.permission-error-title { display: block; font-size: 32.443rpx; font-weight: 700; margin-bottom: 11.45rpx; }
.permission-error .permission-copy { font-size: 29.58rpx; text-align: left; }
.permission-settings { display: flex; align-items: center; justify-content: center; height: 91.603rpx; margin-top: 22.901rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-tinted); font-size: 31.489rpx; font-weight: 600; }
.permission-footer { display: flex; flex-direction: column; gap: 11.45rpx; padding: 0 38.168rpx 57.252rpx; }
</style>
