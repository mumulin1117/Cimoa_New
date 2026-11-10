import { onUnmounted, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { MOTION } from '@/config/navigation.js'
import { arm_icebreaker_motion, consume_icebreaker_motion, clear_icebreaker_motion } from '@/utils/icebreakerMotion.js'

export function use_icebreaker_motion({ auth_context, user_id, question_id = () => '', kind }) {
  const cue = ref(false)
  const style = { '--ice-continuity-duration': `${MOTION.page}ms`, '--ice-press-in': `${MOTION.press_in}ms`, '--ice-press-out': `${MOTION.press_out}ms` }
  const identity = target_kind => ({ auth_context: auth_context(), user_id: user_id(), question_id: question_id(), target_kind })
  const enter = () => { const eligible = consume_icebreaker_motion(identity(kind)); cue.value = globalThis.document?.visibilityState !== 'hidden' && eligible }
  const finish = () => { cue.value = false }
  const visibility_changed = () => { if (globalThis.document?.visibilityState === 'hidden') finish() }
  globalThis.document?.addEventListener?.('visibilitychange', visibility_changed)
  globalThis.document?.addEventListener?.('pointercancel', finish, true)
  globalThis.document?.addEventListener?.('lostpointercapture', finish, true)
  globalThis.window?.addEventListener?.('pagehide', finish)
  watch(auth_context, finish, { flush: 'sync' })
  onHide(finish)
  onUnmounted(() => {
    finish()
    globalThis.document?.removeEventListener?.('visibilitychange', visibility_changed)
    globalThis.document?.removeEventListener?.('pointercancel', finish, true)
    globalThis.document?.removeEventListener?.('lostpointercapture', finish, true)
    globalThis.window?.removeEventListener?.('pagehide', finish)
  })
  return { cue, style, enter, finish, arm: target_kind => arm_icebreaker_motion(identity(target_kind)), cancel: clear_icebreaker_motion }
}
