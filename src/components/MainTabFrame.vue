<script setup>
import { ref, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_main_tab_skeleton } from '@/composables/useMainTabSkeleton.js'
import { route_depth } from '@/utils/routeTransition.js'
import TopSafeArea from './TopSafeArea.vue'
import CustomTabBar from './CustomTabBar.vue'
import PageTransition from './PageTransition.vue'
import MainTabSkeleton from './MainTabSkeleton.vue'

const props = defineProps({ route: { type: String, required: true } })
defineEmits(['scroll'])
const store = use_app_store(), transition = ref(null)
const skeleton = use_main_tab_skeleton(props.route)
const depth = ref(route_depth())
let clock_timer
const stop_clock = () => { clearInterval(clock_timer); clock_timer = null }
onShow(() => { depth.value = route_depth(); stop_clock(); store.tick(); clock_timer = setInterval(() => store.tick(), 1000) })
onHide(stop_clock)
onUnmounted(stop_clock)
defineExpose({ navigate_forward: (url) => transition.value.navigate_forward(url) })
</script>

<template>
  <view class="main-tab-frame" :data-page-depth="depth">
    <TopSafeArea />
    <PageTransition ref="transition" :home="route === 'pages/home/index'">
      <view class="main-tab-header"><slot name="header" /></view>
      <scroll-view class="main-tab-scroll" scroll-y :show-scrollbar="false" @scroll="$emit('scroll')">
        <MainTabSkeleton v-if="skeleton" />
        <slot v-else />
      </scroll-view>
    </PageTransition>
    <CustomTabBar />
    <slot name="overlays" />
  </view>
</template>

<style scoped>
.main-tab-frame {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  color: var(--cimoa-text-title);
  background: var(--cimoa-page-gradient);
}
.main-tab-header { flex: none; }
.main-tab-scroll { flex: 1; min-height: 0; height: 0; touch-action: pan-y; }
</style>
