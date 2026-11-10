<script setup>
import { Teleport, computed, getCurrentInstance, nextTick, ref, watch, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_main_tab_skeleton } from '@/composables/useMainTabSkeleton.js'
import { route_depth, relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { MOTION } from '@/config/navigation.js'
import { bind_card_pointer_events, create_pointer_gesture } from '@/utils/discoverSwipe.js'
import TopSafeArea from './TopSafeArea.vue'
import CustomTabBar from './CustomTabBar.vue'
import PageTransition from './PageTransition.vue'
import MainTabSkeleton from './MainTabSkeleton.vue'
import BrandRefresh from './BrandRefresh.vue'
import { use_stack_surface } from '@/composables/useStackSurface.js'
import { frame_scope_attributes } from '@/utils/frameScope.js'

defineOptions({ inheritAttrs: false })
const props = defineProps({ route: { type: String, required: true }, headerOwnsSafeArea: Boolean, scrollLocked: Boolean, eagerContent: Boolean, pullToRefresh: Boolean, refreshing: Boolean, refreshEnabled: { type: Boolean, default: true } })
const emit = defineEmits(['scroll', 'refresh', 'content-loading'])
const store = use_app_store(), transition = ref(null), scroll_region = ref(null), root = ref(null), instance = getCurrentInstance()
const stack = use_stack_surface({ element: () => root.value?.$el || root.value })
const frame_scopes = frame_scope_attributes(instance)
const skeleton = use_main_tab_skeleton(props.route)
watch(skeleton, value => emit('content-loading', value), { immediate: true, flush: 'sync' })
const pull_progress = ref(0)
const refresher_triggered = ref(props.refreshing)
watch(() => props.refreshing, value => { refresher_triggered.value = value; if (!value) refresh_emitted = false }, { flush: 'sync' })
const refresh_threshold = uni.upx2px(122.137)
const can_refresh = computed(() => props.pullToRefresh && props.refreshEnabled && !props.scrollLocked && !skeleton.value)
let pull_generation = 0
let cancel_generation = 0, restoring_cancel = false, refresh_cancelled = false, refresh_emitted = false
const reset_pull = () => { pull_generation++; pull_progress.value = 0 }
const stop_pull = () => { cancel_generation++; restoring_cancel = false; refresh_cancelled = true; refresh_emitted = false; refresher_triggered.value = false; reset_pull() }
const cancel_pull = async () => {
  refresh_cancelled = true
  reset_pull()
  if (props.refreshing || !can_refresh.value) return
  const token = ++cancel_generation
  restoring_cancel = true
  // uni H5 has no touchcancel restore handler. Exercise its public controlled
  // trigger, then restore it; the guard prevents any business refresh emission.
  refresher_triggered.value = true
  await nextTick()
  if (token !== cancel_generation) return
  refresher_triggered.value = false
  await nextTick()
  if (token === cancel_generation) restoring_cancel = false
}
const pulling = async () => {
  if (restoring_cancel || refresh_cancelled) return
  const token = ++pull_generation
  emit('scroll')
  await nextTick()
  if (token !== pull_generation || restoring_cancel || !can_refresh.value || props.refreshing) return
  // H5's event dy starts before the actual refresher height. Measure the rendered
  // pull area so “Release” agrees with the scroll-view's real refresh threshold.
  uni.createSelectorQuery().in(instance.proxy).select('.uni-scroll-view-refresher').boundingClientRect(rect => {
    if (token !== pull_generation || restoring_cancel || !can_refresh.value || props.refreshing) return
    pull_progress.value = Math.max(0, Math.min(1, (rect?.height || 0) / refresh_threshold))
  }).exec()
}
const refresh = () => {
  if (restoring_cancel || refresh_cancelled || refresh_emitted || !can_refresh.value || props.refreshing) return
  refresh_emitted = true; pull_generation++; pull_progress.value = 1; refresher_triggered.value = true; emit('refresh')
  // A parent can reject a refresh before entering its busy state. Re-arm only
  // after its prop update has had a chance to render, never in this input turn.
  nextTick(() => { if (!props.refreshing) { refresh_emitted = false; refresher_triggered.value = false; reset_pull() } })
}
let unbind_pull
const pull_gesture = create_pointer_gesture({
  element: () => scroll_region.value?.$el || scroll_region.value,
  can_start: () => can_refresh.value && !props.refreshing && !refresh_emitted,
  capture: false,
  prevent_move: false,
  start: () => { refresh_cancelled = false; refresh_emitted = false },
  cancel: cancel_pull,
})
watch(scroll_region, () => {
  pull_gesture.cancel(); unbind_pull?.()
  unbind_pull = bind_card_pointer_events(scroll_region.value?.$el || scroll_region.value, { ...pull_gesture, suspend: stop_pull })
}, { flush: 'post' })
watch(can_refresh, enabled => { if (!enabled) { pull_gesture.cancel(); stop_pull() } })
const depth = ref(route_depth())
const setup_required = computed(() => store.hydration_status === 'ready' && (!store.session.is_authenticated || store.requires_local_verification || store.onboarding && !store.onboarding.completed))
const guard_error = ref('')
let visible = false, redirecting = false
const continue_setup = async () => {
  if (!visible || redirecting) return
  redirecting = true; guard_error.value = ''
  try { await relaunch_route(startup_destination(store)) } catch (cause) { guard_error.value = cause.message } finally { redirecting = false }
}
watch(setup_required, value => { if (value) continue_setup() })
let clock_timer
const stop_clock = () => { clearInterval(clock_timer); clock_timer = null }
onShow(() => { visible = true; depth.value = route_depth(); stop_clock(); store.tick(); clock_timer = setInterval(() => store.tick(), 1000); if (setup_required.value) continue_setup() })
onHide(() => { visible = false; stop_clock() })
onUnmounted(stop_clock)
onHide(() => { pull_gesture.cancel(); stop_pull() })
onUnmounted(() => { pull_gesture.cancel(); unbind_pull?.(); stop_pull() })
defineExpose({ get $el() { return root.value?.$el || root.value }, navigate_forward: url => transition.value.navigate_forward(url, dispatch => stack.forward(url, dispatch)) })
</script>

<template>
  <Teleport :to="stack.destination.value" :disabled="!stack.borrowed.value">
  <view ref="root" v-bind="{ ...$attrs, ...frame_scopes }" class="main-tab-frame" :style="stack.style.value" :data-page-depth="depth" :inert="stack.busy.value ? '' : $attrs.inert" :aria-busy="stack.busy.value || $attrs['aria-busy']">
    <TopSafeArea v-if="!headerOwnsSafeArea" />
    <PageTransition ref="transition" :home="route === 'pages/home/index'" :duration="route === 'pages/discover/index' ? MOTION.discover : route === 'pages/events/index' ? MOTION.events : null">
      <view v-if="setup_required" class="main-setup-guard"><text role="alert">{{ guard_error || (store.session.is_authenticated ? 'Complete your account setup to continue.' : 'Please sign in to continue.') }}</text><view role="button" tabindex="0" @click="continue_setup" @keydown.enter="continue_setup">{{ store.session.is_authenticated ? 'Continue account setup' : 'Sign in' }}</view></view>
      <template v-else><view class="main-tab-header"><slot name="header" /></view>
      <scroll-view ref="scroll_region" class="main-tab-scroll" :data-interaction="pullToRefresh ? 'home.refresh.pull.1' : undefined" :scroll-y="!scrollLocked" :show-scrollbar="false" :refresher-enabled="can_refresh" :refresher-triggered="refresher_triggered" :refresher-threshold="refresh_threshold" refresher-default-style="none" refresher-background="var(--cimoa-surface-transparent)" @refresherpulling="pulling" @refresherrefresh="refresh" @refresherrestore="reset_pull" @refresherabort="reset_pull" @touchcancel="cancel_pull" @scroll="$emit('scroll')">
        <template v-if="pullToRefresh" #refresher><BrandRefresh :refreshing="refreshing" :progress="pull_progress" /></template>
        <MainTabSkeleton v-if="skeleton && !eagerContent" :route="route" />
        <slot v-else :ready="!skeleton" />
      </scroll-view>
      <slot name="footer" :ready="!skeleton" />
      </template>
    </PageTransition>
    <CustomTabBar v-if="!setup_required" />
    <slot name="overlays" />
  </view>
  </Teleport>
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
