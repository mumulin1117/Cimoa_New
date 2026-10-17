<script setup>
import { computed, ref, onUnmounted, watch } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { discover_destination, require_discover_destination_ready } from '@/utils/discoverNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import EventConfirmDialog from '@/components/EventConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import SafetyActionsMiniSheet from '@/components/SafetyActionsMiniSheet.vue'
import ProfileVoiceIntro from '@/components/ProfileVoiceIntro.vue'

const store = use_app_store()
const frame = ref(null)
const user_id = ref('')
const origin_conversation_id = ref('')
const photo_index = ref(0)
const sheet = ref('')
const error = ref('')
const active = ref(true)
const navigating = ref(false)
const was_available = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const person = computed(() => store.user_by_id(user_id.value))
const photos = computed(() => store.photos_for_user(user_id.value))
const goals = computed(() => store.goals_for_user(user_id.value))
const interests = computed(() => store.interests_for_user(user_id.value))
const questions = computed(() => store.questions_for_user(user_id.value))
const song = computed(() => store.song_for_user(user_id.value))
const conversation = computed(() => store.current_conversations.find((row) => row.participant_id === user_id.value) || null)
const photo = computed(() => photos.value[photo_index.value] || null)
const is_self = computed(() => user_id.value === store.session.current_user_id)
const request_context = computed(() => store.introduction_context(user_id.value))
const primary_label = computed(() => is_self.value ? 'This is you' : request_context.value.primary?.label || 'Send shot')
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated
    ? 'Your session has expired. Please sign in again.'
    : !user_id.value || !person.value
      ? 'This profile is unavailable. It may be hidden, deleted or blocked.'
      : '')
const details = computed(() => person.value ? [
  person.value.height_cm ? { icon: 'height', label: `${person.value.height_cm} cm` } : null,
  person.value.university ? { icon: 'university', label: person.value.university } : null,
  person.value.major ? { icon: 'book', label: person.value.major } : null,
  person.value.mbti ? { icon: 'puzzle', label: person.value.mbti } : null,
  person.value.country?.length ? { emoji: '🌏', label: person.value.country.join(', ') } : null,
  person.value.drinking ? { emoji: '🍷', label: person.value.drinking } : null,
  person.value.smoking ? { emoji: '🚭', label: person.value.smoking } : null,
  person.value.religion ? { emoji: '🕊️', label: person.value.religion } : null,
  person.value.clubs ? { icon: 'people', label: person.value.clubs } : null,
  person.value.location ? { icon: 'location', label: person.value.location } : null,
].filter(Boolean) : [])

onLoad(options => {
  user_id.value = String(options?.user_id || '')
  origin_conversation_id.value = String(options?.origin_conversation_id || '')
  was_available.value = !!store.user_by_id(user_id.value)
})
const leave = () => { active.value = false; navigating.value = false; cancel_loading(); sheet.value = '' }
watch(() => photos.value.length, length => { photo_index.value = length ? photo_index.value % length : 0 })
onHide(leave)
onUnmounted(leave)
onShow(async () => {
  active.value = true
  error.value = ''
  if (was_available.value && store.hydration_status === 'ready' && !person.value) {
    try { await frame.value.navigate_relaunch('/pages/discover/index') } catch (cause) { error.value = cause.message }
  }
})

