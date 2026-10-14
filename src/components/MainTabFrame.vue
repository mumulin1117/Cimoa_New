<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_main_tab_skeleton } from '@/composables/useMainTabSkeleton.js'
import { route_depth, relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { MOTION } from '@/config/navigation.js'
import TopSafeArea from './TopSafeArea.vue'
import CustomTabBar from './CustomTabBar.vue'
import PageTransition from './PageTransition.vue'
import MainTabSkeleton from './MainTabSkeleton.vue'

const props = defineProps({ route: { type: String, required: true }, headerOwnsSafeArea: Boolean, scrollLocked: Boolean })
defineEmits(['scroll'])
const store = use_app_store(), transition = ref(null)
const skeleton = use_main_tab_skeleton(props.route)
const depth = ref(route_depth())
const setup_required = computed(() => store.hydration_status === 'ready' && (!store.session.account_id || !store.session.current_user_id || store.session.is_authenticated && (store.requires_local_verification || store.onboarding && !store.onboarding.completed)))
const guard_error = ref('')
const continue_setup = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { guard_error.value = cause.message } }
let clock_timer
const stop_clock = () => { clearInterval(clock_timer); clock_timer = null }
onShow(() => { depth.value = route_depth(); stop_clock(); store.tick(); clock_timer = setInterval(() => store.tick(), 1000); if (setup_required.value) continue_setup() })
onHide(stop_clock)
onUnmounted(stop_clock)
defineExpose({ navigate_forward: (url) => transition.value.navigate_forward(url) })
</script>

<template>
  <view class="main-tab-frame" :data-page-depth="depth">
    <TopSafeArea v-if="!headerOwnsSafeArea" />
    <PageTransition ref="transition" :home="route === 'pages/home/index'" :duration="route === 'pages/discover/index' ? MOTION.discover : route === 'pages/events/index' ? MOTION.events : null">
      <view v-if="setup_required" class="main-setup-guard"><text role="alert">{{ guard_error || 'Complete your account setup to continue.' }}</text><view role="button" tabindex="0" @click="continue_setup" @keydown.enter="continue_setup">Continue account setup</view></view>
      <template v-else><view class="main-tab-header"><slot name="header" /></view>
      <scroll-view class="main-tab-scroll" :scroll-y="!scrollLocked" :show-scrollbar="false" @scroll="$emit('scroll')">
        <MainTabSkeleton v-if="skeleton" />
        <slot v-else />
      </scroll-view>
      <slot name="footer" :ready="!skeleton" />
      </template>
    </PageTransition>
    <CustomTabBar v-if="!setup_required" />
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
.main-setup-guard { padding: 45.802rpx; font-size: 32.443rpx; line-height: 1.5; }
.main-setup-guard view { margin-top: 30.534rpx; color: var(--cimoa-text-link); }
.main-tab-scroll { flex: 1; min-height: 0; height: 0; touch-action: pan-y; }
</style>
