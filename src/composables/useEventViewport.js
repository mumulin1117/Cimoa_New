import { ref, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
// WKWebView's keyboard changes the visual viewport, not necessarily 100vh.
// Only the chat frame consumes this measured, responsive height.
export function use_event_viewport() {
  const height = ref('100vh')
  const update = () => {
    if (typeof window === 'undefined') return
    const viewport = window.visualViewport
    const measured = viewport && Math.abs(viewport.scale - 1) < 0.01 ? viewport.height : window.innerHeight
    if (measured > 0 && window.innerWidth > 0) height.value = `${measured * 750 / window.innerWidth}rpx`
  }
  const detach = () => { if (typeof window !== 'undefined') { window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update) } }
  onShow(() => { detach(); if (typeof window !== 'undefined') { window.addEventListener('resize', update); window.visualViewport?.addEventListener('resize', update) } update() })
  onHide(detach); onUnmounted(detach)
  return height
}
