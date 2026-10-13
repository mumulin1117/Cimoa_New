// Independent, normalized fixture entities transcribed from the source detail screens.
// These records are test data, not claims of live users, payments or services.
export const SCHEMA_VERSION = 2
export const TEST_USER_ID = 'user_cimoa'
export const TEST_EMAIL = 'cimoa@gmail.com'
export const clone_data = (value) => JSON.parse(JSON.stringify(value))
export const QUOTA_POLICY = Object.freeze({ timezone: 'UTC', free_daily_limit: 3, standard_cost: 10 })
const head = (name) => `/static/assets/head/${name}.png`
const make_options = (rows) => rows.map(([item_id, emoji, label]) => ({ item_id, emoji, label }))
export const GOALS = make_options([
  ['friends', '🤝', 'New friends'], ['study', '📚', 'Study buddy'], ['coffee', '☕', 'Coffee chats'],
  ['campus', '🎉', 'Campus events'], ['language', '🗣️', 'Language exchange'],
  ['activity', '🏃', 'Activity Buddies'], ['music', '🎸', 'Music & Gigs'], ['food', '🍜', 'Food Explorers'],
])
export const INTERESTS = make_options([
  ['kpop', '🇰🇷', 'K-pop'], ['photography', '📷', 'Photography'], ['coffee', '☕', 'Coffee'],
  ['music', '🎵', 'Live Music'], ['hiking', '🥾', 'Hiking'], ['gaming', '🎮', 'Gaming'],
  ['travel', '✈️', 'Travel'], ['art', '🎨', 'Art'], ['films', '🎬', 'Films'], ['books', '📚', 'Books'],
  ['fitness', '💪', 'Fitness'], ['cooking', '🍳', 'Cooking'], ['dance', '💃', 'Dance'],
  ['sports', '🏀', 'Sports'], ['volunteering', '🤝', 'Volunteering'], ['study', '📝', 'Study Groups'], ['food', '🍜', 'Food'],
])
export const ONBOARDING_STEPS = ['basic', 'university', 'major', 'photos', 'about', 'interests', 'goals', 'icebreakers', 'notifications', 'complete']
export const PICKER_OPTIONS = {
  majors: ['Business', 'Computer Science', 'Engineering', 'Medicine', 'Finance', 'Sciences', 'Data Science', 'Economics', 'Information Technology', 'Design', 'Law', 'Architecture', 'Psychology', 'Media', 'Education'],
  countries: ['China', 'Hong Kong', 'Singapore', 'Malaysia', 'Korea', 'Japan', 'Taiwan', 'India', 'Indonesia', 'Vietnam', 'Thailand', 'Philippines', 'United States', 'United Kingdom', 'Canada', 'Australia', 'France', 'Germany'],
  mbti: ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'],
  religion: ['Prefer not to say', 'Non-religious', 'Atheist', 'Christian', 'Catholic', 'Buddhist', 'Islam', 'Hindu', 'Taoism'],
  drinking: ['Never', 'Occasionally', 'Socially', 'Regularly'],
  smoking: ['Never', 'Occasionally', 'Socially', 'Regularly', 'Trying to quit'],
  clubs: ['Photo Society', 'Sports Team', 'Music Club', 'Debate Society', 'Volunteer Group', 'Hiking Club', 'None'],
  bio_fonts: ['Poppins', 'Playfair Display', 'Caveat', 'Permanent Marker', 'Anton'],
}
const songs = [
  ['beautiful-things', 'Beautiful Things', 'Benson Boone'], ['espresso', 'Espresso', 'Sabrina Carpenter'],
  ['birds', 'BIRDS OF A FEATHER', 'Billie Eilish'], ['good-luck-babe', 'Good Luck, Babe!', 'Chappell Roan'],
  ['training-season', 'Training Season', 'Dua Lipa'], ['risk-it-all', 'Risk It All', 'Bruno Mars'],
  ['love-me-not', 'Love Me Not', 'Ravyn Lenae'], ['stupid-song', 'stupid song', 'Olivia Rodrigo'],
  ['stateside', 'Stateside', 'PinkPantheress'], ['beauty-beat', 'Beauty And A Beat', 'Justin Bieber'],
].map(([song_id, title, artist]) => ({ song_id, title, artist, cover_url: `/static/assets/songs/${song_id}.jpg`, audio_id: null }))
const profile = (user_id, user_name, university, avatar, extra = {}) => ({
  user_id, user_name, university, avatar_url: head(avatar), age: null, major: '', mbti: '', height_cm: null,
  country: [], degree: '', year: '', graduation_year: '', gender: '', pronouns: '', languages: [], clubs: '',
  religion: '', drinking: '', smoking: '', location: '', bio: '', bio_font: 'Caveat', bio_audio_id: null,
  photo_ids: [], goal_ids: [], interest_ids: [], icebreaker_ids: [], song_id: null,
  verification_status: 'verified', discoverable: false, deleted: false, ...extra,
})
export function create_seed(now = Date.now()) {
  const me = TEST_USER_ID
  const common_goals = ['friends', 'study', 'coffee', 'language', 'campus']
  const users = [
    profile(me, 'Ethan', 'HKUST', 'me', { age: 22, major: 'Interaction Design', mbti: 'INFP', height_cm: 178,
      country: ['China'], year: 'Year 3', graduation_year: '2027', gender: 'Man', pronouns: 'he / him', languages: ['English'], clubs: 'Photo Society',
      religion: 'Prefer not to say', drinking: 'Occasionally', smoking: 'Never',
      bio: 'Always looking for good coffee, new photo spots, and people to explore campus with.',
      goal_ids: common_goals, interest_ids: ['photography', 'coffee', 'music'], song_id: 'espresso' }),
    profile('user_chloe', 'Chloe Lin', 'HKUST', 'maya-av', { age: 21, major: 'Business', mbti: 'ENFP', height_cm: 168,
      country: ['Singapore'], drinking: 'Socially', smoking: 'Never', religion: 'Buddhist', clubs: 'Photography Club', location: 'Clear Water Bay',
      goal_ids: common_goals, interest_ids: ['photography', 'coffee', 'music'], song_id: 'birds', discoverable: true,
      bio: 'Design student who loves quiet cafés. Looking for genuine campus friendships.' }),
    profile('user_liam', 'Liam Park', 'Stanford', 'liam-av', { age: 22, major: 'Comp Sci', mbti: 'INTJ', bio: 'Film photographer, weekend hiker, always down for a late-night noodle run.',
      goal_ids: ['activity', 'music', 'food'], interest_ids: ['photography', 'hiking', 'films'], discoverable: true }),
    profile('user_lina', 'Lina', 'HKU', 'maya-full', { age: 21, major: 'Psychology', mbti: 'INFJ', height_cm: 165,
      country: ['Malaysia'], drinking: 'Never', smoking: 'Never', religion: 'Christian', clubs: 'Psychology Society',
      goal_ids: common_goals, interest_ids: ['photography', 'coffee', 'music'], song_id: 'good-luck-babe', discoverable: true,
      location: 'Pok Fu Lam', bio: 'Psych student who loves long walks, podcasts, and trying every dessert place in Kennedy Town.' }),
    profile('user_jordan', 'Jordan Ellis', 'HKUST', 'jordan-av'),
    profile('user_alex', 'Alex', 'HKUST', 'participant-38b22b41'), profile('user_zoe', 'Zoe', 'HKUST', 'participant-92ddcb8c'),
  ]
  const profile_photos = []
  const icebreakers = []
  for (const user of users) {
    const images = ['user_chloe', 'user_lina'].includes(user.user_id) ? ['maya-full', 'maya-card', 'maya-av'].map(head) : [user.avatar_url]
    user.photo_ids = images.map((media_url, position) => {
      const photo_id = `${user.user_id}_photo_${position}`
      profile_photos.push({ photo_id, user_id: user.user_id, media_url, position })
      return photo_id
    })
    user.icebreaker_ids = ['What’s your ideal Sunday?', 'Which song is on repeat?', 'Best hidden spot on campus?'].map((text, position) => {
      const question_id = `${user.user_id}_q_${position}`
      icebreakers.push({ question_id, user_id: user.user_id, text: user.user_id === me && position === 0 ? 'How would you spend your ideal weekend?' : text, position })
      return question_id
    })
  }
  const event_rows = [
    ['picnic', 'Sunset Picnic', 'Central Lawn', 'Social'], ['sketch', 'Coffee & Sketch', 'Art Studio', 'Arts'],
    ['badminton', 'Beginner Badminton', 'Sports Hall', 'Sports'], ['mic', 'Open Mic Night', 'Student Center', 'Music'],
    ['yoga', 'Sunset Yoga', 'Seafront Deck', 'Sports'], ['language', 'Language Exchange', 'Library Café', 'Social'],
    ['games', 'Board Game Social', 'Common Room', 'Social'], ['hike', 'Hiking: Clear Water Bay', 'North Gate', 'Outdoors'],
    ['film', 'Rooftop Film Night', 'LG7 Rooftop', 'Arts'], ['dumpling', 'Dumpling Workshop', 'Hall 5 Kitchen', 'Food'],
    ['photowalk', 'Campus Photo Walk', 'Main Gate', 'Arts'], ['karaoke', 'Karaoke Night', 'Red Bird', 'Music'],
    ['startup', 'Startup Coffee Chat', 'Entrepreneurship Ctr', 'Career'], ['football', 'Pickup Football', 'Main Field', 'Sports'],
    ['market', 'HKUST Night Market', 'Atrium Piazza', 'Social'], ['study', 'Study Jam: Finals Prep', 'Library L3', 'Study'],
    ['run', 'Campus Run Club', 'Seafront Track', 'Sports'], ['food-fair', 'Cultural Food Fair', 'Atrium', 'Food'],
    ['robotics', 'Robotics Demo Day', 'Academic Bldg', 'Tech'], ['jazz', 'Jazz on the Piazza', 'Piazza', 'Music'],
    ['volunteer', 'Volunteer Beach Clean', 'Clear Water Bay', 'Volunteering'], ['chess', 'Chess Club Meetup', 'Room 2404', 'Social'],
  ]
  // Concrete fixture dates in the source campus timezone. Existing saves are never reseeded.
  const campus_midnight = Math.floor((now + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000
  const source_times = { picnic: [0, 17.5], mic: [0, 20], yoga: [0, 18.5], sketch: [1, 14] }
  const weekdays = { badminton: 5, language: 5, games: 6, hike: 0, film: 4, dumpling: 3, photowalk: 5, karaoke: 5, startup: 4, football: 6, market: 6, study: 1, run: 2, 'food-fair': 0, robotics: 3, jazz: 3, volunteer: 6, chess: 4 }
  const hours = { film: 20, dumpling: 19, photowalk: 16.5, market: 18, 'food-fair': 12, robotics: 15 }
  const image_names = ['ev-forest.jpg', 'ev-boat.jpg', 'ev-camp.jpg', 'ev-bike.jpg', 'ev-hike.png']
  const source_image_indices = { mic: 0, yoga: 1, sketch: 2, badminton: 3, language: 4, dumpling: 0, karaoke: 4, startup: 5, football: 6, 'food-fair': 0, robotics: 1, study: 2, run: 3, jazz: 4, volunteer: 5, chess: 6 }
  // Shared events use the first source detail lookup; badminton retains the existing full-capacity fixture.
  const capacities = { picnic: 20, mic: 34, yoga: 20, sketch: 20, badminton: 2, language: 30, games: 37, hike: 44, film: 46, dumpling: 26, photowalk: 29, karaoke: 30, startup: 37, football: 44, market: 72, study: 20, run: 23, 'food-fair': 120, robotics: 55, jazz: 30, volunteer: 37, chess: 44 }
  const events = event_rows.map(([key, title, location, category], index) => {
    const [offset, hour] = source_times[key] || [(weekdays[key] - new Date(campus_midnight + 8 * 3600000).getUTCDay() + 7) % 7, hours[key] || 17]
    const starts_at = campus_midnight + offset * 86400000 + hour * 3600000
    const cover = ['picnic', 'film', 'market'].includes(key) ? 'event-picnic.png' : /hik/i.test(title) ? 'ev-hike.png' : /walk|photo|bike/i.test(title) ? 'ev-bike.jpg' : /camp|board|game/i.test(title) ? 'ev-camp.jpg' : image_names[source_image_indices[key] % image_names.length]
    return { event_id: `event_${key}`, title, location, category, organizer_id: 'organizer_hkust', description: '', image_url: `/static/assets/img/${cover}`,
      starts_at, ends_at: starts_at + 7200000, time_zone: 'Asia/Hong_Kong', feed_order: key === 'mic' ? 1 : key === 'yoga' ? 2 : index + 3,
      featured_tab: key === 'picnic' ? 'Today' : key === 'film' ? 'This week' : key === 'market' ? 'My campus' : null,
      capacity: capacities[key], university: 'HKUST', price: 0, address: location,
      latitude: null, longitude: null, schedule: [], notes: '', accessibility: '', weather_plan: '' }
  })
  Object.assign(events[0], { description: 'Bring a snack, meet someone new, and watch the sunset together.',
    schedule: [{ label: 'Meet & mingle', offset_minutes: 0, description: 'Grab a spot on the lawn and say hi' }, { label: 'Icebreaker games', offset_minutes: 30, description: 'Small groups of 4–5, mixed faculties' }, { label: 'Sunset', offset_minutes: 65, description: 'Golden hour over Clear Water Bay' }],
    notes: 'Free to join. Bring a picnic mat. English & Cantonese.', accessibility: 'Step-free access', weather_plan: 'Moves indoors if it rains' })
  const memberships = ['user_chloe', 'user_alex', 'user_zoe'].map((user_id) => ({ membership_id: `member_picnic_${user_id}`, event_id: 'event_picnic', user_id, status: 'joined', joined_at: now - 86400000 }))
  memberships.push(...['user_alex', 'user_zoe'].map((user_id) => ({ membership_id: `member_badminton_${user_id}`, event_id: 'event_badminton', user_id, status: 'joined', joined_at: now })))
  return clone_data({
    schema_version: SCHEMA_VERSION, revision: 0, updated_at: now, environment: 'fixture',
    accounts: [{ account_id: 'account_cimoa', user_id: me, email: TEST_EMAIL, status: 'active', auth_provider: 'fixture', credential_hash: '1048c6721624beee8dee35c9f99a8024b9d7fa1272b7d5d5246296f85032f9a2' }],
    session: { account_id: 'account_cimoa', current_user_id: me, expires_at: now + 30 * 86400000 }, users,
    goals: GOALS, interests: INTERESTS, songs, picker_options: PICKER_OPTIONS, onboarding_steps: ONBOARDING_STEPS,
    profile_photos, icebreakers, media_files: [],
    relationships: [[me, 'user_chloe'], ['user_chloe', me]].map(([from_user_id, to_user_id], index) => ({ relationship_id: `rel_seed_${index}`, from_user_id, to_user_id, created_at: now })),
    requests: [{ request_id: 'request_lina', sender_id: 'user_lina', recipient_id: me, question_id: `${me}_q_0`, kind: 'voice', text: '', audio_id: null, status: 'pending', fixture_media_unavailable: true, created_at: now - 3600000, resolved_at: null }],
    match_sessions: [{ match_id: 'match_liam', owner_user_id: me, candidate_id: 'user_liam', status: 'found', created_at: now, started_at: now, expires_at: now + 45000, priority_until: null, paused_at: null, self_accepted: false, peer_accepted: false, queue_position: null, estimated_wait_seconds: null, fixture: true }],
    match_preferences: [{ owner_user_id: me, age_min: 18, age_max: 30, height_min: 150, height_max: 190, distance_max: 100, university: 'All', major: 'All', interest_ids: ['kpop'], mbti: 'All', religion: 'All', drinking: 'All', gender: 'Everyone', language: 'English', goal_id: 'friends' }],
    quota_policy: QUOTA_POLICY, match_quota: [],
    events, memberships, organizers: [{ organizer_id: 'organizer_hkust', name: 'HKUST Student Union', avatar_url: '', description: '', update_text: '' }],
    event_preferences: [{ owner_user_id: me, filters: { date: 'Today', university: 'All', category: 'All', price: 'Free', availability: 'All', accessibility: 'All' }, saved_event_ids: [], reminder_by_event: {} }],
    conversations: [{ conversation_id: 'conversation_chloe', kind: 'direct', participant_ids: [me, 'user_chloe'], event_id: null }, { conversation_id: 'group_picnic', kind: 'group', participant_ids: [], event_id: 'event_picnic' }],
    messages: ['Hey! Your photowalk answer made me smile.', 'We should find a new spot on campus.', 'The garden near the library is underrated.', 'Tomorrow after class?', 'I’m in ✨'].map((body, index) => ({ message_id: `message_chloe_${index}`, conversation_id: 'conversation_chloe', sender_id: index % 2 ? me : 'user_chloe', kind: 'text', body, media_id: null, sent_at: now - (5 - index) * 60000, read_by: index === 4 ? ['user_chloe'] : [me, 'user_chloe'] })),
    coin_packages: [[60, '$0.99'], [300, '$3.99'], [680, '$6.99'], [1280, '$12.99'], [2800, '$24.99'], [6000, '$49.99']].map(([coins, price]) => ({ package_id: `pkg_${coins}`, coins, price, product_id: null, badge: coins === 300 ? 'Most Popular' : coins === 2800 ? 'Best Value' : '', image_url: `/static/assets/coins/coins-${coins <= 300 ? coins : 680}.png` })),
    coin_transactions: [300, -20, -10, -10].map((amount, index) => ({ transaction_id: `txn_seed_${index}`, owner_user_id: me, business_key: `seed_${index}`, amount, kind: amount > 0 ? 'purchase' : 'spend', status: 'completed', created_at: now - (4 - index) * 86400000, related_id: null, fixture: true })),
    purchase_requests: [], blocked_users: [{ block_id: 'block_jordan', owner_user_id: me, user_id: 'user_jordan', created_at: now }], reports: [], drafts: [], support_requests: [], operation_receipts: [],
    settings: [{ owner_user_id: me, language: 'en-US', notifications: { master: true, requests: true, accepted: true, messages: true, auto_match: true, events: true, organizer: true, calls: true, product: false }, privacy: { discover_visible: true, show_online: true, show_year: true, show_field: true, show_mutual: true, allow_voice: true, allow_video: true, event_visible: true } }],
    auth_flow: { flow_id: 'auth_flow_fixture', step: 'welcome', email: '', verification_request_id: null, agreements: { age: false, student: false, terms: false, privacy: false, community: false }, profile_draft: {} },
    legacy_archive: null,
  })
}
