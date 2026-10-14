export const bio_style = font => ({ fontFamily: ({ system: 'system-ui, sans-serif', Poppins: "'Poppins', sans-serif", 'Playfair Display': "'Playfair Display', serif", Caveat: "'Caveat', cursive", 'Permanent Marker': "'Permanent Marker', cursive", Anton: "'Anton', sans-serif" })[font] || 'system-ui, sans-serif' })
export const PROFILE_FIELDS = [
  ['height_cm', 'Height', 'eaOpenHeight'], ['major', 'Degree / Major', 'eaOpenDegree'], ['country', 'Country / Region', 'eaOpenCountry'],
  ['clubs', 'Clubs', 'eaOpenClubs'], ['mbti', 'MBTI type', 'eaOpenMbti'], ['religion', 'Religion', 'eaOpenReligion'],
].map(([key, title, action]) => ({ key, title, action }))
export const profile_value = (user, key) => Array.isArray(user[key]) ? user[key].join(' · ') || 'Not set' : user[key] ? `${user[key]}${key === 'height_cm' ? ' cm' : ''}` : 'Not set'
export const country_emoji = label => ({ China: '🇨🇳', 'Hong Kong': '🇭🇰', Singapore: '🇸🇬', Malaysia: '🇲🇾', Korea: '🇰🇷', Japan: '🇯🇵', Taiwan: '🇹🇼', India: '🇮🇳', Indonesia: '🇮🇩', Vietnam: '🇻🇳', Thailand: '🇹🇭', Philippines: '🇵🇭', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Canada: '🇨🇦', Australia: '🇦🇺', France: '🇫🇷', Germany: '🇩🇪' })[label] || '🌏'
export const major_emoji = label => ({ Business: '💼', 'Computer Science': '🖥️', Engineering: '⚙️', Medicine: '🏥', Finance: '💵', Sciences: '🧬', 'Data Science': '📊', Economics: '💸', 'Information Technology': '💻', Design: '🎨', Law: '⚖️', Architecture: '🏛️', Psychology: '🧠', Media: '🎬', Education: '📚' })[label] || '🎓'
export const bio_font_label = font => ({ 'Playfair Display': 'Playfair', 'Permanent Marker': 'Sharpie', Anton: 'Tanker' })[font] || font
export const profile_preview_tags = (user, settings) => [
  { key: 'height', icon: 'height', label: user.height_cm ? `${user.height_cm} cm` : '' },
  { key: 'university', icon: 'university', label: user.university },
  { key: 'major', icon: 'book', label: settings?.privacy?.show_field === false ? '' : user.major },
  { key: 'mbti', icon: 'puzzle', label: user.mbti },
  ...(user.country || []).map(label => ({ key: `country-${label}`, emoji: country_emoji(label), label })),
  { key: 'drinking', emoji: '🍷', label: user.drinking }, { key: 'smoking', emoji: '🚭', label: user.smoking },
  { key: 'religion', emoji: '🕊️', label: user.religion }, { key: 'clubs', icon: 'people', label: user.clubs },
  { key: 'location', icon: 'location', label: user.location },
].filter(row => row.label)
