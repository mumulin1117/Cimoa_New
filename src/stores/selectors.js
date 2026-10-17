import { ONBOARDING_FLOW } from '../utils/onboardingFlow.js'
import { effective_match_status } from './matchState.js'
import { clone_data } from './seed.js'
export const owner_id = (data) => data.session.current_user_id
export const authenticated = (data, now = Date.now()) => data.session.expires_at > now && data.accounts.some((account) => account.account_id === data.session.account_id && account.user_id === owner_id(data) && account.status === 'active')
export const blocked = (data, user_id, owner = owner_id(data)) => data.blocked_users.some((row) => row.owner_user_id === owner && row.user_id === user_id)
export const visible = (data, user_id) => data.users.some((user) => user.user_id === user_id && !user.deleted) && !blocked(data, user_id) && !blocked(data, owner_id(data), user_id)
export const privacy_for = (data, user_id) => data.settings.find((row) => row.owner_user_id === user_id)?.privacy || {}
export const match_visible = (data, user_id) => visible(data, user_id) && privacy_for(data, user_id).auto_match_visible !== false
export const user_by_id = (data, user_id) => {
  if (!visible(data, user_id)) return null
  const user = data.users.find((row) => row.user_id === user_id)
  const privacy = privacy_for(data, user_id)
  return clone_data({ ...user, ...(owner_id(data) !== user_id ? { year: privacy.show_year === false ? '' : user.year, major: privacy.show_field === false ? '' : user.major } : {}) })
}
export const balance = (data, owner = owner_id(data)) => data.coin_transactions.filter((row) => row.owner_user_id === owner && row.status === 'completed').reduce((sum, row) => sum + row.amount, 0)
export const connected = (data, user_id, owner = owner_id(data)) => !!owner && visible(data, user_id) && [[owner, user_id], [user_id, owner]].every(([from, to]) => data.relationships.some((row) => row.from_user_id === from && row.to_user_id === to))
export const social_eligible = (data, user_id = owner_id(data)) => {
  const user = data.users.find(row => row.user_id === user_id && !row.deleted)
  if (!user) return false
  if (user.verification_status === 'verified') return true
  return user.verification_status === 'pending' && user.onboarding_status === 'complete' && data.accounts.some(row => row.user_id === user_id && row.status === 'active' && row.auth_provider === 'local' && row.local_verification?.method === 'fixed_code' && row.local_verification.status === 'verified')
}
// Shared read model for Home, profiles, participant lists and chat permissions.
// Requests and directional consent remain the only persisted relationship facts.
export const relationship_state = (data, target, now = Date.now()) => {
  const owner = owner_id(data)
  const unavailable = !owner || target === owner || !data.users.some(row => row.user_id === target && !row.deleted)
  const blocked_by_me = blocked(data, target), blocked_by_them = blocked(data, owner, target)
  const mutual = !unavailable && connected(data, target)
  const request = data.requests.filter(row => row.status === 'pending' && [row.sender_id, row.recipient_id].includes(owner) && [row.sender_id, row.recipient_id].includes(target)).sort((a, b) => b.created_at - a.created_at)[0]
  const match = data.match_sessions.filter(row => row.owner_user_id === owner && row.candidate_id === target || row.owner_user_id === target && row.candidate_id === owner && row.self_accepted).sort((a, b) => b.created_at - a.created_at)[0]
  const conversation = mutual ? data.conversations.find(row => row.kind === 'direct' && row.participant_ids.includes(owner) && row.participant_ids.includes(target)) : null
  const match_state = match ? match_status(match, now) : null
  const status = unavailable ? 'unavailable' : blocked_by_me ? 'blocked' : blocked_by_them ? 'unavailable' : mutual ? 'connected' : request ? request.sender_id === owner ? 'outgoing_request' : 'incoming_request' : ['found', 'waiting'].includes(match_state) ? 'matched' : 'none'
  return { user_id: target, status, blocked_by_me, blocked_by_them, connected: mutual, request_id: ['incoming_request', 'outgoing_request'].includes(status) ? request.request_id : null, conversation_id: conversation?.conversation_id || null, match_id: status === 'matched' ? match.match_id : null, match_status: status === 'matched' ? match_state : null }
}
export const introduction_blocker = (data, target, now = Date.now()) => {
  const owner = owner_id(data)
  if (!authenticated(data, now)) return 'Your session has expired. Please sign in again.'
  if (!social_eligible(data)) return 'Complete account verification and profile setup first.'
  if (target === owner || !visible(data, target)) return 'This profile is unavailable.'
  if (connected(data, target)) return 'You are already connected.'
  if (!social_eligible(data, target)) return 'This person is not available for a new connection.'
  if (data.requests.some((row) => row.status === 'pending' && [row.sender_id, row.recipient_id].includes(owner) && [row.sender_id, row.recipient_id].includes(target))) return 'A request is already pending.'
  if (data.match_sessions.some(row => row.status === 'waiting' && row.self_accepted && [row.owner_user_id, row.candidate_id].includes(owner) && [row.owner_user_id, row.candidate_id].includes(target))) return 'A match invitation is already pending.'
  return ''
}
export const utc_date_key = (now) => new Date(now).toISOString().slice(0, 10)
export const remaining_quota = (data, now = Date.now()) => Math.max(0, data.quota_policy.free_daily_limit - (data.match_quota.find((row) => row.owner_user_id === owner_id(data) && row.date_key === utc_date_key(now))?.used_count || 0))
export const match_status = effective_match_status
export const owned_matches = (data, now = Date.now()) => data.match_sessions.filter((row) => row.owner_user_id === owner_id(data) && (!row.candidate_id || visible(data, row.candidate_id))).map((row) => ({ ...row, status: match_status(row, now) }))
export const active_match = (data, now = Date.now()) => owned_matches(data, now).filter(row => !row.fixture && ['searching', 'paused', 'found', 'waiting'].includes(row.status) && (!row.candidate_id || !connected(data, row.candidate_id))).sort((a, b) => b.created_at - a.created_at || a.match_id.localeCompare(b.match_id))[0] || null
export const members = (data, event_id) => data.memberships.filter((row) => row.event_id === event_id && row.status === 'joined')
export const joined = (data, event_id, user_id = owner_id(data)) => members(data, event_id).some((row) => row.user_id === user_id)
export const can_open_conversation = (data, conversation) => !!conversation && (conversation.kind === 'group' ? joined(data, conversation.event_id) : conversation.participant_ids.includes(owner_id(data)) && connected(data, conversation.participant_ids.find((id) => id !== owner_id(data))))
export const goals_for_user = (data, user_id) => clone_data((user_by_id(data, user_id)?.goal_ids || []).map((id) => data.goals.find((row) => row.item_id === id)).filter(Boolean))
export const messages_for = (data, conversation_id) => can_open_conversation(data, data.conversations.find((row) => row.conversation_id === conversation_id)) ? data.messages.filter((row) => row.conversation_id === conversation_id && visible(data, row.sender_id)).sort((a, b) => a.sent_at - b.sent_at) : []
// Compatibility exports forward to the canonical Home projection; no parallel rules.
export { home_cards, home_match_card } from './homeFeed.js'
export const ensure = (condition, message) => { if (!condition) throw new Error(message) }
export function validate_data(data) {
  const tables = { users: 'user_id', accounts: 'account_id', goals: 'item_id', interests: 'item_id', icebreakers: 'question_id', profile_photos: 'photo_id', songs: 'song_id', media_files: 'media_id', relationships: 'relationship_id', requests: 'request_id', match_sessions: 'match_id', events: 'event_id', organizers: 'organizer_id', memberships: 'membership_id', conversations: 'conversation_id', messages: 'message_id', coin_packages: 'package_id', coin_transactions: 'transaction_id', purchase_requests: 'request_id', blocked_users: 'block_id', reports: 'report_id', drafts: 'draft_id', support_requests: 'support_id' }
  const has = (table, id) => data[table].some((row) => row[tables[table]] === id)
  const unique = (rows, key) => new Set(rows.map(key)).size === rows.length
  ensure(data.schema_version === 2 && Number.isInteger(data.revision) && data.revision >= 0, 'Saved data version is invalid.')
  for (const [table, key] of Object.entries(tables)) ensure(Array.isArray(data[table]) && data[table].every((row) => typeof row[key] === 'string' && row[key]) && unique(data[table], (row) => row[key]), `Invalid ${table} identifiers.`)
  ensure(unique(data.accounts, (row) => row.email.toLowerCase()), 'Duplicate account email.')
  ensure(unique(data.accounts, row => row.user_id), 'Duplicate account identity.')
  for (const row of data.accounts) ensure(has('users', row.user_id) && typeof row.email === 'string' && row.email === row.email.trim().toLowerCase() && ['active', 'deleted'].includes(row.status), 'Invalid account.')
  for (const row of data.accounts) if (row.local_verification != null) ensure(row.local_verification.method === 'fixed_code' && row.local_verification.status === 'verified' && Number.isFinite(row.local_verification.verified_at), 'Invalid local verification.')
  for (const row of data.accounts) if (row.onboarding != null) {
    const progress = row.onboarding
    ensure(ONBOARDING_FLOW.includes(progress.step) && Array.isArray(progress.completed_steps) && unique(progress.completed_steps, step => step) && progress.completed_steps.every(step => ONBOARDING_FLOW.includes(step)), 'Invalid profile setup progress.')
    ensure(progress.completed_at === undefined || Number.isFinite(progress.completed_at), 'Invalid profile completion time.')
    ensure(progress.notification_permission === undefined || ['granted', 'denied', 'skipped', 'unavailable'].includes(progress.notification_permission), 'Invalid notification choice.')
  }
  if (data.auth_flow.pending_registration_account_id != null) ensure(has('accounts', data.auth_flow.pending_registration_account_id), 'Invalid registration account.')
  if (data.auth_flow.password_reset != null) {
    const reset = data.auth_flow.password_reset
    ensure(typeof reset.reset_id === 'string' && reset.reset_id && has('accounts', reset.account_id) && typeof reset.email === 'string' && Number.isFinite(reset.created_at) && (reset.verified_at == null || Number.isFinite(reset.verified_at)), 'Invalid password reset.')
  }
  if (owner_id(data)) ensure(data.accounts.some((row) => row.account_id === data.session.account_id && row.user_id === owner_id(data)) && Number.isFinite(data.session.expires_at), 'Invalid session.')
  for (const row of data.users) {
    ensure(typeof row.user_name === 'string' && row.user_name && (row.age === null || Number.isInteger(row.age) && row.age >= 18), 'Invalid profile.')
    for (const [field, table] of [['goal_ids', 'goals'], ['interest_ids', 'interests'], ['photo_ids', 'profile_photos'], ['icebreaker_ids', 'icebreakers']]) ensure(Array.isArray(row[field]) && new Set(row[field]).size === row[field].length && row[field].every((id) => has(table, id)), `Invalid ${field}.`)
    ensure(row.photo_ids.every(id => data.profile_photos.some(photo => photo.photo_id === id && photo.user_id === row.user_id)) && row.icebreaker_ids.every(id => data.icebreakers.some(question => question.question_id === id && question.user_id === row.user_id)), 'Profile media or questions belong to another user.')
    ensure(!row.song_id || has('songs', row.song_id), 'Invalid song.')
    if (row.voice_intro != null) ensure(typeof row.voice_intro.audio_url === 'string' && row.voice_intro.audio_url.startsWith('/static/assets/') && Number.isFinite(row.voice_intro.duration_ms) && row.voice_intro.duration_ms > 0 && typeof row.voice_intro.transcript === 'string' && row.voice_intro.transcript.trim(), 'Invalid voice introduction.')
    ensure(balance(data, row.user_id) >= 0, 'Not enough coins.')
  }
  for (const row of data.icebreakers) ensure(has('users', row.user_id) && typeof row.text === 'string' && row.text.trim(), 'Invalid question.')
  for (const row of data.profile_photos) ensure(has('users', row.user_id) && typeof row.media_url === 'string' && row.media_url && (row.focal_point === undefined || /^\d{1,3}% \d{1,3}%$/.test(row.focal_point)), 'Invalid photo.')
  for (const row of data.media_files) ensure(has('users', row.owner_user_id) && ['image', 'audio'].includes(row.kind) && row.media_url === `indexeddb://${row.media_id}` && row.byte_size > 0 && row.mime.startsWith(`${row.kind}/`), 'Invalid media.')
  for (const row of data.relationships) ensure(has('users', row.from_user_id) && has('users', row.to_user_id) && row.from_user_id !== row.to_user_id && Number.isFinite(row.created_at), 'Invalid relationship.')
  ensure(unique(data.relationships, (row) => `${row.from_user_id}:${row.to_user_id}`), 'Duplicate relationship.')
  for (const row of data.relationships) {
    if (row.source_request_id) ensure(data.requests.some(request => request.request_id === row.source_request_id && request.status === 'accepted' && [request.sender_id, request.recipient_id].includes(row.from_user_id) && [request.sender_id, request.recipient_id].includes(row.to_user_id)), 'Invalid connection request consent.')
    if (row.source_match_id) ensure(data.match_sessions.some(match => match.match_id === row.source_match_id && match.status === 'connected' && [match.owner_user_id, match.candidate_id].includes(row.from_user_id) && [match.owner_user_id, match.candidate_id].includes(row.to_user_id)), 'Invalid matching consent.')
  }
  for (const row of data.requests) ensure(has('users', row.sender_id) && has('users', row.recipient_id) && row.sender_id !== row.recipient_id && data.icebreakers.some((q) => q.question_id === row.question_id && q.user_id === row.recipient_id) && ['pending', 'accepted', 'declined', 'cancelled'].includes(row.status) && ['text', 'voice'].includes(row.kind) && (row.kind === 'text' ? !!row.text.trim() : has('media_files', row.audio_id) || row.fixture_media_unavailable === true), 'Invalid request.')
  ensure(unique(data.requests.filter(row => row.status === 'pending'), row => [row.sender_id, row.recipient_id].sort().join(':')), 'Duplicate pending request.')
  for (const row of data.requests.filter(row => row.kind === 'voice' && row.audio_id)) ensure(data.media_files.some(media => media.media_id === row.audio_id && media.kind === 'audio' && media.owner_user_id === row.sender_id), 'Introduction media belongs to another user.')
  for (const row of data.requests) ensure(Number.isFinite(row.created_at) && (row.resolved_at == null || Number.isFinite(row.resolved_at) && row.resolved_at >= row.created_at) && (row.question_text === undefined || typeof row.question_text === 'string' && row.question_text.trim()) && (row.kind !== 'text' || row.text.length <= 300 && !row.audio_id), 'Invalid introduction content or time.')
  for (const row of data.match_sessions) ensure(has('users', row.owner_user_id) && (!row.candidate_id || has('users', row.candidate_id)) && ['searching', 'paused', 'found', 'waiting', 'connected', 'passed', 'expired', 'no_match', 'left'].includes(row.status) && (row.status !== 'connected' || row.self_accepted && row.peer_accepted), 'Invalid match.')
  for (const row of data.match_sessions) ensure((row.queue_position == null || Number.isInteger(row.queue_position) && row.queue_position > 0) && (row.estimated_wait_seconds == null || Number.isFinite(row.estimated_wait_seconds) && row.estimated_wait_seconds >= 0), 'Invalid queue details.')
  for (const row of data.match_sessions.filter(row => row.engine === 'device')) ensure(Number.isFinite(row.search_ready_at) && (row.status === 'paused' || row.candidate_id === null || Number.isFinite(row.expires_at)), 'Invalid device matching deadline.')
  for (const row of data.match_sessions) ensure((row.search_remaining_ms == null || Number.isFinite(row.search_remaining_ms) && row.search_remaining_ms >= 0) && (row.priority_until == null || Number.isFinite(row.priority_until)) && (row.search_revision == null || Number.isInteger(row.search_revision) && row.search_revision >= 0) && (row.last_event_sequence == null || Number.isInteger(row.last_event_sequence) && row.last_event_sequence >= 0), 'Invalid matching recovery state.')
  for (const row of data.match_preferences) ensure(['Similar interests', 'A mix', 'Surprise me'].includes(row.interest_mode), 'Invalid interest matching preference.')
  ensure(Array.isArray(data.match_distances) && unique(data.match_distances,row=>row.area_pair_id), 'Invalid campus distance identifiers.')
  for(const row of data.match_distances) ensure(typeof row.area_pair_id==='string' && row.area_pair_id && typeof row.university_a==='string' && row.university_a && typeof row.university_b==='string' && row.university_b && Number.isFinite(row.distance_km) && row.distance_km>=0 && row.source==='generated_campus_region', 'Invalid campus distance.')
  ensure(data.quota_policy.timezone === 'UTC', 'The quota timezone must be UTC.')
  ensure(unique(data.match_quota, (row) => `${row.owner_user_id}:${row.date_key}`), 'Duplicate daily quota.')
  for (const row of data.match_quota) ensure(has('users', row.owner_user_id) && /^\d{4}-\d{2}-\d{2}$/.test(row.date_key) && Number.isInteger(row.used_count) && row.used_count >= 0 && row.used_count <= 3, 'Invalid daily quota.')
  for (const row of data.events) {
    ensure(has('organizers', row.organizer_id) && Number.isInteger(row.capacity) && row.capacity >= members(data, row.event_id).length && Number.isFinite(row.starts_at) && Number.isFinite(row.ends_at) && row.ends_at > row.starts_at, 'Invalid event.')
    if (row.time_zone !== undefined) { ensure(typeof row.time_zone === 'string', 'Invalid event timezone.'); new Intl.DateTimeFormat('en-US', { timeZone: row.time_zone }) }
    ensure(row.feed_order === undefined || Number.isFinite(row.feed_order), 'Invalid event order.')
  }
  ensure(unique(data.event_preferences, row => row.owner_user_id), 'Duplicate event preferences.')
  for (const row of data.event_preferences) ensure(row.active_tab === undefined || ['Today', 'This week', 'My campus'].includes(row.active_tab), 'Invalid event tab.')
  for (const row of data.event_preferences) if (row.group_muted_event_ids !== undefined) ensure(Array.isArray(row.group_muted_event_ids) && unique(row.group_muted_event_ids, id => id) && row.group_muted_event_ids.every(id => has('events', id)), 'Invalid group notification preference.')
  for (const row of data.memberships) ensure(has('users', row.user_id) && has('events', row.event_id) && ['joined', 'left'].includes(row.status), 'Invalid member.')
  ensure(unique(data.memberships, (row) => `${row.event_id}:${row.user_id}`), 'Duplicate member.')
  for (const row of data.conversations) ensure(row.kind === 'group' ? has('events', row.event_id) : row.kind === 'direct' && row.participant_ids.length === 2 && new Set(row.participant_ids).size === 2 && row.participant_ids.every((id) => has('users', id)), 'Invalid conversation.')
  ensure(unique(data.conversations.filter(row => row.kind === 'direct'), row => [...row.participant_ids].sort().join(':')), 'Duplicate private conversation.')
  for (const row of data.messages) ensure(has('users', row.sender_id) && has('conversations', row.conversation_id) && row.read_by.every((id) => has('users', id)) && ['text', 'image', 'audio'].includes(row.kind) && (row.kind === 'text' ? !!row.body.trim() : has('media_files', row.media_id)), 'Invalid message.')
  for (const row of data.messages) {
    const conversation = data.conversations.find(item => item.conversation_id === row.conversation_id)
    ensure(Number.isFinite(row.sent_at) && unique(row.read_by, id => id) && (conversation.kind !== 'direct' || conversation.participant_ids.includes(row.sender_id) && row.read_by.every(id => conversation.participant_ids.includes(id))), 'Invalid private message participant or time.')
    if (row.kind !== 'text') ensure(data.media_files.some(media => media.media_id === row.media_id && media.owner_user_id === row.sender_id && media.kind === row.kind), 'Message media belongs to another user.')
  }
  ensure(unique(data.coin_transactions, (row) => `${row.owner_user_id}:${row.business_key}`), 'Duplicate coin transaction.')
  for (const row of data.coin_transactions) ensure(has('users', row.owner_user_id) && Number.isInteger(row.amount) && row.amount !== 0 && ['completed', 'cancelled', 'failed'].includes(row.status), 'Invalid transaction.')
  for (const row of data.purchase_requests) ensure(has('users', row.owner_user_id) && has('coin_packages', row.package_id) && ['pending', 'success', 'failure', 'cancelled', 'timeout'].includes(row.status), 'Invalid purchase.')
  for (const table of ['settings', 'event_preferences', 'match_preferences', 'blocked_users', 'reports', 'drafts', 'support_requests', 'operation_receipts']) for (const row of data[table]) ensure(has('users', row.owner_user_id), 'Invalid account scope.')
  for (const row of data.settings) {
    ensure(row.language === undefined || row.language === 'en-US', 'Invalid language setting.')
    if (row.notifications) ensure(Object.values(row.notifications).every(value => typeof value === 'boolean'), 'Invalid notification setting.')
    if (row.privacy) ensure(Object.values(row.privacy).every(value => typeof value === 'boolean'), 'Invalid privacy setting.')
    if (row.muted_direct_user_ids !== undefined) ensure(Array.isArray(row.muted_direct_user_ids) && unique(row.muted_direct_user_ids, id => id) && row.muted_direct_user_ids.every(id => has('users', id) && id !== row.owner_user_id), 'Invalid direct notification preference.')
  }
  for (const row of data.blocked_users) ensure(has('users', row.user_id) && row.user_id !== row.owner_user_id, 'Invalid block.')
  ensure(unique(data.blocked_users, (row) => `${row.owner_user_id}:${row.user_id}`), 'Duplicate block.')
  for (const row of data.reports) ensure(['user', 'event'].includes(row.target_type) && typeof row.reason === 'string' && row.reason && row.status === 'local_saved' && (row.target_type === 'user' ? has('users', row.target_id) && row.target_id !== row.owner_user_id : has('events', row.target_id)), 'Invalid report.')
  ensure(unique(data.operation_receipts, (row) => `${row.owner_user_id}:${row.operation_id}`), 'Duplicate operation.')
  return true
}
