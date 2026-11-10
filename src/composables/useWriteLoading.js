import { onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { create_write_operation } from '../utils/writeOperation.js'

export const use_write_loading = () => {
  const is_loading = ref(false)
  const document = globalThis.document, window = globalThis.window
  let shown = true, page_active = true, disposed = false
  const is_active = () => shown && page_active && !disposed && document?.visibilityState !== 'hidden'
  const operation = create_write_operation({ set_loading: (value) => { is_loading.value = value }, is_active })
  const visibility = () => { if (document?.visibilityState === 'hidden') operation.cancel() }
  const page_hide = () => { page_active = false; operation.cancel() }
  const page_show = () => { page_active = true }
  // uni-app scopes these hooks to the current instance: a page's hide does
  // not cancel the App instance's purchase-recovery write controller.
  onHide(() => { shown = false; operation.cancel() })
  onShow(() => { shown = true })
  document?.addEventListener?.('visibilitychange', visibility)
  window?.addEventListener?.('pagehide', page_hide)
  window?.addEventListener?.('pageshow', page_show)
  onUnmounted(() => {
    disposed = true
    operation.cancel()
    document?.removeEventListener?.('visibilitychange', visibility)
    window?.removeEventListener?.('pagehide', page_hide)
    window?.removeEventListener?.('pageshow', page_show)
  })
  return { is_loading, run_with_loading: operation.run, cancel_loading: operation.cancel }
}
