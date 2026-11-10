<script setup>
import { Teleport, computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { discover_destination, require_discover_destination_ready } from '@/utils/discoverNavigation.js'
import { DISCOVER_DECK } from '@/config/discoverDeck.js'
import { MOTION } from '@/config/navigation.js'
import { use_send_surface_source } from '@/composables/useSendSurface.js'
import { match_preferences_surface } from '@/utils/sendSurface.js'
import { swipe_commits, deck_card_style } from '@/utils/discoverSwipe.js'
import { create_discover_entrance } from '@/utils/discoverEntrance.js'
import MainTabFrame from '@/components/MainTabFrame.vue'
import DiscoverHeroHeader from '@/components/DiscoverHeroHeader.vue'
import DiscoverProfileCard from '@/components/DiscoverProfileCard.vue'
import BrandProgressMark from '@/components/BrandProgressMark.vue'
import DiscoverGuide from '@/components/DiscoverGuide.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import { use_discover_guide } from '@/composables/useDiscoverGuide.js'

const store = use_app_store()
const frame = ref(null)
const content_element = ref(null), deck_element = ref(null), send_element = ref(null)
const navigation_error = ref('')
const navigating = ref(false)
const card_index = computed(() => store.discover_card_index)
const drag_x = ref(0)
const drag_y = ref(0)
const card_width = ref(1)
const card_height = ref(1)
const deck_space = ref({ left: 0, right: 0, top: 0, bottom: 0 })
const press_style = { '--discover-press-in': `${MOTION.press_in}ms`, '--discover-press-out': `${MOTION.press_out}ms` }
const dragging = ref(false)
const settling = ref(false)
const resetting = ref(false)
const people = computed(() => store.discover_people)
const person = computed(() => people.value.length ? people.value[card_index.value % people.value.length] : null)
const cards = computed(() => Array.from({ length: Math.min(3, people.value.length) }, (_, depth) => ({ person: people.value[(card_index.value + depth) % people.value.length], depth })).reverse())
const primary = computed(() => person.value ? store.introduction_context(person.value.user_id).primary : null)
const surface = use_send_surface_source({ identity: () => ({ auth_context: store.auth_context, user_id: person.value?.user_id || '' }), element: () => frame.value?.$el || frame.value, anchor: () => send_element.value?.$el || send_element.value })
const prefs_surface = use_send_surface_source({ controller: match_preferences_surface, identity: () => ({ auth_context: store.auth_context, user_id: store.session.current_user_id }), element: () => frame.value?.$el || frame.value })
const target = (kind, id) => { try { return discover_destination(store, kind, id) } catch { return '' } }
const content_loading = ref(false), first_reveal = ref(false), entrance_phase = ref('idle'), ready_photo_id = ref('')
const decoded_photos = new Map()
const entrance = create_discover_entrance({ change: phase => { entrance_phase.value = phase } })
const loading_changed = value => { content_loading.value = value; if (value) first_reveal.value = true; entrance.set_loading(value) }
const entrance_identity = computed(() => person.value ? `${store.auth_context}:${person.value.user_id}:${person.value.photo?.media_url || ''}` : null)
watch(entrance_identity, id => { ready_photo_id.value = decoded_photos.get(person.value?.user_id) === id ? person.value.user_id : ''; entrance.set_person(id) }, { immediate: true, flush: 'sync' })
let motion_query, stop_motion_watch
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  motion_query = window.matchMedia('(prefers-reduced-motion: reduce)')
  const changed = event => { if (event.matches) entrance.interrupt() }
  motion_query.addEventListener?.('change', changed)
  stop_motion_watch = () => motion_query.removeEventListener?.('change', changed)
}
const photo_ready = id => { const row = people.value.find(row => row.user_id === id); if (row) decoded_photos.set(id, `${store.auth_context}:${id}:${row.photo?.media_url || ''}`); if (id !== person.value?.user_id) return; ready_photo_id.value = id; entrance.photo_ready(entrance_identity.value); if (motion_query?.matches) entrance.interrupt() }
const photo_failed = id => { decoded_photos.delete(id); if (id === person.value?.user_id) { ready_photo_id.value = ''; entrance.photo_failed(entrance_identity.value) } }
const guide = use_discover_guide('discover', {
  ready: computed(() => !content_loading.value && !!person.value && ready_photo_id.value === person.value.user_id && ['idle', 'complete'].includes(entrance_phase.value)),
  user_id: () => person.value?.user_id || '',
  available: () => !navigating.value && !surface.busy.value && !prefs_surface.busy.value,
  element: () => frame.value?.$el || frame.value,
  open_profile: () => navigate('detail', person.value?.user_id),
  open_intro: () => navigate('primary', person.value?.user_id),
})

