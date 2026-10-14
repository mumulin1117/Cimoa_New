import { ONBOARDING_FLOW } from '../utils/onboardingFlow.js'
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
  return { ...user, ...(owner_id(data) !== user_id ? { year: privacy.show_year === false ? '' : user.year, major: privacy.show_field === false ? '' : user.major } : {}) }
}
export const balance = (data, owner = owner_id(data)) => data.coin_transactions.filter((row) => row.owner_user_id === owner && row.status === 'completed').reduce((sum, row) => sum + row.amount, 0)
export const connected = (data, user_id, owner = owner_id(data)) => !!owner && visible(data, user_id) && [[owner, user_id], [user_id, owner]].every(([from, to]) => data.relationships.some((row) => row.from_user_id === from && row.to_user_id === to))
export const introduction_blocker = (data, target, now = Date.now()) => {
  const owner = owner_id(data)
  if (!authenticated(data, now)) return 'Your session has expired. Please sign in again.'
  if (data.users.find((row) => row.user_id === owner)?.verification_status !== 'verified') return 'Student verification is required.'
  if (target === owner || !visible(data, target)) return 'This profile is unavailable.'
  if (connected(data, target)) return 'You are already connected.'
  if (data.requests.some((row) => row.status === 'pending' && [row.sender_id, row.recipient_id].includes(owner) && [row.sender_id, row.recipient_id].includes(target))) return 'A request is already pending.'
  return ''
}
export const utc_date_key = (now) => new Date(now).toISOString().slice(0, 10)
export const remaining_quota = (data, now = Date.now()) => Math.max(0, data.quota_policy.free_daily_limit - (data.match_quota.find((row) => row.owner_user_id === owner_id(data) && row.date_key === utc_date_key(now))?.used_count || 0))
export const match_status = (row, now) => row.status === 'found' && row.expires_at <= now ? 'expired' : row.status
export const owned_matches = (data, now = Date.now()) => data.match_sessions.filter((row) => row.owner_user_id === owner_id(data) && (!row.candidate_id || visible(data, row.candidate_id))).map((row) => ({ ...row, status: match_status(row, now) }))
export const active_match = (data, now = Date.now()) => owned_matches(data, now).find((row) => !row.fixture && ['searching', 'paused', 'found', 'waiting'].includes(row.status)) || null
export const members = (data, event_id) => data.memberships.filter((row) => row.event_id === event_id && row.status === 'joined')
export const joined = (data, event_id, user_id = owner_id(data)) => members(data, event_id).some((row) => row.user_id === user_id)
export const can_open_conversation = (data, conversation) => !!conversation && (conversation.kind === 'group' ? joined(data, conversation.event_id) : conversation.participant_ids.includes(owner_id(data)) && connected(data, conversation.participant_ids.find((id) => id !== owner_id(data))))
export const goals_for_user = (data, user_id) => (user_by_id(data, user_id)?.goal_ids || []).map((id) => data.goals.find((row) => row.item_id === id)).filter(Boolean)
export const messages_for = (data, conversation_id) => can_open_conversation(data, data.conversations.find((row) => row.conversation_id === conversation_id)) ? data.messages.filter((row) => row.conversation_id === conversation_id && visible(data, row.sender_id)).sort((a, b) => a.sent_at - b.sent_at) : []
export const home_cards = (data, now = Date.now()) => {
  const cards = new Map()
  for (const row of data.conversations) {
    if (row.kind !== 'direct' || !can_open_conversation(data, row)) continue
    const user_id = row.participant_ids.find((id) => id !== owner_id(data))
    cards.set(user_id, { user_id, kind: 'connected', conversation_id: row.conversation_id })
  }
  for (const row of owned_matches(data, now)) {
    if (!row.candidate_id || cards.has(row.candidate_id) || ['passed', 'left', 'no_match'].includes(row.status)) continue
    cards.set(row.candidate_id, { user_id: row.candidate_id, kind: 'auto_match', match_id: row.match_id })
  }
  for (const row of data.requests) {
    if (row.recipient_id !== owner_id(data) || row.status !== 'pending' || !visible(data, row.sender_id) || cards.has(row.sender_id)) continue
    cards.set(row.sender_id, { user_id: row.sender_id, kind: 'invite', request_id: row.request_id })
  }
  return [...cards.values()].map((row) => ({ ...row, user: user_by_id(data, row.user_id), goals: goals_for_user(data, row.user_id) }))
}
export const home_match_card = (data, now) => {
  const row = active_match(data, now)
  if (!row) return null
  const name = row.candidate_id ? user_by_id(data, row.candidate_id)?.user_name : null
  const content = {
    searching: ['Finding your match', row.queue_position ? `Queue position ${row.queue_position}${row.estimated_wait_seconds ? ` · about ${Math.ceil(row.estimated_wait_seconds / 60)} min` : ''}` : 'Waiting for a queue update', 'View Status'],
    paused: ['Matching paused', 'Resume whenever you’re ready', 'Resume'],
    found: ['Your match is ready', 'View before it expires', 'View match'],
    waiting: [`Waiting for ${name || 'your match'}`, 'Waiting for their response', 'View status'],
  }[row.status]
  return { match_id: row.match_id, status: row.status, title: content[0], subtitle: content[1], action: content[2] }
}
export const ensure = (condition, message) => { if (!condition) throw new Error(message) }
export function validate_data(data) {
  const tables = { users: 'user_id', accounts: 'account_id', goals: 'item_id', interests: 'item_id', icebreakers: 'question_id', profile_photos: 'photo_id', songs: 'song_id', media_files: 'media_id', relationships: 'relationship_id', requests: 'request_id', match_sessions: 'match_id', events: 'event_id', organizers: 'organizer_id', memberships: 'membership_id', conversations: 'conversation_id', messages: 'message_id', coin_packages: 'package_id', coin_transactions: 'transaction_id', purchase_requests: 'request_id', blocked_users: 'block_id', reports: 'report_id', drafts: 'draft_id', support_requests: 'support_id' }
  const has = (table, id) => data[table].some((row) => row[tables[table]] === id)
  const unique = (rows, key) => new Set(rows.map(key)).size === rows.length
  ensure(data.schema_version === 2 && Number.isInteger(data.revision) && data.revision >= 0, 'Saved data version is invalid.')
  for (const [table, key] of Object.entries(tables)) ensure(Array.isArray(data[table]) && data[table].every((row) => typeof row[key] === 'string' && row[key]) && unique(data[table], (row) => row[key]), `Invalid ${table} identifiers.`)
  ensure(unique(data.accounts, (row) => row.email.toLowerCase()), 'Duplicate account email.')
  for (const row of data.accounts) ensure(has('users', row.user_id) && ['active', 'deleted'].includes(row.status), 'Invalid account.')
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
    ensure(!row.song_id || has('songs', row.song_id), 'Invalid song.')
    ensure(balance(data, row.user_id) >= 0, 'Not enough coins.')
  }
  for (const row of data.icebreakers) ensure(has('users', row.user_id) && typeof row.text === 'string' && row.text.trim(), 'Invalid question.')
  for (const row of data.profile_photos) ensure(has('users', row.user_id) && typeof row.media_url === 'string' && row.media_url, 'Invalid photo.')
  for (const row of data.media_files) ensure(has('users', row.owner_user_id) && ['image', 'audio'].includes(row.kind) && row.media_url === `indexeddb://${row.media_id}` && row.byte_size > 0 && row.mime.startsWith(`${row.kind}/`), 'Invalid media.')
  for (const row of data.relationships) ensure(has('users', row.from_user_id) && has('users', row.to_user_id) && row.from_user_id !== row.to_user_id, 'Invalid relationship.')
  ensure(unique(data.relationships, (row) => `${row.from_user_id}:${row.to_user_id}`), 'Duplicate relationship.')
  for (const row of data.requests) ensure(has('users', row.sender_id) && has('users', row.recipient_id) && row.sender_id !== row.recipient_id && data.icebreakers.some((q) => q.question_id === row.question_id && q.user_id === row.recipient_id) && ['pending', 'accepted', 'declined', 'cancelled'].includes(row.status) && ['text', 'voice'].includes(row.kind) && (row.kind === 'text' ? !!row.text.trim() : has('media_files', row.audio_id) || row.fixture_media_unavailable === true), 'Invalid request.')
  for (const row of data.match_sessions) ensure(has('users', row.owner_user_id) && (!row.candidate_id || has('users', row.candidate_id)) && ['searching', 'paused', 'found', 'waiting', 'connected', 'passed', 'expired', 'no_match', 'left'].includes(row.status) && (row.status !== 'connected' || row.self_accepted && row.peer_accepted), 'Invalid match.')
  for (const row of data.match_sessions) ensure((row.queue_position == null || Number.isInteger(row.queue_position) && row.queue_position > 0) && (row.estimated_wait_seconds == null || Number.isFinite(row.estimated_wait_seconds) && row.estimated_wait_seconds >= 0), 'Invalid queue details.')
  for (const row of data.match_preferences) ensure(['Similar interests', 'A mix', 'Surprise me'].includes(row.interest_mode), 'Invalid interest matching preference.')
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
  for (const row of data.messages) ensure(has('users', row.sender_id) && has('conversations', row.conversation_id) && row.read_by.every((id) => has('users', id)) && ['text', 'image', 'audio'].includes(row.kind) && (row.kind === 'text' ? !!row.body.trim() : has('media_files', row.media_id)), 'Invalid message.')
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
