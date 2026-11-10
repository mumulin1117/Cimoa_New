import { read_permissions } from './mediaCapabilities.js'
import { auth_message } from './authFeedback.js'

export const open_app_settings = async () => {
  if (!globalThis.window?.webkit?.messageHandlers?.CimoaHost) throw new Error('App settings cannot be opened here. Manage permissions in your browser or device settings, then try again.')
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

const permission_keys = ['camera', 'microphone', 'photos', 'notifications', 'location']
const normalized_permission = value => {
  if (value === 'unknown') return 'not_requested'
  if (!['granted', 'denied', 'not_requested', 'unavailable'].includes(value)) throw new Error('The system returned an unknown permission state. Please retry.')
  return value
}
export const permission_statuses = async (env = globalThis) => {
  const source = env.window?.webkit?.messageHandlers?.CimoaHost
    ? await env.window.CimoaNativeBridge.request('getPermissions')
    : await read_permissions(env.navigator)
  return Object.fromEntries(permission_keys.map(key => [key, normalized_permission(source[key] || 'unavailable')]))
}

export const request_media_permission = async (kind, env = globalThis) => {
  if (!['camera', 'microphone'].includes(kind)) throw new Error('Unsupported media permission.')
  const devices = env.navigator?.mediaDevices
  if (!devices?.getUserMedia) throw new Error(`${kind === 'camera' ? 'Camera' : 'Microphone'} access is unavailable in this browser or device.`)
  let stream
  try {
    stream = await devices.getUserMedia(kind === 'camera' ? { video: true } : { audio: true })
    const tracks = stream.getTracks()
    if (!tracks.length) throw new Error(`No ${kind} device was found.`)
    return 'granted'
  } catch (error) {
    if (error.name === 'NotAllowedError') throw new Error(`${kind === 'camera' ? 'Camera' : 'Microphone'} permission was denied.`)
    if (error.name === 'NotFoundError') throw new Error(`No ${kind} device was found.`)
    throw new Error(auth_message(error.message, `${kind === 'camera' ? 'Camera' : 'Microphone'} access couldn’t be opened. Please try again.`))
  } finally { stream?.getTracks().forEach(track => track.stop()) }
}
