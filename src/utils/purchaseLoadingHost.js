import { h, render, watch } from 'vue'
import CoinActionLoading from '@/components/CoinActionLoading.vue'

// uni-app's App.vue has no rendered page template. Keep the single recovery
// indicator outside transformed pages, using the existing brand component.
export function install_purchase_loading_host(visible) {
  if (typeof document === 'undefined') return () => {}
  const root = document.createElement('div')
  root.id = 'cimoa-purchase-recovery-root'
  document.body.appendChild(root)
  const stop = watch(visible, value => render(h(CoinActionLoading, { visible: value, label: 'Confirming your purchase…' }), root), { immediate: true })
  return () => { stop(); render(null, root); root.remove() }
}
