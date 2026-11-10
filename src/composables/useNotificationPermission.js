import { onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { use_onboarding } from './useOnboarding.js'
import { notification_permission, open_app_settings } from '@/utils/nativePermissions.js'

// Both notification pre-prompts use the same system request and onboarding write.
// Continue never treats accepting this explanation as a system permission grant.
export function use_notification_permission(frame) {
  const setup = use_onboarding('notif', frame)
  const { error, allowed, context, is_loading, save } = setup
  const status = ref('checking'), requesting = ref(false)
  let active = false, generation = 0
  onShow(async () => {
    active = true
    const token = ++generation
    try {
      const value = await notification_permission()
      if (active && token === generation) status.value = value
    } catch (cause) {
      if (active && token === generation) { status.value = 'unavailable'; error.value = cause?.message || 'Notification permissions could not be checked. Please try again.' }
    }
  })
  const hide = () => { active = false; generation++; requesting.value = false }
  onHide(hide); onUnmounted(hide)
  const allow = async () => {
    if (!active || is_loading.value || requesting.value || !allowed.value) return
    error.value = ''; requesting.value = true
    const token = ++generation, account_id = context.value.account_id
    try {
      // Keep the actual permission request inside the user's Continue gesture.
      const value = await notification_permission(true)
      if (!active || token !== generation || context.value?.account_id !== account_id) return
      status.value = value
      if (value === 'granted') await save({ notification_permission: value })
      else error.value = value === 'unavailable'
        ? 'Notifications are unavailable in this browser or device. Choose Cancel to continue without them.'
        : value === 'denied'
          ? 'Notification access is off. Open Settings to change it, or choose Cancel to continue without notifications.'
          : 'No permission was granted. Try again, or choose Cancel to continue without notifications.'
    } catch (cause) {
      if (active && token === generation && context.value?.account_id === account_id) error.value = cause?.message || 'Notification access could not be requested. Please try again.'
    } finally { if (token === generation) requesting.value = false }
  }
  const decline = () => {
    if (!active || requesting.value || is_loading.value || !allowed.value) return
    // Skipping setup is not a denial of the OS permission and makes no request.
    return save({ notification_permission: ['denied', 'unavailable'].includes(status.value) ? status.value : 'skipped' })
  }
  const settings = async () => {
    if (!active || requesting.value || is_loading.value) return
    const token = ++generation
    try { await open_app_settings() }
    catch (cause) { if (active && token === generation) error.value = cause?.message || 'Settings could not be opened. Please try again.' }
  }
  return { ...setup, status, requesting, allow, decline, settings }
}
