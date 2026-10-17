<script setup>
import { computed, ref, onUnmounted, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_profile_editor } from '@/composables/useProfileEditor.js'
import { choose_images, inspect_media } from '@/utils/mediaCapabilities.js'
import { bio_style, PROFILE_FIELDS, profile_value } from '@/utils/profilePresentation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import ProfileFieldSheet from '@/components/ProfileFieldSheet.vue'
import ProfileBioConfirmDialog from '@/components/ProfileBioConfirmDialog.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import PhotoActionsConfirmDialog from '@/components/PhotoActionsConfirmDialog.vue'
import OnboardingSheet from '@/components/OnboardingSheet.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import EventAudio from '@/components/EventAudio.vue'
const frame = ref(null), { store, context, account_id, error, access_error, is_loading, go, back, recover, submit } = use_profile_editor(frame)
const changes = ref({}), draft = computed(() => ({ ...context.value?.user, ...changes.value })), photos = ref(store.current_photos), photo_dirty = ref(false)
const audio_draft = ref(undefined), audio_url = ref('')
const audio = computed(() => audio_draft.value === null ? null : audio_draft.value ? { ...audio_draft.value, media_url: audio_url.value } : context.value?.audio)
const sheet = ref(''), field = ref(null), selected = ref(-1), question = ref(0), song_query = ref(''), song_tab = ref('trend'), picker_busy = ref(false)
const title = computed(() => PROFILE_FIELDS.find(row => row.key === field.value)?.title || ({ drinking: 'Drinking habits', smoking: 'Smoking habits' })[field.value] || '')
const song = computed(() => store.profile_catalog.songs.find(row => row.song_id === draft.value.song_id)), songs = computed(() => { const rows = store.profile_catalog.songs.filter(row => `${row.title} ${row.artist}`.toLowerCase().includes(song_query.value.toLowerCase())); return song_tab.value === 'trend' ? rows : [...rows].reverse() })
const questions = computed(() => context.value?.questions || []), interests = computed(() => store.current_interests), goals = computed(() => store.goals_for_user(context.value?.user.user_id))
const score = computed(() => context.value?.score || 0)
const urls = new Set(); let generation = 0, start_x = null
const release = () => { for (const url of urls) URL.revokeObjectURL(url); urls.clear() }
const prune_urls = () => { const used = new Set([...photos.value.map(p => p.media_url), audio_url.value]); for (const url of urls) if (!used.has(url)) { URL.revokeObjectURL(url); urls.delete(url) } }
const update_bio = value => {
  const { audio: next_audio, ...text } = value; Object.assign(changes.value, text)
  if (next_audio !== undefined) { audio_draft.value = next_audio; audio_url.value = next_audio ? URL.createObjectURL(next_audio.blob) : ''; if (audio_url.value) urls.add(audio_url.value); prune_urls() }
  sheet.value = ''
}
const close = () => { sheet.value = ''; field.value = null; selected.value = -1 }
onHide(() => { generation++; close() })
onUnmounted(() => { generation++; release() })
watch(access_error, value => { if (value) { generation++; close(); changes.value = {}; photos.value = []; audio_draft.value = undefined; audio_url.value = ''; release() } })
onShow(() => { if (!photo_dirty.value && !access_error.value) photos.value = store.current_photos })
const pick = async (index = -1) => {
  if (picker_busy.value || is_loading.value || access_error.value) return
  picker_busy.value = true; error.value = ''; selected.value = -1; const token = ++generation
  try {
    const files = await choose_images(index >= 0 ? 1 : 3 - photos.value.length), rows = []
    for (const file of files) {
      const blob = file instanceof Blob ? file : file.file instanceof Blob ? file.file : null
      if (!blob || !blob.type.startsWith('image/') || blob.size > 20 * 1024 * 1024) throw new Error('Choose a valid image up to 20 MB.')
      await inspect_media(blob, 'image')
      if (token !== generation) return
      const media_url = URL.createObjectURL(blob); urls.add(media_url); rows.push({ blob, media_url })
    }
    if (token !== generation) return
    if (index >= 0) photos.value.splice(index, 1, { ...rows[0], photo_id: photos.value[index].photo_id })
    else { if (photos.value.length + rows.length > 3) throw new Error('Keep up to three profile photos.'); photos.value.push(...rows) }
    photo_dirty.value = true; prune_urls()
  } catch (cause) { if (token === generation) error.value = cause.message } finally { picker_busy.value = false }
}
const photo_action = action => { const index = selected.value; if (index < 0) return; const rows = [...photos.value]; if (action === 'remove') rows.splice(index, 1); else { const to = action === 'primary' ? 0 : action === 'earlier' ? index - 1 : index + 1; if (to < 0 || to >= rows.length) return; const [row] = rows.splice(index, 1); rows.splice(to, 0, row) } photos.value = rows; photo_dirty.value = true; selected.value = -1; prune_urls() }
const save = () => {
  const patch = { ...changes.value }, rows = photo_dirty.value ? [...photos.value] : null
  error.value = store.profile_edit_validation_error(patch, rows, account_id)
  const staged_audio = audio_draft.value
  if (!error.value) submit(scope => store.save_profile_edit(patch, rows, account_id, { ...scope, audio: staged_audio }))
}
const unavailable_song = () => { error.value = 'No playable audio is configured for this song. Nothing was played or added.' }
const swipe = event => { if (start_x != null && questions.value.length) { const dx = event.clientX - start_x; if (Math.abs(dx) > 30) question.value = (question.value + (dx < 0 ? 1 : questions.value.length - 1)) % questions.value.length } start_x = null }
</script>
<template>
  <ProfileEditorFrame ref="frame" class="profile-edit-page" title="Edit profile" source="editAll" save :busy="is_loading" :error="error" :access-error="access_error" :disabled="picker_busy" @back="back" @recover="recover" @save="save">
    <view class="editor-card score-card"><view><text class="score-title">Your profile score</text><text class="editor-copy">A more complete profile helps Cimoa find you better matches.</text></view><view class="score-ring"><svg viewBox="0 0 76 76"><defs><linearGradient id="profile-score"><stop class="score-start" /><stop offset="0.5" class="score-middle" /><stop offset="1" class="score-end" /></linearGradient></defs><circle cx="38" cy="38" r="32" fill="none" class="score-track" stroke-width="7" /><circle cx="38" cy="38" r="32" fill="none" stroke="url(#profile-score)" stroke-width="7" stroke-linecap="round" :stroke-dasharray="`${score * 2.01} 201`" transform="rotate(-90 38 38)" /></svg><text>{{ score }}%</text></view></view>
    <view class="editor-card editor-row" role="button" data-interaction="profileEdit.basic.click.1" @click="go('/pages/profile/basic')"><text>Basic info</text><view class="editor-icon"><SourceIcon name="chevron" /></view></view>
    <text class="editor-section">Student verification</text><text class="editor-copy">{{ draft.verification_status === 'verified' ? 'Your student status is verified.' : 'Local account only. Student verification is pending.' }}</text>
    <view class="editor-card editor-row" role="button" data-interaction="editAll.eaVerify.click.1" @click="go('/pages/profile/verification')"><view v-if="draft.verification_status === 'verified'" class="editor-icon"><SourceIcon name="verified" /></view><text>{{ draft.university || 'University not shared' }} · {{ draft.verification_status === 'verified' ? 'Verified' : 'Pending' }}</text><view class="editor-icon"><SourceIcon name="chevron" /></view></view>
    <text class="editor-section">Photos</text><text class="editor-copy">Show your best self. Changes are published when you save.</text>
    <view class="edit-photos"><view v-for="(photo, index) in photos" :key="photo.photo_id || photo.media_url" class="edit-photo" role="button" :aria-label="`Edit photo ${index + 1}`" data-interaction="editAll.eaPhotos.click.1" @click="selected = index"><ProfilePhoto :src="photo.media_url" name="Your profile photo" portrait /><text v-if="index === 0" class="primary-photo">Primary</text><view class="camera-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="6.5" width="19" height="13.5" rx="3" /><circle cx="12" cy="13.2" r="3.6" /></svg></view></view><view v-if="photos.length < 3" class="edit-photo add-photo" role="button" aria-label="Add profile photo" :aria-disabled="picker_busy" data-interaction="profileEdit.photo.add" @click="pick()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg></view></view>
    <text class="editor-section">Profile song</text><text class="editor-copy">Add a song to your profile.</text><view class="editor-card"><view v-if="song" class="editor-row"><image class="song-cover" :src="song.cover_url" /><view><text>{{ song.title }}</text><text class="editor-copy">{{ song.artist }}</text></view><view class="song-play" role="button" aria-label="Play profile song" data-interaction="editAll.eaSongPlay.click.1" @click="unavailable_song"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 13 8-13 8z" /></svg></view></view><text v-else class="editor-copy">No profile song selected yet.</text><view class="editor-outline" role="button" data-interaction="editAll.eaOpenSong.click.1" @click="sheet = 'song'; song_query = ''; error = ''">{{ song ? 'Change song' : 'Add song' }}</view><view v-if="song" class="editor-outline remove-song" role="button" data-interaction="editAll.eaSongRemove.click.1" @click="changes.song_id = null">Remove</view></view>
    <text class="editor-section">Bio</text><text class="editor-copy">Tell people who you are.</text><view class="editor-card"><text class="editor-bio" :style="bio_style(draft.bio_font)">{{ draft.bio || 'No introduction yet.' }}</text><EventAudio v-if="audio" :src="audio.media_url" :duration="audio.duration_ms" interaction="editAll.evTogglePlay.click.1" /><view class="editor-outline" role="button" data-interaction="editAll.eaOpenBio.click.1" @click="sheet = 'bio'"><view class="editor-icon"><SourceIcon name="edit" /></view>Edit bio</view></view>
    <text class="editor-section">Looking for</text><text class="editor-copy">What are you looking for?</text><view class="editor-card"><view class="editor-tags"><text v-for="item in goals" :key="item.item_id" class="editor-tag">{{ item.emoji }} {{ item.label }}</text></view><view class="editor-outline" role="button" data-interaction="editAll.eaGoals.click.1" @click="go('/pages/profile/goals')">{{ goals.length }} selected<view class="editor-icon"><SourceIcon name="chevron" /></view></view></view>
    <text class="editor-section">Matching preferences</text><text class="editor-copy">Shape your Auto Match recommendations without changing your public profile.</text><view class="editor-card editor-row" role="button" data-interaction="editAll.openEditPrefs.click.1" @click="go('/pages/profile/prefs')"><text>Edit preferences</text><view class="editor-icon"><SourceIcon name="chevron" /></view></view>
    <text class="editor-section">Interests</text><text class="editor-copy">What are you interested in?</text><view class="editor-card"><view class="editor-tags"><text v-for="item in interests" :key="item.item_id" class="editor-tag">{{ item.emoji }} {{ item.label }}</text></view><view class="editor-outline" role="button" data-interaction="editAll.eaInterests.click.1" @click="go('/pages/profile/interests')">{{ interests.length }} selected<view class="editor-icon"><SourceIcon name="chevron" /></view></view></view>
    <text class="editor-section">Icebreakers</text><text class="editor-copy">Choose 3 questions others can answer when they say hi.</text><view class="editor-card"><view class="ice-preview" @pointerdown="start_x = $event.clientX" @pointerup="swipe" @pointercancel="start_x = null">{{ questions[question % questions.length] || 'No questions yet.' }}</view><view class="ice-dots"><view v-for="(q, index) in questions" :key="q" role="button" :aria-label="`Show question ${index + 1}`" :class="{ active: question === index }" data-interaction="editAll.d.go.click.1" @click="question = index" /></view><view class="editor-outline" role="button" data-interaction="editAll.eaIce.click.1" @click="go('/pages/profile/ice')">Edit icebreakers</view></view>
    <template v-for="row in PROFILE_FIELDS" :key="row.key"><text class="editor-section">{{ row.title }}</text><view class="editor-card editor-row" role="button" :aria-label="`Edit ${row.title}`" :data-interaction="`editAll.${row.action}.click.1`" @click="field = row.key"><text>{{ profile_value(draft, row.key) }}</text><view class="editor-icon"><SourceIcon name="chevron" /></view></view></template>
    <text class="editor-section">Habits</text><text class="editor-copy">Share your drinking and smoking habits.</text><view class="habit-row"><view class="editor-card habit" role="button" aria-label="Edit drinking habits" data-interaction="editAll.eaOpenDrink.click.1" @click="field = 'drinking'"><text>🍷</text>{{ profile_value(draft, 'drinking') }}</view><view class="editor-card habit" role="button" aria-label="Edit smoking habits" data-interaction="editAll.eaOpenSmoke.click.1" @click="field = 'smoking'"><text>🚭</text>{{ profile_value(draft, 'smoking') }}</view></view>
    <template #overlays>
      <ProfileFieldSheet :field="field" :title="title" :value="draft[field]" @close="field = null" @select="changes[field] = $event; field = null" />
      <ProfileBioConfirmDialog :open="sheet === 'bio'" :bio="draft.bio" :font="draft.bio_font" :audio="audio" @close="sheet = ''" @done="update_bio" />
      <PhotoActionsConfirmDialog draft :open="selected >= 0" :position="selected" :count="photos.length" @close="selected = -1" @replace="pick(selected)" @action="photo_action" />
      <OnboardingSheet :open="sheet === 'song'" label="Add profile song" @close="sheet = ''"><text class="event-dialog-title">Add profile song</text><input v-model="song_query" class="editor-input" aria-label="Search songs" placeholder="Search songs, artists…" data-interaction="editAll.onEaSongQ.change.1" /><view class="editor-chips"><view class="editor-chip" :class="{ selected: song_tab === 'trend' }" role="button" data-interaction="editAll.eaTabTrend.click.1" @click="song_tab = 'trend'">🔥 Trending</view><view class="editor-chip" :class="{ selected: song_tab === 'forYou' }" role="button" data-interaction="editAll.eaTabForYou.click.1" @click="song_tab = 'forYou'">✨ For you</view></view><text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text><view v-for="item in songs" :key="item.song_id" class="editor-card editor-row" role="button" data-interaction="editAll.g.pick.click.1" @click="unavailable_song"><image class="song-cover" :src="item.cover_url" /><view><text>{{ item.title }}</text><text class="editor-copy">{{ item.artist }}</text></view><view class="song-play" role="button" :aria-label="`Play ${item.title}`" data-interaction="editAll.g.play.click.1" @click.stop="unavailable_song"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 13 8-13 8z" /></svg></view></view><text v-if="!songs.length" class="editor-copy">No songs match your search.</text><view class="editor-outline" role="button" @click="sheet = ''">Close</view></OnboardingSheet>
    </template>
  </ProfileEditorFrame>
