export const copy_event_text = text => new Promise((resolve, reject) => {
  if (!text || typeof uni === 'undefined') { reject(new Error('Copy is unavailable. You can select the event text instead.')); return }
  uni.setClipboardData({ data: text, showToast: false, success: resolve, fail: () => reject(new Error('Clipboard access failed. You can select the event text instead.')) })
})
export const open_event_location = event => new Promise((resolve, reject) => {
  if (!Number.isFinite(event?.latitude) || !Number.isFinite(event?.longitude)) { reject(new Error('Map coordinates have not been provided. Use the address shown here.')); return }
  uni.openLocation({ latitude: event.latitude, longitude: event.longitude, name: event.title, address: event.address || event.location, success: resolve, fail: () => reject(new Error('Maps could not be opened on this device. Use the address shown here.')) })
})
