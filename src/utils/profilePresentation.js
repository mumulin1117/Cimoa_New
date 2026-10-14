export const bio_style = font => ({ fontFamily: ({ system: 'system-ui, sans-serif', Poppins: "'Poppins', sans-serif", 'Playfair Display': "'Playfair Display', serif", Caveat: "'Caveat', cursive", 'Permanent Marker': "'Permanent Marker', cursive", Anton: "'Anton', sans-serif" })[font] || 'system-ui, sans-serif' })
export const PROFILE_FIELDS = [
  ['height_cm', 'Height', 'eaOpenHeight'], ['major', 'Degree / Major', 'eaOpenDegree'], ['country', 'Country / Region', 'eaOpenCountry'],
  ['clubs', 'Clubs', 'eaOpenClubs'], ['mbti', 'MBTI type', 'eaOpenMbti'], ['religion', 'Religion', 'eaOpenReligion'],
].map(([key, title, action]) => ({ key, title, action }))
export const profile_value = (user, key) => Array.isArray(user[key]) ? user[key].join(' · ') || 'Not set' : user[key] ? `${user[key]}${key === 'height_cm' ? ' cm' : ''}` : 'Not set'