let pointer_id = null
let start_x = 0
let start_y = 0
let settle_timer
let move_frame, reset_frame, interaction_token = 0, axis = null, moved = false, pending_x = 0, pending_y = 0
const settle_duration = ref(DISCOVER_DECK.exit_ms)
let ignore_click_until = 0
const clear_settle_timer = () => { clearTimeout(settle_timer); settle_timer = null }
const cancel_frames = () => { cancelAnimationFrame(move_frame); cancelAnimationFrame(reset_frame); move_frame = null; reset_frame = null }
const reset_drag = () => { pointer_id = null; axis = null; moved = false; dragging.value = false; settling.value = false; resetting.value = false; drag_x.value = 0; drag_y.value = 0 }
const stop_interaction = () => { interaction_token++; clear_settle_timer(); cancel_frames(); reset_drag() }
let page_visible = true, resize_observer, measurement_frame
const native_element = reference => reference?.$el || reference
const measure_deck = () => {
  if (!page_visible) return
  const deck = native_element(deck_element.value), content = native_element(content_element.value), send = native_element(send_element.value)
  if (!deck?.getBoundingClientRect || !content?.getBoundingClientRect) return
  const box = deck.getBoundingClientRect(), bounds = content.getBoundingClientRect(), action = send?.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return
  const changed = Math.abs(card_width.value - box.width) > .5 || Math.abs(card_height.value - box.height) > .5
  if (changed) stop_interaction()
  card_width.value = box.width; card_height.value = box.height
  deck_space.value = { left: Math.max(0, box.left - bounds.left), right: Math.max(0, bounds.right - box.right), top: Math.max(0, box.top - bounds.top), bottom: Math.max(0, Math.min(bounds.bottom, action?.top ?? bounds.bottom) - box.bottom) }
}
const schedule_measurement = () => {
  cancelAnimationFrame(measurement_frame)
  if (page_visible) measurement_frame = requestAnimationFrame(() => { measurement_frame = null; measure_deck() })
}
const observe_deck = async () => {
  await nextTick()
  if (!page_visible) return
  resize_observer?.disconnect()
  for (const reference of [content_element.value, deck_element.value, send_element.value]) {
    const element = native_element(reference)
    if (element) resize_observer?.observe(element)
  }
  measure_deck()
}
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') resize_observer = new ResizeObserver(schedule_measurement)
  window.addEventListener('resize', schedule_measurement)
  observe_deck()
})
watch(() => !!person.value, observe_deck, { flush: 'post' })
onShow(() => { page_visible = true; navigating.value = false; stop_interaction(); observe_deck() })
onHide(() => { page_visible = false; cancelAnimationFrame(measurement_frame); stop_interaction(); entrance.interrupt() })
onUnmounted(() => { page_visible = false; resize_observer?.disconnect(); cancelAnimationFrame(measurement_frame); window.removeEventListener('resize', schedule_measurement); stop_interaction(); entrance.dispose(); stop_motion_watch?.() })

watch([() => store.auth_context, () => people.value.map(item => item.user_id)], ([context, ids], [previous_context, previous = []] = []) => {
  if (context === previous_context && ids.length === previous.length && ids.every((id, index) => id === previous[index])) return
  store.reconcile_discover_cursor()
  navigation_error.value = ''
  stop_interaction()
}, { immediate: true })

