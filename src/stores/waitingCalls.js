import { clone_data } from './seed.js'
import { owner_id, ensure } from './selectors.js'
import { direct_conversation } from './directMessaging.js'
import { get_runtime, transact, operation, make_id, failure } from './transactions.js'

// Outgoing waiting only. A deadline is not evidence of a peer answering.
export function waiting_call(data, id, now) {
  const row = data.call_sessions.find(call => call.call_id === id && call.owner_user_id === owner_id(data) && call.session_expires_at === data.session.expires_at)
  if (!row) return null
  const conversation = direct_conversation(data, row.conversation_id, now)
  if (!conversation?.can_call || conversation.connection_id !== row.connection_id) return null
  return { ...clone_data(row), status: row.ended_at != null ? 'ended' : now >= row.expires_at ? 'timeout' : 'waiting' }
}

export const waiting_call_actions = {
  start_waiting_call(conversation_id, operation_id = make_id()) {
    const current = direct_conversation(this.data, conversation_id, get_runtime(this).clock())
    if (!current?.can_call) return failure('call_unavailable', current?.call_blocker || 'This conversation is unavailable.')
    return transact(this, operation(operation_id, 'waiting-call', [conversation_id, this.data.session.expires_at]), (data, now) => {
      const conversation = direct_conversation(data, conversation_id, now)
      ensure(conversation?.can_call, conversation?.call_blocker || 'This conversation is unavailable.')
      const current = data.call_sessions.find(row => row.owner_user_id === owner_id(data) && waiting_call(data, row.call_id, now)?.status === 'waiting')
      if (current) { ensure(current.conversation_id === conversation_id, 'End the current call before starting another.'); return current.call_id }
      const call_id = make_id('call')
      data.call_sessions.push({ call_id, owner_user_id: owner_id(data), participant_id: conversation.participant_id, conversation_id, connection_id: conversation.connection_id, session_expires_at: data.session.expires_at, started_at: now, expires_at: now + 8000 + Math.floor(Math.random() * 4001), ended_at: null })
      return call_id
    })
  },
  end_waiting_call(id) {
    return transact(this, null, (data, now) => {
      const call = waiting_call(data, id, now)
      ensure(call, 'This call is no longer available.')
      const row = data.call_sessions.find(item => item.call_id === id)
      if (row.ended_at == null) row.ended_at = Math.min(now, row.expires_at)
      return id
    })
  },
}
