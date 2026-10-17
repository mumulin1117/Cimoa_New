<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import SourceIcon from './SourceIcon.vue'
import ConnectionIcon from './ConnectionIcon.vue'
import ProfilePhoto from './ProfilePhoto.vue'
const props = defineProps({ userId: String })
const emit = defineEmits(['gallery'])
const store = use_app_store(), index = ref(0), error = ref('')
const person = computed(() => store.user_by_id(props.userId)), photos = computed(() => store.photos_for_user(props.userId)), photo = computed(() => photos.value[index.value] || photos.value[0]), song = computed(() => store.song_for_user(props.userId))
const goals = computed(() => store.goals_for_user(props.userId)), interests = computed(() => store.interests_for_user(props.userId))
const tags = computed(() => person.value ? [person.value.height_cm ? { icon: 'height', label: `${person.value.height_cm} cm` } : null, ...[['university','university'],['major','book'],['mbti','puzzle']].map(([key,icon]) => person.value[key] ? { icon, label: person.value[key] } : null), person.value.country?.length ? { emoji: person.value.country[0] === 'Malaysia' ? '🇲🇾' : '🌏', label: person.value.country.join(', ') } : null, ...[['drinking','🍷'],['smoking','🚭'],['religion','🕊️']].map(([key,emoji]) => person.value[key] ? { emoji, label: person.value[key] } : null), ...[['clubs','people'],['location','location']].map(([key,icon]) => person.value[key] ? { icon, label: person.value[key] } : null)].filter(Boolean) : [])
const change = delta => { if (photos.value.length > 1) index.value = (index.value + delta + photos.value.length) % photos.value.length }
</script>
<template>
  <view v-if="person" class="received-content">
    <view class="received-photo-card">
      <view class="received-photo" role="button" tabindex="0" aria-label="Open profile photo" data-interaction="reqReceived.openGallery.click.1" @click="emit('gallery', index)" @keydown.enter="emit('gallery', index)"><ProfilePhoto :src="photo?.media_url || ''" :name="person.user_name" :position="photo?.focal_point || '50% 22%'" /></view>
      <view v-if="song" class="received-song"><image :src="song.cover_url" mode="aspectFill" /><view><text>{{ song.title }}</text><text>{{ song.artist }}</text></view><view role="button" tabindex="0" aria-label="Play profile song" data-interaction="reqReceived.otherSongPlay.click.1" @click="error = 'This profile includes song artwork only. No playable audio was provided.'" @keydown.enter="error = 'This profile includes song artwork only. No playable audio was provided.'"><ConnectionIcon name="song-play" /></view></view>
      <template v-if="photos.length > 1"><view class="received-photo-hit received-photo-hit--prev" role="button" tabindex="0" aria-label="Previous photo" data-interaction="reqReceived.prevPhoto.click.1" @click="change(-1)" @keydown.enter="change(-1)" /><view class="received-photo-hit received-photo-hit--next" role="button" tabindex="0" aria-label="Next photo" data-interaction="reqReceived.nextPhoto.click.1" @click="change(1)" @keydown.enter="change(1)" /><view class="received-dots"><view v-for="(_,i) in photos" :key="i" :class="{ active: index === i }" /></view></template>
    </view>
    <text v-if="error" class="received-media-error" role="alert">{{ error }}</text>
    <view v-if="tags.length" class="received-card received-tags"><view v-for="tag in tags" :key="tag.label" class="received-chip"><view v-if="tag.icon" class="received-tag-icon"><ConnectionIcon v-if="tag.icon === 'location'" name="location" /><SourceIcon v-else :name="tag.icon" :stroke-width="1.7" /></view><text v-else class="received-emoji">{{ tag.emoji }}</text><text>{{ tag.label }}</text></view></view>
    <view v-if="person.bio" class="received-card received-bio"><text>{{ person.bio }}</text></view>
    <view v-if="goals.length" class="received-card"><view class="received-section"><view><SourceIcon name="people" :stroke-width="1.9" /></view><text>Looking for</text></view><view class="received-chips"><view v-for="goal in goals" :key="goal.item_id" class="received-chip"><text>{{ goal.emoji }}</text><text>{{ goal.label }}</text></view></view></view>
    <view v-if="interests.length" class="received-card"><view class="received-section received-section--blue"><view><SourceIcon name="sparkle" :stroke-width="1.9" /></view><text>Interests</text></view><view class="received-chips"><view v-for="interest in interests" :key="interest.item_id" class="received-chip"><text>{{ interest.emoji }}</text><text>{{ interest.label }}</text></view></view></view>
  </view>
