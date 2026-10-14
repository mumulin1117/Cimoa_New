export const open_app_settings = async () => {
  if (!globalThis.window?.webkit?.messageHandlers?.CimoaHost) throw new Error('Native Settings are unavailable in this browser. Manage photo permissions in your browser or device settings, then retry.')
  const result = await window.CimoaNativeBridge.request('openSettings')
  if (result.opened !== true) throw new Error('Settings could not be opened. Please open the device Settings app manually.')
  return result
}
