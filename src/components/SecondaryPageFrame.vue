<script setup>
import { Teleport, getCurrentInstance, ref, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { route_depth } from '@/utils/routeTransition.js'
import PageTransition from './PageTransition.vue'
import TopSafeArea from './TopSafeArea.vue'
import BottomSafeArea from './BottomSafeArea.vue'
import { use_stack_surface } from '@/composables/useStackSurface.js'
import { frame_scope_attributes } from '@/utils/frameScope.js'

defineOptions({ inheritAttrs: false })
defineProps({ duration: { type: Number, default: null }, scrollLocked: Boolean, scrollIntoView: String, overlayHeader: Boolean, reducedFade: Boolean, contentMotion: Boolean, surfaceMotion: Boolean })
const emit = defineEmits(['scroll', 'resize', 'presented', 'revealing'])
const store = use_app_store(), transition = ref(null), scroll_element = ref(null), root = ref(null), depth = ref(route_depth()), instance = getCurrentInstance()
const stack = use_stack_surface({ element: () => root.value?.$el || root.value })
const frame_scopes = frame_scope_attributes(instance)
let timer
let resize_observer
onMounted(() => {
  const element = scroll_element.value?.$el || scroll_element.value
  if (typeof ResizeObserver !== 'undefined' && element) {
    resize_observer = new ResizeObserver(() => emit('resize'))
    resize_observer.observe(element)
  }
})
const stop_clock = () => { clearInterval(timer); timer = null }
onShow(() => { depth.value = route_depth(); stop_clock(); store.tick(); timer = setInterval(() => store.tick(), 1000) })
onHide(stop_clock)
onUnmounted(() => { stop_clock(); resize_observer?.disconnect() })
defineExpose({
  get $el() { return root.value?.$el || root.value },
  measure_scroll: () => new Promise(resolve => uni.createSelectorQuery().in(instance.proxy).select('.secondary-page-scroll').fields({ size: true, scrollOffset: true }, resolve).exec()),
  navigate_forward: url => transition.value.navigate_forward(url, dispatch => stack.forward(url, dispatch)),
  navigate_replace: url => transition.value.navigate_replace(url),
  navigate_relaunch: url => transition.value.navigate_relaunch(url),
  navigate_back: (fallback = '/pages/home/index') => route_depth() > 1 ? transition.value.navigate_back_with(dispatch => stack.back(dispatch)) : transition.value.navigate_replace(fallback),
  navigate_back_with: (present, fallback = '/pages/home/index') => route_depth() > 1 ? transition.value.navigate_back_with(present) : transition.value.navigate_replace(fallback),
})
</script>

<template>
  <Teleport :to="stack.destination.value" :disabled="!stack.borrowed.value">
  <view ref="root" v-bind="{ ...$attrs, ...frame_scopes }" class="secondary-page-frame" :class="{ 'secondary-page-frame--overlay-header': overlayHeader }" :style="stack.style.value" :data-page-depth="depth" :data-stack-motion="stack.suppress.value || undefined" :inert="stack.busy.value ? '' : $attrs.inert" :aria-busy="stack.busy.value || $attrs['aria-busy']">
    <TopSafeArea v-if="!overlayHeader" />
    <PageTransition ref="transition" :duration="duration" :reduced-fade="reducedFade" :content-motion="contentMotion && !stack.suppress.value" :surface-motion="surfaceMotion || stack.suppress.value" :native-motion="stack.eligible.value" @presented="emit('presented')" @revealing="emit('revealing')">
      <view class="secondary-page-header"><slot name="header" /></view>
      <scroll-view ref="scroll_element" class="secondary-page-scroll" :scroll-y="!scrollLocked" :scroll-into-view="scrollIntoView" :show-scrollbar="false" @scroll="$emit('scroll', $event)"><slot /></scroll-view>
      <slot name="footer" />
    </PageTransition>
    <BottomSafeArea />
    <slot name="overlays" />
  </view>
  </Teleport>
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
.secondary-page-frame--overlay-header { position: relative; }
.secondary-page-frame--overlay-header .secondary-page-header {
  position: absolute;
  z-index: 10;
  top: 0;
  right: 0;
  left: 0;
  padding-top: var(--app-safe-top);
  pointer-events: none;
}
.secondary-page-frame--overlay-header .secondary-page-header :deep([role='button']) { pointer-events: auto; }
</style>
