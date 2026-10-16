<script setup>
import { ref, watch } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
const frame = ref(null), { context, error, access_error, is_loading, back, recover, save } = use_onboarding('about', frame), bio = ref(context.value?.profile.bio || '')
watch(bio, () => { error.value = '' })
</script>
<template>
  <OnboardingFrame ref="frame" step="about" :busy="is_loading" :error="error" :access-error="access_error" interaction="obAbout.goObInterests.click.1" back-interaction="obAbout.goBack.click.1" :source-index="4" :source-total="8" :source-progress="50" @back="back" @recover="recover" @continue="save({ bio })">
    <text class="onboarding-title">A line about you</text><text class="auth-description">Optional, but it makes conversations easier to start.</text>
    <view class="auth-card about-card"><textarea v-model="bio" aria-label="About you" data-interaction="obAbout.onObBio.change.1" placeholder="Design student who loves quiet cafés, live music, and spontaneous photowalks." :maxlength="300" :disabled="is_loading" /><view class="about-counter"><text>Keep it short</text><text>{{ bio.length }} / 300</text></view></view>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
<style scoped>
.about-card { margin-top: 34.351rpx; }
.about-card textarea { width: 100%; min-height: 286.26rpx; font-size: 32.443rpx; line-height: 1.45; color: var(--cimoa-text-title); }
.about-card :deep(.uni-textarea-textarea) { word-break: normal; overflow-wrap: break-word; }
.about-counter { display: flex; align-items: center; justify-content: space-between; margin-top: 15.267rpx; font-size: 27.672rpx; color: var(--cimoa-text-auth-placeholder); }
.about-counter text:last-child { font-weight: 600; color: var(--cimoa-text-auth-muted); }
</style>
