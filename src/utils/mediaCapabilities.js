export function inspect_media(blob, kind) {
  const inspect_element = () => new Promise((resolve, reject) => {
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
  // MediaRecorder commonly emits WebM/Opus. Some WebKit/Chromium builds can
  // play that container but OfflineAudioContext cannot decode it, so retain
  // frame decoding as the first validation and fall back to real media
  // metadata rather than rejecting an otherwise playable recording.
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext
  if (kind === 'audio' && Offline) return blob.arrayBuffer()
    .then(buffer => new Offline(1, 1, 48000).decodeAudioData(buffer))
    .then(audio => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw new Error('This audio could not be decoded.')
      return { duration_ms: audio.duration * 1000 }
    })
    .catch(inspect_element)
  return inspect_element()
}
export async function create_recorder({ devices = globalThis.navigator?.mediaDevices, Recorder = globalThis.MediaRecorder, clock = Date.now, signal, timers = globalThis, request_timeout = 15000, stop_timeout = 8000 } = {}) {
  if (!devices?.getUserMedia || !Recorder) throw new Error('Voice recording is currently unavailable.')
  const media_error = (name, message) => Object.assign(new Error(message), { name })
  const stop_stream = value => (value?.getTracks?.() || []).forEach(track => { try { track.stop() } catch {} })
  let stream
  try {
    stream = await new Promise((resolve, reject) => {
      let settled = false, timer
      const cleanup = () => { timers.clearTimeout(timer); signal?.removeEventListener('abort', abort) }
      const fail = error => { if (!settled) { settled = true; cleanup(); reject(error) } }
      const abort = () => fail(media_error('AbortError', 'Microphone access was cancelled.'))
      if (signal?.aborted) { abort(); return }
      signal?.addEventListener('abort', abort, { once: true })
      timer = timers.setTimeout(() => fail(media_error('TimeoutError', 'The microphone did not respond. Check your audio input and try again.')), request_timeout)
      // Invoke the capability inside the original click stack. Do not defer the
      // permission request behind a timer, native bridge round trip or microtask.
      try {
        Promise.resolve(devices.getUserMedia({ audio: true })).then(value => {
          if (settled) { stop_stream(value); return }
          settled = true; cleanup(); resolve(value)
        }, fail)
      } catch (error) { fail(error) }
    })
    if (signal?.aborted) { stop_stream(stream); throw media_error('AbortError', 'Microphone access was cancelled.') }
  } catch (error) {
    const name = error?.name || 'NotReadableError'
    throw media_error(name, ['AbortError', 'TimeoutError'].includes(name) ? error.message : ['NotAllowedError', 'SecurityError'].includes(name) ? 'Microphone permission was denied.' : name === 'NotFoundError' ? 'No microphone was found.' : 'The microphone could not be opened.')
  }
  const audio_tracks = stream?.getAudioTracks?.() || stream?.getTracks?.().filter(track => track.kind !== 'video') || []
  if (!audio_tracks.some(track => track.readyState !== 'ended')) { stop_stream(stream); throw media_error('NotFoundError', 'No microphone was found.') }
  let released = false
  const tracks = () => { if (!released) { released = true; stop_stream(stream) } }
  let recorder
  try {
    const mime = typeof Recorder.isTypeSupported === 'function' ? ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(type => Recorder.isTypeSupported(type)) : ''
    recorder = mime ? new Recorder(stream, { mimeType: mime }) : new Recorder(stream)
  } catch { tracks(); throw new Error('Voice recording could not be started.') }
  let chunks = [], started_at = 0, started = false, disposed = false, completion = null, stop_timer, failure
  const detach = () => { recorder.ondataavailable = recorder.onerror = recorder.onstop = null; signal?.removeEventListener('abort', abort_recording) }
  const finish_pending = (error, result) => {
    timers.clearTimeout(stop_timer); stop_timer = undefined
    const pending = completion; completion = null
    if (pending) error ? pending.reject(error) : pending.resolve(result)
  }
  const fail_recording = error => {
    failure = error; chunks = []; tracks(); detach(); finish_pending(error)
    try { if (recorder.state !== 'inactive') recorder.stop() } catch {}
  }
  const abort_recording = () => fail_recording(media_error('AbortError', 'Recording was cancelled.'))
  recorder.ondataavailable = event => { if (!disposed && !failure && event.data instanceof Blob && event.data.size) chunks.push(event.data) }
  recorder.onerror = () => fail_recording(new Error('Voice recording failed. Please try again.'))
  recorder.onstop = () => {
    tracks(); detach()
    if (disposed || failure) { finish_pending(failure || media_error('AbortError', 'Recording was cancelled.')); chunks = []; return }
    const type = recorder.mimeType || chunks.find(chunk => chunk.type)?.type || ''
    const blob = new Blob(chunks, { type }); chunks = []
    if (!blob.size || !type.startsWith('audio/')) { finish_pending(new Error('No playable audio was recorded. Please try again.')); return }
    finish_pending(null, { blob, duration_ms: Math.max(0, clock() - started_at) })
  }
  signal?.addEventListener('abort', abort_recording, { once: true })
  if (signal?.aborted) { abort_recording(); throw failure }
  return {
    start() {
      if (failure) throw failure
      if (disposed || started || recorder.state !== 'inactive') throw new Error('Start a new recording to try again.')
      chunks = []; started_at = clock(); started = true
      try { recorder.start() } catch { const error = new Error('Voice recording could not be started.'); fail_recording(error); throw error }
    },
    stop() {
      if (failure) return Promise.reject(failure)
      if (disposed || recorder.state === 'inactive' || completion) return Promise.reject(new Error('Recording is not active.'))
      return new Promise((resolve, reject) => {
        completion = { resolve, reject }
        stop_timer = timers.setTimeout(() => fail_recording(media_error('TimeoutError', 'Your audio could not be completed. Please try again.')), stop_timeout)
        try { recorder.stop() } catch { fail_recording(new Error('Your audio could not be completed. Please try again.')) }
      })
    },
    dispose() { if (disposed) return; disposed = true; fail_recording(media_error('AbortError', 'Recording was cancelled.')) },
  }
}
export const choose_images = (count = 6) => new Promise((resolve, reject) => {
  if (typeof uni === 'undefined') { reject(new Error('Photo selection is unavailable.')); return }
  uni.chooseImage({ count, sourceType: ['album'], success: (result) => resolve(result.tempFiles), fail: () => reject(new Error('No photos were selected. Check photo access and try again.')) })
})
export const choose_camera_image = () => new Promise((resolve, reject) => {
  if (typeof uni === 'undefined') { reject(new Error('Camera capture is unavailable.')); return }
  uni.chooseImage({ count: 1, sourceType: ['camera'], success: (result) => resolve(result.tempFiles), fail: () => reject(new Error('No photo was captured. Check camera access and try again.')) })
})
export async function read_permissions(navigator_api = globalThis.navigator) {
  const result = {}
  for (const name of ['camera', 'microphone', 'notifications', 'geolocation']) {
    try { const state = (await navigator_api.permissions.query({ name })).state; result[name === 'geolocation' ? 'location' : name] = state === 'prompt' ? 'unknown' : state } catch { result[name === 'geolocation' ? 'location' : name] = 'unavailable' }
  }
  result.photos = 'unknown'
  return result
}
