export const STATE_KEY = 'cimoa_app_state_v2'
export const LEGACY_KEY = 'cimoa_app_state'
export const default_persistence = {
  read(key) {
    if (typeof uni === 'undefined') throw new Error('Storage is unavailable.')
    const value = uni.getStorageSync(key)
    return value === '' || value == null ? null : value
  },
  write(key, value) {
    if (typeof uni === 'undefined') throw new Error('Storage is unavailable.')
    uni.setStorageSync(key, value)
  },
}
