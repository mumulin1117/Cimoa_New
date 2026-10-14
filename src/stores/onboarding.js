import { clone_data } from './seed.js'
import { authenticated, ensure } from './selectors.js'
import { transact, get_runtime, failure, make_id } from './transactions.js'
import { local_verification_context } from '../utils/localVerification.js'
import { age_from_date } from '../utils/localAuth.js'
import { ONBOARDING_FLOW, ONBOARDING_GOALS, onboarding_error } from '../utils/onboardingFlow.js'

export function onboarding_context(data, now) {
  if (!authenticated(data, now)) return null
  const account = data.accounts.find(row => row.account_id === data.session.account_id)
  if (account?.auth_provider !== 'local' || !local_verification_context(data, now)?.verified) return null
  const user = data.users.find(row => row.user_id === account.user_id && !row.deleted)
  if (!user) return null
  return { account, user, step: account.onboarding?.step || 'basic', completed: user.onboarding_status === 'complete' }
}
const require_context = (data, now, step) => {
  const context = onboarding_context(data, now)
  ensure(context && !context.completed, 'Log in and complete local verification before profile setup.')
  ensure(ONBOARDING_FLOW.includes(step) && ONBOARDING_FLOW.indexOf(step) <= ONBOARDING_FLOW.indexOf(context.step), 'Complete the previous profile steps first.')
  return context
}
const fields = { basic: ['user_name', 'gender', 'pronouns'], uni: ['university', 'year', 'major', 'graduation_year'], major: ['major'], about: ['bio'], interests: ['interest_ids'], goal: ['goal_ids'] }
export const onboarding_actions = {
  async add_onboarding_photos(blobs, replace_id, expected_account_id, { is_current = () => true } = {}) {
    const rt = get_runtime(this), created = []
    try {
      const { account, user } = require_context(this.data, rt.clock(), 'photos')
      ensure(account.account_id === expected_account_id, 'The account changed. Please retry.')
      const previous_ids = [...user.photo_ids]
      ensure(Array.isArray(blobs) && blobs.length > 0, 'Choose at least one photo.')
      ensure(replace_id ? previous_ids.includes(replace_id) && blobs.length === 1 : previous_ids.length + blobs.length <= 3, replace_id ? 'Choose one replacement photo.' : 'You can keep up to three profile photos.')
      for (const blob of blobs) {
        ensure(blob instanceof Blob && blob.type.startsWith('image/') && blob.size > 0 && blob.size <= 20 * 1024 * 1024, 'Choose a valid image up to 20 MB.')
        await rt.inspect_media(blob, 'image')
        ensure(is_current(), 'Photo selection was cancelled.')
        const media_id = make_id('media')
        await rt.media.put(media_id, blob)
        created.push({ media_id, owner_user_id: user.user_id, kind: 'image', mime: blob.type, byte_size: blob.size, duration_ms: 0, media_url: `indexeddb://${media_id}`, created_at: rt.clock() })
      }
      ensure(is_current(), 'Photo selection was cancelled.')
      const result = transact(this, null, (data, now) => {
        const current = require_context(data, now, 'photos')
        ensure(current.account.account_id === expected_account_id && JSON.stringify(current.user.photo_ids) === JSON.stringify(previous_ids), 'Photos or account changed. Please select again.')
        data.media_files.push(...created)
        if (replace_id) data.profile_photos.find(row => row.photo_id === replace_id && row.user_id === user.user_id).media_url = created[0].media_url
        else for (const media of created) { const photo_id = make_id('photo'); data.profile_photos.push({ photo_id, user_id: user.user_id, media_url: media.media_url, position: current.user.photo_ids.length }); current.user.photo_ids.push(photo_id) }
        current.user.avatar_url = data.profile_photos.find(row => row.photo_id === current.user.photo_ids[0]).media_url
        return current.user.photo_ids
      }, { expected_owner: user.user_id })
      if (result.success) return result
      throw new Error(result.message)
    } catch (error) {
      await Promise.all(created.map(row => rt.media.delete(row.media_id).catch(() => {})))
      return failure('photo_failed', error.message)
    }
  },
  edit_onboarding_photo(photo_id, action, expected_account_id) {
    return transact(this, null, (data, now) => {
      const { account, user } = require_context(data, now, 'photos')
      ensure(account.account_id === expected_account_id, 'The account changed. Please retry.')
      const ids = [...user.photo_ids], index = ids.indexOf(photo_id)
      ensure(index >= 0 && ['primary', 'earlier', 'later', 'remove'].includes(action), 'This photo is unavailable.')
      if (action === 'remove') { ids.splice(index, 1); data.profile_photos = data.profile_photos.filter(row => row.photo_id !== photo_id) }
      else { const to = action === 'primary' ? 0 : action === 'earlier' ? index - 1 : index + 1; ensure(to >= 0 && to < ids.length, 'This photo cannot move further.'); ids.splice(index, 1); ids.splice(to, 0, photo_id) }
      ids.forEach((id, position) => { data.profile_photos.find(row => row.photo_id === id).position = position })
      user.photo_ids = ids; user.avatar_url = data.profile_photos.find(row => row.photo_id === ids[0])?.media_url || ''
    })
  },
  begin_onboarding(expected_account_id) {
    const rt = get_runtime(this), existing = onboarding_context(this.data, rt.clock())
    if (existing?.account.account_id === expected_account_id && existing.account.onboarding) return { success: true, data: existing.completed ? 'home' : existing.step, repeated: true }
    return transact(this, null, (data, now) => {
      const context = local_verification_context(data, now)
      ensure(context?.verified && context.account_id === expected_account_id, 'Complete local verification for this account first.')
      const account = data.accounts.find(row => row.account_id === context.account_id)
      ensure(account.auth_provider === 'local' && (data.auth_flow.pending_registration_account_id === account.account_id || data.session.account_id === account.account_id && authenticated(data, now)), 'Please log in again to continue setup.')
      const user = data.users.find(row => row.user_id === account.user_id)
      account.onboarding ||= { step: 'basic', completed_steps: [] }
      data.session = { account_id: account.account_id, current_user_id: user.user_id, expires_at: now + 30 * 86400000 }
      user.onboarding_status = 'in_progress'
      if (!data.settings.some(row => row.owner_user_id === user.user_id)) data.settings.push({ owner_user_id: user.user_id, language: 'en-US', notifications: { master: false, requests: true, accepted: true, messages: true, auto_match: true, events: true, organizer: true, calls: true, product: false }, privacy: { discover_visible: true, auto_match_visible: true, show_online: true, show_year: true, show_field: true, show_mutual: true, allow_voice: true, allow_video: true, event_visible: true } })
      if (!data.event_preferences.some(row => row.owner_user_id === user.user_id)) data.event_preferences.push({ owner_user_id: user.user_id, filters: {}, saved_event_ids: [], reminder_by_event: {} })
      if (!data.match_preferences.some(row => row.owner_user_id === user.user_id)) data.match_preferences.push({ owner_user_id: user.user_id, age_min: 18, age_max: 100, height_min: 100, height_max: 250, distance_max: 100, university: 'All', major: 'All', interest_ids: [], mbti: 'All', religion: 'All', drinking: 'All', gender: 'Everyone', language: 'All', goal_id: 'friends' })
      return account.onboarding.step
    }, { public: true })
  },
  async save_onboarding_step(step, patch, expected_account_id, { is_current = () => true } = {}) {
    try {
      const rt = get_runtime(this), context = require_context(this.data, rt.clock(), step)
      ensure(context.account.account_id === expected_account_id, 'The account changed. Please retry.')
      const message = onboarding_error(step, patch, rt.clock()); ensure(!message, message)
      if (step === 'photos' || step === 'complete') {
        const photos = this.data.profile_photos.filter(row => row.user_id === context.user.user_id)
        ensure(photos.length >= 2, 'Add at least two photos to continue.')
        for (const photo of photos) {
          const meta = this.data.media_files.find(row => row.media_url === photo.media_url && row.owner_user_id === context.user.user_id && row.kind === 'image')
          ensure(meta, 'Select your own photos to continue.')
          const blob = await rt.media.get(meta.media_id)
          ensure(blob instanceof Blob && blob.size === meta.byte_size && blob.type === meta.mime, 'Saved photo unavailable. Please select it again.')
          await rt.inspect_media(blob, 'image')
        }
      }
      if (!is_current()) return failure('cancelled', 'Profile setup was cancelled.')
      return transact(this, null, (data, now) => {
        const { account, user } = require_context(data, now, step)
        ensure(account.account_id === expected_account_id, 'The account changed. Please retry.')
        account.onboarding ||= { step: 'basic', completed_steps: [] }
        for (const field of fields[step] || []) user[field] = typeof patch[field] === 'string' ? patch[field].trim() : [...new Set(patch[field])]
        if (step === 'basic') { account.date_of_birth = patch.date_of_birth; user.age = age_from_date(patch.date_of_birth, now) }
        if (step === 'goal') for (const id of user.goal_ids) if (!data.goals.some(row => row.item_id === id)) data.goals.push(clone_data(ONBOARDING_GOALS.find(row => row.item_id === id)))
        if (step === 'ice') {
          data.icebreakers = data.icebreakers.filter(row => row.user_id !== user.user_id)
          user.icebreaker_ids = patch.questions.map((text, position) => { const question_id = make_id('question'); data.icebreakers.push({ question_id, user_id: user.user_id, text: text.trim(), position }); return question_id })
        }
        if (step === 'notif') { account.onboarding.notification_permission = patch.notification_permission; const settings = data.settings.find(row => row.owner_user_id === user.user_id); if (settings) settings.notifications.master = patch.notification_permission === 'granted' }
        if (step === 'complete') {
          ensure(ONBOARDING_FLOW.slice(0, -1).every(key => account.onboarding.completed_steps.includes(key)), 'Complete every profile step first.')
          for (const key of ['basic', 'uni', 'major', 'about', 'interests', 'goal', 'ice']) { const message = onboarding_error(key, { ...user, date_of_birth: account.date_of_birth, questions: user.icebreaker_ids.map(id => data.icebreakers.find(row => row.question_id === id)?.text) }, now); ensure(!message, message) }
          user.onboarding_status = 'complete'; user.discoverable = true; account.onboarding.completed_at = now
          data.auth_flow.pending_registration_account_id = null
          return 'home'
        }
        if (!account.onboarding.completed_steps.includes(step)) account.onboarding.completed_steps.push(step)
        const next = ONBOARDING_FLOW[ONBOARDING_FLOW.indexOf(step) + 1]
        if (ONBOARDING_FLOW.indexOf(next) > ONBOARDING_FLOW.indexOf(account.onboarding.step)) account.onboarding.step = next
        user.onboarding_status = 'in_progress'
        return next
      }, { expected_owner: context.user.user_id })
    } catch (error) { return failure('onboarding_failed', error.message) }
  },
}
