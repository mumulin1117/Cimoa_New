<script setup>
import { ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { age_from_date } from '@/utils/localAuth.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
const store = use_app_store(), frame = ref(null), dob = ref(store.auth_draft.profile_draft.date_of_birth || ''), under = ref(false), error = ref('')
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
onHide(cancel_loading)
const back = async () => { try { await frame.value.navigate_back() } catch (cause) { error.value = cause.message } }
const next = async () => {
  if (is_loading.value) return
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
  <AuthPageFrame ref="frame" class="age-page" title="Age check" :busy="is_loading" @back="back">
    <text class="auth-heading">Are you 18 or older?</text>
    <text class="auth-description">Cimoa is available only to university students aged 18 or older. Your date of birth stays private — other students only see your age.</text>
    <view class="auth-field"><text class="auth-label">Date of birth</text><view class="auth-input-box"><input v-model="dob" class="auth-input" aria-label="Date of birth" placeholder="YYYY-MM-DD" :maxlength="10" :disabled="is_loading" @input="under = false" /></view></view>
    <view v-if="under" class="auth-card age-under" role="alert"><text class="age-title">Cimoa isn’t available yet</text><text class="auth-description">You need to be 18 or older to create an account. Nothing has been saved.</text><view class="age-close" role="button" tabindex="0" data-interaction="age.closeUnder.click.1" @click="back" @keydown.enter="back">Close</view></view>
    <text v-if="error" class="auth-error-box" role="alert">{{ error }}</text>
    <template #footer><view class="auth-primary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="age.goAgree.click.1" @click="next" @keydown.enter="next">Continue</view><view class="auth-secondary" role="button" tabindex="0" data-interaction="age.underage.click.1" @click="under = true" @keydown.enter="under = true">I’m under 18</view></template>
    <template #overlays><AuthActionLoading :visible="is_loading" label="Saving age check…" /></template>
  </AuthPageFrame>
</template>
<style>
@import './auth.css';
</style>
<style scoped>
.age-under { margin-top: 34.351rpx; }
.age-title { font-size: 38.168rpx; font-weight: 800; }
.age-close { display: flex; align-items: center; justify-content: center; height: 95.42rpx; border-radius: 47.71rpx; margin-top: 26.718rpx; background: var(--cimoa-surface-tinted); font-size: 32.443rpx; font-weight: 600; }
</style>
