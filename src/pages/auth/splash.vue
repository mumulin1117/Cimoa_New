<script setup>
import { ref, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { MOTION } from '@/config/navigation.js'
import PageTransition from '@/components/PageTransition.vue'
import TopSafeArea from '@/components/TopSafeArea.vue'
import BottomSafeArea from '@/components/BottomSafeArea.vue'
import CimoaBrand from '@/components/CimoaBrand.vue'
const store = use_app_store(), transition = ref(null), error = ref('')
let timer, pending = false, active = false
const stop = () => { clearTimeout(timer); timer = null }
const proceed = async () => {
  if (pending || !active) return
  stop(); pending = true; error.value = ''
  try {
    store.tick()
    if (store.hydration_status !== 'ready') store.hydrate()
    const destination = startup_destination(store)
    await transition.value.navigate_replace(store.has_app_consent ? destination : '/pages/auth/welcome')
  } catch (cause) { error.value = cause.message } finally { pending = false }
}
onShow(() => { active = true; stop(); timer = setTimeout(proceed, MOTION.splash) })
onHide(() => { active = false; stop() })
onUnmounted(() => { active = false; stop() })
</script>
<template>
  <view class="splash-page" role="button" tabindex="0" aria-label="Continue to Cimoa" data-interaction="splash.goWelcome.click.1" @click="proceed" @keydown.enter="proceed"><TopSafeArea /><PageTransition ref="transition">
    <view class="splash-content">
      <CimoaBrand splash />
      <view v-if="!error" class="splash-track" aria-hidden="true"><view class="splash-progress" /></view>
      <view v-else class="splash-error" role="alert"><text>{{ error }}</text><text class="splash-retry">Retry</text></view>
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
.splash-progress { width: 122.137rpx; height: 100%; border-radius: 3.817rpx; background: var(--cimoa-gradient-primary); animation: source-pulse 1500ms ease-in-out infinite; }
.splash-error { max-width: 610.687rpx; color: var(--cimoa-status-danger); font-size: 28.626rpx; line-height: 1.45; text-align: center; }
.splash-retry { display: block; margin-top: 22.901rpx; color: var(--cimoa-text-link); font-weight: 600; }
@keyframes source-pulse {
  0%, 100% { transform: scale(.94); opacity: .16; }
  50% { transform: scale(1.04); opacity: .3; }
}
</style>
