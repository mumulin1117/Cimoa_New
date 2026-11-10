<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { nextTick, ref, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { MOTION } from '@/config/navigation.js'
import PageTransition from '@/components/PageTransition.vue'
import TopSafeArea from '@/components/TopSafeArea.vue'
import BottomSafeArea from '@/components/BottomSafeArea.vue'
import CimoaBrand from '@/components/CimoaBrand.vue'
import { campus_preload } from '@/utils/startupCampus.js'
const store = use_app_store(), transition = ref(null), error = ref(''), shown = ref(false)
const document_visible = ref(typeof document === 'undefined' || document.visibilityState !== 'hidden')
const visibility_changed = () => { document_visible.value = document.visibilityState !== 'hidden'; if (document_visible.value) campus_preload.start(); else campus_preload.cancel() }
onMounted(() => { if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility_changed) })
let timer, pending = false, active = false
const stop = () => { clearTimeout(timer); timer = null }
const proceed = async () => {
  if (pending || !active) return
  stop(); pending = true; error.value = ''
  try {
    store.tick()
    if (store.hydration_status !== 'ready') store.hydrate()
    const destination = startup_destination(store)
    if (store.has_app_consent && destination !== '/pages/auth/welcome') campus_preload.consume()
    await transition.value.navigate_replace(store.has_app_consent ? destination : '/pages/auth/welcome')
  } catch (cause) {
    error.value = cause.message
    await nextTick()
    if (active) void transition.value?.finish_startup_handoff()
  } finally { pending = false }
}
onShow(() => { active = true; shown.value = true; campus_preload.arm(); campus_preload.start(); stop(); timer = setTimeout(proceed, MOTION.splash) })
onHide(() => { active = false; shown.value = false; stop() })
onUnmounted(() => { active = false; shown.value = false; stop(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility_changed) })
</script>
<template>
  <view class="splash-page" data-startup-phase="gathering" :class="{ 'splash-page--active': shown && document_visible }" :style="{ '--splash-progress-duration': `${MOTION.splash_progress}ms` }" role="button" tabindex="0" aria-label="Continue to Cimoa" data-interaction="splash.goWelcome.click.1" @click="proceed" @keydown.enter="proceed"><TopSafeArea /><PageTransition ref="transition" reduced-fade>
    <view class="splash-content">
      <CimoaBrand splash encounter :active="shown && document_visible" />
      <view v-if="!error" class="splash-track" aria-hidden="true"><view class="splash-progress" /></view>
      <view v-else class="splash-error" role="alert"><text>{{ auth_message(error) }}</text><text class="splash-retry">Retry</text></view>
    </view>
  </PageTransition><BottomSafeArea /></view>
</template>
<style scoped>
.splash-page { display: flex; flex-direction: column; height: 100vh; background: var(--cimoa-page-gradient); color: var(--cimoa-text-title); }
.splash-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 64.885rpx;
}
.splash-track { width: 286.26rpx; height: 7.634rpx; overflow: hidden; border-radius: 3.817rpx; background: var(--cimoa-surface-splash-track); }
.splash-progress {
  width: 122.137rpx;
  height: 100%;
  border-radius: 3.817rpx;
  background: var(--cimoa-gradient-primary);
  transform-origin: left center;
  opacity: 1;
  animation: splash-flow var(--splash-progress-duration) ease-in-out infinite;
  animation-play-state: paused;
}
.splash-page--active .splash-progress { animation-play-state: running; }
.splash-error { max-width: 610.687rpx; color: var(--cimoa-status-danger); font-size: 28.626rpx; line-height: 1.45; text-align: center; }
.splash-retry { display: block; margin-top: 22.901rpx; color: var(--cimoa-text-link); font-weight: 600; }
@keyframes splash-flow {
  0%, 100% { transform: scaleX(.2); }
  50% { transform: scaleX(2.1); }
}
@media (prefers-reduced-motion: reduce) { .splash-progress { animation: none; transform: scaleX(1); } }
</style>