</template>
<style scoped>
.score-card { display: flex; align-items: center; gap: 30.534rpx; padding: 38.168rpx; margin-top: 0; }
.score-title { font-size: 38.168rpx; font-weight: 800; }
.score-ring { position: relative; width: 145.038rpx; height: 145.038rpx; flex: none; }
.score-ring svg { width: 100%; height: 100%; }
.score-ring text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36.26rpx;
  font-weight: 800;
}
.score-start { stop-color: var(--cimoa-brand-cyan); }
.score-middle { stop-color: var(--cimoa-brand-purple); }
.score-end { stop-color: var(--cimoa-brand-pink); }
.score-track { stroke: var(--cimoa-surface-event-divider); }
.edit-photos { display: flex; gap: 22.901rpx; margin-top: 26.718rpx; }
.edit-photo {
  flex: 1;
  min-width: 0;
  max-width: 33.333%;
  aspect-ratio: 3/4;
  position: relative;
  border-radius: 45.802rpx;
  overflow: hidden;
  cursor: pointer;
}
.add-photo {
  min-height: 190.84rpx;
  border: 2px dashed var(--cimoa-surface-onboarding-dashed);
  background: var(--cimoa-surface-onboarding-empty);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cimoa-text-auth-placeholder);
}
.add-photo svg { width: 53.435rpx; height: 53.435rpx; }
.primary-photo {
  position: absolute;
  top: 15.267rpx;
  left: 11.45rpx;
  border-radius: 19.084rpx;
  padding: 5.725rpx 11.45rpx;
  background: var(--cimoa-surface-photo-tag);
  color: var(--cimoa-text-inverse);
  font-size: 20.992rpx;
}
.camera-icon {
  position: absolute;
  right: 15.267rpx;
  bottom: 15.267rpx;
  width: 64.885rpx;
  height: 64.885rpx;
  border-radius: 32.443rpx;
  padding: 16.221rpx;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-surface-photo-tag);
}
.camera-icon svg, .song-play svg { width: 100%; height: 100%; }
.song-cover { width: 106.87rpx; height: 106.87rpx; border-radius: 26.718rpx; flex: none; }
.song-play {
  width: 83.969rpx;
  height: 83.969rpx;
  padding: 24.809rpx;
  border-radius: 41.985rpx;
  color: var(--cimoa-brand-purple);
  background: var(--cimoa-surface-tinted);
  margin-left: auto;
  flex: none;
  cursor: pointer;
}
.remove-song { color: var(--cimoa-status-danger); }
.ice-preview {
  min-height: 183.206rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 49.618rpx;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  touch-action: pan-y;
}
.ice-dots { display: flex; justify-content: center; gap: 13.359rpx; margin-top: 30.534rpx; }
.ice-dots > view { width: 15.267rpx; height: 15.267rpx; background: var(--cimoa-surface-onboarding-dashed); border-radius: 7.634rpx; cursor: pointer; }
.ice-dots > .active { width: 41.985rpx; background: var(--cimoa-text-title); }
.habit-row { display: grid; grid-template-columns: 1fr 1fr; gap: 22.901rpx; }
.habit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 19.084rpx;
  font-size: 32.443rpx;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
}
.habit > text { font-size: 91.603rpx; }
</style>
