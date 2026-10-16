<script setup>
import EventAudio from './EventAudio.vue'
import SourceIcon from './SourceIcon.vue'

defineProps({
  intro: { type: Object, required: true },
})
</script>

<template>
  <view class="profile-voice-intro" :data-audio-url="intro.audio_url">
    <view class="profile-voice-heading">
      <view class="profile-voice-icon"><SourceIcon name="mic" /></view>
      <view class="profile-voice-copy"><text>Voice introduction</text><text>Tap to listen</text></view>
    </view>
    <EventAudio :src="intro.audio_url" :duration="intro.duration_ms" interaction="expanded.voiceIntroPlay.click.1" />
    <text class="profile-voice-transcript">{{ intro.transcript }}</text>
  </view>
</template>

<style scoped>
.profile-voice-intro { margin-top: 30.534rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.profile-voice-heading { display: flex; align-items: center; gap: 19.084rpx; }
.profile-voice-icon { display: flex; align-items: center; justify-content: center; width: 68.702rpx; height: 68.702rpx; padding: 17.176rpx; border-radius: 50%; color: var(--cimoa-text-profile-interest-icon); background: var(--cimoa-surface-profile-interest-icon); }
.profile-voice-copy { display: flex; flex-direction: column; gap: 3.817rpx; }
.profile-voice-copy text:first-child { color: var(--cimoa-text-title); font-size: 34.351rpx; font-weight: 800; }
.profile-voice-copy text:last-child { color: var(--cimoa-text-secondary); font-size: 24.809rpx; }
.profile-voice-intro :deep(.event-audio) { margin-top: 22.901rpx; padding: 15.267rpx 22.901rpx; border-radius: 34.351rpx; color: var(--cimoa-text-title); background: var(--cimoa-surface-tinted); }
.profile-voice-transcript { display: block; margin-top: 22.901rpx; color: var(--cimoa-text-profile-bio); font-size: 28.626rpx; line-height: 1.5; }
</style>
