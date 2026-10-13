import { onUnmounted, ref } from 'vue'

export const use_write_loading = () => {
  const is_loading = ref(false)
  let timer = null
  const run_with_loading = (action, duration = 450) => {
    if (is_loading.value) return Promise.resolve({ success: false, reason: 'busy' })
    is_loading.value = true
    return new Promise((resolve) => {
      timer = setTimeout(async () => {
        try { resolve(await action()) } finally { is_loading.value = false; timer = null }
      }, duration)
    })
  }
  onUnmounted(() => { if (timer) clearTimeout(timer) })
  return { is_loading, run_with_loading }
}
