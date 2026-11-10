<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { push_route, back_route, relaunch_route, replace_route, notify_route_ready } from '@/utils/routeTransition.js'
import { MOTION, NAVIGATION } from '@/config/navigation.js'
import { create_startup_handoff } from '@/utils/startupHandoff.js'
import { create_auth_keyboard_handoff } from '@/utils/authKeyboard.js'
import { create_page_return } from '@/utils/pageReturn.js'

const props = defineProps({ home: Boolean, duration: { type: Number, default: null }, reducedFade: Boolean, contentMotion: Boolean, surfaceMotion: Boolean, nativeMotion: Boolean })
const emit = defineEmits(['presented', 'revealing'])
const leaving = ref(false), settled = ref(false), element = ref(null)
const keyboard = create_auth_keyboard_handoff({ timeout_ms: NAVIGATION.keyboard_timeout_ms, hide_keyboard: () => uni.hideKeyboard() })
const returning = create_page_return({ navigate: back_route, duration: MOTION.back, on_state: value => { leaving.value = value } })
const startup_handoff = create_startup_handoff({ browser_ready: true, on_reveal: () => emit('revealing') })
const finish_startup_handoff = () => startup_handoff.start(element.value?.$el || element.value, { allow_splash: true })
let presentation = 0
const prepare_startup_handoff = async () => {
  if (!active || disposed) return
  const token = ++presentation
  if (!element.value) return
  notify_route_ready()
  const result = await startup_handoff.start(element.value?.$el || element.value)
  if (token === presentation && !disposed && (result.requested || ['browser', 'complete'].includes(result.reason))) emit('presented')
}
let disposed = false, active = true, navigation_task = null, navigation_generation = 0
const cancel_pending = () => { navigation_generation++; keyboard.cancel(); returning.cancel() }
const visibility_changed = () => {
  if (document.visibilityState === 'hidden') { cancel_pending(); return }
  if (active && !disposed && document.visibilityState !== 'hidden') void prepare_startup_handoff()
}
onMounted(() => {
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility_changed)
  void prepare_startup_handoff()
})
onShow(() => { if (!disposed) { active = true; void prepare_startup_handoff() } })
onHide(() => { active = false; settled.value = true; presentation++; cancel_pending(); startup_handoff.cancel() })
const navigate = (key, action) => {
  if (navigation_task) return navigation_task.key === key ? navigation_task.promise : Promise.resolve(false)
  if (!active || disposed) return Promise.resolve(false)
  const task = { key, generation: navigation_generation }
  // Install the lock before awaiting keyboard closure or a return animation.
  navigation_task = task
  task.promise = (async () => {
    try {
      if (props.contentMotion || props.surfaceMotion || props.nativeMotion) {
        const result = await keyboard.prepare()
        if (!result.ready) {
          if (active && !disposed && task.generation === navigation_generation && ['observation-timeout', 'layout-changed'].includes(result.reason)) throw new Error('This page couldn’t be opened. Please try again.')
          return false
        }
      }
      if (!active || disposed || task.generation !== navigation_generation) return false
      settled.value = true
      return await action()
    } finally { if (navigation_task === task) navigation_task = null }
  })()
  return task.promise
}
const navigate_forward = (url, present) => {
  const generation = navigation_generation
  return navigate(`forward:${url}`, () => {
    const dispatch = () => !active || disposed || generation !== navigation_generation ? Promise.resolve(false) : push_route(url)
    return typeof present === 'function' ? present(dispatch) : dispatch()
  })
}
const navigate_relaunch = url => navigate(`relaunch:${url}`, () => relaunch_route(url))
const navigate_replace = url => navigate(`replace:${url}`, () => replace_route(url))
const navigate_back = (delta = 1) => navigate(`back:${delta}`, () => returning.run(delta))
const navigate_back_with = (present, delta = 1) => {
  if (typeof present !== 'function') return navigate_back(delta)
  const generation = navigation_generation
  return navigate(`back:${delta}`, async () => {
    const dispatch = () => !active || disposed || generation !== navigation_generation ? Promise.resolve(false) : back_route(delta)
    const result = await present(dispatch)
    if (!active || disposed || generation !== navigation_generation) return result === null ? false : result
    return result === null ? returning.run(delta) : result
  })
}
const entrance_finished = event => { if (/^(page-rise|page-fade|auth-content-rise|auth-content-fade)(-|$)/.test(event.animationName || '')) settled.value = true }
const unload = () => { disposed = true; active = false; presentation++; cancel_pending(); startup_handoff.cancel() }
onUnload(unload)
onUnmounted(() => { unload(); keyboard.dispose(); returning.dispose(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility_changed) })
defineExpose({ navigate_forward, navigate_back, navigate_back_with, navigate_relaunch, navigate_replace, finish_startup_handoff })
</script>

<template>
  <view ref="element" class="page-transition" :class="{ 'page-transition--leaving': leaving, 'page-transition--settled': settled, 'page-transition--reduced-fade': reducedFade, 'page-transition--content-motion': contentMotion, 'page-transition--surface-motion': surfaceMotion }" :style="{ '--page-duration': `${duration ?? (home ? MOTION.home : MOTION.page)}ms`, '--back-duration': `${MOTION.back}ms` }" @animationend="entrance_finished"><slot /></view>
</template>

<style scoped>
.page-transition { display: flex; flex: 1; flex-direction: column; min-height: 0; animation: page-rise var(--page-duration) ease both; }
.page-transition--settled { animation: none; }
.page-transition--leaving { animation: page-leave var(--back-duration) ease both; pointer-events: none; }
.page-transition--content-motion { animation: none; }
.page-transition--content-motion:not(.page-transition--settled) :deep(.secondary-page-scroll) { animation: auth-content-rise var(--page-duration) ease both; }
.page-transition--content-motion.page-transition--leaving :deep(.secondary-page-scroll) { animation: page-leave var(--back-duration) ease both; }
.page-transition--surface-motion:not(.page-transition--leaving) { animation: none; }
.page-transition--surface-motion:not(.page-transition--settled):not(.page-transition--leaving) :deep(.secondary-page-scroll) { animation: none; }
@keyframes page-rise {
  from { opacity: 0; transform: translateY(26.718rpx); pointer-events: none; }
  99.99% { pointer-events: none; }
  to { opacity: 1; transform: translateY(0); pointer-events: auto; }
}
@keyframes page-leave {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: .94; transform: translateY(7.634rpx); }
}
@keyframes page-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes auth-content-rise { from { opacity: 0; transform: translateY(15.267rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes auth-content-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes return-fade { from { opacity: 1; } to { opacity: .94; } }
@media (prefers-reduced-motion: reduce) {
  .page-transition:not(.page-transition--settled):not(.page-transition--content-motion):not(.page-transition--surface-motion) { animation-name: page-fade; }
  .page-transition--content-motion:not(.page-transition--settled) :deep(.secondary-page-scroll) { animation-name: auth-content-fade; }
  .page-transition--leaving:not(.page-transition--content-motion), .page-transition--content-motion.page-transition--leaving :deep(.secondary-page-scroll) { animation-name: return-fade; }
}
</style>
