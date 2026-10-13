export function inspect_media(blob, kind) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new Error('Media decoding is unavailable.')); return }
    const url = URL.createObjectURL(blob)
    const element = kind === 'audio' ? document.createElement('audio') : new Image()
    const cleanup = () => { clearTimeout(timer); element.onload = element.onloadedmetadata = element.onerror = null; element.removeAttribute('src'); URL.revokeObjectURL(url) }
    const finish = () => {
      const duration_ms = kind === 'audio' ? element.duration * 1000 : 0
      const valid = kind === 'audio' ? Number.isFinite(duration_ms) && duration_ms > 0 : element.naturalWidth > 0
      cleanup(); valid ? resolve({ duration_ms }) : reject(new Error('This media file cannot be played or displayed.'))
    }
    const timer = setTimeout(() => { cleanup(); reject(new Error('Media decoding timed out.')) }, 8000)
    element.onload = element.onloadedmetadata = finish
    element.onerror = () => { cleanup(); reject(new Error('This media file could not be decoded.')) }
    element.src = url
    if (kind === 'audio') { element.preload = 'metadata'; element.load() }
  })
}
export async function create_recorder({ devices = globalThis.navigator?.mediaDevices, Recorder = globalThis.MediaRecorder, clock = Date.now } = {}) {
  if (!devices?.getUserMedia || !Recorder) throw new Error('Voice recording is unavailable on this device.')
  let stream
  try { stream = await devices.getUserMedia({ audio: true }) } catch (error) {
    throw new Error(error.name === 'NotAllowedError' ? 'Microphone permission was denied.' : error.name === 'NotFoundError' ? 'No microphone was found.' : 'The microphone could not be opened.')
  }
  const tracks = () => stream.getTracks().forEach((track) => track.stop())
  let recorder
  try { recorder = new Recorder(stream) } catch { tracks(); throw new Error('Voice recording could not be started.') }
  let chunks = [], started_at = 0, disposed = false, completion = null
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
  const reject_pending = (message) => { if (completion) { completion.reject(new Error(message)); completion = null } }
  recorder.onerror = () => { tracks(); reject_pending('Voice recording failed. Please try again.') }
  recorder.onstop = () => {
    tracks()
    if (disposed) { reject_pending('Recording was cancelled.'); return }
    const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' })
    if (!blob.size) { reject_pending('No audio was recorded.'); return }
    completion?.resolve({ blob, duration_ms: Math.max(0, clock() - started_at) }); completion = null; chunks = []
  }
  return {
    start() { if (disposed || recorder.state !== 'inactive') throw new Error('Recording is already active.'); chunks = []; started_at = clock(); recorder.start() },
    stop() { if (disposed || recorder.state === 'inactive' || completion) return Promise.reject(new Error('Recording is not active.')); return new Promise((resolve, reject) => { completion = { resolve, reject }; recorder.stop() }) },
    dispose() { if (disposed) return; disposed = true; if (recorder.state !== 'inactive') recorder.stop(); tracks(); reject_pending('Recording was cancelled.'); chunks = [] },
  }
}
export const choose_images = () => new Promise((resolve, reject) => {
  if (typeof uni === 'undefined') { reject(new Error('Photo selection is unavailable.')); return }
  uni.chooseImage({ count: 6, sourceType: ['album'], success: (result) => resolve(result.tempFiles), fail: () => reject(new Error('No photos were selected. Check photo access and try again.')) })
})
export async function read_permissions(navigator_api = globalThis.navigator) {
  const result = {}
  for (const name of ['camera', 'microphone', 'notifications', 'geolocation']) {
    try { const state = (await navigator_api.permissions.query({ name })).state; result[name === 'geolocation' ? 'location' : name] = state === 'prompt' ? 'unknown' : state } catch { result[name === 'geolocation' ? 'location' : name] = 'unavailable' }
  }
  result.photos = 'unknown'
  return result
}
