<script setup>
import { computed, ref, watch, nextTick, getCurrentInstance, onUnmounted } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { MOTION } from '@/config/navigation.js'
const props = defineProps({ userId: { type: String, default: '' }, anchor: { type: Object, default: null } })
const emit = defineEmits(['close'])
const store = use_app_store(), instance = getCurrentInstance()
const rendered = ref(false), showing = ref(false), placement = ref({}), retained_id = ref('')
const goals = computed(() => store.goals_for_user(retained_id.value))
const panel_interaction = computed(() => `home.stopTap.click.${retained_id.value === 'user_liam' ? 2 : retained_id.value === 'user_lina' ? 3 : 1}`)
let timer, token = 0
const measure = async (current) => {
  await nextTick()
  uni.createSelectorQuery().in(instance.proxy).select('.goals-panel').boundingClientRect((rect) => {
    if (current !== token || !props.anchor || !rect) return
    const info = uni.getWindowInfo(), scale = 750 / info.windowWidth
    const { right, bottom, limit_bottom, limit_top } = props.anchor
    const max_bottom = limit_bottom ?? info.windowHeight
    const min_top = Math.max(8 / scale, limit_top || 0)
    const y = Math.max(min_top, Math.min(bottom - 6 * info.windowWidth / 393, max_bottom - rect.height - 8 / scale))
    const x = Math.max(8 / scale, Math.min(right - 12 * info.windowWidth / 393 - rect.width, info.windowWidth - rect.width - 8 / scale))
    placement.value = { left: `${x * scale}rpx`, top: `${y * scale}rpx`, maxHeight: `${(max_bottom - min_top - 8 / scale) * scale}rpx` }
    showing.value = true
  }).exec()
}
watch(() => [props.userId, props.anchor], () => {
  const current = ++token; clearTimeout(timer)
  if (props.userId && props.anchor) {
    retained_id.value = props.userId; rendered.value = true; showing.value = false
    measure(current)
  } else {
    showing.value = false
    timer = setTimeout(() => { rendered.value = false; retained_id.value = '' }, MOTION.popover)
  }
})
onUnmounted(() => { token++; clearTimeout(timer) })
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
  transform: translateY(26.718rpx);
  transition: opacity var(--popover-duration) ease, transform var(--popover-duration) ease;
  overflow: hidden;
  display: flex;
}
.goals-panel--open { opacity: 1; transform: translateY(0); }
.goals-scroll { min-height: 0; max-height: inherit; }
.goal-row { display: flex; align-items: flex-start; gap: 19.084rpx; padding: 20.992rpx 22.901rpx; }
.goal-emoji { font-size: 40.076rpx; line-height: 1.2; flex: none; }
.goal-label { font-size: 32.443rpx; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
.goals-empty { display: block; padding: 20.992rpx 22.901rpx; color: var(--cimoa-text-secondary); font-size: 32.443rpx; }
</style>
