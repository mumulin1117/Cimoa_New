import { clone_data, PICKER_OPTIONS } from './seed.js'
import { authenticated, ensure, owner_id } from './selectors.js'
import { transact, get_runtime, failure, make_id } from './transactions.js'
import { onboarding_error, ONBOARDING_GOALS } from '../utils/onboardingFlow.js'

export const profile_context = (data, now) => {
  if (!authenticated(data, now)) return null
  const user = data.users.find(row => row.user_id === owner_id(data))
  return { account_id: data.session.account_id, user: clone_data(user), questions: user.icebreaker_ids.map(id => data.icebreakers.find(row => row.question_id === id)?.text).filter(Boolean) }
}
const section_fields = {
  basic: ['user_name', 'pronouns', 'year', 'major'], interests: ['interest_ids'], goals: ['goal_ids'], ice: ['questions'],
  all: ['bio', 'bio_font', 'height_cm', 'major', 'country', 'clubs', 'mbti', 'religion', 'drinking', 'smoking', 'song_id'],
}
export function validate_profile_patch(section, patch) {
  ensure(patch && typeof patch === 'object' && Object.keys(patch).every(key => section_fields[section]?.includes(key)), 'This field cannot be edited here.')
  if (section === 'basic') {
    ensure(typeof patch.user_name === 'string' && patch.user_name.trim() && patch.user_name.trim().length <= 50, 'Enter a display name of 1–50 characters.')
    ensure(typeof patch.pronouns === 'string' && patch.pronouns.length <= 50 && patch.pronouns !== 'Add your own', 'Check your pronouns (up to 50 characters).')
    ensure(['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgraduate'].includes(patch.year), 'Choose your academic year.')
    ensure(typeof patch.major === 'string' && patch.major.trim() && patch.major.length <= 100, 'Enter a field of study of 1–100 characters.')
  }
  if (['interests', 'goals', 'ice'].includes(section)) { const error = onboarding_error(section === 'goals' ? 'goal' : section, patch); ensure(!error, error) }
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'bio') ensure(typeof value === 'string' && value.length <= 300, 'Keep your introduction within 300 characters.')
    if (key === 'bio_font') ensure(['system', ...PICKER_OPTIONS.bio_fonts].includes(value), 'Choose an available font.')
    if (key === 'height_cm') ensure(value === null || Number.isInteger(value) && value >= 150 && value <= 200, 'Choose a height between 150 and 200 cm.')
    if (key === 'country') ensure(Array.isArray(value) && value.length <= 2 && new Set(value).size === value.length && value.every(v => PICKER_OPTIONS.countries.includes(v)), 'Choose up to two countries or regions.')
    if (['clubs', 'religion', 'drinking', 'smoking'].includes(key)) ensure(value === '' || PICKER_OPTIONS[key].includes(value), 'Choose an available profile option.')
    if (key === 'mbti') ensure(['', 'Prefer not to say', ...PICKER_OPTIONS.mbti].includes(value), 'Choose an available MBTI type.')
    if (key === 'major') ensure(typeof value === 'string' && value.trim() && value.length <= 100, 'Enter a field of study of 1–100 characters.')
    if (key === 'song_id') ensure(value === null, 'Playable profile songs are not configured. No song was added.')
  }
}
const write_patch = (data, section, patch) => {
  const user = data.users.find(row => row.user_id === owner_id(data))
  for (const [key, value] of Object.entries(patch)) if (key !== 'questions') user[key] = typeof value === 'string' ? value.trim() : clone_data(value)
  if (section === 'goals') for (const id of user.goal_ids) if (!data.goals.some(row => row.item_id === id)) data.goals.push(clone_data(ONBOARDING_GOALS.find(row => row.item_id === id)))
  if (section === 'ice') {
    // Keep historical questions referenced by existing introductions; only the active IDs change.
    user.icebreaker_ids = patch.questions.map((text, position) => {
      const existing = data.icebreakers.find(row => row.user_id === user.user_id && row.text === text.trim())
      if (existing) return existing.question_id
      const question_id = make_id('question'); data.icebreakers.push({ question_id, user_id: user.user_id, text: text.trim(), position }); return question_id
    })
  }
}
export const profile_edit_actions = {
  save_profile_section(section, patch, expected_account_id) {
    return transact(this, null, (data) => {
      ensure(data.session.account_id === expected_account_id, 'The account changed. Please reopen the editor.')
      validate_profile_patch(section, patch); write_patch(data, section, patch)
    })
  },
  async save_profile_edit(patch, photos, expected_account_id, { is_current = () => true } = {}) {
    const rt = get_runtime(this), created = [], owner = owner_id(this.data)
    try {
      ensure(this.session.is_authenticated && this.data.session.account_id === expected_account_id, 'The account changed. Please reopen the editor.')
      validate_profile_patch('all', patch)
      const original = clone_data(this.current_photos)
      if (photos !== null) {
        // Existing fixture accounts may have one legacy photo; edits require at least one.
        // Completed local onboarding keeps its two-photo minimum.
        const minimum = this.data.accounts.find(row => row.account_id === expected_account_id)?.auth_provider === 'local' ? 2 : 1
        ensure(Array.isArray(photos) && photos.length >= minimum && photos.length <= 3, `Keep ${minimum}–3 profile photos.`)
        const ids = photos.filter(row => row.photo_id).map(row => row.photo_id)
        ensure(new Set(ids).size === ids.length, 'Each photo can appear only once.')
        for (const row of photos) {
          if (row.blob) {
            const blob = row.blob
            ensure(blob instanceof Blob && blob.type.startsWith('image/') && blob.size > 0 && blob.size <= 20 * 1024 * 1024, 'Choose a valid image up to 20 MB.')
            await rt.inspect_media(blob, 'image'); ensure(is_current(), 'Photo save was cancelled.')
            const media_id = make_id('media'); await rt.media.put(media_id, blob)
            created.push({ media_id, owner_user_id: owner, kind: 'image', mime: blob.type, byte_size: blob.size, duration_ms: 0, media_url: `indexeddb://${media_id}` })
          } else {
            const old = original.find(p => p.photo_id === row.photo_id)
            ensure(old, 'This photo no longer belongs to your profile.')
            if (old.media_url.startsWith('indexeddb://')) {
              const meta = this.data.media_files.find(m => m.media_url === old.media_url && m.owner_user_id === owner)
              const blob = meta && await rt.media.get(meta.media_id)
              ensure(blob instanceof Blob && blob.size === meta.byte_size, 'A saved photo is unavailable. Replace it before saving.')
              await rt.inspect_media(blob, 'image')
            }
          }
        }
      }
      ensure(is_current(), 'Profile save was cancelled.')
      const result = transact(this, null, data => {
        ensure(data.session.account_id === expected_account_id, 'The account changed. Please reopen the editor.')
        const user = data.users.find(row => row.user_id === owner)
        if (photos !== null) {
          ensure(JSON.stringify(data.profile_photos.filter(row => row.user_id === owner).sort((a,b) => a.position-b.position)) === JSON.stringify(original), 'Your photos changed. Reopen the editor before saving.')
          data.media_files.push(...created); let index = 0
          const rows = photos.map((row, position) => ({ photo_id: row.photo_id || make_id('photo'), user_id: owner, position, media_url: row.blob ? created[index++].media_url : original.find(p => p.photo_id === row.photo_id).media_url }))
          data.profile_photos = [...data.profile_photos.filter(row => row.user_id !== owner), ...rows]
          user.photo_ids = rows.map(row => row.photo_id); user.avatar_url = rows[0].media_url
        }
        write_patch(data, 'all', patch)
      }, { expected_owner: owner })
      if (result.success) return result
      throw new Error(result.message)
    } catch (error) {
      await Promise.all(created.map(row => rt.media.delete(row.media_id).catch(() => {})))
      return failure('profile_save_failed', error.message)
    }
  },
}
