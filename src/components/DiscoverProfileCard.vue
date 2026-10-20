<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { bind_card_pointer_events } from '@/utils/discoverSwipe.js'
import ProfilePhoto from './ProfilePhoto.vue'
import SourceIcon from './SourceIcon.vue'

const props = defineProps({
  person: { type: Object, required: true },
  front: Boolean,
  disabled: Boolean,
  depth: { type: Number, default: 1 },
  target: { type: String, default: '' },
  transformStyle: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['open', 'drag-start', 'drag-move', 'drag-end', 'drag-cancel'])
const card = ref(null)
let active_pointer = null, unbind_pointer
const element = () => card.value?.$el || card.value
const pointer_payload = (event, measure = false) => {
  const candidates = [event, event.detail, event.touches?.[0], event.changedTouches?.[0]].filter(Boolean)
  const point = candidates.find((candidate) => Number.isFinite(Number(candidate.clientX ?? candidate.pageX ?? candidate.x))) || {}
  const bounds = measure ? element()?.getBoundingClientRect?.() : null
  return {
    pointerId: event.pointerId ?? event.detail?.pointerId ?? point.identifier ?? 'primary',
    clientX: Number(point.clientX ?? point.pageX ?? point.x),
    clientY: Number(point.clientY ?? point.pageY ?? point.y),
    button: Number(event.button ?? event.detail?.button ?? 0),
    isPrimary: event.isPrimary ?? event.detail?.isPrimary ?? true,
    cardWidth: bounds?.width,
    cardHeight: bounds?.height,
  }
}
const start_drag = (event) => {
  const point = pointer_payload(event, true)
  if (!props.front || props.disabled || active_pointer !== null || point.button !== 0 || !point.isPrimary || event.target?.closest?.('.photo-retry')) return
  active_pointer = point.pointerId
  try { element()?.setPointerCapture?.(point.pointerId) } catch { /* Untrusted test events have no platform capture. */ }
  emit('drag-start', point)
}
const move_drag = (event) => {
  if (!props.front || pointer_payload(event).pointerId !== active_pointer) return
  event.preventDefault?.()
  emit('drag-move', pointer_payload(event))
}
const finish_drag = (event, cancelled = false) => {
  const point = pointer_payload(event)
  if (point.pointerId !== active_pointer) return
  active_pointer = null
  emit(cancelled ? 'drag-cancel' : 'drag-end', point)
  try { if (element()?.hasPointerCapture?.(point.pointerId)) element().releasePointerCapture(point.pointerId) } catch { /* Capture was already released by WebKit. */ }
}
const release_pointer = () => { if (active_pointer !== null) finish_drag({ pointerId: active_pointer }, true) }
watch(() => props.front, front => { if (!front) release_pointer() })
onHide(release_pointer)
onMounted(() => { unbind_pointer = bind_card_pointer_events(element(), { start: start_drag, move: move_drag, end: finish_drag, cancel: event => finish_drag(event, true) }) })
onUnmounted(() => { release_pointer(); unbind_pointer?.() })
</script>

<template>
  <view
    ref="card"
    class="discover-photo-card"
    :class="front ? 'discover-photo-card--front' : depth === 1 ? 'discover-photo-card--back' : 'discover-photo-card--rear'"
    :data-deck-depth="front ? 0 : depth"
    :style="transformStyle"
    :role="front ? 'button' : undefined"
    :tabindex="front ? 0 : -1"
    :aria-hidden="front ? undefined : 'true'"
    :aria-label="front ? `View ${person.user_name}’s profile` : undefined"
    :aria-disabled="front ? disabled : undefined"
    :data-user-id="person.user_id"
    :data-interaction="front ? 'photo.expand.click.1' : undefined"
    :data-target="front ? target : undefined"
    @click="front && emit('open')"
    @keydown.enter.self="front && emit('open')"
    @keydown.space.self.prevent="front && emit('open')"
  >
    <ProfilePhoto :src="person.photo?.media_url || ''" :name="person.user_name" :position="person.photo?.focal_point || '50% 22%'" />
    <view class="discover-photo-scrim" />
    <view class="discover-info">
      <view class="discover-name-row"><text class="discover-name">{{ person.user_name }}{{ person.age === null ? '' : `, ${person.age}` }}</text><view v-if="person.verified" class="discover-verified" aria-label="Verified student"><SourceIcon name="verified" /></view></view>
      <view class="discover-tags">
        <view v-if="person.university" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="university" /></view><text>{{ person.university }}</text></view>
        <view v-if="person.major" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="book" /></view><text>{{ person.major }}</text></view>
        <view v-if="person.mbti" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="puzzle" /></view><text>{{ person.mbti }}</text></view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.discover-photo-card {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 0;
  overflow: hidden;
  padding: 0 41.985rpx 30.534rpx;
  border-radius: 53.435rpx;
  background: var(--cimoa-surface-deep);
  box-shadow: var(--cimoa-shadow-discover-photo);
  transform-origin: 50% 92%;
  will-change: transform;
}
.discover-photo-card--front { z-index: 3; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.discover-photo-card--front:active { cursor: grabbing; }
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
</style>
