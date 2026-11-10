import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { MOTION } from '@/config/navigation.js'
import { avatar_relay, clear_avatar_relay, land_chat_avatar_relay, prepare_avatar_relay_return } from '@/utils/avatarRelay.js'

// A missing/late media decode is only a visual fallback. It never blocks a route
// or changes a conversation; cRise and the actual UserAvatar remain untouched.
export function use_avatar_relay({ element, identity, available }) {
  let active = true, entered_at = Date.now(), timer = null, observer = null, observed = null, generation = 0
  const node = () => element.value?.$el || element.value
  const cleanup = () => {
    generation++; clearTimeout(timer); timer = null
    observer?.disconnect(); observer = null
    observed?.removeEventListener('load', attempt, true); observed = null
  }
  const input = () => ({ ...identity(), element: node(), entered_at })
  const attempt = () => {
    if (!active || !available() || !avatar_relay.pending || Date.now() - entered_at >= MOTION.avatar_relay) { cleanup(); return }
    if (land_chat_avatar_relay(input())) cleanup()
  }
  const observe = async () => {
    cleanup()
    const token = generation
    await nextTick()
    if (token !== generation || !active || !available() || !avatar_relay.pending) return
    observed = node()
    if (!observed) return
    observed.addEventListener('load', attempt, true)
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(attempt)
      observer.observe(observed, { childList: true, attributes: true, subtree: true })
    }
    timer = setTimeout(cleanup, Math.max(0, MOTION.avatar_relay - (Date.now() - entered_at)))
    attempt()
  }
  const prepare_back = () => available() && prepare_avatar_relay_return(input())
  watch(() => [identity().user_id, identity().conversation_id, identity().auth_context, identity().avatar_src, available()], observe, { flush: 'post' })
  watch(available, (value, previous) => { if (active && previous && !value) clear_avatar_relay() }, { flush: 'sync' })
  onShow(() => { active = true; entered_at = Date.now(); void observe() })
  onMounted(observe)
  onHide(() => { prepare_back(); active = false; cleanup() })
  onUnmounted(() => { active = false; cleanup() })
  return { prepare_back, cancel: clear_avatar_relay }
}
