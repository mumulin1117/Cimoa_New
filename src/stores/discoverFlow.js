import { clone_data } from './seed.js'
import { authenticated, owner_id, user_by_id, relationship_state, introduction_blocker, balance } from './selectors.js'
import { connection_for } from './connectionEntities.js'
import { direct_conversation } from './directMessaging.js'

// One read-only entry decision for the deck, profile and introduction screens.
// A tap never grants consent, creates a conversation or restarts an old request.
export function introduction_context(data, target, draft_id = null, now = Date.now(), hydration_status = 'ready') {
  const empty = error => ({ error, user: null, questions: [], question: null, draft: null, audio: null, primary: null, blocker: error, completed_request_id: null, balance: null })
  if (hydration_status !== 'ready') return empty('Your information is unavailable. Please try again.')
  if (!authenticated(data, now)) return empty('Your session has expired. Please sign in again.')
  const owner = owner_id(data), user = user_by_id(data, target)
  if (!user || owner === target) return empty('This profile is unavailable.')
  const questions = user.icebreaker_ids.map(id => data.icebreakers.find(row => row.question_id === id && row.user_id === target)).filter(Boolean).sort((a, b) => a.position - b.position)
  const drafts = data.drafts.filter(row => row.owner_user_id === owner && row.kind === 'introduction' && row.target_id === target)
  const draft = draft_id ? drafts.find(row => row.draft_id === draft_id) : drafts.filter(row => !row.payload.completed_request_id).sort((a,b) => b.updated_at - a.updated_at || a.draft_id.localeCompare(b.draft_id))[0]
  const question = questions.find(row => row.question_id === draft?.payload.question_id) || null
  const audio = data.media_files.find(row => row.media_id === draft?.payload.audio_id && row.owner_user_id === owner && row.kind === 'audio') || null
  const completed = data.requests.find(row => row.request_id === draft?.payload.completed_request_id && row.sender_id === owner && row.recipient_id === target)
  const relation = relationship_state(data, target, now), connection = connection_for(data, target, now)
  let primary, blocker = introduction_blocker(data, target, now)
  if (connection) {
    const conversation = connection.conversation_id ? direct_conversation(data, connection.conversation_id, now) : null
    primary = { kind: 'chat', label: 'Chat', destination: conversation ? `/pages/messages/chat?conversation_id=${encodeURIComponent(conversation.conversation_id)}` : '', error: conversation ? '' : 'This conversation is unavailable. Your connection has not changed.' }
  } else if (relation.request_id) primary = { kind: 'request', label: relation.status === 'outgoing_request' ? 'Waiting for reply' : 'View request', disabled: relation.status === 'outgoing_request', destination: `/pages/connections/${relation.status === 'outgoing_request' ? 'sent' : 'received'}?request_id=${encodeURIComponent(relation.request_id)}`, error: '' }
  else if (relation.match_id) {
    const match = data.match_sessions.find(row => row.match_id === relation.match_id), incoming = match.owner_user_id !== owner
    primary = { kind: 'match', label: 'View match', destination: incoming ? `/pages/connections/received?match_id=${encodeURIComponent(match.match_id)}` : `/pages/auto-match/${relation.match_status}?match_id=${encodeURIComponent(match.match_id)}`, error: '' }
  } else primary = { kind: 'introduction', label: 'Send shot', destination: blocker ? '' : `/pages/discover/icebreaker/select?user_id=${encodeURIComponent(target)}`, error: blocker }
  const error = draft_id && (!draft || !question) ? 'This introduction is unavailable. Choose a question again.' : ''
  return clone_data({ error, user, questions, question, draft: draft || null, audio, primary, blocker, completed_request_id: completed?.request_id || null, balance: balance(data) })
}
