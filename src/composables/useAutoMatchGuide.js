import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from './useWriteLoading.js'

// A walkthrough never calls a matching or preference action. It can only
// navigate to the existing entry and finish its own account-scoped receipt.
export function use_auto_match_guide(page, { ready, open_entry, return_home, available = () => true }) {
  const store = use_app_store(), visible = ref(false), foreground = ref(globalThis.document?.visibilityState !== 'hidden')
  const navigating = ref(false), error = ref('')
  const presented = ref(false)
  const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
  const busy = computed(() => navigating.value || is_loading.value)
  const step = computed(() => store.auto_match_guide.step)
  const allowed = () => visible.value && foreground.value && ready.value && available() && store.auto_match_guide.eligible
  const open = computed(() => allowed() && presented.value && store.auto_match_guide.started && (page === 'home' ? step.value === 0 : step.value > 0))
  let generation = 0, disposed = false
  const prepare = async () => {
    const token = ++generation
    if (disposed || !allowed() || busy.value || presented.value) return
    await nextTick()
    if (disposed || token !== generation || !allowed() || busy.value) return
    // Wait for the existing page's real animation, not another fixed delay.
    // PageTransition's presented event also covers native startup handoff and
    // may arrive before cRise's final painted frame in a normal browser.
    const element = globalThis.document?.querySelector(page === 'home' ? '.main-tab-frame .page-transition' : '.auto-match-index .page-transition')
    const animations = (element?.getAnimations?.() || []).filter(animation => animation.playState === 'running' && animation.animationName === 'page-rise')
    await Promise.allSettled(animations.map(animation => animation.finished))
    if (disposed || token !== generation || !allowed() || busy.value) return
    presented.value = true
    if (page !== 'home') return
    store.begin_auto_match_guide(store.auth_context)
    // Browser/system back can return without a teaching Back click. Keep the
    // real route authoritative rather than forcing a forward navigation.
    while (store.auto_match_guide.step > 0) store.move_auto_match_guide(store.auto_match_guide.step - 1, store.auth_context)
  }
  watch(() => [ready.value, store.auth_context, store.auto_match_guide.eligible, visible.value, foreground.value, available(), busy.value], prepare, { immediate: true })
  const navigate = async (target_step, callback) => {
    if (busy.value || !open.value) return
    const context = store.auth_context, previous = step.value
    error.value = ''; navigating.value = true
    if (!store.move_auto_match_guide(target_step, context).success) { navigating.value = false; return }
    try {
      if (!callback || await callback() === false) throw new Error('Navigation unavailable')
    } catch {
      if (context === store.auth_context && store.auto_match_guide.started) store.move_auto_match_guide(previous, context)
      if (visible.value && foreground.value) error.value = 'Couldn’t open this step. Please try again.'
    } finally { navigating.value = false }
  }
  const finish = async outcome => {
    if (busy.value || !open.value) return
    const context = store.auth_context
    error.value = ''
    const result = await run_with_loading(scope => store.finish_auto_match_guide(outcome, context, scope))
    if (disposed || !visible.value || !foreground.value || context !== store.auth_context || result.reason === 'cancelled') return
    if (!result.success) error.value = result.message || 'Couldn’t finish the guide. Please try again.'
  }
  const next = () => {
    if (busy.value || !open.value) return
    if (step.value === 0) return navigate(1, open_entry)
    if (step.value === 3) return finish('completed')
    error.value = ''; store.move_auto_match_guide(step.value + 1, store.auth_context)
  }
  const back = () => {
    if (busy.value || !open.value || step.value === 0) return
    if (step.value === 1) return navigate(0, return_home)
    error.value = ''; store.move_auto_match_guide(step.value - 1, store.auth_context)
  }
  const interrupt = () => { generation++; presented.value = false; cancel_loading(); navigating.value = false; error.value = '' }
  const visibility_changed = () => { foreground.value = document.visibilityState !== 'hidden'; if (!foreground.value) interrupt(); else prepare() }
  const page_hidden = () => { foreground.value = false; interrupt() }
  const page_shown = () => { foreground.value = true; prepare() }
  globalThis.document?.addEventListener?.('visibilitychange', visibility_changed)
  globalThis.window?.addEventListener?.('pagehide', page_hidden)
  globalThis.window?.addEventListener?.('pageshow', page_shown)
  watch(() => store.auth_context, interrupt, { flush: 'sync' })
  watch(() => store.auto_match_guide.eligible, eligible => { if (!eligible && !store.auto_match_guide.receipt) interrupt() }, { flush: 'sync' })
  onShow(() => { visible.value = true; foreground.value = globalThis.document?.visibilityState !== 'hidden'; prepare() })
  onHide(() => { visible.value = false; interrupt() })
  onUnmounted(() => {
    disposed = true; visible.value = false; interrupt()
    globalThis.document?.removeEventListener?.('visibilitychange', visibility_changed)
    globalThis.window?.removeEventListener?.('pagehide', page_hidden)
    globalThis.window?.removeEventListener?.('pageshow', page_shown)
  })
  return { open, step, busy, error, is_loading, next, back, skip: () => finish('skipped') }
}
