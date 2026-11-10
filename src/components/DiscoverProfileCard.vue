<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { bind_card_pointer_events, create_pointer_gesture } from '@/utils/discoverSwipe.js'
import { DISCOVER_DECK } from '@/config/discoverDeck.js'
import { MOTION } from '@/config/navigation.js'
import ProfilePhoto from './ProfilePhoto.vue'
import SourceIcon from './SourceIcon.vue'

const props = defineProps({
  person: { type: Object, required: true },
  front: Boolean,
  disabled: Boolean,
  gestureDisabled: Boolean,
  depth: { type: Number, default: 1 },
  target: { type: String, default: '' },
  transformStyle: { type: Object, default: () => ({}) },
  skeleton: Boolean,
  entering: Boolean,
  photoFade: Boolean,
})
const emit = defineEmits(['open', 'drag-start', 'drag-move', 'drag-end', 'drag-cancel', 'photo-ready', 'photo-error'])
const card = ref(null)
const photo_status = ref('loading')
const masked = computed(() => props.skeleton || photo_status.value === 'loading')
watch(() => props.person.photo?.media_url, source => { photo_status.value = source ? 'loading' : 'empty' }, { immediate: true })
const photo_ready = source => {
  if (source !== props.person.photo?.media_url) return
  photo_status.value = 'ready'; emit('photo-ready', props.person.user_id)
}
const photo_error = source => {
  if (source !== props.person.photo?.media_url) return
  photo_status.value = 'error'; emit('photo-error', props.person.user_id)
}
const photo_loading = source => { if (source === props.person.photo?.media_url) photo_status.value = 'loading' }
// Decorate the inner face, never the root transform owned by the swipe gesture.
const face_style = computed(() => ({
  '--deck-fan-angle': props.transformStyle['--deck-fan-angle'] || '0deg',
  '--deck-fan-scale': DISCOVER_DECK.entrance.fan_scale,
  '--deck-fan-duration': `${DISCOVER_DECK.entrance.fan_ms}ms`,
  '--deck-sweep-duration': `${DISCOVER_DECK.entrance.sweep_ms}ms`,
  '--deck-fade-duration': `${DISCOVER_DECK.entrance.fade_ms}ms`,
  '--deck-loading-duration': `${MOTION.skeleton_reveal}ms`,
}))
let unbind_pointer
const element = () => card.value?.$el || card.value
const gesture = create_pointer_gesture({
  element,
  can_start: event => props.front && !props.disabled && !props.skeleton && !event.target?.closest?.('.photo-retry'),
  can_continue: () => props.front && !props.gestureDisabled && !props.skeleton,
  slop: row => row.cardWidth * DISCOVER_DECK.tap_slop_ratio,
  start: point => emit('drag-start', point),
  move: point => emit('drag-move', point),
  end: point => emit('drag-end', point),
  cancel: point => emit('drag-cancel', point),
})
const release_pointer = () => gesture.cancel()
const open = () => { if (props.front && !props.disabled && !props.skeleton && gesture.can_click()) emit('open') }
watch(() => [props.front, props.gestureDisabled, props.skeleton, props.person.user_id], ([front, disabled, skeleton, id], previous) => {
  if (!front || disabled || skeleton || previous && id !== previous[3]) release_pointer()
})
onHide(release_pointer)
onMounted(() => { unbind_pointer = bind_card_pointer_events(element(), gesture) })
onUnmounted(() => { release_pointer(); unbind_pointer?.() })
</script>

<template>
  <view
    ref="card"
    class="discover-photo-card"
    :class="front ? 'discover-photo-card--front' : depth === 1 ? 'discover-photo-card--back' : 'discover-photo-card--rear'"
    :data-deck-depth="front ? 0 : depth"
    :data-skeleton-card="masked"
    :style="transformStyle"
    :role="front ? 'button' : undefined"
    :tabindex="front && !skeleton ? 0 : -1"
    :aria-hidden="front ? undefined : 'true'"
    :aria-label="front ? `View ${person.user_name}’s profile` : undefined"
    :aria-disabled="front ? disabled || skeleton : undefined"
    :data-user-id="person.user_id"
    :data-interaction="front ? 'photo.expand.click.1' : undefined"
    :data-target="front ? target : undefined"
    @click="open"
    @keydown.enter.self="open"
    @keydown.space.self.prevent="open"
  >
    <view class="discover-card-face" :class="{ 'discover-card-face--masked': masked, 'discover-card-face--enter': entering }" :style="face_style">
    <ProfilePhoto deck :fade="photoFade" :reveal="!skeleton" :src="person.photo?.media_url || ''" :name="person.user_name" :position="person.photo?.focal_point || '50% 22%'" @ready="photo_ready" @error="photo_error" @loading="photo_loading" />
    <view class="discover-photo-scrim" />
    <view class="discover-info" :aria-hidden="masked ? 'true' : undefined">
      <view class="discover-name-row"><text class="discover-name">{{ person.user_name }}{{ person.age === null ? '' : `, ${person.age}` }}</text><view v-if="person.verified" class="discover-verified" aria-label="Verified student"><SourceIcon name="verified" /></view></view>
      <view class="discover-tags">
        <view v-if="person.university" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="university" /></view><text>{{ person.university }}</text></view>
        <view v-if="person.major" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="book" /></view><text>{{ person.major }}</text></view>
        <view v-if="person.mbti" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="puzzle" /></view><text>{{ person.mbti }}</text></view>
      </view>
    </view>
    <view v-if="front && entering" class="discover-edge-sweep" aria-hidden="true" />
    </view>
  </view>
</template>