const navigate = async (kind, id) => {
  if (navigating.value || dragging.value || settling.value || resetting.value) return false
  if (kind === 'primary' && store.introduction_context(id).primary?.disabled) return false
  entrance.interrupt()
  navigating.value = true
  navigation_error.value = ''
  store.tick()
  try {
    const destination = require_discover_destination_ready(discover_destination(store, kind, id))
    if (kind === 'primary' && destination.split('?')[0] === '/pages/discover/icebreaker/select') {
      return await surface.navigate(id, () => frame.value.navigate_forward(destination))
    } else if (kind === 'preferences') return await prefs_surface.navigate(store.session.current_user_id, () => frame.value.navigate_forward(destination))
    else return await frame.value.navigate_forward(destination)
  }
  catch (error) { navigation_error.value = error.message; return false }
  finally { navigating.value = false }
}
const open_profile = () => {
  if (!person.value || Date.now() < ignore_click_until || dragging.value || settling.value) return
  navigate('detail', person.value.user_id)
}

const begin_drag = (event) => {
  if (guide.open.value || content_loading.value || !person.value || navigating.value || settling.value || resetting.value || pointer_id !== null || event.button !== 0 || !event.isPrimary || !Number.isFinite(event.cardWidth) || event.cardWidth <= 0) return
  entrance.interrupt()
  // A fresh deliberate contact is not the compatibility click from the prior
  // swipe. Keep the old swipe guard for its own release, not the next tap.
  ignore_click_until = 0
  pointer_id = event.pointerId
  start_x = event.clientX
  start_y = event.clientY
  card_width.value = event.cardWidth
  card_height.value = Math.max(1, event.cardHeight)
  axis = null; moved = false; pending_x = 0; pending_y = 0
}
const flush_move = () => { cancelAnimationFrame(move_frame); move_frame = null; drag_x.value = pending_x; drag_y.value = pending_y }
const move_drag = (event) => {
  if (event.pointerId !== pointer_id || settling.value || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
  const dx = event.clientX - start_x
  const dy = event.clientY - start_y
  if (!axis && Math.hypot(dx, dy) >= card_width.value * DISCOVER_DECK.tap_slop_ratio) { moved = true; axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical' }
  if (axis !== 'horizontal') return
  dragging.value = true
  pending_x = dx; pending_y = dy
  if (move_frame == null) move_frame = requestAnimationFrame(() => { move_frame = null; drag_x.value = pending_x; drag_y.value = pending_y })
}
const settle_back = () => {
  settle_duration.value = DISCOVER_DECK.rebound_ms
  settling.value = true
  drag_x.value = 0; drag_y.value = 0
  settle_timer = setTimeout(() => { settling.value = false; dragging.value = false }, DISCOVER_DECK.rebound_ms)
}
const advance_card = (direction) => {
  const token = interaction_token
  settle_duration.value = DISCOVER_DECK.exit_ms
  settling.value = true
  drag_x.value = direction * card_width.value * DISCOVER_DECK.exit_ratio
  settle_timer = setTimeout(async () => {
    resetting.value = true
    const next = people.value.length ? people.value[(card_index.value + 1) % people.value.length] : null
    if (next) store.remember_discover_card(next.user_id)
    drag_x.value = 0; drag_y.value = 0
    dragging.value = false
    settling.value = false
    await nextTick()
    if (token !== interaction_token) return
    reset_frame = requestAnimationFrame(() => { reset_frame = null; resetting.value = false })
  }, DISCOVER_DECK.exit_ms)
}
const finish_drag = (event, cancelled = false) => {
  if (event.pointerId !== pointer_id) return
  if (!cancelled) move_drag(event)
  pointer_id = null
  if (moved || cancelled) ignore_click_until = Date.now() + DISCOVER_DECK.click_guard_ms
  if (!dragging.value) return
  flush_move()
  const dismiss = !cancelled && people.value.length > 1 && swipe_commits(drag_x.value, card_width.value)
  if (dismiss) advance_card(drag_x.value >= 0 ? 1 : -1)
  else settle_back()
}
const styles = computed(() => [0, 1, 2].map(depth => deck_card_style({ depth, x: drag_x.value, y: drag_y.value, width: card_width.value, height: card_height.value, space: deck_space.value, dragging: dragging.value, settling: settling.value, resetting: resetting.value, duration: settle_duration.value })))
</script>

<template>
  <Teleport to="#cimoa-send-surface-source" :disabled="!surface.borrowed.value">
  <Teleport to="#cimoa-match-preferences-surface-source" :disabled="!prefs_surface.borrowed.value">
  <MainTabFrame ref="frame" class="discover-request-deck" route="pages/discover/index" header-owns-safe-area scroll-locked eager-content :style="press_style" @content-loading="loading_changed">
    <template #header><DiscoverHeroHeader :profile-target="target('profile')" :preferences-target="target('preferences')" @profile="navigate('profile')" @preferences="navigate('preferences')" /></template>
    <template #default="{ ready }">
    <view ref="content_element" class="discover-content">
      <view v-if="store.hydration_status === 'error'" class="discover-state discover-read-error" role="alert"><text>{{ store.hydration_error }}</text><view class="discover-retry" role="button" tabindex="0" @click="store.hydrate" @keydown.enter="store.hydrate">Retry</view></view>
      <view v-else-if="store.hydration_status !== 'ready'" class="discover-state" role="status" aria-busy="true"><view class="discover-loading-mark"><BrandProgressMark /></view><text>Loading profiles…</text></view>
      <view v-else-if="!store.session.is_authenticated" class="discover-state discover-session-error" role="alert">Your session has expired. Please sign in again.</view>
      <view v-else-if="!person" class="discover-state discover-empty"><text>No profiles available right now.</text><text>Check back when more students are available.</text></view>
      <view
        v-else
        ref="deck_element"
        class="discover-deck"
        :data-skeleton="!ready ? 'discover' : undefined"
        :role="!ready ? 'status' : undefined"
        :aria-label="!ready ? 'Loading people' : undefined"
        :aria-busy="!ready"
        :data-entrance-phase="entrance_phase"
        data-interaction="photo.browse.drag.1"
        :data-card-index="card_index"
        :data-drag-x="drag_x"
        :data-dragging="dragging"
        :data-settling="settling"
        :data-resetting="resetting"
        :data-navigating="navigating"
      >
        <DiscoverProfileCard
          v-for="entry in cards"
          :key="entry.person.user_id"
          :person="entry.person"
          :front="entry.depth === 0"
          :disabled="!ready || navigating || dragging || settling || resetting"
          :gesture-disabled="!ready || navigating || settling || resetting || guide.open.value"
          :skeleton="!ready"
          :entering="entrance_phase === 'running'"
          :photo-fade="first_reveal"
          :depth="entry.depth"
          :target="entry.depth === 0 ? target('detail', entry.person.user_id) : ''"
          :transform-style="styles[entry.depth]"
          @open="open_profile"
          @drag-start="begin_drag"
          @drag-move="move_drag"
          @drag-end="finish_drag"
          @drag-cancel="finish_drag($event, true)"
          @photo-ready="photo_ready"
          @photo-error="photo_failed"
        />
      </view>
    </view>
    </template>
    <template #footer="{ ready }">
      <view class="discover-footer">
        <FeedbackToast v-if="navigation_error" :message="navigation_error" @dismiss="navigation_error = String()" />
        <view ref="send_element" class="discover-send" :class="{ 'discover-send--waiting': primary?.disabled }" role="button" :tabindex="primary?.disabled ? -1 : 0" :aria-disabled="!ready || !person || navigating || dragging || settling || resetting || primary?.disabled" :aria-busy="navigating" data-interaction="photo.sayHi.click.1" :data-target="person ? target('primary', person.user_id) : ''" @click="ready && person && navigate('primary', person.user_id)" @keydown.enter="ready && person && navigate('primary', person.user_id)" @keydown.space.prevent="ready && person && navigate('primary', person.user_id)"><text class="discover-send-label">{{ primary?.label || 'Send shot' }}</text></view>
      </view>
    </template>
    <template #overlays><DiscoverGuide :open="guide.open.value" :step="guide.step.value" :busy="guide.busy.value" :error="guide.error.value" :target-user-id="guide.target_user_id.value" @next="guide.next" @back="guide.back" @skip="guide.skip" /><EventActionLoading :visible="guide.is_loading.value" label="Updating your preferences…" /></template>
  </MainTabFrame>
  </Teleport>
  </Teleport>
</template>

<style scoped>
.discover-request-deck { -webkit-font-smoothing: antialiased; }
.discover-content { height: 100%; min-height: 0; overflow: hidden; padding: 0 38.168rpx 26.718rpx; }
.discover-deck { position: relative; width: 100%; height: min(100%, 1034.351rpx); min-height: 0; overflow: visible; isolation: isolate; }
.discover-deck::before {
  content: '';
  position: absolute;
  inset: 7.634rpx -19.084rpx -26.718rpx;
  z-index: 0;
  border-radius: 68.702rpx;
  background: var(--cimoa-gradient-discover-deck-aura);
  filter: blur(19.084rpx);
  opacity: 0;
  transform: scale(.94);
  pointer-events: none;
  transition: opacity var(--discover-press-out) ease-out, transform var(--discover-press-out) ease-out;
}
.discover-deck[data-entrance-phase='running']::before { animation: discover-aura-arrive calc(var(--discover-press-out) * 4) ease-out both; }
.discover-deck[data-dragging='true']::before { opacity: .82; transform: scale(1.025); transition-duration: var(--discover-press-in); }
.discover-footer { flex: none; padding: 30.534rpx 38.168rpx 3.817rpx; }
.discover-send {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 114.504rpx;
  border-radius: 57.252rpx;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-gradient-primary);
  box-shadow: var(--cimoa-shadow-primary);
  font-size: 40.076rpx;
  font-weight: 700;
  cursor: pointer;
  isolation: isolate;
  transition: transform var(--discover-press-out) ease, box-shadow var(--discover-press-out) ease;
}
.discover-send::before {
  content: '';
  position: absolute;
  inset: -28% auto -28% -72%;
  width: 58%;
  z-index: 0;
  background: var(--cimoa-gradient-main-action-shine);
  opacity: 0;
  transform: skewX(-14deg);
  pointer-events: none;
}
.discover-send-label { position: relative; z-index: 1; }
.discover-send[data-touch-state="pressed"]:not([aria-disabled="true"]), .discover-send[data-touch-state="held"]:not([aria-disabled="true"]) { transform: scale(.985); box-shadow: var(--cimoa-shadow-main-action-active); transition-duration: var(--discover-press-in); }
.discover-send[data-touch-state="pressed"]:not([aria-disabled="true"])::before, .discover-send[data-touch-state="held"]:not([aria-disabled="true"])::before { animation: discover-action-sheen calc(var(--discover-press-out) * 2) ease-out both; }
.discover-send[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.discover-send[aria-busy="true"] { opacity: 1; }
.discover-send--waiting[aria-disabled="true"] { color: var(--cimoa-text-connection-muted); background: var(--cimoa-surface-tinted); box-shadow: none; opacity: 1; }
.discover-error {
  display: block;
  margin-bottom: 19.084rpx;
  color: var(--cimoa-status-danger);
  font-size: 26.718rpx;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.discover-state {
  display: flex;
  flex-direction: column;
  gap: 22.901rpx;
  padding: 45.802rpx;
  border-radius: 45.802rpx;
  color: var(--cimoa-text-secondary);
  background: var(--cimoa-surface-empty);
  font-size: 30.534rpx;
  line-height: 1.5;
}
.discover-retry { color: var(--cimoa-text-link); font-weight: 700; cursor: pointer; }
.discover-loading-mark { flex: none; width: 61.069rpx; height: 61.069rpx; }
@keyframes discover-aura-arrive { from { opacity: 0; transform: scale(.9); } 42% { opacity: .72; } to { opacity: 0; transform: scale(1.03); } }
@keyframes discover-action-sheen { from { opacity: 0; transform: translateX(0) skewX(-14deg); } 24% { opacity: 1; } to { opacity: 0; transform: translateX(310%) skewX(-14deg); } }
@media (prefers-reduced-motion: reduce) {
  .discover-deck::before, .discover-send { transition: none; }
  .discover-deck[data-entrance-phase='running']::before, .discover-send[data-touch-state]::before { animation: none; }
  .discover-deck[data-dragging='true']::before { opacity: .35; transform: none; }
  .discover-send[data-touch-state] { transform: none; }
}
</style>
