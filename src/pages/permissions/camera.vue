<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { choose_camera_image } from '@/utils/mediaCapabilities.js'
import { open_app_settings } from '@/utils/nativePermissions.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'

const store = use_app_store(), frame = ref(null), error = ref(''), declined = ref(false), selecting = ref(false), fallback = ref('/pages/onboarding/photos')
const context = computed(() => store.onboarding)
const allowed_fallbacks = new Set(['/pages/onboarding/photos', '/pages/profile/edit', '/pages/messages/chat', '/pages/events/group'])
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true, generation = 0

onLoad(options => {
  const requested = typeof options?.fallback === 'string' ? decodeURIComponent(options.fallback) : ''
  if (allowed_fallbacks.has(requested)) fallback.value = requested
})
const hide = () => { active = false; generation++; selecting.value = false; cancel_loading() }
onShow(() => { active = true }); onHide(hide); onUnmounted(hide)
const back = async () => { try { await frame.value.navigate_back(fallback.value) } catch (cause) { error.value = cause.message } }
const settings = async () => { try { await open_app_settings() } catch (cause) { error.value = cause.message } }
const choose = async () => {
  if (is_loading.value || selecting.value) return
  error.value = ''; declined.value = false
  if (!context.value || context.value.completed) { error.value = 'Complete local verification and return to profile setup before taking a photo.'; return }
  if (store.current_photos.length >= 3) { error.value = 'Your three photo slots are full. Return to Photos and choose a photo to replace.'; return }
  selecting.value = true
  const token = generation, account_id = context.value.account_id
  try {
    const files = await choose_camera_image()
    if (!active || token !== generation) return
    const result = await run_with_loading(scope => store.add_onboarding_photos(files, null, account_id, scope))
    if (!active || token !== generation || result.reason === 'cancelled') return
    if (!result.success) { error.value = result.message; return }
    await back()
  } catch (cause) { if (active && token === generation) error.value = cause.message }
  finally { if (token === generation) selecting.value = false }
}
</script>

<template>
  <SecondaryPageFrame ref="frame" class="permission-camera-page">
    <view class="permission-camera-content">
      <view class="permission-camera-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="2.5" y="6.5" width="19" height="13.5" rx="3" /><circle cx="12" cy="13.2" r="3.6" /><path d="M8.5 6.5 10 4h4l1.5 2.5" /></svg></view>
      <text class="permission-camera-title">Take a profile photo</text>
      <text class="permission-camera-copy">The camera is used only while you take a photo. Cimoa does not record in the background.</text>
      <view v-if="declined || error" class="auth-card permission-camera-error">
        <text class="permission-camera-error-title">{{ declined && !error ? 'Access is off' : 'Photo was not added' }}</text>
        <text class="permission-camera-copy permission-camera-error-copy" role="alert">{{ error || 'Without it you can’t add a photo here. You can turn camera access on in Settings, or return and use your photo library.' }}</text>
        <view class="permission-camera-settings" role="button" tabindex="0" data-interaction="permCamera.openSettings.click.1" @click="settings" @keydown.enter="settings">Open Settings</view>
      </view>
    </view>
    <template #footer><view class="permission-camera-footer"><view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading || selecting" data-interaction="permCamera.allowPhotos.click.1" @click="choose" @keydown.enter="choose">{{ selecting ? 'Opening Camera…' : 'Allow Camera' }}</view><view class="auth-secondary" role="button" tabindex="0" :aria-disabled="is_loading || selecting" data-interaction="permCamera.denyPhotos.click.1" @click="!is_loading && !selecting && (declined = true)" @keydown.enter="!is_loading && !selecting && (declined = true)">Not Now</view></view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Saving captured photo…" /></template>
  </SecondaryPageFrame>
</template>

<style>
@import '../auth/auth.css';
</style>
<style scoped>
.permission-camera-content { display: flex; flex-direction: column; align-items: center; gap: 30.534rpx; padding: 225.191rpx 45.802rpx 45.802rpx; }
.permission-camera-icon { display: flex; align-items: center; justify-content: center; width: 175.572rpx; height: 175.572rpx; flex: none; border-radius: 87.786rpx; background: var(--cimoa-surface-deep); color: var(--cimoa-text-inverse); box-shadow: var(--cimoa-shadow-auth-action); }
.permission-camera-icon svg { width: 76.336rpx; height: 76.336rpx; }
.permission-camera-title { display: block; font-size: 51.527rpx; font-weight: 800; letter-spacing: -.035em; line-height: 1.15; text-align: center; }
.permission-camera-copy { display: block; font-size: 32.443rpx; line-height: 1.45; color: var(--cimoa-text-secondary); text-align: center; }
.permission-camera-error { width: 100%; margin-top: 7.634rpx; }
.permission-camera-error-title { display: block; font-size: 32.443rpx; font-weight: 700; margin-bottom: 11.45rpx; }
.permission-camera-error-copy { font-size: 29.58rpx; text-align: left; }
.permission-camera-settings { display: flex; align-items: center; justify-content: center; height: 91.603rpx; margin-top: 22.901rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-tinted); font-size: 31.489rpx; font-weight: 600; }
.permission-camera-footer { display: flex; flex-direction: column; gap: 11.45rpx; padding: 0 38.168rpx 57.252rpx; }
</style>
