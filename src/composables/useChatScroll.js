import { nextTick, onUnmounted, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { chat_near_bottom } from '@/utils/chatScroll.js'

export function use_chat_scroll({ frame, last_id, target_id, available, viewport_height }) {
  const scroll_target = ref('')
  let pinned = true, generation = 0, measurement = 0, disposed = false
  const cancel = () => { generation++; measurement++ }
  const on_scroll = async () => {
    const current = ++measurement
    const metrics = await frame.value?.measure_scroll()
    if (disposed || current !== measurement || !available()) return
    const next = chat_near_bottom(metrics, uni.upx2px(122.137))
    if (next !== null) { pinned = next; if (!pinned) generation++ }
  }
  const follow_last = async (force = false) => {
    if (!available() || (force !== true && !pinned)) return
    if (force === true) { pinned = true; measurement++ }
    const current = ++generation
    scroll_target.value = ''
    await nextTick()
    if (!disposed && current === generation && available() && pinned) scroll_target.value = target_id() || ''
  }
  watch(last_id, () => follow_last(), { immediate: true })
  watch(viewport_height, () => follow_last())
  onHide(cancel)
  onUnmounted(() => { disposed = true; cancel() })
  return { scroll_target, on_scroll, follow_last }
}
