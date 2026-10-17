import { owner_id, social_eligible, match_visible, connected } from './selectors.js'

export function choose_match_candidate(data) {
  const owner = owner_id(data), me = data.users.find(row => row.user_id === owner)
  const preferences = data.match_preferences.find(row => row.owner_user_id === owner)
  if (!me || !preferences) return null
  return data.users.filter(person => {
    if (person.user_id === owner || !person.discoverable || !social_eligible(data, person.user_id) || !match_visible(data, person.user_id) || connected(data, person.user_id)) return false
    if (data.requests.some(row => row.status === 'pending' && [row.sender_id, row.recipient_id].includes(owner) && [row.sender_id, row.recipient_id].includes(person.user_id))) return false
    if (person.age < preferences.age_min || person.age > preferences.age_max) return false
    if (person.height_cm != null && (person.height_cm < preferences.height_min || person.height_cm > preferences.height_max)) return false
    for (const key of ['university', 'major', 'mbti', 'religion', 'drinking']) if (preferences[key] && preferences[key] !== 'All' && person[key] !== preferences[key]) return false
    if (preferences.gender !== 'Everyone' && ![person.gender, `${person.gender}s`, person.gender === 'Man' ? 'Men' : person.gender === 'Woman' ? 'Women' : person.gender].includes(preferences.gender)) return false
    if (preferences.language !== 'All' && !person.languages.includes(preferences.language)) return false
    return true
  }).map(person => ({ person, score: person.interest_ids.filter(id => (preferences.interest_ids.length ? preferences.interest_ids : me.interest_ids).includes(id)).length * 3 + person.goal_ids.filter(id => me.goal_ids.includes(id)).length }))
    .sort((a, b) => (preferences.interest_mode === 'Surprise me' ? 0 : b.score - a.score) || a.person.user_id.localeCompare(b.person.user_id))[0]?.person || null
}
