import { clone_data } from './seed.js'
import { authenticated, owner_id, ensure, joined, messages_for, user_by_id } from './selectors.js'
import { transact, get_runtime, make_id, operation, failure } from './transactions.js'
export function event_group(data, event_id, conversation_id, now) {
  const event = data.events.find(row => row.event_id === event_id)
  const conversation = data.conversations.find(row => row.conversation_id === conversation_id && row.kind === 'group' && row.event_id === event_id)
  if (!authenticated(data, now) || !event || !conversation || !joined(data, event_id)) return null
  const muted = data.event_preferences.find(row => row.owner_user_id === owner_id(data))?.group_muted_event_ids?.includes(event_id) || false
  return { event_id, conversation_id, muted, messages: messages_for(data, conversation_id).map(row => ({ ...clone_data(row),
    sender: clone_data(user_by_id(data, row.sender_id)), mine: row.sender_id === owner_id(data),
    time_label: new Intl.DateTimeFormat('en-US', { timeZone: event.time_zone || 'UTC', hour: 'numeric', minute: '2-digit' }).format(row.sent_at),
    media: clone_data(data.media_files.find(media => media.media_id === row.media_id) || null),
  })) }
}
function validate(store, event_id, conversation_id, body, media, now) {
  ensure(store.hydration_status === 'ready' && event_group(store.data, event_id, conversation_id, now), 'This event group is unavailable. Join the event to continue.')
  ensure(typeof body === 'string' && body.length <= 2000, 'Keep messages within 2000 characters.')
  ensure(body.trim() || media, 'Write a message first.')
  if (media) {
    ensure(['image', 'audio'].includes(media.kind) && media.blob instanceof Blob && media.blob.type.startsWith(`${media.kind}/`) && media.blob.size > 0 && media.blob.size <= 20 * 1024 * 1024, 'Choose valid media up to 20 MB.')
    if (media.kind === 'audio') ensure(Number.isFinite(media.duration_ms) && media.duration_ms > 0 && media.duration_ms <= 120000, 'Record a voice message up to two minutes.')
  }
}
const sending = new WeakSet()
export const event_message_actions = {
  event_message_error(event_id, conversation_id, body, media = null) { try { validate(this, event_id, conversation_id, body, media, get_runtime(this).clock()); return '' } catch (error) { return error.message } },
  async send_event_message(event_id, conversation_id, body, media = null, operation_id = make_id(), { is_current = () => true } = {}) {
    if (sending.has(this)) return failure('busy', 'A message is already being saved.')
    sending.add(this)
    const rt = get_runtime(this), owner = owner_id(this.data); let created = null, published = false
    try {
      validate(this, event_id, conversation_id, body, media, rt.clock())
      let fingerprint = null, metadata = null
      if (media) {
        const decoded = await rt.inspect_media(media.blob, media.kind)
        const duration_ms = media.kind === 'audio' ? decoded.duration_ms : 0
        ensure(media.kind !== 'audio' || Number.isFinite(duration_ms) && duration_ms > 0 && duration_ms <= 120000, 'The recording cannot be decoded or is longer than two minutes.')
        ensure(globalThis.crypto?.subtle, 'Secure media hashing is unavailable.')
        fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await media.blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
        ensure(is_current(), 'Message save was cancelled.')
        created = make_id('media'); await rt.media.put(created, media.blob)
        metadata = { media_id: created, owner_user_id: owner, kind: media.kind, media_url: `indexeddb://${created}`, mime: media.blob.type, byte_size: media.blob.size, duration_ms }
      }
      ensure(is_current(), 'Message save was cancelled.')
      const result = transact(this, operation(operation_id, 'event-message', [event_id, conversation_id, body, fingerprint]), (data, now) => {
        ensure(event_group(data, event_id, conversation_id, now), 'Your attendance changed. This group is unavailable.')
        if (metadata) data.media_files.push(metadata)
        const message_id = make_id('message'); data.messages.push({ message_id, conversation_id, sender_id: owner, body: body.trim(), kind: media?.kind || 'text', media_id: metadata?.media_id || null, sent_at: now, read_by: [owner] }); return message_id
      }, { expected_owner: owner })
      published = result.success && !result.repeated
      return result
    } catch (error) { return failure('message_failed', error.message) }
    finally {
      if (created && !published) { try { await rt.media.delete(created) } catch { this.last_error = 'Message was not published; temporary media cleanup failed. Retry storage when available.' } }
      sending.delete(this)
    }
  },
  set_event_group_muted(event_id, conversation_id, muted) {
    return transact(this, null, (data, now) => {
      ensure(event_group(data, event_id, conversation_id, now), 'This group is unavailable.')
      let row = data.event_preferences.find(entry => entry.owner_user_id === owner_id(data))
      if (!row) { row = { owner_user_id: owner_id(data), filters: {}, saved_event_ids: [], reminder_by_event: {} }; data.event_preferences.push(row) }
      row.group_muted_event_ids = [...new Set((row.group_muted_event_ids || []).filter(id => id !== event_id).concat(muted ? [event_id] : []))]
    })
  },
}
