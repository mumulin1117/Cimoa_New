export const COIN_FEATURES = Object.freeze([
  { feature_id: 'text_introduction', title: 'Text introduction', description: 'Send a thoughtful written introduction for free', cost: 'Free', image_url: '/static/assets/icons/ic-connect.png' },
  { feature_id: 'voice_introduction', title: 'Voice introduction', description: 'Send a recorded answer to someone new', cost: '10', image_url: '/static/assets/icons/ic-rewind.png' },
  { feature_id: 'priority_match', title: 'Priority Match', description: 'Jump ahead in the match queue for 15 minutes', cost: '20', image_url: '/static/assets/icons/ic-boost.png' },
])

export const package_image = coins => `/static/assets/coins/coins-${coins <= 60 ? 60 : coins <= 300 ? 300 : 680}.png`
