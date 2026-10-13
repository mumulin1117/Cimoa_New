import { ref, onUnmounted } from 'vue'
import { consume_main_tab_skeleton } from '@/utils/mainTabSkeleton.js'
import { MOTION } from '@/config/navigation.js'

export function use_main_tab_skeleton(route) {
  const visible = ref(consume_main_tab_skeleton(route))
  const timer = visible.value ? setTimeout(() => { visible.value = false }, MOTION.skeleton) : null
  onUnmounted(() => clearTimeout(timer))
  return visible
}
