<script setup>
import { reactive, ref, watch } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
const frame = ref(null), flow = use_onboarding('basic', frame)
const { context, catalog, error, access_error, is_loading, back, recover, save } = flow
const profile = context.value?.profile || {}, form = reactive({ user_name: profile.user_name === 'New member' ? '' : profile.user_name || '', date_of_birth: profile.date_of_birth || '', gender: profile.gender || '', pronouns: profile.pronouns || '' })
const gender = ref(catalog.value.genders.includes(form.gender) ? form.gender : form.gender ? 'Self-describe' : ''), pronouns = ref(catalog.value.pronouns.includes(form.pronouns) ? form.pronouns : form.pronouns ? 'Add your own' : '')
const select_gender = value => { gender.value = value; form.gender = value === 'Self-describe' ? '' : value }
const select_pronouns = value => { pronouns.value = value; form.pronouns = value === 'Add your own' ? '' : value }
watch(form, () => { error.value = '' })
</script>
<template>
  <OnboardingFrame ref="frame" step="basic" :busy="is_loading" :error="error" :access-error="access_error" interaction="obBasic.goObUni.click.1" @back="back" @recover="recover" @continue="save({ ...form })">
    <text class="onboarding-title">About you</text><text class="auth-description">Your name and age are public. Your date of birth and email stay private.</text>
    <view class="auth-field"><view class="onboarding-label-row"><text class="auth-label">Display name</text><text class="onboarding-private">Public</text></view><view class="auth-input-box"><input v-model="form.user_name" class="auth-input" aria-label="Display name" placeholder="Alex" :maxlength="50" :disabled="is_loading" /></view></view>
    <view class="auth-field"><view class="onboarding-label-row"><text class="auth-label">Date of birth</text><text class="onboarding-private">Private</text></view><view class="auth-input-box"><input v-model="form.date_of_birth" class="auth-input" aria-label="Date of birth" placeholder="YYYY-MM-DD" :maxlength="10" :disabled="is_loading" /></view></view>
    <view class="onboarding-section"><view class="onboarding-label-row"><text class="onboarding-label">Gender identity</text><text class="onboarding-private">Public</text></view><view class="onboarding-chips"><view v-for="value in catalog.genders" :key="value" class="onboarding-chip" :class="{ selected: gender === value }" role="button" tabindex="0" :aria-pressed="gender === value" @click="select_gender(value)" @keydown.enter="select_gender(value)">{{ value }}</view></view><view v-if="gender === 'Self-describe'" class="auth-input-box auth-field"><input v-model="form.gender" class="auth-input" aria-label="Describe your gender" placeholder="Your gender identity" :maxlength="50" /></view></view>
    <view class="onboarding-section"><view class="onboarding-label-row"><text class="onboarding-label">Pronouns</text><text class="onboarding-private">Optional</text></view><view class="onboarding-chips"><view v-for="value in catalog.pronouns" :key="value" class="onboarding-chip" :class="{ selected: pronouns === value }" role="button" tabindex="0" :aria-pressed="pronouns === value" @click="select_pronouns(value)" @keydown.enter="select_pronouns(value)">{{ value }}</view></view><view v-if="pronouns === 'Add your own'" class="auth-input-box auth-field"><input v-model="form.pronouns" class="auth-input" aria-label="Your pronouns" placeholder="Your pronouns" :maxlength="50" /></view></view>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
