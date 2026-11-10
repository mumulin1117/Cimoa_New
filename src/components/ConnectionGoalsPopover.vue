<script setup>
import { computed, ref, watch, nextTick, getCurrentInstance, onMounted, onUnmounted } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { MOTION } from '@/config/navigation.js'
const props = defineProps({ userId: { type: String, default: '' }, anchor: { type: Object, default: null } })
const emit = defineEmits(['close'])
const store = use_app_store(), instance = getCurrentInstance()
const rendered = ref(false), showing = ref(false), placement = ref({}), retained_id = ref('')
const goals = computed(() => store.goals_for_user(retained_id.value))
const panel_interaction = computed(() => `home.stopTap.click.${retained_id.value === 'user_liam' ? 2 : retained_id.value === 'user_grace' ? 3 : 1}`)
let timer, frame, token = 0
const cancel_pending = () => {
  clearTimeout(timer)
  if (frame != null && typeof window !== 'undefined') window.cancelAnimationFrame(frame)
  timer = frame = undefined
}
const release = () => { rendered.value = false; showing.value = false; retained_id.value = ''; placement.value = {} }
const interrupt = () => { token++; cancel_pending(); release(); if (props.userId) emit('close') }
const reveal = (current) => {
  if (current !== token || !props.userId || !props.anchor) return
  // Commit the measured, closed frame before opening. Both first and repeated
  // presentations therefore start at the same tag, rather than the old panel.
  if (typeof window === 'undefined') { showing.value = true; return }
  frame = window.requestAnimationFrame(() => {
    frame = window.requestAnimationFrame(() => {
      frame = undefined
      if (current === token && props.userId && props.anchor) showing.value = true
    })
  })
}
const measure = async (current) => {
  await nextTick()
  if (current !== token || !props.userId || !props.anchor) return
  uni.createSelectorQuery().in(instance.proxy).select('.goals-panel').boundingClientRect((rect) => {
    if (current !== token || !props.userId || !props.anchor) return
    if (!rect) { interrupt(); return }
    const info = uni.getWindowInfo(), scale = 750 / info.windowWidth
    const { right, bottom, limit_bottom, limit_top, trigger } = props.anchor
    const max_bottom = limit_bottom ?? info.windowHeight
    const min_top = Math.max(8 / scale, limit_top || 0)
    const y = Math.max(min_top, Math.min(bottom - 6 * info.windowWidth / 393, max_bottom - rect.height - 8 / scale))
    const x = Math.max(8 / scale, Math.min(right - 12 * info.windowWidth / 393 - rect.width, info.windowWidth - rect.width - 8 / scale))
    const valid_trigger = trigger && [trigger.left, trigger.top, trigger.width, trigger.height].every(Number.isFinite)
    const origin_x = valid_trigger ? trigger.left + trigger.width / 2 - x : rect.width / 2
    const origin_y = valid_trigger ? trigger.top + trigger.height / 2 - y : 0
    placement.value = {
      left: `${x * scale}rpx`,
      top: `${y * scale}rpx`,
      maxHeight: `${(max_bottom - min_top - 8 / scale) * scale}rpx`,
      transformOrigin: `${origin_x * scale}rpx ${origin_y * scale}rpx`,
    }
    nextTick(() => reveal(current))
  }).exec()
}
watch(() => [props.userId, props.anchor], () => {
  const current = ++token; cancel_pending()
  if (props.userId && props.anchor) {
    retained_id.value = props.userId; rendered.value = true; showing.value = false
    // SelectorQuery returns the transformed bounding box. Measure at natural
    // size while invisible so the .94 starting scale cannot shift the layout.
    placement.value = { transform: 'none' }
    measure(current)
  } else {
    showing.value = false
    if (rendered.value) timer = setTimeout(() => { if (current === token) release() }, MOTION.popover)
  }
}, { immediate: true })
const visibility_changed = () => { if (document.visibilityState === 'hidden') interrupt() }
onMounted(() => {
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility_changed)
  if (typeof window !== 'undefined') window.addEventListener('resize', interrupt)
})
onHide(interrupt)
onUnmounted(() => {
  token++; cancel_pending(); release()
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility_changed)
  if (typeof window !== 'undefined') window.removeEventListener('resize', interrupt)
})
</script>
<template>
  <view v-show="rendered" class="goals-layer" :style="{ '--popover-duration': `${MOTION.popover}ms` }">
    <view class="goals-mask" data-interaction="home.closeGoalPop.click.1" @click="emit('close')" @touchmove="emit('close')" />
    <view class="goals-panel" :class="{ 'goals-panel--open': showing }" :style="placement" role="dialog" aria-label="Connection goals" :data-interaction="panel_interaction" @click.stop>
      <scroll-view class="goals-scroll" scroll-y :show-scrollbar="false">
        <view v-for="goal in goals" :key="goal.item_id" class="goal-row"><text class="goal-emoji">{{ goal.emoji }}</text><text class="goal-label">{{ goal.label }}</text></view>
        <text v-if="!goals.length" class="goals-empty">No connection goals yet.</text>
      </scroll-view>
    </view>
  </view>
</template>
<style scoped>
.goals-layer { position: fixed; inset: 0; z-index: 40; }
.goals-mask { position: absolute; inset: 0; background: var(--cimoa-surface-transparent); }
.goals-panel {
  position: absolute;
  width: 442.748rpx;
  max-width: calc(100% - 30.534rpx);
  padding: 19.084rpx 15.267rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-popover);
  opacity: 0;
  transform: translateY(7.634rpx) scale(0.94);
  transition: opacity var(--popover-duration) ease, transform var(--popover-duration) ease;
  overflow: hidden;
  display: flex;
}
.goals-panel--open { opacity: 1; transform: translateY(0) scale(1); }
.goals-scroll { min-height: 0; max-height: inherit; }
.goal-row { display: flex; align-items: flex-start; gap: 19.084rpx; padding: 20.992rpx 22.901rpx; }
.goal-emoji { font-size: 40.076rpx; line-height: 1.2; flex: none; }
.goal-label { font-size: 32.443rpx; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; text-wrap: pretty; }
.goals-empty { display: block; padding: 20.992rpx 22.901rpx; color: var(--cimoa-text-secondary); font-size: 32.443rpx; }
@media (prefers-reduced-motion: reduce) {
  .goals-panel, .goals-panel--open { transform: none; transition-property: opacity; }
}
</style>