const conversation_route = () => discover_destination(store, 'chat', user_id.value)
const back_fallback = () => conversation.value?.conversation_id === origin_conversation_id.value ? conversation_route() : '/pages/discover/index'
const back = async () => { if (is_loading.value || sheet.value) return; try { await frame.value.navigate_back(back_fallback()) } catch (cause) { error.value = cause.message } }
const change_photo = delta => {
  if (photos.value.length < 2) return
  photo_index.value = (photo_index.value + delta + photos.value.length) % photos.value.length
  error.value = ''
}
const open_gallery = () => { if (photo.value && !is_loading.value) { sheet.value = 'gallery'; error.value = '' } }
const play_song = () => { error.value = song.value?.audio_id ? 'This song audio is not available in local storage.' : 'This profile includes song artwork only. No playable audio was provided.' }
const say_hi = async () => {
  if (is_loading.value || navigating.value || sheet.value || access_error.value || is_self.value) return
  navigating.value = true
  error.value = ''
  try {
    const primary = request_context.value.primary
    if (request_context.value.error || primary?.error || !primary?.destination) throw Error(request_context.value.error || primary?.error || 'This profile is unavailable.')
    if (primary.kind === 'chat') {
      const route = primary.destination
      if (conversation.value.conversation_id === origin_conversation_id.value) await frame.value.navigate_back(route)
      else await frame.value.navigate_forward(route)
      return
    }
    await frame.value.navigate_forward(require_discover_destination_ready(primary.destination))
  } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const open_report = async () => {
  if (is_loading.value || access_error.value || is_self.value) return
  sheet.value = ''
  try { await frame.value.navigate_forward(`/pages/safety/report-user?target_user_id=${encodeURIComponent(user_id.value)}`) } catch (cause) { error.value = cause.message }
}
const confirm_block = async () => {
  if (is_loading.value || access_error.value || is_self.value) return
  error.value = ''
  const result = await run_with_loading(() => store.block_user(user_id.value))
  if (!active.value || result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  sheet.value = ''
  try { await frame.value.navigate_relaunch('/pages/discover/index') } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <SecondaryPageFrame ref="frame" class="expanded-profile-page" :scroll-locked="!!sheet || is_loading">
    <template #header>
      <view class="expanded-header">
        <view class="expanded-round" role="button" tabindex="0" aria-label="Back" data-interaction="expanded.collapse.click.1" @click="back" @keydown.enter="back"><view class="expanded-icon"><SourceIcon name="back" /></view></view>
        <view v-if="person" class="expanded-heading"><text>{{ person.user_name }}{{ person.age === null ? '' : `, ${person.age}` }}</text><view v-if="person.verified" class="expanded-verified"><SourceIcon name="verified" /></view></view>
        <view v-if="person && !is_self" class="expanded-round" role="button" tabindex="0" aria-label="Safety actions" data-interaction="expanded.openSafetyMini.click.1" @click="sheet = 'safety'; error = ''" @keydown.enter="sheet = 'safety'; error = ''"><view class="expanded-icon"><SourceIcon name="more" /></view></view>
        <view v-else class="expanded-round-placeholder" />
      </view>
    </template>

    <view v-if="access_error" class="expanded-state" role="alert">{{ access_error }}</view>
    <view v-else class="expanded-content">
      <view class="expanded-photo-card">
        <view class="expanded-photo" role="button" tabindex="0" :aria-label="`Open photo ${photo_index + 1} of ${photos.length}`" :data-interaction="`expanded.openGallery.click.${Math.min(photo_index + 1, 3)}`" @click="open_gallery" @keydown.enter="open_gallery"><ProfilePhoto :src="photo?.media_url || ''" :name="person.user_name" :position="photo?.focal_point || '50% 22%'" /></view>
        <view v-if="song" class="expanded-song"><image :src="song.cover_url" mode="aspectFill" /><view><text>{{ song.title }}</text><text>{{ song.artist }}</text></view><view class="expanded-song-play" role="button" tabindex="0" aria-label="Play profile song" data-interaction="expanded.otherSongPlay.click.1" @click.stop="play_song" @keydown.enter.stop="play_song"><SourceIcon name="play" /></view></view>
        <view v-if="photos.length > 1" class="expanded-photo-hit expanded-photo-hit--prev" role="button" tabindex="0" aria-label="Previous photo" data-interaction="expanded.prevPhoto.click.1" @click.stop="change_photo(-1)" @keydown.enter.stop="change_photo(-1)" />
        <view v-if="photos.length > 1" class="expanded-photo-hit expanded-photo-hit--next" role="button" tabindex="0" aria-label="Next photo" data-interaction="expanded.nextPhoto.click.1" @click.stop="change_photo(1)" @keydown.enter.stop="change_photo(1)" />
        <view v-if="photos.length > 1" class="expanded-dots"><view v-for="(_, index) in photos" :key="index" :class="{ active: index === photo_index }" /></view>
      </view>

      <view v-if="details.length" class="expanded-card expanded-tags"><view v-for="item in details" :key="item.label" class="expanded-tag"><view v-if="item.icon" class="expanded-tag-icon"><SourceIcon :name="item.icon" /></view><text v-else class="expanded-tag-emoji">{{ item.emoji }}</text><text>{{ item.label }}</text></view></view>
      <view v-if="person.bio" class="expanded-card expanded-bio"><text>{{ person.bio }}</text></view>
      <ProfileVoiceIntro v-if="person.voice_intro" :intro="person.voice_intro" />
      <view v-if="goals.length" class="expanded-card"><view class="expanded-section-title"><view><SourceIcon name="people" /></view><text>Looking for</text></view><view class="expanded-chip-list"><view v-for="goal in goals" :key="goal.item_id" class="expanded-chip"><text>{{ goal.emoji }}</text><text>{{ goal.label }}</text></view></view></view>
      <view v-if="interests.length" class="expanded-card"><view class="expanded-section-title expanded-section-title--blue"><view><SourceIcon name="sparkle" /></view><text>Interests</text></view><view class="expanded-chip-list"><view v-for="interest in interests" :key="interest.item_id" class="expanded-chip"><text>{{ interest.emoji }}</text><text>{{ interest.label }}</text></view></view></view>
      <view v-if="questions.length" class="expanded-card"><view class="expanded-section-title expanded-section-title--blue"><view><SourceIcon name="sparkle" /></view><text>Ask me</text></view><view class="expanded-question-list"><text v-for="question in questions" :key="question.question_id">{{ question.text }}</text></view></view>
    </view>

    <template #footer>
      <view v-if="person" class="expanded-footer"><text v-if="error" class="expanded-error" role="alert">{{ error }}</text><view class="expanded-send" role="button" tabindex="0" :aria-disabled="is_self || is_loading" data-interaction="expanded.sayHi.click.1" @click="say_hi" @keydown.enter="say_hi">{{ primary_label }}</view></view>
    </template>

    <template #overlays>
      <SafetyActionsMiniSheet :open="['safety', 'block'].includes(sheet)" :mode="sheet === 'block' ? 'block' : 'menu'" :user-name="person?.user_name" :busy="is_loading" :error="error" @close="sheet = ''; error = ''" @report="open_report" @open-block="sheet = 'block'; error = ''" @confirm-block="confirm_block" />
      <EventConfirmDialog :open="sheet === 'gallery'" :busy="false" :label="`${person?.user_name || 'Profile'} photo gallery`" close-interaction="expanded.gallery.close.click.1" style="--event-dialog-bottom: var(--app-safe-bottom);" @close="sheet = ''">
        <text class="event-dialog-title">Photo {{ photo_index + 1 }} of {{ photos.length }}</text>
        <view class="expanded-gallery"><ProfilePhoto :src="photo?.media_url || ''" :name="person?.user_name || 'Profile'" :position="photo?.focal_point || '50% 22%'" /></view>
        <view class="expanded-gallery-actions"><view role="button" tabindex="0" :aria-disabled="photos.length < 2" @click="change_photo(-1)" @keydown.enter="change_photo(-1)">Previous</view><view role="button" tabindex="0" :aria-disabled="photos.length < 2" @click="change_photo(1)" @keydown.enter="change_photo(1)">Next</view></view>
        <view class="event-dialog-secondary" role="button" tabindex="0" @click="sheet = ''" @keydown.enter="sheet = ''">Close</view>
      </EventConfirmDialog>
      <EventActionLoading :visible="is_loading" label="Blocking account…" />
    </template>
  </SecondaryPageFrame>
</template>

<style scoped>
.expanded-profile-page { -webkit-font-smoothing: antialiased; }
.expanded-header { display: flex; align-items: center; justify-content: space-between; min-height: 103.053rpx; padding: 11.45rpx 38.168rpx 0; }
.expanded-round { display: flex; align-items: center; justify-content: center; width: 103.053rpx; height: 103.053rpx; border-radius: 50%; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); color: var(--cimoa-text-title); cursor: pointer; }
.expanded-round-placeholder { width: 103.053rpx; }
.expanded-icon { width: 45.802rpx; height: 45.802rpx; }
.expanded-heading { display: flex; align-items: center; justify-content: center; gap: 13.359rpx; min-width: 0; padding: 0 15.267rpx; }
.expanded-heading > text { min-width: 0; overflow: hidden; color: var(--cimoa-text-title); font-size: 43.893rpx; font-weight: 700; letter-spacing: -0.02em; text-overflow: ellipsis; white-space: nowrap; }
.expanded-verified { flex: none; width: 38.168rpx; height: 38.168rpx; }
.expanded-content { padding: 22.901rpx 38.168rpx 190.84rpx; }
.expanded-photo-card { position: relative; width: 100%; aspect-ratio: 3 / 4; overflow: hidden; border-radius: 45.802rpx; box-shadow: var(--cimoa-shadow-discover-photo); }
.expanded-photo { position: absolute; inset: 0; cursor: pointer; }
.expanded-song { position: absolute; right: 26.718rpx; bottom: 22.901rpx; left: 26.718rpx; z-index: 4; display: flex; align-items: center; gap: 22.901rpx; padding: 15.267rpx; border-radius: 41.985rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-surface-profile-song); backdrop-filter: blur(26.718rpx); }
.expanded-song image { flex: none; width: 83.969rpx; height: 83.969rpx; border-radius: 22.901rpx; }
.expanded-song > view:nth-child(2) { flex: 1; min-width: 0; }
.expanded-song text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.expanded-song text:first-child { font-size: 29.58rpx; font-weight: 700; }
.expanded-song text:last-child { margin-top: 3.817rpx; color: var(--cimoa-text-profile-song-artist); font-size: 24.809rpx; }
.expanded-song-play { display: flex; align-items: center; justify-content: center; width: 83.969rpx; height: 83.969rpx; padding: 22.901rpx; border-radius: 50%; background: var(--cimoa-surface-card); color: var(--cimoa-text-settings-purple); cursor: pointer; }
.expanded-photo-hit { position: absolute; top: 0; bottom: 122.137rpx; z-index: 2; width: 35%; cursor: pointer; }
.expanded-photo-hit--prev { left: 0; }
.expanded-photo-hit--next { right: 0; }
.expanded-dots { position: absolute; top: 26.718rpx; right: 26.718rpx; left: 26.718rpx; z-index: 4; display: flex; gap: 11.45rpx; }
.expanded-dots view { flex: 1; height: 5.725rpx; border-radius: 3.817rpx; background: var(--cimoa-surface-profile-dot-inactive); }
.expanded-dots .active { background: var(--cimoa-surface-card); }
.expanded-card { margin-top: 30.534rpx; padding: 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.expanded-tags { display: flex; flex-wrap: wrap; gap: 15.267rpx; margin-top: 38.168rpx; }
.expanded-tag, .expanded-chip { display: flex; align-items: center; gap: 11.45rpx; min-height: 64.885rpx; padding: 0 22.901rpx; border-radius: 32.443rpx; color: var(--cimoa-text-profile-bio); background: var(--cimoa-surface-tinted); font-size: 26.718rpx; font-weight: 500; }
.expanded-tag-icon { width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-text-title); }
.expanded-tag-emoji { font-size: 30.534rpx; }
.expanded-bio { color: var(--cimoa-text-profile-bio); font-family: Caveat, cursive; font-size: 51.527rpx; font-weight: 600; line-height: 1.25; text-align: center; }
.expanded-section-title { display: flex; align-items: center; gap: 19.084rpx; color: var(--cimoa-text-title); font-size: 41.985rpx; font-weight: 800; letter-spacing: -0.02em; }
.expanded-section-title > view { width: 68.702rpx; height: 68.702rpx; padding: 17.176rpx; border-radius: 50%; color: var(--cimoa-text-profile-goal-icon); background: var(--cimoa-surface-profile-goal-icon); }
.expanded-section-title--blue > view { color: var(--cimoa-text-profile-interest-icon); background: var(--cimoa-surface-profile-interest-icon); }
.expanded-chip-list { display: flex; flex-wrap: wrap; gap: 15.267rpx; margin-top: 22.901rpx; }
.expanded-question-list { display: flex; flex-direction: column; gap: 15.267rpx; margin-top: 22.901rpx; }
.expanded-question-list text { padding: 22.901rpx 26.718rpx; border-radius: 30.534rpx; color: var(--cimoa-text-profile-bio); background: var(--cimoa-surface-tinted); font-size: 28.626rpx; line-height: 1.4; }
.expanded-footer { padding: 15.267rpx 38.168rpx 64.885rpx; }
.expanded-send { display: flex; align-items: center; justify-content: center; height: 114.504rpx; border-radius: 57.252rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-primary); font-size: 40.076rpx; font-weight: 700; cursor: pointer; }
.expanded-send[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.expanded-error { display: block; margin-bottom: 11.45rpx; color: var(--cimoa-status-danger); font-size: 25.763rpx; line-height: 1.4; overflow-wrap: anywhere; }
.expanded-state { margin: 45.802rpx 38.168rpx; padding: 45.802rpx; border-radius: 45.802rpx; color: var(--cimoa-text-secondary); background: var(--cimoa-surface-empty); font-size: 30.534rpx; line-height: 1.5; }
.expanded-gallery { position: relative; height: 763.359rpx; margin-top: 30.534rpx; overflow: hidden; border-radius: 38.168rpx; }
.expanded-gallery-actions { display: flex; gap: 15.267rpx; margin-top: 22.901rpx; }
.expanded-gallery-actions view { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 83.969rpx; border-radius: 41.985rpx; color: var(--cimoa-text-title); background: var(--cimoa-surface-tinted); font-size: 28.626rpx; font-weight: 600; cursor: pointer; }
.expanded-gallery-actions view[aria-disabled="true"] { opacity: 0.5; cursor: default; }
</style>
