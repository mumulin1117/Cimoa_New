<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { MOTION } from '@/config/navigation.js'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import SourceIcon from './SourceIcon.vue'
const props = defineProps({ title: String, busy: Boolean, backInteraction: { type: String, default: '' } })
const emit = defineEmits(['back', 'error']), frame = ref(null)
const navigation_busy = ref(false), locked = computed(() => props.busy || navigation_busy.value)
const motion_style = { '--auth-press-in': `${MOTION.press_in}ms`, '--auth-press-out': `${MOTION.press_out}ms` }
let pending_navigation = null, active = true, disposed = false
const navigate = (method, target) => {
  if (!active || disposed) return Promise.resolve(false)
  if (pending_navigation) return pending_navigation.method === method && pending_navigation.target === target ? pending_navigation.promise : Promise.resolve(false)
  navigation_busy.value = true
  const task = { method, target }
  task.promise = Promise.resolve().then(() => active && !disposed && pending_navigation === task ? frame.value[method](target) : false).finally(() => {
    if (pending_navigation === task) { pending_navigation = null; navigation_busy.value = false }
  })
  pending_navigation = task
  return task.promise
}
const hide = () => { active = false; pending_navigation = null; navigation_busy.value = false }
onShow(() => { active = true })
onHide(hide)
onUnmounted(() => { disposed = true; hide() })
defineExpose({
  navigate_forward: target => navigate('navigate_forward', target),
  navigate_replace: target => navigate('navigate_replace', target),
  navigate_relaunch: target => navigate('navigate_relaunch', target),
  navigate_back: (fallback = '/pages/auth/welcome') => navigate('navigate_back', fallback),
})
</script>
<template>
  <SecondaryPageFrame ref="frame" class="auth-frame" content-motion :style="motion_style" :aria-busy="locked">
    <template #header>
      <view class="auth-atmosphere" aria-hidden="true"><view class="auth-orb auth-orb--cyan" /><view class="auth-orb auth-orb--pink" /><view class="auth-energy-line" /></view>
      <view class="auth-header"><view class="auth-back" role="button" aria-label="Back" tabindex="0" :aria-disabled="locked" :data-interaction="backInteraction || undefined" @click="!locked && emit('back')" @keydown.enter="!locked && emit('back')"><SourceIcon name="back" /></view><text class="auth-header-title">{{ title }}</text></view>
    </template>
    <view class="auth-content" :inert="navigation_busy ? '' : undefined"><slot /></view>
    <template #footer><view class="auth-footer" :inert="navigation_busy ? '' : undefined"><slot name="footer" /></view></template>
    <template #overlays><slot name="overlays" /></template>
  </SecondaryPageFrame>
</template>
<style scoped>
.auth-frame { position: relative; isolation: isolate; }
.auth-atmosphere { position: absolute; z-index: 0; inset: 0; overflow: hidden; pointer-events: none; }
.auth-orb { position: absolute; width: 412.214rpx; height: 412.214rpx; border-radius: 50%; opacity: .82; filter: blur(3.817rpx); animation: auth-orb-drift 8s ease-in-out infinite alternate; }
.auth-orb--cyan { top: 76.336rpx; right: -213.74rpx; background: var(--cimoa-gradient-auth-ambient-cyan); }
.auth-orb--pink { top: 496.183rpx; left: -248.092rpx; background: var(--cimoa-gradient-auth-ambient-pink); animation-delay: -3s; animation-direction: alternate-reverse; }
.auth-energy-line { position: absolute; top: 202.29rpx; right: 53.435rpx; width: 118.321rpx; height: 7.634rpx; border-radius: 7.634rpx; background: var(--cimoa-gradient-auth-heading-mark); opacity: .4; transform: rotate(-18deg); animation: auth-line-breathe 3.6s ease-in-out infinite; }
.auth-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 30.534rpx; }
.auth-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 43.893rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  transition: transform var(--auth-press-out) ease, box-shadow var(--auth-press-out) ease, color var(--auth-press-out) ease;
}
.auth-back[data-touch-state='pressed'], .auth-back[data-touch-state='held'] { color: var(--cimoa-text-link); box-shadow: var(--cimoa-shadow-auth-back-active); }
.auth-back .source-icon { width: 41.985rpx; height: 41.985rpx; }
.auth-header-title {
  position: absolute;
  inset: 0 110.687rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40.076rpx;
  font-weight: 700;
  letter-spacing: -.025em;
  line-height: 1.15;
  pointer-events: none;
  text-align: center;
}
.auth-content { padding: 0 38.168rpx 38.168rpx; }
.auth-footer { display: flex; flex-direction: column; gap: 11.45rpx; padding: 0 38.168rpx 57.252rpx; }
@keyframes auth-orb-drift { from { transform: translate3d(0,0,0) scale(.94); } to { transform: translate3d(-26.718rpx,34.351rpx,0) scale(1.08); } }
@keyframes auth-line-breathe { 0%,100% { opacity: .24; transform: rotate(-18deg) scaleX(.72); } 50% { opacity: .52; transform: rotate(-18deg) scaleX(1); } }
@media (prefers-reduced-motion: reduce) {
  .auth-orb, .auth-energy-line { animation: none; }
}
</style>
