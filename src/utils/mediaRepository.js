const database_name = 'cimoa_media_v2'
const open_database = () => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) { reject(new Error('Media storage is unavailable.')); return }
  const request = indexedDB.open(database_name, 1)
  request.onupgradeneeded = () => request.result.createObjectStore('blobs')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(new Error('Media storage could not be opened.'))
  request.onblocked = () => reject(new Error('Close other Cimoa windows and retry media storage.'))
})
async function transact_blob(mode, action) {
  const db = await open_database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('blobs', mode)
    let result
    try {
      const request = action(transaction.objectStore('blobs'))
      request.onsuccess = () => { result = request.result }
    } catch (error) { db.close(); reject(error); return }
    transaction.oncomplete = () => { db.close(); resolve(result) }
    transaction.onerror = transaction.onabort = () => { db.close(); reject(new Error('Media storage failed. Please retry.')) }
  })
}
export const media_repository = {
  get: (id) => transact_blob('readonly', (store) => store.get(id)),
  put: (id, blob) => transact_blob('readwrite', (store) => store.put(blob, id)),
  delete: (id) => transact_blob('readwrite', (store) => store.delete(id)),
}

export function create_media_cache(repository = media_repository, url_api = globalThis.URL, clock = Date.now, timers = globalThis) {
  const cache = new Map()
  const pending = new Map()
  let cleanup_timer = null
  const sweep = () => {
    const idle = [...cache].filter(([, row]) => row.refs === 0).sort((a, b) => a[1].idle_at - b[1].idle_at)
    idle.forEach(([id, row], index) => {
      if (clock() - row.idle_at >= 120000 || idle.length - index > 48) { url_api.revokeObjectURL(row.url); cache.delete(id) }
    })
  }
  const schedule = () => {
    timers.clearTimeout(cleanup_timer)
    sweep()
    const next = [...cache.values()].filter((row) => row.refs === 0).sort((a, b) => a.idle_at - b.idle_at)[0]
    if (next) cleanup_timer = timers.setTimeout(schedule, Math.max(1, 120000 - (clock() - next.idle_at)))
  }
  return {
    async acquire(media_url) {
      if (!media_url) throw new Error('This image is unavailable.')
      if (!media_url.startsWith('indexeddb://')) return { url: media_url, release() {} }
      const id = media_url.slice(12)
      if (!cache.has(id)) {
        if (!pending.has(id)) pending.set(id, (async () => {
          const blob = await repository.get(id)
          if (!(blob instanceof Blob) || !blob.size) throw new Error('Saved media is unavailable. Please select it again.')
          cache.set(id, { url: url_api.createObjectURL(blob), refs: 0, idle_at: clock() })
        })().finally(() => pending.delete(id)))
        await pending.get(id)
      }
      const row = cache.get(id)
      row.refs += 1
      let released = false
      return { url: row.url, release() { if (released) return; released = true; row.refs -= 1; if (!row.refs) row.idle_at = clock(); schedule() } }
    },
    sweep,
    dispose_idle() { timers.clearTimeout(cleanup_timer); for (const [id, row] of cache) if (!row.refs) { url_api.revokeObjectURL(row.url); cache.delete(id) } },
  }
}
export const media_cache = create_media_cache()