</template>
<style scoped>
.received-content { padding: 0 38.168rpx 53.435rpx; }
.received-photo-card {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 45.802rpx;
  box-shadow: var(--cimoa-shadow-connection-photo);
}
.received-photo { position: absolute; inset: 0; cursor: pointer; }
.received-song {
  position: absolute;
  right: 26.718rpx;
  bottom: 22.901rpx;
  left: 26.718rpx;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  padding: 15.267rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-surface-profile-song);
  backdrop-filter: blur(26.718rpx);
}
.received-song image { flex: none; width: 83.969rpx; height: 83.969rpx; border-radius: 22.901rpx; }
.received-song > view:nth-child(2) { flex: 1; min-width: 0; }
.received-song text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.received-song text:first-child { color: var(--cimoa-text-inverse); font-size: 29.58rpx; font-weight: 700; }
.received-song text:last-child { color: var(--cimoa-text-profile-song-artist); font-size: 24.809rpx; }
.received-song > view:last-child {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 83.969rpx;
  height: 83.969rpx;
  padding: 22.901rpx;
  border-radius: 50%;
  background: var(--cimoa-surface-card);
  color: var(--cimoa-brand-purple);
  cursor: pointer;
}
.received-photo-hit {
  position: absolute;
  top: 0;
  bottom: 137.405rpx;
  z-index: 2;
  width: 35%;
  cursor: pointer;
}
.received-photo-hit--prev { left: 0; }
.received-photo-hit--next { right: 0; }
.received-dots {
  position: absolute;
  top: 26.718rpx;
  right: 26.718rpx;
  left: 26.718rpx;
  display: flex;
  gap: 11.45rpx;
  pointer-events: none;
}
.received-dots view { flex: 1; height: 5.725rpx; border-radius: 3.817rpx; background: var(--cimoa-surface-profile-dot-inactive); }
.received-dots .active { background: var(--cimoa-surface-card); }
.received-card { margin-top: 30.534rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-connection-profile); }
.received-tags { display: flex; flex-wrap: wrap; gap: 15.267rpx; margin-top: 38.168rpx; }
.received-chip {
  display: flex;
  align-items: center;
  gap: 11.45rpx;
  min-height: 64.885rpx;
  padding: 0 22.901rpx;
  border-radius: 32.443rpx;
  background: var(--cimoa-surface-tinted);
  color: var(--cimoa-text-profile-bio);
  font-size: 26.718rpx;
  font-weight: 500;
}
.received-tag-icon { width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-text-title); }
.received-emoji { font-size: 32.443rpx; line-height: 1; }
.received-bio {
  font-family: Caveat, cursive;
  font-size: 51.527rpx;
  font-weight: 600;
  line-height: 1.25;
  color: var(--cimoa-text-profile-bio);
  text-align: center;
  text-wrap: balance;
}
.received-section {
  display: flex;
  align-items: center;
  gap: 19.084rpx;
  font-size: 41.985rpx;
  font-weight: 800;
  letter-spacing: -.02em;
}
.received-section > view {
  width: 68.702rpx;
  height: 68.702rpx;
  padding: 17.176rpx;
  border-radius: 50%;
  color: var(--cimoa-text-profile-goal-icon);
  background: var(--cimoa-surface-profile-goal-icon);
}
.received-section--blue > view { color: var(--cimoa-text-profile-interest-icon); background: var(--cimoa-surface-profile-interest-icon); }
.received-chips { display: flex; flex-wrap: wrap; gap: 15.267rpx; margin-top: 22.901rpx; }
.received-media-error { display: block; margin-top: 15.267rpx; color: var(--cimoa-status-danger); font-size: 27.672rpx; line-height: 1.4; }
</style>
