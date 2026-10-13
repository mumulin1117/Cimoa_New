const message_handler_name = 'CommonTemplateSafeArea'

export const install_safe_area_bridge = () => {
  if (typeof window === 'undefined') return
  window.CommonTemplateSafeAreaBridge = {
    update({ top = 0, bottom = 0 } = {}) {
      document.documentElement.style.setProperty('--native-safe-area-top', `${Number(top) || 0}px`)
      document.documentElement.style.setProperty('--native-safe-area-bottom', `${Number(bottom) || 0}px`)
    },
  }
}

export const request_safe_area = () => {
  if (typeof window === 'undefined') return
  window.webkit?.messageHandlers?.[message_handler_name]?.postMessage('getSafeAreaInsets')
}
