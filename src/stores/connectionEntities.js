import { clone_data } from './seed.js'
import { owner_id, authenticated, visible, connected, goals_for_user } from './selectors.js'

// A Connection is a read model of two consent records, never a second friends table.
// Its identity changes after a block/reconnection, so an old result cannot open a new chat.
export function connection_for(data, target, now) {
  const owner = owner_id(data)
  if (!authenticated(data, now) || !connected(data, target)) return null
  const consent = [[owner, target], [target, owner]].map(([from, to]) => data.relationships.find(row => row.from_user_id === from && row.to_user_id === to))
  const created_at = Math.max(...consent.map(row => row.created_at))
  const conversation = data.conversations.find(row => row.kind === 'direct' && row.participant_ids.includes(owner) && row.participant_ids.includes(target))
  const request = data.requests.find(row => row.status === 'accepted' && (consent[0].source_request_id !== undefined ? consent.every(item => item.source_request_id === row.request_id) : row.resolved_at === created_at) && [row.sender_id, row.recipient_id].includes(owner) && [row.sender_id, row.recipient_id].includes(target))
  const match = data.match_sessions.find(row => row.status === 'connected' && (consent[0].source_match_id !== undefined ? consent.every(item => item.source_match_id === row.match_id) : row.resolved_at === created_at) && [row.owner_user_id, row.candidate_id].includes(owner) && [row.owner_user_id, row.candidate_id].includes(target))
  const mine = data.users.find(row => row.user_id === owner)
  return {
    connection_id: `connection:${JSON.stringify(consent.map(row => row.relationship_id).sort())}`,
    participant_ids: [owner, target].sort(), user_id: target, status: 'connected', created_at,
    conversation_id: conversation?.conversation_id || null,
    source_request_id: request?.request_id || null, source_match_id: match?.match_id || null,
    shared_interests: clone_data(data.interests.filter(row => mine.interest_ids.includes(row.item_id) && data.users.find(user => user.user_id === target).interest_ids.includes(row.item_id))),
    goals: goals_for_user(data, target),
  }
}

export function connection_request(data, id, now) {
  if (!authenticated(data, now)) return null
  const owner = owner_id(data)
  const row = data.requests.find(request => request.request_id === id && [request.sender_id, request.recipient_id].includes(owner))
  if (!row || !visible(data, row.sender_id) || !visible(data, row.recipient_id)) return null
  const target = row.sender_id === owner ? row.recipient_id : row.sender_id
  const connection = connection_for(data, target, now)
  // Only the acceptance that created this generation may claim its conversation.
  const current_acceptance = row.status === 'accepted' && connection?.source_request_id === id
  return {
    ...clone_data(row), direction: row.sender_id === owner ? 'outgoing' : 'incoming',
    question: row.question_text || data.icebreakers.find(question => question.question_id === row.question_id)?.text || '',
    audio: clone_data(data.media_files.find(media => media.media_id === row.audio_id && media.owner_user_id === row.sender_id) || null),
    connection_id: current_acceptance ? connection.connection_id : null,
    conversation_id: current_acceptance ? connection.conversation_id : null,
    can_accept: row.status === 'pending' && row.recipient_id === owner && !connection,
    can_decline: row.status === 'pending' && row.recipient_id === owner,
    can_cancel: row.status === 'pending' && row.sender_id === owner,
  }
}
