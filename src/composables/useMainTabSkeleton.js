import { ref, watch, onUnmounted } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { content_loading, consume_main_tab_skeleton } from '@/utils/mainTabSkeleton.js'
import { MOTION } from '@/config/navigation.js'
import { use_app_store } from '@/stores/store.js'

export function use_main_tab_skeleton(route) {
  const store = use_app_store(), visible = ref(false)
  let timer
  const cancel = () => { clearTimeout(timer); visible.value = false }
  watch(() => store.session.is_authenticated ? store.auth_context : null, scope => {
    cancel(); content_loading.synchronize(scope)
    if (!scope || !consume_main_tab_skeleton(route)) return
    visible.value = true
    timer = setTimeout(() => { visible.value = false }, MOTION.skeleton)
  }, { immediate: true })
  onHide(cancel)
  onUnmounted(cancel)
  return visible
}
