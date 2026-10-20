<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { discover_destination, require_discover_destination_ready } from '@/utils/discoverNavigation.js'
import { DISCOVER_DECK } from '@/config/discoverDeck.js'
import { swipe_commits, deck_card_style } from '@/utils/discoverSwipe.js'
import MainTabFrame from '@/components/MainTabFrame.vue'
import DiscoverHeroHeader from '@/components/DiscoverHeroHeader.vue'
import DiscoverProfileCard from '@/components/DiscoverProfileCard.vue'

const store = use_app_store()
const frame = ref(null)
const navigation_error = ref('')
const navigating = ref(false)
const card_index = ref(0)
const drag_x = ref(0)
const drag_y = ref(0)
const card_width = ref(1)
const card_height = ref(1)
const dragging = ref(false)
const settling = ref(false)
const resetting = ref(false)
const people = computed(() => store.discover_people)
const person = computed(() => people.value.length ? people.value[card_index.value % people.value.length] : null)
const cards = computed(() => Array.from({ length: Math.min(3, people.value.length) }, (_, depth) => ({ person: people.value[(card_index.value + depth) % people.value.length], depth })).reverse())
const primary = computed(() => person.value ? store.introduction_context(person.value.user_id).primary : null)
const target = (kind, id) => { try { return discover_destination(store, kind, id) } catch { return '' } }

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
onShow(() => { navigating.value = false; stop_interaction() })
onHide(stop_interaction)
onUnmounted(stop_interaction)

watch(() => people.value.map((item) => item.user_id), (ids, previous = []) => {
  if (ids.length === previous.length && ids.every((id, index) => id === previous[index])) return
  const current_id = previous.length ? previous[card_index.value % previous.length] : null
  const retained = ids.indexOf(current_id)
  card_index.value = retained >= 0 ? retained : ids.length ? card_index.value % ids.length : 0
  navigation_error.value = ''
  stop_interaction()
})
watch(() => store.session.current_user_id, () => { card_index.value = 0; navigation_error.value = ''; stop_interaction() })

const navigate = async (kind, id) => {
  if (navigating.value || dragging.value || settling.value || resetting.value) return
  if (kind === 'primary' && store.introduction_context(id).primary?.disabled) return
  navigating.value = true
  navigation_error.value = ''
  store.tick()
  try { await frame.value.navigate_forward(require_discover_destination_ready(discover_destination(store, kind, id))) }
  catch (error) { navigation_error.value = error.message }
  finally { navigating.value = false }
}
const open_profile = () => {
  if (!person.value || Date.now() < ignore_click_until || dragging.value || settling.value) return
  navigate('detail', person.value.user_id)
}

const begin_drag = (event) => {
  if (!person.value || navigating.value || settling.value || resetting.value || pointer_id !== null || event.button !== 0 || !event.isPrimary || !Number.isFinite(event.cardWidth) || event.cardWidth <= 0) return
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
    card_index.value = people.value.length ? (card_index.value + 1) % people.value.length : 0
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
const styles = computed(() => [0, 1, 2].map(depth => deck_card_style({ depth, x: drag_x.value, y: drag_y.value, width: card_width.value, height: card_height.value, dragging: dragging.value, settling: settling.value, resetting: resetting.value, duration: settle_duration.value })))
</script>

<template>
  <MainTabFrame ref="frame" class="discover-request-deck" route="pages/discover/index" header-owns-safe-area scroll-locked>
    <template #header><DiscoverHeroHeader :profile-target="target('profile')" :preferences-target="target('preferences')" @profile="navigate('profile')" @preferences="navigate('preferences')" /></template>
    <view class="discover-content">
      <view v-if="store.hydration_status === 'error'" class="discover-state discover-read-error" role="alert"><text>{{ store.hydration_error }}</text><view class="discover-retry" role="button" tabindex="0" @click="store.hydrate" @keydown.enter="store.hydrate">Retry</view></view>
      <view v-else-if="store.hydration_status !== 'ready'" class="discover-state" role="status">Loading profiles…</view>
      <view v-else-if="!store.session.is_authenticated" class="discover-state discover-session-error" role="alert">Your session has expired. Please sign in again.</view>
      <view v-else-if="!person" class="discover-state discover-empty"><text>No profiles available right now.</text><text>Check back when more students are available.</text></view>
      <view
        v-else
        class="discover-deck"
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
          :disabled="navigating || dragging || settling || resetting"
          :depth="entry.depth"
          :target="entry.depth === 0 ? target('detail', entry.person.user_id) : ''"
          :transform-style="styles[entry.depth]"
          @open="open_profile"
          @drag-start="begin_drag"
          @drag-move="move_drag"
          @drag-end="finish_drag"
          @drag-cancel="finish_drag($event, true)"
        />
      </view>
    </view>
    <template #footer="{ ready }">
      <view class="discover-footer">
        <text v-if="navigation_error" class="discover-error" role="alert">{{ navigation_error }}</text>
        <view class="discover-send" :class="{ 'discover-send--waiting': primary?.disabled }" role="button" :tabindex="primary?.disabled ? -1 : 0" :aria-disabled="!ready || !person || navigating || dragging || settling || resetting || primary?.disabled" data-interaction="photo.sayHi.click.1" :data-target="person ? target('primary', person.user_id) : ''" @click="ready && person && navigate('primary', person.user_id)" @keydown.enter="ready && person && navigate('primary', person.user_id)" @keydown.space.prevent="ready && person && navigate('primary', person.user_id)">{{ primary?.label || 'Send shot' }}</view>
      </view>
    </template>
  </MainTabFrame>
</template>

<style scoped>
.discover-request-deck { -webkit-font-smoothing: antialiased; }
.discover-content { height: 100%; min-height: 0; overflow: hidden; padding: 0 38.168rpx 26.718rpx; }
.discover-deck { position: relative; width: 100%; height: min(100%, 1034.351rpx); min-height: 0; overflow: visible; }
.discover-footer { flex: none; padding: 30.534rpx 38.168rpx 3.817rpx; }
.discover-send {
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
}
.discover-send[aria-disabled="true"] { opacity: 0.5; cursor: default; }
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
</style>
