<script setup>
import { ref, onUnmounted } from 'vue'
import { push_route, back_route, relaunch_route } from '@/utils/routeTransition.js'
import { MOTION } from '@/config/navigation.js'

defineProps({ home: Boolean })
const leaving = ref(false)
let timer, settle, disposed = false
const navigate_forward = (url) => push_route(url)
const navigate_relaunch = (url) => relaunch_route(url)
const navigate_back = async (delta = 1) => {
  if (leaving.value) return
  leaving.value = true
  const ready = await new Promise((resolve) => { settle = resolve; timer = setTimeout(() => { settle = null; resolve(true) }, MOTION.back) })
  if (!ready || disposed) return
  try { await back_route(delta) } finally { leaving.value = false }
}
onUnmounted(() => { disposed = true; clearTimeout(timer); settle?.(false); settle = null })
defineExpose({ navigate_forward, navigate_back, navigate_relaunch })
</script>

<template>
  <view class="page-transition" :class="{ 'page-transition--leaving': leaving }" :style="{ '--page-duration': `${home ? MOTION.home : MOTION.page}ms`, '--back-duration': `${MOTION.back}ms` }"><slot /></view>
</template>

<style scoped>
.page-transition { display: flex; flex: 1; flex-direction: column; min-height: 0; animation: page-rise var(--page-duration) ease both; }
.page-transition--leaving { animation: page-leave var(--back-duration) ease both; pointer-events: none; }
@keyframes page-rise {
  from { opacity: 0; transform: translateY(26.718rpx); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes page-leave {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(26.718rpx); }
}
</style>
