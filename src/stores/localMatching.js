import { owner_id, social_eligible, match_visible, connected, match_status } from './selectors.js'
import { matching_distance, campus_key } from './matchingCatalog.js'

export function match_candidates(data,now=Date.now(),exclude_match_id=null) {
  const owner = owner_id(data), me = data.users.find(row => row.user_id === owner)
  const preferences = data.match_preferences.find(row => row.owner_user_id === owner)
  if (!me || !preferences) return []
  return data.users.filter(person => {
    if (person.user_id === owner || !person.discoverable || !social_eligible(data, person.user_id) || !match_visible(data, person.user_id) || connected(data, person.user_id)) return false
    if (data.requests.some(row => row.status === 'pending' && [row.sender_id, row.recipient_id].includes(owner) && [row.sender_id, row.recipient_id].includes(person.user_id))) return false
    if(data.match_sessions.some(row=>row.match_id!==exclude_match_id&&row.candidate_id&&[row.owner_user_id,row.candidate_id].includes(owner)&&[row.owner_user_id,row.candidate_id].includes(person.user_id)&&['found','waiting'].includes(match_status(row,now))))return false
    if (person.age < preferences.age_min || person.age > preferences.age_max) return false
    if (person.height_cm == null ? preferences.height_min>100||preferences.height_max<250 : person.height_cm < preferences.height_min || person.height_cm > preferences.height_max) return false
    if(preferences.distance_max<100&&(matching_distance(data,me,person)===null||matching_distance(data,me,person)>preferences.distance_max))return false
    const university=preferences.university
    if(university==='My university'&&campus_key(person.university)!==campus_key(me.university))return false
    if(university==='Nearby universities'&&(matching_distance(data,me,person)===null||matching_distance(data,me,person)>50))return false
    if(!['All','My university','Nearby universities','Any supported university'].includes(university)&&campus_key(person.university)!==campus_key(university))return false
    const norm=value=>String(value).toLowerCase().replaceAll('-',' ').replace('buddhism','buddhist').replace('hinduism','hindu').replace(/^comp sci$/,'computer science')
    for (const key of ['major', 'mbti', 'religion', 'drinking']) if (preferences[key] && preferences[key] !== 'All' && norm(person[key]) !== norm(preferences[key])) return false
    if (preferences.gender !== 'Everyone' && ![person.gender, `${person.gender}s`, person.gender === 'Man' ? 'Men' : person.gender === 'Woman' ? 'Women' : person.gender].includes(preferences.gender)) return false
    if (preferences.language !== 'All' && !person.languages.includes(preferences.language)) return false
    return true
  }).map(person => ({ person, score: person.interest_ids.filter(id => (preferences.interest_ids.length ? preferences.interest_ids : me.interest_ids).includes(id)).length * (preferences.interest_mode==='A mix'?1:3) + person.goal_ids.filter(id => me.goal_ids.includes(id)).length }))
    .sort((a, b) => (preferences.interest_mode === 'Surprise me' ? 0 : b.score - a.score) || a.person.user_id.localeCompare(b.person.user_id)).map(row=>row.person)
}
export const choose_match_candidate=(data,now,exclude_match_id,excluded_user_ids=[])=>match_candidates(data,now,exclude_match_id).find(row=>!excluded_user_ids.includes(row.user_id))||null
