const message_handler_name = 'CommonTemplateSafeArea'

export const install_safe_area_bridge = () => {
  if (typeof window === 'undefined') return
  window.CommonTemplateSafeAreaBridge = {
    update({ top = 0, bottom = 0 } = {}) {
      const inset = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
      document.documentElement.style.setProperty('--native-safe-area-top', `${inset(top)}px`)
      document.documentElement.style.setProperty('--native-safe-area-bottom', `${inset(bottom)}px`)
    },
  }
}

export const request_safe_area = () => {
  if (typeof window === 'undefined') return
  try { window.webkit?.messageHandlers?.[message_handler_name]?.postMessage('getSafeAreaInsets') } catch { /* Browser without a native host keeps measured env insets. */ }
}
