import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { send_surface } from '@/utils/sendSurface.js'

const observe = (endpoint, controller) => {
  const state = shallowRef(controller.current)
  const stop = controller.subscribe(value => { state.value = value })
  const unwatch = watch(() => { const value = endpoint.identity(); return controller.identity_keys.map(key => value?.[key]) }, () => controller.identity_changed(endpoint), { flush: 'sync' })
  onUnmounted(() => { stop(); unwatch() })
  return state
}

export function use_send_surface_source({ identity, element, anchor, controller = send_surface }) {
  const endpoint = { identity, element, anchor }, state = observe(endpoint, controller)
  const unregister = controller.register_source(endpoint)
  onUnmounted(unregister)
  onShow(() => controller.route_changed())
  return {
    borrowed: computed(() => state.value.source === endpoint && state.value.source_borrowed),
    busy: computed(() => state.value.source === endpoint && state.value.source_borrowed),
    navigate: (user_id, dispatch) => controller.navigate(endpoint, user_id, dispatch),
    cancel: () => { if (controller.current.source === endpoint) controller.clear('source-cancelled') },
  }
}

export function use_send_surface_target({ identity, element, controller = send_surface }) {
  const endpoint = { identity, element }, state = observe(endpoint, controller), surface_mode = ref(false)
  const own = computed(() => state.value.target === endpoint)
  const style = computed(() => {
    if (!own.value || !state.value.busy || !state.value.geometry) return {}
    const value = state.value, returning = value.direction === 'back'
    if (value.reduced) return { opacity: returning ? 1 : 0, pointerEvents: 'none' }
    if (value.strategy === 'bottom') return { transform: returning ? 'translateY(0)' : 'translateY(100%)', pointerEvents: 'none' }
    return { clipPath: returning ? value.geometry.end_clip : value.geometry.start_clip, WebkitClipPath: returning ? value.geometry.end_clip : value.geometry.start_clip, pointerEvents: 'none' }
  })
  onMounted(() => { if (surface_mode.value) void controller.attach(endpoint) })
  onUnmounted(() => controller.release_target(endpoint))
  return {
    surface_mode,
    borrowed: computed(() => own.value && state.value.target_borrowed),
    busy: computed(() => own.value && state.value.busy),
    style,
    enter: () => { surface_mode.value = controller.enter(endpoint); return surface_mode.value },
    back: dispatch => controller.back(endpoint, dispatch),
  }
}
