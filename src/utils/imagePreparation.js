// A cancellable H5 image decode, shared by ordinary browsers and WKWebView.
// The caller owns the media-cache lease and its existing read timeout.
// Retain only six decoded images in memory, never storage or business state.
// Warm Tab remounts can paint the known image without replaying its placeholder.
const decoded_caches = new WeakMap()
export function prepare_image(url, ImageType = globalThis.Image) {
  let cache
  if (typeof ImageType === 'function') {
    if (!decoded_caches.has(ImageType)) decoded_caches.set(ImageType, new Map())
    cache = decoded_caches.get(ImageType)
    if (cache.has(url)) {
      const image = cache.get(url)
      cache.delete(url); cache.set(url, image)
      return { ready: Promise.resolve(true), cached: true, cancel() {} }
    }
  }
  let image = null, finished = false, cancelled = false, retained = false, resolve_ready
  const detach = () => { if (image) { image.onload = null; image.onerror = null } }
  const ready = new Promise((resolve, reject) => {
    resolve_ready = resolve
    if (!url || typeof ImageType !== 'function') { finished = true; reject(new Error('Photo loading is unavailable.')); return }
    image = new ImageType()
    image.decoding = 'async'
    const loaded = async () => {
      // Cached images can fire both the complete shortcut and load.
      if (finished) return
      finished = true
      detach()
      try {
        if (!image.naturalWidth) throw new Error('This photo is unavailable.')
        if (typeof image.decode === 'function') await image.decode()
        if (cancelled) return
        cache.set(url, image); retained = true
        while (cache.size > 6) cache.delete(cache.keys().next().value)
        resolve(true)
      } catch { reject(new Error('This photo could not be decoded.')) }
    }
    image.onload = loaded
    image.onerror = () => { if (!finished) { finished = true; detach(); reject(new Error('This photo could not be loaded.')) } }
    image.src = url
    if (image.complete && image.naturalWidth) loaded()
  })
  return { ready, cached: false, cancel() { cancelled = true; finished = true; detach(); if (image && !retained) image.src = ''; resolve_ready(false) } }
}
