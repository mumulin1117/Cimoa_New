import { computed, nextTick, onBeforeMount, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { STACK_SURFACE_MOTION } from '@/config/navigation.js'
import { is_stack_route, stack_surface } from '@/utils/stackSurface.js'

// Presentation ownership does not use auth_context's mutable registration
// metadata. A real session or a new guest flow still invalidates every link.
export function stack_surface_context(store) {
  const session = store.session || {}, authenticated = session.is_authenticated === true
  return JSON.stringify([session.account_id ?? null, session.current_user_id ?? null, session.expires_at ?? null, authenticated, authenticated ? null : store.auth_draft?.flow_id ?? null])
}

/** Bind one existing frame to the real-page stack presenter, never a copy. */
export function use_stack_surface({ element, identity, controller = stack_surface }) {
  const store = identity ? null : use_app_store()
  const endpoint = { element, identity: identity || (() => ({ auth_context: stack_surface_context(store) })) }
  const state = shallowRef(controller.current)
  const stop = controller.subscribe(value => { state.value = value })
  const unregister = controller.register(endpoint)
  let mounted = false, disposed = false, attaching = null

  const attach = () => {
    if (!mounted || disposed || attaching) return attaching
    attaching = nextTick().then(() => {
      if (disposed) return false
      return controller.attach(endpoint)
    }).finally(() => { attaching = null })
    return attaching
  }
  const enter = () => {
    if (disposed) return false
    const handled = controller.enter(endpoint)
    if (mounted) void attach()
    return handled
  }

  // Parent frame setup runs before PageTransition setup. Consume the pending
  // real target now so neither a cRise nor an untranslated first frame leaks.
  enter()
  onBeforeMount(enter)
  onMounted(() => { mounted = true; void attach() })
  onShow(() => { enter(); controller.route_changed() })
  const unwatch = watch(() => endpoint.identity()?.auth_context, () => controller.identity_changed(endpoint), { flush: 'sync' })
  onUnmounted(() => {
    disposed = true
    mounted = false
    unwatch()
    unregister()
    stop()
  })

  const source = computed(() => state.value.source === endpoint)
  const target = computed(() => state.value.target === endpoint)
  const busy = computed(() => !!state.value.busy && (source.value || target.value))
  return {
    borrowed: computed(() => source.value && state.value.source_borrowed || target.value && state.value.target_borrowed || false),
    destination: computed(() => `#${source.value ? controller.presentation.source_id : controller.presentation.target_id}`),
    // Reading the published state invalidates this computation after link
    // changes; managed() also includes retained incoming links on warm pop.
    suppress: computed(() => { void state.value; return controller.managed(endpoint) }),
    eligible: computed(() => { void state.value; return is_stack_route(controller.page_route(endpoint)) }),
    busy,
    style: computed(() => {
      if (!busy.value) return {}
      const value = state.value, returning = value.direction === 'back'
      if (value.reduced) return { opacity: target.value && !returning ? 0 : 1, pointerEvents: 'none' }
      return { transform: target.value ? `translateX(${returning ? '0' : '100%'})` : `translateX(${returning ? `${-STACK_SURFACE_MOTION.parallax * 100}%` : '0'})`, pointerEvents: 'none' }
    }),
    forward: (url, dispatch) => controller.forward(endpoint, url, dispatch),
    back: dispatch => controller.back(endpoint, dispatch),
  }
}
