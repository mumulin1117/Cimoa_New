<script setup>
import { computed, ref, watch } from 'vue'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import { use_profile_editor } from '@/composables/useProfileEditor.js'
import { bio_style, profile_preview_tags } from '@/utils/profilePresentation.js'
import EventAudio from '@/components/EventAudio.vue'
const frame = ref(null), { store, error, access_error, go, back, recover } = use_profile_editor(frame)
const user = computed(() => store.current_user), photos = computed(() => store.current_photos), photo_index = ref(0)
const tags = computed(() => profile_preview_tags(user.value, store.current_settings)), goals = computed(() => store.goals_for_user(user.value.user_id))
const song = computed(() => store.profile_catalog.songs.find(row => row.song_id === user.value.song_id))
const audio = computed(() => store.profile_editor?.audio)
watch(photos, value => { photo_index.value = Math.min(photo_index.value, Math.max(0, value.length - 1)) })
const turn_photo = direction => { if (photos.value.length > 1) photo_index.value = (photo_index.value + direction + photos.value.length) % photos.value.length }
const edit = () => go('/pages/profile/edit')
</script>
<template>
  <SecondaryPageFrame ref="frame" class="profile-preview-page">
    <template #header><view class="preview-header"><view class="preview-tool" role="button" aria-label="Back" data-interaction="profilePreview.goBack.click.1" @click="back"><SourceIcon name="back" /></view><view v-if="!access_error" class="preview-name"><text>{{ user.user_name }}{{ user.age ? `, ${user.age}` : '' }}</text><view v-if="user.verified" class="preview-verified" role="img" aria-label="Verified student"><SourceIcon name="verified" /></view></view><view v-if="!access_error" class="preview-tool" role="button" aria-label="Edit Profile" data-interaction="profilePreview.openEditBasic.click.1" @click="edit"><SourceIcon name="edit" /></view></view><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
    <view class="preview-body"><view v-if="access_error" class="editor-access" role="alert"><text>{{ access_error }}</text><view class="editor-outline" role="button" @click="recover">Return to account entry</view></view><template v-else>
      <view class="preview-photo"><ProfilePhoto :src="photos[photo_index]?.media_url || ''" :name="user.user_name" /><view v-if="photos.length > 1" class="photo-navigation"><view role="button" aria-label="Previous photo" data-interaction="profilePreview.prevPhoto.click.1" @click="turn_photo(-1)" /><view role="button" aria-label="Next photo" data-interaction="profilePreview.nextPhoto.click.1" @click="turn_photo(1)" /></view><view class="photo-dots" aria-label="Profile photo position"><view v-for="(photo, index) in photos" :key="photo.photo_id" :class="{ active: photo_index === index }" :aria-current="photo_index === index ? 'true' : undefined" /></view>
        <view v-if="song" class="preview-song" aria-label="Favorite song"><image :src="song.cover_url" mode="aspectFill" /><view class="song-labels"><text>{{ song.title }}</text><text>{{ song.artist }}</text></view><view class="song-mark" aria-hidden="true"><SourceIcon name="music" /></view></view>
      </view>
      <view class="preview-card preview-tags"><view v-for="tag in tags" :key="tag.key" class="preview-tag"><view v-if="tag.icon" class="tag-icon"><SourceIcon :name="tag.icon" :stroke-width="1.7" /></view><text v-else class="tag-emoji">{{ tag.emoji }}</text><text>{{ tag.label }}</text></view><text v-if="!tags.length" class="editor-copy">No details shared yet.</text></view>
      <view class="preview-card"><EventAudio v-if="audio" :src="audio.media_url" :duration="audio.duration_ms" interaction="profilePreview.evTogglePlay.click.1" /><text v-if="user.bio" class="editor-bio" :style="bio_style(user.bio_font)">{{ user.bio }}</text><text v-else class="editor-copy">No introduction yet.</text></view>
      <view class="preview-card"><view class="preview-heading"><view class="heading-icon goals-icon"><SourceIcon name="people" :stroke-width="1.9" /></view><text>Looking for</text></view><view class="preview-tags section-tags"><view v-for="goal in goals" :key="goal.item_id" class="preview-tag"><text>{{ goal.emoji }}</text><text>{{ goal.label }}</text></view></view><text v-if="!goals.length" class="editor-copy">No connection goals selected yet.</text></view>
      <view class="preview-card"><view class="preview-heading"><view class="heading-icon interests-icon"><SourceIcon name="sparkle" :stroke-width="1.9" /></view><text>Interests</text></view><view class="preview-tags section-tags"><view v-for="interest in store.current_interests" :key="interest.item_id" class="preview-tag"><text>{{ interest.emoji }}</text><text>{{ interest.label }}</text></view></view><text v-if="!store.current_interests.length" class="editor-copy">No interests selected yet.</text></view>
    </template></view>
    <template #footer><view v-if="!access_error" class="editor-footer"><view class="editor-save preview-edit" role="button" data-interaction="profilePreview.openEditBasic.click.2" @click="edit"><view><SourceIcon name="edit" :stroke-width="2.2" /></view>Edit Profile</view></view></template>
  </SecondaryPageFrame>
