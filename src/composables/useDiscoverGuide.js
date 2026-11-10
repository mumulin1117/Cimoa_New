import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from './useWriteLoading.js'

// Teaching follows real routes and controls. Only the final account receipt is
// persisted; navigation never sends an introduction or requests permission.
export function use_discover_guide(page, options) {
  const store = use_app_store(), visible = ref(false), foreground = ref(globalThis.document?.visibilityState !== 'hidden')
  const presented = ref(false), navigating = ref(false), error = ref('')
  const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
  const busy = computed(() => navigating.value || is_loading.value)
  const step = computed(() => store.discover_guide.step)
  const target_user_id = computed(() => store.discover_guide.target_user_id)
  const mode = computed(() => options.mode?.() || 'text')
  const owns_step = value => page === 'discover' ? value === 0 || value === 2 : page === 'profile' ? value === 1 : page === 'select' ? value === 3 || value === 4 : value === 5 || value === 6
  const allowed = () => visible.value && foreground.value && options.ready.value && (options.available?.() ?? true) && store.discover_guide.eligible
  const same_target = () => options.user_id?.() === target_user_id.value
  const open = computed(() => allowed() && presented.value && store.discover_guide.started && same_target() && owns_step(step.value))
  const next_disabled = computed(() => page === 'select' && !(options.can_next?.() ?? true))
  let generation = 0, disposed = false, route_synced = false
  const move_to = value => {
    while (store.discover_guide.started && step.value !== value) {
      if (!store.move_discover_guide(step.value + Math.sign(value - step.value), store.auth_context).success) return false
    }
    return store.discover_guide.started
  }
  const prepare = async () => {
    const token = ++generation
    if (disposed || !allowed() || busy.value || presented.value) return
    await nextTick()
    if (disposed || token !== generation || !allowed() || busy.value) return
    if (!route_synced) {
      if (page === 'discover' && !store.discover_guide.started) store.begin_discover_guide(options.user_id?.(), store.auth_context)
      if (!store.discover_guide.started || !same_target()) return
      // Real browser/system Back remains authoritative. Do not push a page just
      // to recover a teaching step or replace the current person.
      const value = step.value
      const target = page === 'discover' ? (value === 0 ? 0 : 2) : page === 'profile' ? 1 : page === 'select' ? (value >= 4 ? 4 : 3) : (value === 6 ? 6 : 5)
      if (!move_to(target)) return
      route_synced = true
    }
    if (!owns_step(step.value) || !same_target()) return
    const element = options.element?.()
    let animations = []
    try {
      animations = (element?.getAnimations?.({ subtree: true }) || []).filter(animation => {
        const timing = animation.effect?.getComputedTiming?.()
        return (animation.playState === 'running' || animation.pending) && Number.isFinite(timing?.endTime) && timing.endTime <= 1200
      })
    } catch { /* Animation introspection is optional, real route readiness is not. */ }
    await Promise.allSettled(animations.map(animation => animation.finished))
    if (disposed || token !== generation || !allowed() || busy.value || !same_target() || !owns_step(step.value)) return
    if (page === 'select') element?.querySelector?.(step.value === 3 ? '.ice-questions' : '.ice-modes')?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
    await nextTick()
    if (!disposed && token === generation && allowed() && !busy.value && same_target() && owns_step(step.value)) presented.value = true
  }
  const navigate = async (target, callback) => {
    if (busy.value || !open.value) return
    const context = store.auth_context, previous = step.value
    error.value = ''; navigating.value = true
    if (!move_to(target)) { navigating.value = false; return }
    try {
      if (!callback || await callback() === false) throw new Error('Navigation unavailable')
    } catch {
      if (visible.value && foreground.value && context === store.auth_context && store.discover_guide.started) move_to(previous)
      if (visible.value && foreground.value) error.value = 'Couldn’t open this step. Please try again.'
    } finally { navigating.value = false }
  }
  const finish = async outcome => {
    if (busy.value || !open.value) return
    const context = store.auth_context
    error.value = ''
    const result = await run_with_loading(scope => store.finish_discover_guide(outcome, context, scope))
    if (disposed || !visible.value || !foreground.value || context !== store.auth_context || result.reason === 'cancelled') return
    if (!result.success) error.value = result.message || 'Couldn’t finish the guide. Please try again.'
  }
  const next = () => {
    if (busy.value || !open.value || next_disabled.value) return
    if (step.value === 0) return navigate(1, options.open_profile)
    if (step.value === 1) return navigate(2, options.return_discover)
    if (step.value === 2) return navigate(3, options.open_intro)
    if (step.value === 4) return navigate(5, options.open_answer)
    if (step.value === 6) return finish('completed')
    error.value = ''; store.move_discover_guide(step.value + 1, store.auth_context)
  }
  const back = () => {
    if (busy.value || !open.value || step.value === 0) return
    if (step.value === 1) return navigate(0, options.return_discover)
    if (step.value === 2) return navigate(1, options.open_profile)
    if (step.value === 3) return navigate(2, options.return_discover)
    if (step.value === 5) return navigate(4, options.return_select)
    error.value = ''; store.move_discover_guide(step.value - 1, store.auth_context)
  }
  const interrupt = () => { generation++; presented.value = false; cancel_loading(); navigating.value = false; error.value = '' }
  watch(() => [options.ready.value, options.available?.() ?? true, visible.value, foreground.value, store.auth_context, store.discover_guide.eligible, store.discover_guide.target_available, busy.value], prepare, { immediate: true, flush: 'post' })
  watch(step, () => { if (page === 'select' && visible.value && !navigating.value) { presented.value = false; prepare() } }, { flush: 'sync' })
  watch(() => store.auth_context, () => { interrupt(); route_synced = false }, { flush: 'sync' })
  const visibility_changed = () => { foreground.value = document.visibilityState !== 'hidden'; if (!foreground.value) interrupt(); else prepare() }
  const page_hidden = () => { foreground.value = false; interrupt() }
  const page_shown = () => { foreground.value = true; prepare() }
  globalThis.document?.addEventListener?.('visibilitychange', visibility_changed)
  globalThis.window?.addEventListener?.('pagehide', page_hidden)
  globalThis.window?.addEventListener?.('pageshow', page_shown)
  onShow(() => { route_synced = false; visible.value = true; foreground.value = globalThis.document?.visibilityState !== 'hidden'; prepare() })
  onHide(() => { visible.value = false; interrupt() })
  onUnmounted(() => {
    disposed = true; visible.value = false; interrupt()
    globalThis.document?.removeEventListener?.('visibilitychange', visibility_changed)
    globalThis.window?.removeEventListener?.('pagehide', page_hidden)
    globalThis.window?.removeEventListener?.('pageshow', page_shown)
  })
  return { open, step, busy, error, is_loading, next_disabled, next, back, skip: () => finish('skipped'), target_user_id, mode }
}
