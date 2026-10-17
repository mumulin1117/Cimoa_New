import { clone_data } from './seed.js'
import { authenticated, owner_id, visible, user_by_id, goals_for_user, owned_matches, active_match, match_status, remaining_quota, utc_date_key } from './selectors.js'
import { connection_for, connection_request } from './connectionEntities.js'
import { direct_conversation } from './directMessaging.js'

const labels = { connected: 'Connected', auto_match: 'Auto Match', match_invite: 'Invite', invite: 'Invite', sent: 'Sent' }
const groups = { connected: 0, auto_match: 1, match_invite: 2, invite: 3, sent: 4 }
const by_recency = (a, b) => b.activity_at - a.activity_at || a.source_id.localeCompare(b.source_id)
const match_route = row => `/pages/auto-match/${row.status}?match_id=${encodeURIComponent(row.match_id)}`

function empty_feed(status, error_message = '') {
  return { status, error_message, owner_user_id: null, cards: [], match_card: null, quota: null, destinations: {}, counts: { total: 0, connected: 0, incoming_requests: 0, outgoing_requests: 0, match_candidates: 0, match_invitations: 0, unread_messages: 0 } }
}

// Read-only composition of canonical entities. No persisted feed, navigation,
// timers, synthetic contacts, automatic consent or message-read side effects.
export function home_feed(data, now = Date.now(), hydration_status = 'ready', hydration_error = '') {
  if (hydration_status === 'error') return empty_feed('error', hydration_error || 'Saved data could not be loaded. Please retry.')
  if (hydration_status !== 'ready') return empty_feed('loading')
  const owner = owner_id(data)
  if (!authenticated(data, now) || !data.users.some(row => row.user_id === owner && !row.deleted)) return empty_feed('session_expired', 'Please sign in again to view your connections.')
  const people = new Map()
  const offer = (priority, card) => {
    if (card.user_id === owner || !visible(data, card.user_id)) return
    const previous = people.get(card.user_id)
    if (!previous || priority < previous.priority || priority === previous.priority && by_recency(card, previous.card) < 0) people.set(card.user_id, { priority, card })
  }
  for (const user of data.users) {
    const connection = connection_for(data, user.user_id, now)
    if (!connection) continue
    const conversation = connection.conversation_id ? direct_conversation(data, connection.conversation_id, now) : null
    offer(0, {
      user_id: user.user_id, kind: 'connected', source_id: connection.connection_id,
      connection_id: connection.connection_id, conversation_id: conversation?.conversation_id || null,
      activity_at: Math.max(connection.created_at, conversation?.updated_at || 0),
      preview: conversation?.preview || '', last_message: conversation?.last_message || null, unread_count: conversation?.unread_count || 0,
      destination: conversation ? `/pages/messages/chat?conversation_id=${encodeURIComponent(conversation.conversation_id)}` : '',
      unavailable_reason: conversation ? '' : 'This conversation is unavailable. Your connection has not changed.',
    })
  }
  for (const row of data.requests) {
    if (row.status !== 'pending' || ![row.sender_id, row.recipient_id].includes(owner)) continue
    const request = connection_request(data, row.request_id, now)
    if (!request) continue
    const outgoing = request.direction === 'outgoing'
    offer(1, {
      user_id: outgoing ? request.recipient_id : request.sender_id, kind: outgoing ? 'sent' : 'invite', source_id: request.request_id,
      request_id: request.request_id, activity_at: request.created_at,
      destination: `/pages/connections/${outgoing ? 'sent' : 'received'}?request_id=${encodeURIComponent(request.request_id)}`,
    })
  }
  for (const row of data.match_sessions) {
    if (row.candidate_id !== owner || !row.self_accepted || match_status(row, now) !== 'waiting') continue
    offer(2, { user_id: row.owner_user_id, kind: 'match_invite', source_id: row.match_id, match_id: row.match_id, activity_at: row.created_at, destination: `/pages/connections/received?match_id=${encodeURIComponent(row.match_id)}` })
  }
  for (const row of owned_matches(data, now)) {
    if (!row.candidate_id || !['found', 'waiting'].includes(row.status)) continue
    offer(3, { user_id: row.candidate_id, kind: 'auto_match', source_id: row.match_id, match_id: row.match_id, activity_at: row.created_at, destination: match_route(row) })
  }
  const cards = [...people.values()].map(({ card }) => ({
    connection_id: null, conversation_id: null, request_id: null, match_id: null, preview: '', last_message: null, unread_count: 0, unavailable_reason: '',
    ...card, status_label: labels[card.kind], user: user_by_id(data, card.user_id), goals: goals_for_user(data, card.user_id),
  })).sort((a, b) => groups[a.kind] - groups[b.kind] || b.activity_at - a.activity_at || a.user_id.localeCompare(b.user_id))
  const match_card = home_match_card(data, now)
  const counts = { total: cards.length, connected: 0, incoming_requests: 0, outgoing_requests: 0, match_candidates: 0, match_invitations: 0, unread_messages: 0 }
  const count_keys = { connected: 'connected', auto_match: 'match_candidates', match_invite: 'match_invitations', invite: 'incoming_requests', sent: 'outgoing_requests' }
  for (const card of cards) { counts[count_keys[card.kind]]++; counts.unread_messages += card.unread_count }
  const remaining = remaining_quota(data, now)
  return clone_data({ status: cards.length ? 'ready' : 'empty', error_message: '', owner_user_id: owner, cards, match_card, counts, quota: { date_key: utc_date_key(now), remaining, daily_limit: data.quota_policy.free_daily_limit, is_paid: remaining === 0 }, destinations: { profile: '/pages/profile/index', match: '/pages/auto-match/index', discover: '/pages/discover/index' } })
}

export function home_cards(data, now = Date.now()) { return home_feed(data, now).cards }

export function home_match_card(data, now = Date.now()) {
  if (!authenticated(data, now)) return null
  const row = active_match(data, now)
  if (!row) return null
  const name = row.candidate_id ? user_by_id(data, row.candidate_id)?.user_name : null
  const content = {
    searching: ['Finding your match', row.queue_position ? `Queue position ${row.queue_position}${row.estimated_wait_seconds != null ? row.estimated_wait_seconds < 60 ? ' · under a min' : ` · about ${Math.ceil(row.estimated_wait_seconds / 60)} min` : ''}` : 'Waiting for a queue update', 'View Status'],
    paused: ['Matching paused', 'Resume whenever you’re ready', 'Resume'],
    found: ['Your match is ready', 'View before it expires', 'View match'],
    waiting: [`Waiting for ${name || 'your match'}`, 'Waiting for their response', 'View status'],
  }[row.status]
  return { match_id: row.match_id, status: row.status, candidate_id: row.candidate_id, title: content[0], subtitle: content[1], action: content[2], destination: match_route(row), created_at: row.created_at, expires_at: row.expires_at ?? null, search_ready_at: row.search_ready_at ?? null }
}
