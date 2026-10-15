import { ref, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
// WKWebView's keyboard changes the visual viewport, not necessarily 100vh.
// Pages with a fixed footer consume this measured height so keyboard-safe
// scrolling has one owner and never relies on a hard-coded device size.
export function use_visual_viewport() {
  const height = ref('100vh')
  const keyboard_open = ref(false)
  let baseline = 0, viewport_width = 0
  const update = () => {
    if (typeof window === 'undefined') return
    const viewport = window.visualViewport
    const measured = viewport && Math.abs(viewport.scale - 1) < 0.01 ? viewport.height : window.innerHeight
    if (!(measured > 0 && window.innerWidth > 0)) return
    if (Math.abs(viewport_width - window.innerWidth) > 1) { viewport_width = window.innerWidth; baseline = measured }
    baseline = Math.max(baseline, measured)
    keyboard_open.value = baseline - measured > 120
    height.value = `${measured * 750 / window.innerWidth}rpx`
  }
  const detach = () => { if (typeof window !== 'undefined') { window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update) } }
  onShow(() => { detach(); if (typeof window !== 'undefined') { window.addEventListener('resize', update); window.visualViewport?.addEventListener('resize', update) } update() })
  onHide(detach); onUnmounted(detach)
  return { height, keyboard_open }
}
export const use_event_viewport = () => use_visual_viewport().height
