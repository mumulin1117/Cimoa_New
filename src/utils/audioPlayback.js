import { acquire_audio_media } from './mediaRepository.js'

// H5/WKWebView adapter. Prepare the source before the user's tap and preserve
// HTMLMediaElement.play()'s Promise: uni-h5's audio wrapper discards its rejection.
export async function create_audio_playback(source, handlers = {}, { acquire = acquire_audio_media, AudioConstructor = globalThis.Audio } = {}) {
  if (typeof AudioConstructor !== 'function') throw new Error('Audio playback is currently unavailable.')
  const lease = await acquire(source)
  let audio
  try { audio = new AudioConstructor() } catch { lease.release(); throw new Error('Audio playback is currently unavailable.') }
  let disposed = false
  const listeners = { play: handlers.play, pause: handlers.pause, ended: handlers.ended, timeupdate: () => handlers.time?.(audio.currentTime || 0), error: () => handlers.error?.('This audio could not be played. Please retry.') }
  for (const [name, handler] of Object.entries(listeners)) if (handler) audio.addEventListener(name, handler)
  audio.preload = 'metadata'; audio.src = lease.url
  return {
    play() {
      if (disposed) return Promise.reject(new Error('Audio playback has ended. Please reopen it.'))
      // Call play synchronously inside the user event, before any await.
      try { return Promise.resolve(audio.play()).catch(error => { throw new Error(error.name === 'NotAllowedError' ? 'Playback was blocked. Tap play to try again.' : 'This audio could not be played. Please retry.') }) }
      catch { return Promise.reject(new Error('This audio could not be played. Please retry.')) }
    },
    pause() { if (!disposed) audio.pause() },
    seek(seconds) { if (!disposed && Number.isFinite(seconds) && Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Math.max(0, Math.min(audio.duration, seconds)) },
    get duration() { return disposed ? 0 : audio.duration },
    destroy() {
      if (disposed) return
      disposed = true
      for (const [name, handler] of Object.entries(listeners)) if (handler) audio.removeEventListener(name, handler)
      audio.pause(); audio.removeAttribute('src'); audio.load(); lease.release()
    },
  }
}
