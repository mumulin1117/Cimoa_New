<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { discover_destination, require_discover_destination_ready } from '@/utils/discoverNavigation.js'
import { MOTION } from '@/config/navigation.js'
import MainTabFrame from '@/components/MainTabFrame.vue'
import DiscoverHeroHeader from '@/components/DiscoverHeroHeader.vue'
import DiscoverProfileCard from '@/components/DiscoverProfileCard.vue'

const store = use_app_store()
const frame = ref(null)
const navigation_error = ref('')
const navigating = ref(false)
const card_index = ref(0)
const drag_x = ref(0)
const card_width = ref(1)
const dragging = ref(false)
const settling = ref(false)
const resetting = ref(false)
const people = computed(() => store.discover_people)
const person = computed(() => people.value.length ? people.value[card_index.value % people.value.length] : null)
const next_person = computed(() => people.value.length > 1 ? people.value[(card_index.value + 1) % people.value.length] : null)
const primary = computed(() => person.value ? store.introduction_context(person.value.user_id).primary : null)
const target = (kind, id) => { try { return discover_destination(store, kind, id) } catch { return '' } }

let pointer_id = null
let start_x = 0
let start_y = 0
let start_time = 0
let settle_timer
let ignore_click_until = 0
const clear_settle_timer = () => { clearTimeout(settle_timer); settle_timer = null }
const reset_drag = () => { pointer_id = null; dragging.value = false; settling.value = false; resetting.value = false; drag_x.value = 0 }
const stop_interaction = () => { clear_settle_timer(); reset_drag() }
onShow(() => { navigating.value = false; stop_interaction() })
onHide(stop_interaction)
onUnmounted(stop_interaction)

watch(() => people.value.map((item) => item.user_id), (ids, previous = []) => {
  const current_id = previous.length ? previous[card_index.value % previous.length] : null
  const retained = ids.indexOf(current_id)
  card_index.value = retained >= 0 ? retained : ids.length ? card_index.value % ids.length : 0
  navigation_error.value = ''
  stop_interaction()
})
watch(() => store.session.current_user_id, () => { card_index.value = 0; navigation_error.value = ''; stop_interaction() })

const navigate = async (kind, id) => {
  if (navigating.value || settling.value) return
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
  if (!person.value || navigating.value || settling.value || pointer_id !== null || event.button > 0) return
  pointer_id = event.pointerId
  start_x = event.clientX
  start_y = event.clientY
  start_time = Date.now()
  card_width.value = Math.max(1, event.cardWidth)
}
const move_drag = (event) => {
  if (event.pointerId !== pointer_id || settling.value) return
  const dx = event.clientX - start_x
  const dy = event.clientY - start_y
  if (!dragging.value && (Math.abs(dx) < card_width.value * 0.018 || Math.abs(dx) <= Math.abs(dy))) return
  dragging.value = true
  drag_x.value = dx
}
const settle_back = () => {
  settling.value = true
  drag_x.value = 0
  settle_timer = setTimeout(() => { settling.value = false; dragging.value = false }, MOTION.discover)
}
const advance_card = (direction) => {
  settling.value = true
  drag_x.value = direction * card_width.value * 1.45
  settle_timer = setTimeout(async () => {
    resetting.value = true
    card_index.value = people.value.length ? (card_index.value + 1) % people.value.length : 0
    drag_x.value = 0
    dragging.value = false
    settling.value = false
    await nextTick()
    requestAnimationFrame(() => { resetting.value = false })
  }, MOTION.discover)
}
const finish_drag = (event, cancelled = false) => {
  if (event.pointerId !== pointer_id) return
  pointer_id = null
  if (!dragging.value) return
  ignore_click_until = Date.now() + MOTION.discover
  const elapsed = Math.max(Date.now() - start_time, 1)
  const velocity = Math.abs(drag_x.value) / elapsed
  const dismiss = !cancelled && (Math.abs(drag_x.value) >= card_width.value * 0.24 || velocity >= 0.75)
  if (dismiss) advance_card(drag_x.value >= 0 ? 1 : -1)
  else settle_back()
}
const front_style = computed(() => ({
  transform: `translate3d(${drag_x.value}px,0,0) rotate(${(drag_x.value / card_width.value * 9).toFixed(3)}deg)`,
  transition: dragging.value && !settling.value || resetting.value ? 'none' : `transform ${MOTION.discover}ms cubic-bezier(.2,.78,.2,1)`,
}))
const back_style = computed(() => {
  const progress = Math.min(1, Math.abs(drag_x.value) / (card_width.value * 0.45))
  return {
    transform: `translateY(${(15.267 * (1 - progress)).toFixed(3)}rpx) scale(${(0.965 + progress * 0.035).toFixed(4)})`,
    transition: dragging.value && !settling.value || resetting.value ? 'none' : `transform ${MOTION.discover}ms cubic-bezier(.2,.78,.2,1)`,
  }
})
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
        <DiscoverProfileCard v-if="next_person" :key="`${next_person.user_id}-back`" :person="next_person" :transform-style="back_style" />
        <DiscoverProfileCard
          :key="`${person.user_id}-front`"
          :person="person"
          front
          :target="target('detail', person.user_id)"
          :transform-style="front_style"
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
        <view class="discover-send" role="button" tabindex="0" :aria-disabled="!ready || !person || navigating" data-interaction="photo.sayHi.click.1" :data-target="person ? target('primary', person.user_id) : ''" @click="ready && person && navigate('primary', person.user_id)" @keydown.enter="ready && person && navigate('primary', person.user_id)" @keydown.space.prevent="ready && person && navigate('primary', person.user_id)">{{ primary?.label || 'Send shot' }}</view>
      </view>
    </template>
  </MainTabFrame>
</template>

<style scoped>
.discover-request-deck { -webkit-font-smoothing: antialiased; }
.discover-content { height: 100%; min-height: 0; overflow: hidden; padding: 0 38.168rpx; }
.discover-deck { position: relative; width: 100%; height: min(100%, 1034.351rpx); min-height: 0; overflow: visible; }
.discover-footer { flex: none; padding: 30.534rpx 38.168rpx 3.817rpx; }
.discover-send { display: flex; align-items: center; justify-content: center; height: 114.504rpx; border-radius: 57.252rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); box-shadow: var(--cimoa-shadow-primary); font-size: 40.076rpx; font-weight: 700; cursor: pointer; }
.discover-send[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.discover-error { display: block; margin-bottom: 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.discover-state { display: flex; flex-direction: column; gap: 22.901rpx; padding: 45.802rpx; border-radius: 45.802rpx; color: var(--cimoa-text-secondary); background: var(--cimoa-surface-empty); font-size: 30.534rpx; line-height: 1.5; }
.discover-retry { color: var(--cimoa-text-link); font-weight: 700; cursor: pointer; }
</style>
