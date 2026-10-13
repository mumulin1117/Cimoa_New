<script setup>
import { ref, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { route_depth } from '@/utils/routeTransition.js'
import PageTransition from './PageTransition.vue'
import TopSafeArea from './TopSafeArea.vue'
import BottomSafeArea from './BottomSafeArea.vue'

defineProps({ duration: { type: Number, default: null } })
const store = use_app_store(), transition = ref(null), depth = ref(route_depth())
let timer
const stop_clock = () => { clearInterval(timer); timer = null }
onShow(() => { depth.value = route_depth(); stop_clock(); store.tick(); timer = setInterval(() => store.tick(), 1000) })
onHide(stop_clock)
onUnmounted(stop_clock)
defineExpose({
  navigate_forward: url => transition.value.navigate_forward(url),
  navigate_back: (fallback = '/pages/home/index') => route_depth() > 1 ? transition.value.navigate_back() : transition.value.navigate_replace(fallback),
})
</script>

<template>
  <view class="secondary-page-frame" :data-page-depth="depth">
    <TopSafeArea />
    <PageTransition ref="transition" :duration="duration">
      <view class="secondary-page-header"><slot name="header" /></view>
      <scroll-view class="secondary-page-scroll" scroll-y :show-scrollbar="false"><slot /></scroll-view>
      <slot name="footer" />
    </PageTransition>
    <BottomSafeArea />
    <slot name="overlays" />
  </view>
</template>

<style scoped>
.secondary-page-frame {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  color: var(--cimoa-text-title);
  background: var(--cimoa-page-gradient);
}
.secondary-page-header { flex: none; }
.secondary-page-scroll { flex: 1; min-height: 0; height: 0; touch-action: pan-y; }
</style>
