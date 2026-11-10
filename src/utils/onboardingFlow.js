import { age_from_date } from './localAuth.js'
export const ONBOARDING_FLOW = Object.freeze(['basic', 'uni', 'major', 'photos', 'about', 'interests', 'goal', 'ice', 'notif', 'complete'])
export const onboarding_route = step => `/pages/onboarding/${ONBOARDING_FLOW.includes(step) ? step : 'basic'}`
export const onboarding_catalog = {
  genders: ['Woman', 'Man', 'Non-binary', 'Self-describe', 'Prefer not to say'],
  pronouns: ['she / her', 'he / him', 'they / them', 'Add your own'],
  years: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgraduate'],
  majors: [['Business', '💼'], ['Computer Science', '💻'], ['Engineering', '⚙️'], ['Medicine', '🩺'], ['Finance', '💰'], ['Sciences', '🔬'], ['Data Science', '📊'], ['Economics', '📈'], ['Information Technology', '🖥️'], ['Psychology', '🧠'], ['Nursing', '💊'], ['Law', '⚖️'], ['Public Health', '🏥'], ['Education', '📚'], ['Arts', '🎨']].map(([label, emoji]) => ({ label, emoji })),
  questions: ['What’s your ideal Sunday?', 'Which song is on repeat?', 'Best hidden spot on campus?', 'What could you talk about for hours?', 'What’s one thing you want to try this semester?', 'Coffee, tea, or something else?'],
}
export const ONBOARDING_GOALS = [['friends', '🙋', 'New Friends'], ['study', '📖', 'Study Partners'], ['activity', '🏃', 'Activity Buddies'], ['campus', '🎉', 'Campus Events'], ['conversations', '💬', 'Meaningful Conversations'], ['language', '🗣️', 'Language Exchange'], ['gym', '🏋️', 'Gym & Sports'], ['coffee', '☕', 'Coffee Chats'], ['project', '🛠️', 'Project Teammates'], ['music', '🎸', 'Music & Gigs'], ['food', '🍜', 'Food Explorers'], ['travel', '✈️', 'Travel Buddies'], ['gaming', '🎮', 'Gaming'], ['career', '💼', 'Career Networking'], ['dating', '💘', 'Dating']].map(([item_id, emoji, label]) => ({ item_id, emoji, label }))
export const ONBOARDING_INTEREST_IDS = ['photography', 'coffee', 'music', 'sports', 'gaming', 'travel', 'art', 'films', 'books', 'volunteering', 'study', 'food', 'fitness', 'hiking', 'cooking', 'dance', 'kpop']
const text = (value, max) => typeof value === 'string' && !!value.trim() && value.trim().length <= max
export const question_error = value => !String(value || '').trim() ? 'Write your question first.' : String(value).trim().length > 160 ? 'Keep your question within 160 characters.' : /address|phone|password|money|hot|sexy/i.test(value) ? 'That question can’t be used — keep it safe and non-personal.' : ''
export function onboarding_error(step, value, now) {
  if (step === 'basic') {
    if (!text(value.user_name, 50)) return 'Enter a display name of 1–50 characters.'
    if (!(age_from_date(value.date_of_birth, now) >= 18)) return 'Enter a valid date of birth. You must be 18 or older.'
    if (!text(value.gender, 50) || value.gender === 'Self-describe') return 'Choose or describe your gender identity.'
    if (typeof value.pronouns !== 'string' || value.pronouns.length > 50 || value.pronouns === 'Add your own') return 'Check your pronouns (up to 50 characters).'
  }
  if (step === 'uni') {
    if (!text(value.university, 100)) return 'Enter your university. This is self-reported, not verified.'
    if (!onboarding_catalog.years.includes(value.year)) return 'Choose your academic year.'
    if (typeof value.major !== 'string' || value.major.length > 100) return 'Keep your field of study within 100 characters.'
    if (value.graduation_year && (!/^\d{4}$/.test(value.graduation_year) || +value.graduation_year < new Date(now).getUTCFullYear() || +value.graduation_year > new Date(now).getUTCFullYear() + 15)) return 'Enter a valid expected graduation year, or leave it blank.'
  }
  if (step === 'major' && !onboarding_catalog.majors.some(row => row.label === value.major)) return 'Choose the major closest to yours.'
  if (step === 'about' && (typeof value.bio !== 'string' || value.bio.length > 300)) return 'Keep your introduction within 300 characters.'
  if (step === 'interests' && (!Array.isArray(value.interest_ids) || new Set(value.interest_ids).size < 3 || value.interest_ids.some(id => !ONBOARDING_INTEREST_IDS.includes(id)))) return 'Choose at least three interests.'
  if (step === 'goal' && (!Array.isArray(value.goal_ids) || !value.goal_ids.length || value.goal_ids.some(id => !ONBOARDING_GOALS.some(row => row.item_id === id)))) return 'Choose at least one connection goal.'
  if (step === 'ice' && (!Array.isArray(value.questions) || value.questions.length !== 3 || new Set(value.questions.map(q => String(q).trim())).size !== 3 || value.questions.some(q => question_error(q)))) return 'Choose three different, safe questions (up to 160 characters each).'
  if (step === 'notif' && !['granted', 'denied', 'unavailable', 'skipped'].includes(value.notification_permission)) return 'Check notification permission or choose Cancel.'
  return ''
}
