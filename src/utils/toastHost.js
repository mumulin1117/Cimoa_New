import { h, render } from 'vue'
import BrandToastHost from '@/components/BrandToastHost.vue'

// App.vue has no page template in uni-app H5. Keep a single Vue-rendered host
// outside transformed page/Sheet roots, so fixed positioning uses the viewport.
export function install_toast_host() {
  if (typeof document === 'undefined' || document.getElementById('cimoa-toast-root')) return
  const root = document.createElement('div')
  root.id = 'cimoa-toast-root'
  document.body.appendChild(root)
  render(h(BrandToastHost), root)
}
