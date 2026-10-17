import { ONBOARDING_GOALS } from '../utils/onboardingFlow.js'
import { authenticated, owner_id } from './selectors.js'
// Source prefGroups -> the same numeric/catalog fields used by Auto Match.
export function profile_preference_groups(data, draft, now) {
  if (!authenticated(data, now) || !draft) return []
  const me = data.users.find(u => u.user_id === owner_id(data))
  const group = (title, values) => ({ title, options: values.map(([label, patch]) => ({ label, patch, selected: Object.entries(patch).every(([key, value]) => draft[key] === value) })) })
  const choices = (key, labels) => labels.map(v => Array.isArray(v) ? [v[0], { [key]: v[1] }] : [v, { [key]: v }])
  return [
    group('Connection goal', ONBOARDING_GOALS.map(g => [g.label[0] + g.label.slice(1).toLowerCase(), { goal_id: g.item_id }])),
    group('University range', choices('university', [['My university', me.university], 'Nearby universities', ['Any supported university', 'All']]).filter(([, p]) => p.university)),
    group('Major', choices('major', [['Any major', 'All'], 'Similar major', 'STEM', 'Business', 'Arts & Humanities'])),
    group('Age range', [['18 – 21', { age_min: 18, age_max: 21 }], ['18 – 24', { age_min: 18, age_max: 24 }], ['21 – 27', { age_min: 21, age_max: 27 }]]),
    group('Height range', [['No preference', { height_min: 100, height_max: 250 }], ['150 – 165 cm', { height_min: 150, height_max: 165 }], ['165 – 180 cm', { height_min: 165, height_max: 180 }], ['180 cm +', { height_min: 180, height_max: 250 }]]),
    group('Shared interests', choices('interest_mode', ['Similar interests', 'A mix', 'Surprise me'])),
    group('MBTI personality', choices('mbti', [['No preference', 'All'], 'Similar type', 'Complementary type'])),
    group('Drinking habits', choices('drinking', [['No preference', 'All'], ['Doesn’t drink', 'Never'], 'Socially', 'Regularly'])),
    group('Distance', [['On campus', { distance_max: 1 }], ['Within 5 km', { distance_max: 5 }], ['Anywhere in city', { distance_max: 100 }]]),
    group('Religion', choices('religion', [['No preference', 'All'], 'Same religion', 'Open to all'])),
    group('Preferred language', choices('language', ['English', 'Cantonese', 'Mandarin'])),
    group('Gender preference', choices('gender', [['Show me everyone', 'Everyone'], 'Women', 'Men'])),
  ]
}
