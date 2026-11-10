<script setup>
import EventAudio from './EventAudio.vue'
import SourceIcon from './SourceIcon.vue'
import ProfilePhoto from './ProfilePhoto.vue'
import BrandProgressMark from './BrandProgressMark.vue'

defineProps({
  intro: { type: Object, required: true },
  cover: { type: String, default: '' },
  name: { type: String, required: true },
})
</script>

<template>
  <view class="profile-voice-intro" :data-audio-url="intro.audio_url">
    <EventAudio :src="intro.audio_url" :duration="intro.duration_ms" interaction="expanded.voiceIntroPlay.click.1">
      <template #default="{ playing, pending, error, toggle }">
        <view class="profile-voice-bar" @click.stop>
          <view class="profile-voice-cover"><ProfilePhoto v-if="cover" :src="cover" :name="name" portrait /><view v-else class="profile-voice-icon"><SourceIcon name="mic" /></view></view>
          <view class="profile-voice-copy">
            <text class="profile-voice-title">Voice introduction</text>
            <text v-if="error" class="profile-voice-status" role="alert">{{ error }}</text>
            <text v-else-if="pending" class="profile-voice-status" aria-live="polite">Loading audio…</text>
            <text v-else class="profile-voice-transcript" :title="intro.transcript">{{ intro.transcript || `${Math.ceil((intro.duration_ms || 0) / 1000)}s` }}</text>
          </view>
          <view class="profile-voice-play event-audio-button" role="button" tabindex="0" :aria-label="pending ? 'Loading voice introduction' : playing ? 'Pause voice message' : 'Play voice message'" :aria-description="`${Math.ceil((intro.duration_ms || 0) / 1000)}s voice introduction`" :aria-disabled="pending" :aria-busy="pending" data-interaction="expanded.voiceIntroPlay.click.1" @click.stop="toggle" @keydown.enter.stop="toggle" @keydown.space.stop.prevent="toggle"><view class="profile-voice-play-icon"><BrandProgressMark v-if="pending" /><SourceIcon v-else :name="playing ? 'pause' : 'play'" /></view></view>
        </view>
      </template>
    </EventAudio>
  </view>
</template>

<style scoped>
.profile-voice-intro { position: absolute; right: 26.718rpx; bottom: 22.901rpx; left: 26.718rpx; z-index: 4; border-radius: 41.985rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-surface-profile-song); backdrop-filter: blur(26.718rpx); }
.profile-voice-bar { display: flex; align-items: center; gap: 22.901rpx; height: 114.504rpx; padding: 15.267rpx; }
.profile-voice-cover { position: relative; flex: none; width: 83.969rpx; height: 83.969rpx; overflow: hidden; border-radius: 22.901rpx; }
.profile-voice-icon { display: flex; align-items: center; justify-content: center; height: 100%; padding: 22.901rpx; }
.profile-voice-copy { flex: 1; min-width: 0; }
.profile-voice-copy text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-voice-title { font-size: 29.58rpx; font-weight: 700; }
.profile-voice-transcript, .profile-voice-status { margin-top: 3.817rpx; color: var(--cimoa-text-profile-song-artist); font-size: 24.809rpx; }
.profile-voice-copy .profile-voice-status { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; line-height: 1.15; font-size: 20.992rpx; }
.profile-voice-play { flex: none; display: flex; align-items: center; justify-content: center; width: 83.969rpx; height: 83.969rpx; padding: 0; border-radius: 50%; color: var(--cimoa-text-settings-purple); background: var(--cimoa-surface-card); cursor: pointer; }
.profile-voice-play[aria-disabled="true"] { cursor: default; }
.profile-voice-play-icon { width: 38.168rpx; height: 38.168rpx; }
</style>
