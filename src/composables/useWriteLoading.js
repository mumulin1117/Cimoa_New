import { onUnmounted, ref } from 'vue'
import { create_write_operation } from '../utils/writeOperation.js'

export const use_write_loading = () => {
  const is_loading = ref(false)
  const operation = create_write_operation({ set_loading: (value) => { is_loading.value = value } })
  onUnmounted(operation.cancel)
  return { is_loading, run_with_loading: operation.run, cancel_loading: operation.cancel }
}
