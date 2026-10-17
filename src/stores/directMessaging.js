import { clone_data } from './seed.js'
import { authenticated, owner_id, ensure, can_open_conversation, messages_for, user_by_id } from './selectors.js'
import { transact, get_runtime, make_id, operation, failure } from './transactions.js'
import { connection_for } from './connectionEntities.js'

export function direct_conversation(data, conversation_id, now) {
  const conversation = data.conversations.find(row => row.conversation_id === conversation_id && row.kind === 'direct')
  if (!authenticated(data, now) || !can_open_conversation(data, conversation)) return null
  const participant_id = conversation.participant_ids.find(id => id !== owner_id(data))
  const messages = messages_for(data, conversation_id)
  const last_message = messages.at(-1) || null
  const connection = connection_for(data, participant_id, now)
  return {
    ...clone_data(conversation),
    participant_id,
    participant: clone_data(user_by_id(data, participant_id)),
    connection_id: connection?.connection_id || null,
    created_at: connection?.created_at || messages[0]?.sent_at || 0,
    updated_at: last_message?.sent_at || connection?.created_at || 0,
    last_message: clone_data(last_message),
    preview: last_message ? last_message.kind === 'text' ? last_message.body : last_message.kind === 'image' ? 'Photo' : 'Voice message' : 'Start a conversation',
    unread_count: messages.filter(row => row.sender_id !== owner_id(data) && !row.read_by.includes(owner_id(data))).length,
    messages: messages.map(row => ({
      ...clone_data(row),
      mine: row.sender_id === owner_id(data),
      time_label: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(row.sent_at),
      day_label: new Date(row.sent_at).toDateString() === new Date(now).toDateString() ? 'Today' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(row.sent_at),
      media: clone_data(data.media_files.find(media => media.media_id === row.media_id) || null),
    })),
  }
}

function validate(store, conversation_id, body, media, now) {
  ensure(store.hydration_status === 'ready' && direct_conversation(store.data, conversation_id, now), 'This conversation is unavailable.')
  ensure(typeof body === 'string' && body.length <= 2000, 'Keep messages within 2000 characters.')
  ensure(body.trim() || media, 'Write a message first.')
  if (media) {
    ensure(['image', 'audio'].includes(media.kind) && media.blob instanceof Blob && media.blob.type.startsWith(`${media.kind}/`) && media.blob.size > 0 && media.blob.size <= 20 * 1024 * 1024, 'Choose valid media up to 20 MB.')
    if (media.kind === 'audio') ensure(Number.isFinite(media.duration_ms) && media.duration_ms > 0 && media.duration_ms <= 120000, 'Record a voice message up to two minutes.')
  }
}

const sending = new WeakSet()
export const direct_message_actions = {
  direct_message_error(conversation_id, body, media = null) {
    try { validate(this, conversation_id, body, media, get_runtime(this).clock()); return '' } catch (error) { return error.message }
  },
  async send_direct_message(conversation_id, body, media = null, operation_id = make_id(), { is_current = () => true } = {}) {
    if (sending.has(this)) return failure('busy', 'A message is already being saved.')
    sending.add(this)
    const rt = get_runtime(this), owner = owner_id(this.data)
    let created = null, published = false
    try {
      validate(this, conversation_id, body, media, rt.clock())
      let fingerprint = null, metadata = null
      if (media) {
        const decoded = await rt.inspect_media(media.blob, media.kind)
        const duration_ms = media.kind === 'audio' ? decoded.duration_ms : 0
        ensure(media.kind !== 'audio' || Number.isFinite(duration_ms) && duration_ms > 0 && duration_ms <= 120000, 'The recording cannot be decoded or is longer than two minutes.')
        ensure(globalThis.crypto?.subtle, 'Secure media hashing is unavailable.')
        fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await media.blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
        ensure(is_current(), 'Message save was cancelled.')
        created = make_id('media')
        await rt.media.put(created, media.blob)
        metadata = { media_id: created, owner_user_id: owner, kind: media.kind, media_url: `indexeddb://${created}`, mime: media.blob.type, byte_size: media.blob.size, duration_ms }
      }
      ensure(is_current(), 'Message save was cancelled.')
      const result = transact(this, operation(operation_id, 'direct-message', [conversation_id, body, fingerprint]), (data, now) => {
        ensure(direct_conversation(data, conversation_id, now), 'This conversation is no longer available.')
        if (metadata) data.media_files.push(metadata)
        const message_id = make_id('message')
        data.messages.push({ message_id, conversation_id, sender_id: owner, body: body.trim(), kind: media?.kind || 'text', media_id: metadata?.media_id || null, sent_at: now, read_by: [owner] })
        return message_id
      }, { expected_owner: owner })
      published = result.success && !result.repeated
      return result
    } catch (error) { return failure('message_failed', error.message) }
    finally {
      if (created && !published) { try { await rt.media.delete(created) } catch { this.last_error = 'Message was not published; temporary media cleanup failed. Retry storage when available.' } }
      sending.delete(this)
    }
  },
}
