import { ref, watch, onUnmounted } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { content_loading } from '@/utils/mainTabSkeleton.js'
import { MOTION } from '@/config/navigation.js'

export function use_entity_skeleton(kind, entity_id, available) {
  const store = use_app_store(), visible = ref(false), active = ref(true)
  let timer
  const cancel = () => { clearTimeout(timer); visible.value = false }
  watch([entity_id, available, active, () => store.session.is_authenticated ? store.auth_context : null], ([id, valid, shown, scope]) => {
    cancel(); content_loading.synchronize(scope)
    if (!shown || !scope || !valid || !id || content_loading.cached(kind, id)) return
    visible.value = true
    const ticket = content_loading.ticket()
    timer = setTimeout(() => {
      content_loading.complete(kind, id, ticket)
      visible.value = false
    }, MOTION.skeleton)
  }, { immediate: true })
  onHide(() => { active.value = false; cancel() })
  onShow(() => { active.value = true })
  onUnmounted(cancel)
  return visible
}