</template>
<style scoped>
.preview-header { display: flex; align-items: center; gap: 13.359rpx; margin: 11.45rpx 38.168rpx 22.901rpx; min-height: 103.053rpx; }
.preview-tool {
  flex: none;
  width: 103.053rpx;
  height: 103.053rpx;
  padding: 28.626rpx;
  border-radius: 51.527rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
}
.preview-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13.359rpx;
  font-size: 43.893rpx;
  font-weight: 700;
  letter-spacing: -.02em;
}
.preview-name > text { min-width: 0; overflow-wrap: anywhere; text-align: center; line-height: 1.2; }
.preview-verified { flex: none; width: 38.168rpx; height: 38.168rpx; }
.preview-body { padding: 0 38.168rpx 38.168rpx; overflow-wrap: anywhere; }
.preview-photo {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 45.802rpx;
  overflow: hidden;
  box-shadow: var(--cimoa-shadow-profile-avatar);
}
.photo-navigation { position: absolute; inset: 0; pointer-events: none; }
.photo-navigation > view { position: absolute; top: 0; bottom: 0; width: 35%; pointer-events: auto; }
.photo-navigation > view:first-child { left: 0; }
.photo-navigation > view:last-child { right: 0; }
.photo-dots {
  position: absolute;
  top: 26.718rpx;
  left: 26.718rpx;
  right: 26.718rpx;
  display: flex;
  gap: 11.45rpx;
  pointer-events: none;
}
.photo-dots > view { flex: 1; height: 5.725rpx; border-radius: 3.817rpx; background: var(--cimoa-surface-profile-dot-inactive); }
.photo-dots > .active { background: var(--cimoa-surface-card); }
.preview-song {
  position: absolute;
  left: 26.718rpx;
  right: 26.718rpx;
  bottom: 26.718rpx;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  padding: 15.267rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-surface-profile-song);
  backdrop-filter: blur(26.718rpx);
  color: var(--cimoa-text-inverse);
}
.preview-song image { flex: none; width: 83.969rpx; height: 83.969rpx; border-radius: 22.901rpx; }
.song-labels { flex: 1; min-width: 0; }
.song-labels text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 29.58rpx;
  font-weight: 700;
}
.song-labels text + text { font-size: 24.809rpx; font-weight: 400; color: var(--cimoa-text-profile-song-artist); }
.song-mark {
  flex: none;
  width: 83.969rpx;
  height: 83.969rpx;
  padding: 22.901rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-surface-card);
  color: var(--cimoa-brand-purple);
}
.preview-card { margin-top: 30.534rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-auth-input); }
.preview-photo + .preview-card { margin-top: 38.168rpx; }
.preview-tags { display: flex; flex-wrap: wrap; gap: 15.267rpx; }
.preview-tag {
  display: flex;
  align-items: center;
  gap: 11.45rpx;
  min-height: 64.885rpx;
  max-width: 100%;
  padding: 11.45rpx 22.901rpx;
  border-radius: 32.443rpx;
  background: var(--cimoa-surface-tinted);
  color: var(--cimoa-text-profile-bio);
  font-size: 26.718rpx;
  font-weight: 500;
}
.preview-tag > text { min-width: 0; }
.tag-icon { flex: none; width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-icon-primary); }
.tag-emoji { font-size: 32.443rpx; }
.preview-heading {
  display: flex;
  align-items: center;
  gap: 19.084rpx;
  font-size: 41.985rpx;
  font-weight: 800;
  letter-spacing: -.02em;
}
.heading-icon { width: 68.702rpx; height: 68.702rpx; padding: 17.176rpx; border-radius: 34.351rpx; }
.goals-icon { color: var(--cimoa-text-profile-goal-icon); background: var(--cimoa-surface-profile-goal-icon); }
.interests-icon { color: var(--cimoa-text-profile-interest-icon); background: var(--cimoa-surface-profile-interest-icon); }
.section-tags { margin-top: 22.901rpx; }
.preview-edit { gap: 15.267rpx; font-size: 40.076rpx; }
.preview-edit > view { width: 38.168rpx; height: 38.168rpx; }
</style>
