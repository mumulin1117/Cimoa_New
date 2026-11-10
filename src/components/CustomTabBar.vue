<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { MAIN_TABS } from '@/config/navigation.js'
import { current_route, switch_tab_route } from '@/utils/routeTransition.js'
import { sample_tab_motion, subscribe_tab_motion } from '@/utils/tabMotion.js'
import SourceIcon from './SourceIcon.vue'

const active = ref(current_route()), busy = ref(false), error = ref('')
const motion = ref(sample_tab_motion(active.value))
let frame, shown = true, disposed = false, reduced, unsubscribe
const stop_frame = () => { if (frame != null) cancelAnimationFrame(frame); frame = null }
const refresh_motion = () => {
  stop_frame()
  if (!shown || disposed) return
  active.value = current_route()
  motion.value = sample_tab_motion(active.value, { reduced: reduced?.matches === true })
  if (motion.value.moving) frame = requestAnimationFrame(refresh_motion)
}
onMounted(() => {
  reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  reduced?.addEventListener?.('change', refresh_motion)
  unsubscribe = subscribe_tab_motion(refresh_motion)
  refresh_motion()
})
onShow(() => { shown = true; refresh_motion() })
onHide(() => { shown = false; stop_frame() })
onUnmounted(() => { disposed = true; stop_frame(); unsubscribe?.(); reduced?.removeEventListener?.('change', refresh_motion) })
const go_tab = async (tab) => {
  if (busy.value || motion.value.busy || current_route() === tab.path) return
  busy.value = true; error.value = ''
  try { await switch_tab_route(`/${tab.path}`) } catch (cause) { error.value = cause.message } finally { busy.value = false; refresh_motion() }
}
</script>

<template>
  <view class="tabbar-area">
    <FeedbackToast v-if="error" :message="error" @dismiss="error = String()" />
    <view class="tabbar" role="navigation" aria-label="Primary navigation">
      <view class="tab__light-track" aria-hidden="true" :data-motion-revision="motion.revision" :style="{ transform: `translateX(${motion.position * 100}%)` }"><view class="tab__light" /></view>
      <view v-for="(tab, index) in MAIN_TABS" :key="tab.id" class="tab" :class="{ active: active === tab.path, 'tab--lit': Math.abs(motion.position - index) < 0.45 }" role="button" tabindex="0" :aria-label="tab.label" :aria-current="active === tab.path ? 'page' : undefined" :aria-disabled="busy || motion.busy" @click="go_tab(tab)" @keydown.enter="go_tab(tab)">
        <view class="tab__circle"><view class="tab__icon" :style="{ transform: `scale(${motion.target === tab.path ? motion.icon_scale : 1})` }"><SourceIcon :name="tab.icon" /></view></view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.tabbar-area { position: relative; z-index: 20; flex: none; height: var(--app-main-tab-bar-height); padding: 22.901rpx 38.168rpx calc(53.435rpx + var(--app-safe-bottom)); }
.tabbar {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: 118.321rpx;
  border-radius: 59.16rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-tab);
}
.tab { position: relative; display: flex; justify-content: center; align-items: center; color: var(--cimoa-text-title); }
.tab__light-track {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(100% / 3);
  height: 100%;
  pointer-events: none;
}
.tab__light { width: 99.237rpx; height: 99.237rpx; border-radius: 50%; background: var(--cimoa-gradient-tab); }
.tab__circle {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 99.237rpx;
  height: 99.237rpx;
  border-radius: 50%;
}
.tab--lit .tab__circle { color: var(--cimoa-text-inverse); }
.tab__icon { width: 49.618rpx; height: 49.618rpx; }
.tabbar-error { position: absolute; bottom: 100%; left: 38.168rpx; right: 38.168rpx; color: var(--cimoa-status-danger); }
</style>
