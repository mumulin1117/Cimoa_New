// One definition for registration, onboarding and additive hydration upgrades.
export const SESSION_LIFETIME_MS = 30 * 86400000
export const session_for = (account, now) => ({ account_id: account.account_id, current_user_id: account.user_id, expires_at: now + SESSION_LIFETIME_MS })
export const auth_context_key = data => JSON.stringify([data.session, data.auth_flow.flow_id, data.auth_flow.pending_registration_account_id])
export function ensure_account_defaults(data, user_id) {
  if (!data.settings.some(row => row.owner_user_id === user_id)) data.settings.push({ owner_user_id: user_id, language: 'en-US', muted_direct_user_ids: [], notifications: { master: false, requests: true, accepted: true, messages: true, auto_match: true, events: true, organizer: true, calls: true, product: false }, privacy: { discover_visible: true, auto_match_visible: true, show_online: true, show_year: true, show_field: true, show_mutual: true, allow_voice: true, allow_video: true, event_visible: true } })
  if (!data.event_preferences.some(row => row.owner_user_id === user_id)) data.event_preferences.push({ owner_user_id: user_id, filters: {}, saved_event_ids: [], reminder_by_event: {} })
  if (!data.match_preferences.some(row => row.owner_user_id === user_id)) data.match_preferences.push({ owner_user_id: user_id, age_min: 18, age_max: 100, height_min: 100, height_max: 250, distance_max: 100, university: 'All', major: 'All', interest_ids: [], interest_mode: 'Similar interests', mbti: 'All', religion: 'All', drinking: 'All', gender: 'Everyone', language: 'All', goal_id: 'friends' })
}
export const registration_profile = (user_id, age) => ({
  user_id, user_name: 'New member', age, avatar_url: '', university: '', major: '', mbti: '', height_cm: null,
  country: [], degree: '', year: '', graduation_year: '', gender: '', pronouns: '', languages: [], clubs: '', religion: '', drinking: '', smoking: '', location: '',
  bio: '', bio_font: 'Caveat', bio_audio_id: null, goal_ids: [], interest_ids: [], photo_ids: [], icebreaker_ids: [], song_id: null,
  verification_status: 'pending', onboarding_status: 'not_started', discoverable: false, deleted: false,
})