<style scoped>
.discover-photo-card {
  position: absolute;
  inset: 0;
  min-height: 0;
  border-radius: 53.435rpx;
  transform-origin: 50% 92%;
  will-change: transform;
}
.discover-card-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  padding: 0 41.985rpx 30.534rpx;
  border-radius: inherit;
  background: var(--cimoa-surface-skeleton);
  box-shadow: var(--cimoa-shadow-discover-deck-layer);
  transform-origin: 50% 92%;
  transition: box-shadow var(--deck-shadow-duration, 0ms) cubic-bezier(.2,.8,.25,1);
}
.discover-photo-card--front { z-index: 3; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.discover-photo-card--front:active { cursor: grabbing; }
.discover-photo-card--front[data-touch-state='pressed'] .discover-card-face, .discover-photo-card--front[data-touch-state='held'] .discover-card-face { box-shadow: var(--cimoa-shadow-discover-deck-active); }
.discover-photo-card--back, .discover-photo-card--rear { pointer-events: none; }
.discover-photo-card--front :deep(img) { -webkit-user-drag: none; }
.discover-photo-scrim { position: absolute; right: 0; bottom: 0; left: 0; height: 572.519rpx; background: var(--cimoa-gradient-photo-scrim); pointer-events: none; }
.discover-info { position: relative; color: var(--cimoa-text-inverse); pointer-events: none; }
.discover-name-row { display: flex; align-items: center; gap: 19.084rpx; }
.discover-name { min-width: 0; font-size: 59.16rpx; font-weight: 800; letter-spacing: -0.03em; line-height: 1.08; overflow-wrap: anywhere; }
.discover-verified { flex: none; width: 49.618rpx; height: 49.618rpx; }
.discover-tags { display: flex; flex-wrap: wrap; gap: 13.359rpx; margin-top: 22.901rpx; }
.discover-tag { flex: none; display: flex; align-items: center; gap: 11.45rpx; min-height: 68.702rpx; max-width: 100%; padding: 0 22.901rpx; border: 1px solid var(--cimoa-surface-photo-tag-border); border-radius: 34.351rpx; background: var(--cimoa-surface-photo-tag); backdrop-filter: blur(15.267rpx); font-size: 28.626rpx; font-weight: 600; overflow-wrap: anywhere; }
.discover-tag text { min-width: 0; padding: 7.634rpx 0; }
.discover-tag-icon { flex: none; width: 30.534rpx; height: 30.534rpx; }
.discover-card-face--masked::before { content: ''; position: absolute; inset: 0; z-index: 1; background: var(--cimoa-gradient-loading-discover-mist); animation: discover-mist-reveal var(--deck-loading-duration) ease-out both; pointer-events: none; }
.discover-card-face--masked::after { content: ''; position: absolute; inset: 0; z-index: 3; padding: 2.863rpx; border-radius: inherit; background: var(--cimoa-gradient-discover-edge) border-box; background-size: 250% 100%; opacity: 0; pointer-events: none; -webkit-mask: var(--cimoa-gradient-card-fill) content-box, var(--cimoa-gradient-card-fill); -webkit-mask-composite: xor; mask: var(--cimoa-gradient-card-fill) content-box, var(--cimoa-gradient-card-fill); mask-composite: exclude; animation: discover-loading-edge var(--deck-loading-duration) ease-out both; }
.discover-card-face--masked .discover-info { z-index: 2; }
.discover-card-face--masked .discover-photo-scrim { opacity: 0; }
.discover-card-face--masked .discover-name { position: relative; color: var(--cimoa-surface-transparent); border-radius: 15.267rpx; background: var(--cimoa-gradient-loading-block); }
.discover-card-face--masked .discover-verified { visibility: hidden; }
.discover-card-face--masked .discover-tag { border-color: var(--cimoa-surface-transparent); background: var(--cimoa-gradient-loading-block); backdrop-filter: none; }
.discover-card-face--masked .discover-tag-icon, .discover-card-face--masked .discover-tag text { visibility: hidden; }
.discover-info, .discover-photo-scrim { transition: opacity var(--deck-fade-duration) ease-out; }
.discover-photo-card--back .discover-card-face--enter, .discover-photo-card--rear .discover-card-face--enter { animation: discover-fan var(--deck-fan-duration) cubic-bezier(.2,.8,.25,1) both; }
.discover-edge-sweep { position: absolute; inset: 0; padding: 2.863rpx; border-radius: inherit; pointer-events: none; background: var(--cimoa-gradient-discover-edge); background-size: 250% 100%; -webkit-mask: var(--cimoa-gradient-card-fill) content-box, var(--cimoa-gradient-card-fill); -webkit-mask-composite: xor; mask: var(--cimoa-gradient-card-fill) content-box, var(--cimoa-gradient-card-fill); mask-composite: exclude; animation: discover-edge var(--deck-sweep-duration) ease-in-out both; }
@keyframes discover-mist-reveal { from { opacity: .58; transform: scale(1.05); } to { opacity: 1; transform: scale(1); } }
@keyframes discover-loading-edge { from { opacity: 0; background-position: 135% 50%; } 28%, 64% { opacity: .78; } to { opacity: 0; background-position: -35% 50%; } }
@keyframes discover-fan { from, to { transform: rotate(0) scale(1); } 48% { transform: rotate(var(--deck-fan-angle)) scale(var(--deck-fan-scale)); } }
@keyframes discover-edge { from { opacity: 0; background-position: 130% 50%; } 25%, 65% { opacity: .85; } to { opacity: 0; background-position: -130% 50%; } }
@media (prefers-reduced-motion: reduce) {
  .discover-card-face--masked::before, .discover-card-face--masked::after, .discover-photo-card--back .discover-card-face--enter, .discover-photo-card--rear .discover-card-face--enter { animation: none; }
  .discover-card-face--masked::after { display: none; }
  .discover-edge-sweep { display: none; animation: none; }
  .discover-card-face { transition: none; }
}
</style>
