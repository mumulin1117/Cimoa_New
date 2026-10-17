import { ref, shallowRef, onUnmounted } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { choose_images, create_recorder, inspect_media } from '@/utils/mediaCapabilities.js'
export function use_event_media(error, { max_duration_ms = 120000 } = {}) {
  const draft = shallowRef(null), recording = ref(false), busy = ref(false), seconds = ref(0)
  let recorder, timer, capture_controller, token = 0
  const clear = () => { token++; capture_controller?.abort(); capture_controller = null; clearInterval(timer); timer = null; recorder?.dispose(); recorder = null; recording.value = false; busy.value = false; seconds.value = 0; if (draft.value) URL.revokeObjectURL(draft.value.url); draft.value = null }
  onHide(clear); onUnmounted(clear)
  const stage = async (blob, kind) => {
    if (!(blob instanceof Blob) || !blob.type.startsWith(`${kind}/`) || !blob.size || blob.size > 20 * 1024 * 1024) throw new Error('Choose valid media up to 20 MB.')
    const current = token, info = await inspect_media(blob, kind)
    if (current !== token) return
    if (kind === 'audio' && info.duration_ms > max_duration_ms) throw new Error(`Record up to ${max_duration_ms / 1000} seconds.`)
    draft.value = { blob, kind, duration_ms: info.duration_ms || 0, url: URL.createObjectURL(blob) }
  }
  const photo = async () => {
    if (busy.value || recording.value) return false
    clear(); error.value = ''; busy.value = true; const current = token
    try { const files = await choose_images(1); if (current !== token) return false; const file = files[0]; await stage(file instanceof Blob ? file : file?.file, 'image'); return current === token && !!draft.value }
    catch (cause) { if (current === token) error.value = cause.message; return false } finally { if (current === token) busy.value = false }
  }
  const stop = async () => {
    if (!recording.value || busy.value) return
    busy.value = true; recording.value = false; clearInterval(timer); const current = token
    try { const result = await recorder.stop(); if (current === token) await stage(result.blob, 'audio') } catch (cause) { if (current === token) error.value = cause.message } finally { if (current === token) { recorder?.dispose(); recorder = null; busy.value = false } }
  }
  const start = async () => {
    if (busy.value || recording.value) return
    clear(); error.value = ''; busy.value = true; const current = token
    try {
      capture_controller = new AbortController()
      const next = await create_recorder({ signal: capture_controller.signal }); if (current !== token) { next.dispose(); return }
      recorder = next; recorder.start(); recording.value = true
      const began = Date.now(); timer = setInterval(() => { const elapsed = Date.now() - began; seconds.value = Math.floor(elapsed / 1000); if (elapsed >= max_duration_ms - 250) stop() }, 250)
    } catch (cause) { if (current === token) { recorder?.dispose(); recorder = null; error.value = cause.message } } finally { if (current === token) busy.value = false }
  }
  return { draft, recording, busy, seconds, clear, photo, start, stop }
}
