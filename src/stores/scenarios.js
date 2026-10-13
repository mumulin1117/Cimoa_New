// Test fixture factory, never selected from production URL parameters.
import { create_seed, clone_data, TEST_USER_ID } from './seed.js'
import { validate_data } from './selectors.js'
export const SCENARIOS = ['default', 'home_empty', 'home_single', 'home_long', 'missing_avatar', 'zero_coins', 'quota_used', 'one_way', 'request_declined', 'request_accepted', 'blocked', 'session_expired', 'account_deleted', 'event_joined', 'event_past', 'three_chats', ...['searching', 'paused', 'found', 'waiting', 'connected', 'passed', 'expired', 'no_match', 'left'].map((status) => `match_${status}`)]
const connect = (data, other, index = 0) => {
  for (const [from, to] of [[TEST_USER_ID, other], [other, TEST_USER_ID]]) if (!data.relationships.some((row) => row.from_user_id === from && row.to_user_id === to)) data.relationships.push({ relationship_id: `rel_${from}_${to}`, from_user_id: from, to_user_id: to, created_at: data.updated_at })
  const conversation_id = `fixture_conversation_${index}`
  data.conversations.push({ conversation_id, kind: 'direct', participant_ids: [TEST_USER_ID, other], event_id: null })
  data.messages.push(...['Hey! Your photowalk answer made me smile.', 'Tomorrow after class?', 'I’m in ✨'].map((body, i) => ({ message_id: `fixture_message_${index}_${i}`, conversation_id, sender_id: i % 2 ? TEST_USER_ID : other, kind: 'text', body, media_id: null, sent_at: data.updated_at + i, read_by: [TEST_USER_ID, other] })))
}
export function create_scenario(name = 'default', now = Date.now()) {
  if (!SCENARIOS.includes(name)) throw new Error(`Unknown scenario: ${name}`)
  const data = create_seed(now)
  if (name === 'home_empty') { data.relationships = []; data.requests = []; data.match_sessions = [] }
  if (name === 'home_single') { data.requests = []; data.match_sessions = [] }
  if (name === 'home_long') {
    for (let i = 0; i < 12; i += 1) {
      const user = clone_data(data.users[1]); user.user_id = `fixture_long_${i}`; user.user_name = `A very long campus connection name ${i + 1}`; user.photo_ids = []; user.icebreaker_ids = []
      data.users.push(user); connect(data, user.user_id, i)
    }
    data.goals[0].label = 'New friends who love taking the longer, scenic route across campus together'
  }
  if (name === 'missing_avatar') data.users[1].avatar_url = ''
  if (name === 'zero_coins') data.coin_transactions = []
  if (name === 'quota_used') data.match_quota = [{ owner_user_id: TEST_USER_ID, date_key: new Date(now).toISOString().slice(0, 10), used_count: 3 }]
  if (name === 'one_way') data.relationships.pop()
  if (name === 'request_declined') data.requests[0].status = 'declined'
  if (name === 'request_accepted') { data.requests[0].status = 'accepted'; connect(data, 'user_lina') }
  if (name === 'blocked') data.blocked_users.push({ block_id: 'fixture_block', owner_user_id: TEST_USER_ID, user_id: 'user_chloe', created_at: now })
  if (name === 'session_expired') data.session.expires_at = now - 1
  if (name === 'account_deleted') { data.accounts[0].status = 'deleted'; data.users[0].deleted = true; data.session = { account_id: null, current_user_id: null, expires_at: null } }
  if (name === 'event_joined' || name === 'event_past') {
    data.memberships.push({ membership_id: 'fixture_me_picnic', event_id: 'event_picnic', user_id: TEST_USER_ID, status: 'joined', joined_at: now - 3600000 })
    data.messages.push(...[['user_chloe', 'I’ll bring fruit! 🍉'], ['user_alex', 'I have an extra picnic mat.'], [TEST_USER_ID, 'Perfect, see everyone soon.'], ['user_zoe', 'Is anyone coming from the library?']].map(([sender_id, body], i) => ({ message_id: `group_message_${i}`, conversation_id: 'group_picnic', sender_id, kind: 'text', body, media_id: null, sent_at: now - 300000 + i * 60000, read_by: [sender_id] })))
    if (name === 'event_past') { data.events[0].starts_at = now - 86400000; data.events[0].ends_at = now - 80000000 }
  }
  if (name === 'three_chats') { data.requests = []; data.match_sessions = []; connect(data, 'user_liam', 1); connect(data, 'user_lina', 2) }
  if (name.startsWith('match_')) {
    const status = name.slice(6), match = data.match_sessions[0]
    Object.assign(match, { status, fixture: false, candidate_id: ['searching', 'paused', 'no_match', 'left'].includes(status) ? null : 'user_liam', self_accepted: ['waiting', 'connected'].includes(status), peer_accepted: status === 'connected', expires_at: status === 'expired' ? now - 1 : now + 45000 })
    if (status === 'connected') connect(data, 'user_liam')
  }
  validate_data(data)
  return data
}
export function create_source_scenario(source_query, now = Date.now()) {
  const source = Object.fromEntries(new URLSearchParams(source_query)), route = source.route
  let name = source.newUser === '1' ? 'home_empty' : source.joined === '1' ? 'event_joined' : source.am ? `match_${source.am === 'noMatch' ? 'no_match' : source.am}` : 'default'
  if (route === 'reqAccepted') name = 'request_accepted'
  if (route === 'reqDeclined') name = 'request_declined'
  if (route === 'sysSessionExpired') name = 'session_expired'
  if (route === 'delSuccess') name = 'account_deleted'
  if (route.startsWith('call')) name = 'default'
  const data = create_scenario(SCENARIOS.includes(name) ? name : 'default', now)
  if (source.blocked === '0') data.blocked_users = []
  if (source.coins != null) {
    data.coin_transactions = Number(source.coins) > 0 ? [{ transaction_id: 'fixture_balance', owner_user_id: TEST_USER_ID, business_key: 'fixture_balance', kind: 'purchase', amount: Number(source.coins), status: 'completed', created_at: now, fixture: true, related_id: null }] : []
  }
  if (route.startsWith('ob')) data.auth_flow.step = route.slice(2)
  data.auth_flow.profile_draft = { name: 'Ethan', photo_ids: source.photos === '3' ? data.users[1].photo_ids : [], interest_ids: ['photography', 'coffee', 'music'], icebreaker_texts: source.ice === '1' ? ['What’s your ideal Sunday?', 'Which song is on repeat?', 'Best hidden spot on campus?'] : [] }
  validate_data(data)
  return { data, ui: { source_route: route, overlay: source.sheet || source.pop || source.ea || null, permission: route === 'sysPermDenied' ? 'denied' : 'unknown', service_status: ['sysOffline', 'sysError', 'sysMaintenance'].includes(route) ? 'error' : 'idle', call_status: route.startsWith('call') ? 'waiting_only' : null } }
}
