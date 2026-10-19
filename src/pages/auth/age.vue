<script setup>
import { ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { age_from_date } from '@/utils/localAuth.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { use_visual_viewport } from '@/composables/useEventViewport.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import DateOfBirthPickerConfirmDialog from '@/components/DateOfBirthPickerConfirmDialog.vue'
const store = use_app_store(), frame = ref(null), dob = ref(store.auth_draft.profile_draft.date_of_birth || ''), under = ref(false), error = ref('')
const picker_open = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const { height: viewport_height, keyboard_open } = use_visual_viewport()
onHide(() => { cancel_loading(); picker_open.value = false })
const back = async () => { if (picker_open.value) { picker_open.value = false; return }; try { await frame.value.navigate_back() } catch (cause) { error.value = cause.message } }
const open_picker = () => { if (!is_loading.value) picker_open.value = true }
const select_date = value => {
  if (is_loading.value || !picker_open.value || age_from_date(value, store.clock_ms) === null) return
  dob.value = value; under.value = false; error.value = ''; picker_open.value = false
}
const show_underage = () => { if (is_loading.value) return; error.value = ''; under.value = true }
const next = async () => {
  if (is_loading.value || picker_open.value) return
  error.value = ''; under.value = false
  const age = age_from_date(dob.value, store.clock_ms)
  if (age == null) { error.value = 'Enter a valid date of birth in YYYY-MM-DD format.'; return }
  if (age < 18) { under.value = true; return }
  const result = await run_with_loading(() => store.save_registration_age(dob.value))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  try { await frame.value.navigate_forward(auth_destination('/pages/auth/community')) } catch (cause) { error.value = cause.message }
}
</script>
<template>
  <AuthPageFrame ref="frame" class="age-page" :class="{ 'age-page--keyboard': keyboard_open }" title="Age check" back-interaction="age.goBack.click.1" :busy="is_loading" :style="{ height: viewport_height }" @back="back">
    <text class="auth-heading">Are you 18 or older?</text>
    <text class="auth-description">Cimoa is available only to university students aged 18 or older. Your date of birth stays private — other students only see your age.</text>
    <view class="auth-field"><text class="auth-label">Date of birth</text><view class="auth-input-box" role="button" tabindex="0" aria-label="Date of birth" aria-haspopup="dialog" :aria-expanded="picker_open" :aria-disabled="is_loading" data-interaction="age.openDatePicker.click.1" @click="open_picker" @keydown.enter="open_picker" @keydown.space.prevent="open_picker"><text class="auth-input age-date-value" :class="{ 'age-date-placeholder': !dob }" :data-date-value="dob" data-placeholder="YYYY-MM-DD">{{ dob || 'YYYY-MM-DD' }}</text></view></view>
    <view v-if="under" class="auth-card age-under" role="alert"><text class="age-title">Cimoa isn’t available yet</text><text class="age-under-copy">You need to be 18 or older to create an account. Nothing has been saved.</text><view class="age-close" role="button" tabindex="0" data-interaction="age.closeUnder.click.1" @click="back" @keydown.enter="back">Close</view></view>
    <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    <template #footer><view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="age.goAgree.click.1" @click="next" @keydown.enter="next">Continue</view><view class="auth-secondary" role="button" tabindex="0" data-interaction="age.underage.click.1" @click="show_underage" @keydown.enter="show_underage">I’m under 18</view></template>
    <template #overlays><DateOfBirthPickerConfirmDialog :open="picker_open" :value="dob" :now="store.clock_ms" :busy="is_loading" @confirm="select_date" @close="picker_open = false" /><AuthActionLoading :visible="is_loading" label="Saving age check…" /></template>
  </AuthPageFrame>
</template>
<style>
@import './auth.css';
</style>
<style scoped>
.age-page.age-page--keyboard :deep(.auth-footer) { display: none; }
.age-date-value { display: flex; align-items: center; }
.age-date-placeholder { color: var(--cimoa-text-auth-placeholder); }
.age-under { margin-top: 34.351rpx; padding: 38.168rpx; }
.age-title { display: block; font-size: 38.168rpx; font-weight: 800; letter-spacing: -.025em; }
.age-under-copy { display: block; margin-top: 15.267rpx; color: var(--cimoa-text-secondary); font-size: 30.534rpx; line-height: 1.45; }
.age-close { display: flex; align-items: center; justify-content: center; height: 95.42rpx; border-radius: 47.71rpx; margin-top: 26.718rpx; background: var(--cimoa-surface-tinted); font-size: 32.443rpx; font-weight: 600; }
</style>
