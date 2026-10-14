export const open_app_settings = async () => {
  if (!globalThis.window?.webkit?.messageHandlers?.CimoaHost) throw new Error('Native Settings are unavailable in this browser. Manage app permissions in your browser or device settings, then retry.')
  const result = await window.CimoaNativeBridge.request('openSettings')
  if (result.opened !== true) throw new Error('Settings could not be opened. Please open the device Settings app manually.')
  return result
}
const permission_status = result => {
  if (!['granted', 'denied', 'not_requested', 'unavailable'].includes(result)) throw new Error('The system returned an unknown notification permission. Please retry.')
  return result
}
export const notification_permission = async (request = false, env = globalThis) => {
  if (env.window?.webkit?.messageHandlers?.CimoaHost) {
    const result = await env.window.CimoaNativeBridge.request(request ? 'requestNotifications' : 'getNotificationPermission')
    return permission_status(result.status)
  }
  if (!env.isSecureContext || !env.Notification) return 'unavailable'
  const value = request ? await env.Notification.requestPermission() : env.Notification.permission
  return permission_status(value === 'default' ? 'not_requested' : value)
}
