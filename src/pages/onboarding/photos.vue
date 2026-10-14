<script setup>
import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_onboarding } from '@/composables/useOnboarding.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import PhotoActionsConfirmDialog from '@/components/PhotoActionsConfirmDialog.vue'
const frame = ref(null), { store, context, error, access_error, is_loading, back, recover, save, go, run_with_loading } = use_onboarding('photos', frame)
const photos = computed(() => store.current_photos), selected_id = ref(''), selected = computed(() => photos.value.find(row => row.photo_id === selected_id.value))
// Technical layout order: the primary photo occupies the source's centre card.
const slots = computed(() => [1, 0, 2].map((position, slot) => ({ slot, position, photo: photos.value[position] })))
const pick = async photo => { error.value = ''; if (photo) selected_id.value = photo.photo_id; else await go('/pages/permissions/photos') }
const replace = async () => { const id = selected_id.value; selected_id.value = ''; await go(`/pages/permissions/photos?replace_id=${encodeURIComponent(id)}`) }
const edit = async action => {
  if (is_loading.value || !selected.value || !context.value) return
  error.value = ''; const id = selected_id.value, account_id = context.value.account_id
  const result = await run_with_loading(() => store.edit_onboarding_photo(id, action, account_id))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  selected_id.value = ''
}
onHide(() => { selected_id.value = '' })
</script>
<template>
  <OnboardingFrame ref="frame" step="photos" :busy="is_loading" :error="selected ? '' : error" :access-error="access_error" :disabled="photos.length < 2" interaction="obPhotos.goObAbout.click.1" @back="back" @recover="recover" @continue="save({})">
    <text class="onboarding-title photos-heading">Add your photos</text><text class="auth-description photos-heading">Add at least 2 photos</text>
    <view class="photo-fan"><view v-for="slot in slots" :key="slot.slot" class="photo-slot" :class="`photo-slot-${slot.slot}`" role="button" tabindex="0" :aria-label="slot.photo ? `Edit photo ${slot.position + 1}` : 'Add profile photo'" data-interaction="obPhotos.p.tap.click.1" @click="pick(slot.photo)" @keydown.enter="pick(slot.photo)">
      <ProfilePhoto v-if="slot.photo" :src="slot.photo.media_url" name="Your selected photo" portrait />
      <view v-else class="photo-slot-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.6" /></svg><text v-if="slot.position === 0">Main Photo</text></view>
      <text v-if="slot.photo && slot.position === 0" class="photo-primary">Primary</text>
    </view></view>
    <template #hint><text class="photos-hint">{{ photos.length >= 2 ? 'Tap a photo to replace, reorder, remove, or set it as your primary.' : 'Add at least 2 photos to continue' }}</text></template>
    <template #overlays><PhotoActionsConfirmDialog :open="!!selected" :busy="is_loading" :position="selected?.position ?? 0" :count="photos.length" :error="error" @close="selected_id = ''" @replace="replace" @action="edit" /></template>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
<style scoped>
.photos-heading { text-align: center; }
.photo-fan { position: relative; height: 534.351rpx; margin-top: 49.618rpx; }
.photo-slot { position: absolute; left: 50%; width: 278.626rpx; height: 389.313rpx; margin-left: -139.313rpx; border-radius: 41.985rpx; overflow: hidden; background: var(--cimoa-surface-card); transform-origin: center; }
.photo-slot-0 { top: 83.969rpx; transform: translateX(-183.206rpx) rotate(-12deg); box-shadow: var(--cimoa-shadow-onboarding-photo-side); z-index: 1; }
.photo-slot-1 { top: 0; box-shadow: var(--cimoa-shadow-onboarding-photo-main); z-index: 2; }
.photo-slot-2 { top: 83.969rpx; transform: translateX(183.206rpx) rotate(12deg); box-shadow: var(--cimoa-shadow-onboarding-photo-side); z-index: 1; }
.photo-slot-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 19.084rpx; color: var(--cimoa-text-profile-chevron); font-size: 28.626rpx; font-weight: 600; }
.photo-slot-empty svg { width: 49.618rpx; height: 49.618rpx; }
.photo-primary { position: absolute; bottom: 15.267rpx; left: 15.267rpx; padding: 7.634rpx 17.176rpx; border-radius: 20.992rpx; background: var(--cimoa-surface-photo-tag); color: var(--cimoa-text-inverse); font-size: 21.947rpx; font-weight: 700; }
.photos-hint { text-align: center; font-size: 27.672rpx; line-height: 1.4; color: var(--cimoa-text-auth-placeholder); }
</style>
