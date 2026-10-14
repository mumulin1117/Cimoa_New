import { computed } from 'vue'
import { defineStore } from 'pinia'
import { create_seed, clone_data } from './seed.js'
import { migrate_legacy } from './migration.js'
import { normalize_email, signup_error, age_from_date, create_local_credential, verify_local_credential } from '../utils/localAuth.js'
import { LOCAL_VERIFICATION_CODE } from '../config/local-auth.js'
import { community_rules, registration_agreements } from '../utils/registrationCatalog.js'
import { local_verification_context, valid_local_code } from '../utils/localVerification.js'
import * as s from './selectors.js'
import * as ev from './eventSelectors.js'
import { STATE_KEY, LEGACY_KEY } from '../utils/statePersistence.js'
import { get_runtime, transact, operation, make_id, failure, unavailable, require_target, require_student, password_hash, add_transaction, connect_users } from './transactions.js'
export { configure_store_runtime, make_id as make_operation_id } from './transactions.js'
const own = (data, rows) => rows.filter((row) => row.owner_user_id === s.owner_id(data))
const require_owned = (data, rows, key, id) => {
  const row = rows.find((entry) => entry[key] === id && entry.owner_user_id === s.owner_id(data))
  s.ensure(row, 'This item is unavailable.')
  return row
}
const ready = (state) => state.hydration_status === 'ready' && s.authenticated(state.data, state.clock_ms)
const profile = (data, id) => {
  const user = s.user_by_id(data, id)
  return user ? { ...user, interests: user.interest_ids.map((id) => data.interests.find((row) => row.item_id === id)?.label).filter(Boolean), connection_goal: s.goals_for_user(data, id)[0]?.label || '', verified: user.verification_status === 'verified' } : null
}
const check_media = async (store, id, kind) => {
  const row = require_owned(store.data, store.data.media_files, 'media_id', id)
  s.ensure(!kind || row.kind === kind, 'Incorrect media type.')
  const blob = await get_runtime(store).media.get(id)
  s.ensure(blob instanceof Blob && blob.size === row.byte_size && blob.type === row.mime, 'Saved media is unavailable. Please select it again.')
  return row
}
export const use_app_store = defineStore('app', {
  state: () => ({ data: create_seed(), hydration_status: 'idle', hydration_error: '', last_error: '', clock_ms: Date.now() }),
  getters: {
    auth_draft: state => clone_data(state.data.auth_flow),
    registration_catalog: () => ({ rules: clone_data(community_rules), agreements: clone_data(registration_agreements) }),
    local_verification: state => state.hydration_status === 'ready' ? local_verification_context(state.data, state.clock_ms) : null,
    local_verification_code: () => LOCAL_VERIFICATION_CODE,
    requires_local_verification() { return this.session.is_authenticated && this.data.accounts.find(row => row.account_id === this.data.session.account_id)?.auth_provider === 'local' && !this.local_verification?.verified },
    session: (state) => ({ ...state.data.session, is_authenticated: ready(state) }),
    current_user: (state) => ready(state) ? { ...profile(state.data, s.owner_id(state.data)), email: state.data.accounts.find((row) => row.account_id === state.data.session.account_id)?.email, coin_balance: s.balance(state.data) } : { user_name: '', interests: [], coin_balance: 0 },
    current_user_profile() { return this.current_user },
    current_interests: (state) => ready(state) ? clone_data((s.user_by_id(state.data, s.owner_id(state.data))?.interest_ids || []).map(id => state.data.interests.find(row => row.item_id === id)).filter(Boolean)) : [],
    user_by_id: (state) => (id) => ready(state) ? profile(state.data, id) : null,
    goals_for_user: (state) => (id) => ready(state) ? s.goals_for_user(state.data, id) : [],
    visible_people: (state) => ready(state) ? state.data.users.filter((row) => row.user_id !== s.owner_id(state.data) && row.discoverable && s.visible(state.data, row.user_id) && state.data.settings.find((settings) => settings.owner_user_id === row.user_id)?.privacy.discover_visible !== false).map((row) => profile(state.data, row.user_id)) : [],
    discover_person() {
      const user = this.visible_people[0]
      if (!user) return null
      const photos = this.data.profile_photos.filter((row) => row.user_id === user.user_id && user.photo_ids.includes(row.photo_id)).sort((a, b) => a.position - b.position)
      return { ...user, photo: clone_data(photos[0] || null) }
    },
    introduction_blocker: (state) => (id) => state.hydration_status === 'ready' ? s.introduction_blocker(state.data, id, state.clock_ms) : 'Saved data is unavailable. Please retry loading it.',
    home_connections: (state) => ready(state) ? s.home_cards(state.data, state.clock_ms) : [],
    home_match_card: (state) => ready(state) ? s.home_match_card(state.data, state.clock_ms) : null,
    request_by_id: (state) => (id) => ready(state) ? clone_data(state.data.requests.find((row) => row.request_id === id && [row.sender_id, row.recipient_id].includes(s.owner_id(state.data)) && s.visible(state.data, row.sender_id) && s.visible(state.data, row.recipient_id)) || null) : null,
    match_by_id: (state) => (id) => ready(state) ? s.owned_matches(state.data, state.clock_ms).find((row) => row.match_id === id) || null : null,
    active_match: (state) => ready(state) ? s.active_match(state.data, state.clock_ms) : null,
    free_matches_remaining: (state) => ready(state) ? s.remaining_quota(state.data, state.clock_ms) : 0,
    coin_balance: (state) => ready(state) ? s.balance(state.data) : 0,
    coin_transactions: (state) => ready(state) ? clone_data(own(state.data, state.data.coin_transactions)) : [],
    coin_packages: (state) => clone_data(state.data.coin_packages),
    current_reports: (state) => ready(state) ? clone_data(own(state.data, state.data.reports)) : [],
    current_drafts: (state) => ready(state) ? clone_data(own(state.data, state.data.drafts)) : [],
    current_photos: (state) => ready(state) ? clone_data(state.data.profile_photos.filter((row) => row.user_id === s.owner_id(state.data)).sort((a, b) => a.position - b.position)) : [],
    current_settings: (state) => ready(state) ? clone_data(state.data.settings.find((row) => row.owner_user_id === s.owner_id(state.data)) || {}) : {},
    settings() { const row = this.current_settings; return { ...row, notifications_enabled: row.notifications?.master || false, show_online_status: row.privacy?.show_online || false, location_enabled: false } },
    blocked_accounts: (state) => ready(state) ? own(state.data, state.data.blocked_users).map((row) => clone_data(state.data.users.find((user) => user.user_id === row.user_id))).filter(Boolean) : [],
    blocked_user_ids() { return this.blocked_accounts.map((row) => row.user_id) },
    can_chat: (state) => (id) => ready(state) && s.connected(state.data, id),
    messages_for_conversation: (state) => (id) => ready(state) ? clone_data(s.messages_for(state.data, id)) : [],
    current_conversations: (state) => ready(state) ? state.data.conversations.filter((row) => row.kind === 'direct' && s.can_open_conversation(state.data, row)).map((row) => {
      const messages = s.messages_for(state.data, row.conversation_id)
      return { ...clone_data(row), participant_id: row.participant_ids.find((id) => id !== s.owner_id(state.data)), messages: clone_data(messages), unread_count: messages.filter((message) => !message.read_by.includes(s.owner_id(state.data))).length }
    }) : [],
    conversations() { return this.current_conversations },
    unread_count() { return this.current_conversations.reduce((sum, row) => sum + row.unread_count, 0) },
    events: (state) => ready(state) ? state.data.events.map(event => ev.event_card(state.data, event, state.clock_ms)) : [],
    event_tabs: () => ev.EVENT_TABS,
    active_event_tab: (state) => ready(state) ? ev.active_event_tab(state.data) : 'Today',
    event_feed: (state) => ready(state) ? ev.event_feed(state.data, state.clock_ms) : [],
    event_by_id() { return id => clone_data(this.events.find(row => row.event_id === id) || null) },
    event_join_blocker: (state) => id => state.hydration_status === 'ready' ? ev.event_join_blocker(state.data, id, state.clock_ms) : 'Saved data is unavailable. Please retry loading it.',
    event_participants: (state) => (id) => ready(state) ? s.members(state.data, id).filter((row) => s.visible(state.data, row.user_id)).map((row) => profile(state.data, row.user_id)) : [],
    my_events() { return this.events.filter((row) => row.joined) },
    event_count() { return this.my_events.length },
    legacy_recovery: (state) => ready(state) && state.data.legacy_archive?.owner_user_id === s.owner_id(state.data) ? clone_data(state.data.legacy_archive.snapshot) : null,
    relationships: (state) => ready(state) ? state.data.users.filter((row) => row.user_id !== s.owner_id(state.data)).map((row) => ({ to_user_id: row.user_id, status: s.connected(state.data, row.user_id) ? 'mutual' : 'none' })) : [],
    match: (state) => ({ ...(s.active_match(state.data, state.clock_ms) || { status: 'idle', candidate_id: null }), preferences: clone_data(state.data.match_preferences.find((row) => row.owner_user_id === s.owner_id(state.data)) || {}) }),
    posts: () => [], comments_for_post: () => () => [],
  },
  actions: {
    tick() { this.clock_ms = get_runtime(this).clock() },
    hydrate() {
      if (this.hydration_status === 'ready') return { success: true }
      this.hydration_status = 'loading'
      try {
        const rt = get_runtime(this), current = rt.persistence.read(STATE_KEY)
        const data = current == null ? migrate_legacy(rt.persistence.read(LEGACY_KEY), rt.clock()) : clone_data(current)
        s.validate_data(data)
        this.data = data; this.clock_ms = rt.clock(); this.hydration_status = 'ready'; this.hydration_error = ''
        return { success: true }
      } catch {
        this.hydration_status = 'error'; this.hydration_error = 'Saved data could not be loaded. Your data has not been changed. Please retry.'
        return failure('storage_read_failed', this.hydration_error)
      }
    },
    async login(email, password, { is_current = () => true } = {}) {
      const email_key = String(email || '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_key) || !password) return failure('invalid_form', 'Enter a valid email and password.')
      try {
        const expected = this.data.accounts.find(row => row.email === email_key && row.status === 'active')
        const valid = expected?.auth_provider === 'local' ? await verify_local_credential(expected, password) : expected?.auth_provider === 'fixture' && expected.credential_hash === await password_hash(password)
        if (!is_current()) return failure('cancelled', 'Sign in was cancelled.')
        return transact(this, null, (data, now) => {
          const account = data.accounts.find(row => row.account_id === expected?.account_id && row.status === 'active' && row.credential_hash === expected.credential_hash)
          s.ensure(valid && account, 'Email or password is incorrect.')
          data.session = { account_id: account.account_id, current_user_id: account.user_id, expires_at: now + 30 * 86400000 }; return account.user_id
        }, { public: true })
      } catch { return unavailable('Secure authentication') }
    },
    logout() { return transact(this, null, (data) => { data.session = { current_user_id: null, account_id: null, expires_at: null }; data.auth_flow.pending_registration_account_id = null }, { public: true }) },
    async delete_account(password) {
      const owner = s.owner_id(this.data), expected = this.data.accounts.find(row => row.account_id === this.data.session.account_id)
      const valid = await (expected?.auth_provider === 'local' ? verify_local_credential(expected, password) : password_hash(password).then(hash => hash === expected?.credential_hash)).catch(() => false)
      return transact(this, null, (data) => {
        const account = data.accounts.find((row) => row.account_id === data.session.account_id)
        s.ensure(valid && account?.credential_hash === expected?.credential_hash, 'Password is incorrect.')
        account.status = 'deleted'; data.users.find((row) => row.user_id === owner).deleted = true
        data.session = { current_user_id: null, account_id: null, expires_at: null }
      }, { expected_owner: owner })
    },
    async register_local_account(input) {
      const email = normalize_email(input?.email), now = get_runtime(this).clock()
      const error = signup_error(input, now)
      if (error) return failure('invalid_form', error)
      if (this.session.is_authenticated) return failure('already_authenticated', 'Log out before creating another account.')
      if (this.data.accounts.some(row => row.email === email)) return failure('email_exists', 'This email is already registered. Log in instead.')
      try {
        const credential = await create_local_credential(input.password)
        return transact(this, null, (data, timestamp) => {
          s.ensure(!s.authenticated(data, timestamp), 'The account changed. Please retry.')
          s.ensure(!data.accounts.some(row => row.email === email), 'This email is already registered. Log in instead.')
          const user_id = make_id('user'), account_id = make_id('account')
          data.accounts.push({ account_id, user_id, email, status: 'active', ...credential, date_of_birth: input.date_of_birth, agreements: clone_data(input.agreements), created_at: timestamp })
          data.users.push({ user_id, user_name: 'New member', age: age_from_date(input.date_of_birth, timestamp), avatar_url: '', university: '', major: '', mbti: '', bio: '', bio_font: 'system', country: '', goal_ids: [], interest_ids: [], photo_ids: [], icebreaker_ids: [], song_id: null, verification_status: 'pending', onboarding_status: 'not_started', discoverable: false, deleted: false })
          data.auth_flow = { ...data.auth_flow, step: 'registered', email, verification_request_id: null, pending_registration_account_id: account_id, profile_draft: {}, agreements: { ...clone_data(input.agreements), age: true, student: false } }
          return { account_id, user_id, next_step: 'local_verification' }
        }, { public: true })
      } catch { return unavailable('Secure local authentication') }
    },
    create_account({ email } = {}) { return this.data.accounts.some(row => row.email === normalize_email(email)) ? failure('email_exists', 'This email is already registered.') : failure('registration_form_required', 'Complete the local registration form first.') },
    reset_password() { return unavailable('Password reset') },
    apply_verification(code, expected_account_id) {
      if (!valid_local_code(code)) return failure('invalid_code', 'That code is incorrect. Enter the six-digit local verification code.')
      if (this.hydration_status !== 'ready') return failure('storage_not_ready', 'Saved data is unavailable. Please retry loading it.')
      const context = local_verification_context(this.data, get_runtime(this).clock())
      if (!context || context.account_id !== expected_account_id) return failure('account_changed', 'Log in to the same local account and try again.')
      if (context.verified) return { success: true, repeated: true, data: context }
      return transact(this, null, (data, now) => {
        const current = local_verification_context(data, now)
        s.ensure(current?.account_id === expected_account_id, 'The account changed. Please retry.')
        data.accounts.find(row => row.account_id === current.account_id).local_verification = { method: 'fixed_code', status: 'verified', verified_at: now }
        if (data.auth_flow.pending_registration_account_id === current.account_id) data.auth_flow.step = 'local_verified'
        return local_verification_context(data, now)
      }, { public: true })
    },
    submit_support() { return unavailable('Support delivery') },
    update_profile(patch) {
      return transact(this, null, (data) => {
        const allowed = ['user_name', 'age', 'height_cm', 'major', 'university', 'mbti', 'country', 'year', 'degree', 'graduation_year', 'gender', 'pronouns', 'languages', 'clubs', 'religion', 'drinking', 'smoking', 'location', 'bio', 'bio_font', 'goal_ids', 'interest_ids', 'song_id']
        s.ensure(patch && Object.keys(patch).every((key) => allowed.includes(key)), 'This profile field cannot be changed here.')
        const user = data.users.find((row) => row.user_id === s.owner_id(data)); Object.assign(user, clone_data(patch))
        if (patch.user_name) user.user_name = patch.user_name.trim()
        s.ensure(typeof user.bio === 'string' && user.bio.length <= 300, 'Your introduction must be 300 characters or fewer.')
      })
    },
    save_icebreakers(texts) {
      return transact(this, null, (data) => {
        s.ensure(Array.isArray(texts) && texts.length === 3 && texts.every((text) => typeof text === 'string' && text.trim()), 'Choose three icebreaker questions.')
        const user = data.users.find((row) => row.user_id === s.owner_id(data))
        user.icebreaker_ids = texts.map((text, position) => { const question_id = make_id('question'); data.icebreakers.push({ question_id, user_id: user.user_id, text: text.trim(), position }); return question_id })
      })
    },
    save_draft(kind, target_id, payload) {
      return transact(this, null, (data, now) => {
        s.ensure(typeof kind === 'string' && kind && payload && typeof payload === 'object' && !/"(?:password|pw|code|credential_hash)"|data:[^;]+;base64/.test(JSON.stringify(payload)), 'This draft contains unsupported data.')
        let row = own(data, data.drafts).find((entry) => entry.kind === kind && entry.target_id === target_id)
        if (!row) { row = { draft_id: make_id('draft'), owner_user_id: s.owner_id(data), kind, target_id }; data.drafts.push(row) }
        Object.assign(row, { payload: clone_data(payload), updated_at: now }); return row.draft_id
      })
    },
    discard_draft(id) { return transact(this, null, (data) => { require_owned(data, data.drafts, 'draft_id', id); data.drafts = data.drafts.filter((row) => row.draft_id !== id) }) },
    save_auth_draft(patch) { return transact(this, null, (data) => { s.ensure(Object.keys(patch).every((key) => ['step', 'email', 'agreements', 'profile_draft'].includes(key)) && !/"(?:password|pw|code|credential_hash)"|data:[^;]+;base64/.test(JSON.stringify(patch)), 'Unsupported signup field.'); Object.assign(data.auth_flow, clone_data(patch)) }, { public: true }) },
    save_registration_age(date_of_birth) {
      return transact(this, null, (data, now) => {
        s.ensure(!s.authenticated(data, now) && !data.auth_flow.pending_registration_account_id, 'Please finish your existing account setup or log out first.')
        const age = age_from_date(date_of_birth, now)
        s.ensure(age != null && age >= 18, 'Enter a valid date of birth. You must be 18 or older.')
        data.auth_flow.profile_draft = { date_of_birth }
        data.auth_flow.agreements.age = true
        data.auth_flow.step = 'community'
      }, { public: true })
    },
    save_registration_agreements(agreements) {
      return transact(this, null, (data, now) => {
        s.ensure(!s.authenticated(data, now) && !data.auth_flow.pending_registration_account_id, 'Please finish your existing account setup or log out first.')
        s.ensure(age_from_date(data.auth_flow.profile_draft.date_of_birth, now) >= 18, 'Complete the age check first.')
        s.ensure(['terms', 'privacy', 'community'].every(key => agreements?.[key] === true), 'Please confirm all three community agreements.')
        data.auth_flow.agreements = { age: true, student: false, terms: true, privacy: true, community: true }
        data.auth_flow.step = 'signup'
      }, { public: true })
    },
    async save_media(blob, kind, duration_ms = 0) {
      const owner = s.owner_id(this.data), media_id = make_id('media'), rt = get_runtime(this)
      try {
        s.ensure(this.session.is_authenticated, 'Please log in again.')
        s.ensure(['image', 'audio'].includes(kind) && blob instanceof Blob && blob.size > 0 && blob.size <= 20 * 1024 * 1024 && blob.type.startsWith(`${kind}/`), 'Choose a supported file smaller than 20 MB.')
        const decoded = await rt.inspect_media(blob, kind)
        duration_ms = decoded.duration_ms
        s.ensure(kind !== 'audio' || Number.isFinite(duration_ms) && duration_ms > 0, 'Record a playable voice note first.')
        await rt.media.put(media_id, blob)
        const result = transact(this, null, (data) => { const row = { media_id, owner_user_id: owner, kind, media_url: `indexeddb://${media_id}`, mime: blob.type, duration_ms, byte_size: blob.size }; data.media_files.push(row); return row }, { expected_owner: owner })
        if (!result.success) { await rt.media.delete(media_id); return result }
        return result
      } catch (error) { return failure('media_failed', error.message || 'Media could not be saved.') }
    },
    async save_profile_photos(media_ids) {
      const owner = s.owner_id(this.data)
      try {
        s.ensure(Array.isArray(media_ids) && media_ids.length >= 1 && new Set(media_ids).size === media_ids.length, 'Choose at least one photo.')
        const media = await Promise.all(media_ids.map((id) => check_media(this, id, 'image')))
        return transact(this, null, (data) => {
          const user = data.users.find((row) => row.user_id === owner)
          data.profile_photos = data.profile_photos.filter((row) => row.user_id !== owner)
          user.photo_ids = media.map((row, position) => { const photo_id = make_id('photo'); data.profile_photos.push({ photo_id, user_id: owner, media_url: row.media_url, position }); return photo_id })
          user.avatar_url = media[0].media_url
        }, { expected_owner: owner })
      } catch (error) { return failure('media_failed', error.message) }
    },
    async send_introduction({ user_id, question_id, kind = 'text', text = '', audio_id = null, operation_id }) {
      const owner = s.owner_id(this.data)
      try { if (kind === 'voice') await check_media(this, audio_id, 'audio') } catch (error) { return failure('media_unavailable', error.message) }
      return transact(this, operation(operation_id, 'introduction', [user_id, question_id, kind, text, audio_id]), (data, now) => {
        const blocker = s.introduction_blocker(data, user_id, now)
        s.ensure(!blocker, blocker)
        s.ensure(data.icebreakers.some((q) => q.question_id === question_id && q.user_id === user_id), 'Choose one of this person’s questions.')
        s.ensure(kind === 'text' ? typeof text === 'string' && text.trim() : kind === 'voice', 'Write an introduction or record a voice note.')
        const request_id = make_id('request')
        if (kind === 'voice') add_transaction(data, -10, `voice:${request_id}`, 'spend', request_id, now)
        data.requests.push({ request_id, sender_id: owner, recipient_id: user_id, question_id, kind, text: text.trim(), audio_id, status: 'pending', created_at: now, resolved_at: null }); return request_id
      }, { expected_owner: owner })
    },
    resolve_request(id, decision) {
      return transact(this, null, (data, now) => {
        const row = data.requests.find((entry) => entry.request_id === id)
        s.ensure(row && row.status === 'pending' && ['accepted', 'declined', 'cancelled'].includes(decision), 'This request is no longer pending.')
        s.ensure((decision === 'cancelled' ? row.sender_id : row.recipient_id) === s.owner_id(data), 'You cannot change this request.')
        require_target(data, row.sender_id === s.owner_id(data) ? row.recipient_id : row.sender_id)
        row.status = decision; row.resolved_at = now
        return decision === 'accepted' ? connect_users(data, row.sender_id, now) : id
      })
    },
    accept_request(id) { return this.resolve_request(id, 'accepted') },
    decline_request(id) { return this.resolve_request(id, 'declined') },
    cancel_request(id) { return this.resolve_request(id, 'cancelled') },
    start_match(operation_id) {
      if (!get_runtime(this).services.matching_available) return unavailable('Auto Match service')
      return transact(this, operation(operation_id, 'match', []), (data, now) => {
        require_student(data); s.ensure(!s.active_match(data, now), 'A match session is already active.')
        const match_id = make_id('match'), date_key = s.utc_date_key(now)
        let quota = own(data, data.match_quota).find((row) => row.date_key === date_key)
        if (!quota) { quota = { owner_user_id: s.owner_id(data), date_key, used_count: 0 }; data.match_quota.push(quota) }
        if (quota.used_count < 3) quota.used_count += 1
        else add_transaction(data, -10, `match:${match_id}`, 'spend', match_id, now)
        data.match_sessions.push({ match_id, owner_user_id: s.owner_id(data), candidate_id: null, status: 'searching', created_at: now, started_at: now, paused_at: null, expires_at: null, priority_until: null, self_accepted: false, peer_accepted: false, queue_position: null, estimated_wait_seconds: null, fixture: false }); return match_id
      })
    },
    transition_match(id, status) {
      return transact(this, null, (data, now) => {
        const row = require_owned(data, data.match_sessions, 'match_id', id)
        const allowed = { searching: ['paused', 'left'], paused: ['searching', 'left'], found: ['waiting', 'passed', 'left'], waiting: ['left'] }
        s.ensure(allowed[s.match_status(row, now)]?.includes(status), 'This match action is no longer available.')
        row.status = status; row.paused_at = status === 'paused' ? now : null
        if (status === 'waiting') { require_target(data, row.candidate_id); row.self_accepted = true }
        return id
      })
    },
    async apply_match_event(event) {
      const owner = s.owner_id(this.data)
      let valid = false
      try { valid = !!await get_runtime(this).services.verify_match_event?.(event) } catch { /* Fail closed. */ }
      if (!valid) return unavailable('Verified matching events')
      return transact(this, operation(event.event_id, 'match-event', event), (data, now) => {
        const row = require_owned(data, data.match_sessions, 'match_id', event.match_id)
        if (event.type === 'queue') {
          s.ensure(row.status === 'searching' && Number.isInteger(event.queue_position) && event.queue_position > 0 && (event.estimated_wait_seconds == null || Number.isFinite(event.estimated_wait_seconds) && event.estimated_wait_seconds >= 0), 'Invalid queue update.')
          row.queue_position = event.queue_position; row.estimated_wait_seconds = event.estimated_wait_seconds ?? null
        }
        else if (event.type === 'found') { s.ensure(row.status === 'searching', 'The queue is not searching.'); require_target(data, event.user_id); row.candidate_id = event.user_id; row.status = 'found'; row.expires_at = now + 45000 }
        else if (event.type === 'accepted') { s.ensure(row.status === 'waiting' && row.self_accepted && row.candidate_id === event.user_id, 'The candidate does not match.'); require_target(data, event.user_id); row.peer_accepted = true; row.status = 'connected'; connect_users(data, event.user_id, now) }
        else { s.ensure(event.type === 'no_match' && row.status === 'searching', 'Invalid queue event.'); row.status = 'no_match' }
      }, { expected_owner: owner })
    },
    boost_match(id, operation_id) { return transact(this, operation(operation_id, 'priority', id), (data, now) => { const row = require_owned(data, data.match_sessions, 'match_id', id); s.ensure(['searching', 'paused'].includes(row.status) && !(row.priority_until > now), 'Priority Match is not available for this session.'); add_transaction(data, -20, `priority:${operation_id}`, 'spend', id, now); row.priority_until = now + 900000 }) },
    update_match_preferences(patch) { return transact(this, null, (data) => { const row = data.match_preferences.find((entry) => entry.owner_user_id === s.owner_id(data)); s.ensure(row && Object.keys(patch).every((key) => key !== 'owner_user_id' && key in row), 'Invalid matching preference.'); Object.assign(row, clone_data(patch)); s.ensure(row.age_min >= 18 && row.age_min <= row.age_max && row.age_max <= 100 && row.height_min <= row.height_max && row.distance_max > 0 && row.interest_ids.every((id) => data.interests.some((item) => item.item_id === id)), 'Check your matching preferences.') }) },
    join_event(id) {
      return transact(this, null, (data, now) => {
        const blocker = ev.event_join_blocker(data, id, now)
        s.ensure(!blocker, blocker)
        let row = data.memberships.find((entry) => entry.event_id === id && entry.user_id === s.owner_id(data))
        if (!row) { row = { membership_id: make_id('member'), event_id: id, user_id: s.owner_id(data) }; data.memberships.push(row) }
        Object.assign(row, { status: 'joined', joined_at: now })
        let group = data.conversations.find((entry) => entry.kind === 'group' && entry.event_id === id)
        if (!group) { group = { conversation_id: make_id('group'), kind: 'group', participant_ids: [], event_id: id }; data.conversations.push(group) }
        return group.conversation_id
      })
    },
    leave_event(id) { return transact(this, null, (data) => { const row = data.memberships.find((entry) => entry.event_id === id && entry.user_id === s.owner_id(data) && entry.status === 'joined'); s.ensure(row, 'You have not joined this event.'); row.status = 'left' }) },
    cancel_event(id) { return this.leave_event(id) },
    select_event_tab(label) {
      return transact(this, null, data => {
        s.ensure(ev.EVENT_TABS.some(tab => tab.label === label), 'Invalid event filter.')
        let row = data.event_preferences.find(entry => entry.owner_user_id === s.owner_id(data))
        if (!row) { row = { owner_user_id: s.owner_id(data), filters: {}, saved_event_ids: [], reminder_by_event: {} }; data.event_preferences.push(row) }
        row.active_tab = label
      })
    },
    toggle_event_saved(id) { return transact(this, null, (data) => { s.ensure(data.events.some((row) => row.event_id === id), 'Event unavailable.'); const row = data.event_preferences.find((entry) => entry.owner_user_id === s.owner_id(data)); row.saved_event_ids = row.saved_event_ids.includes(id) ? row.saved_event_ids.filter((entry) => entry !== id) : [...row.saved_event_ids, id] }) },
    update_event_preferences(patch) { return transact(this, null, (data) => { s.ensure(Object.keys(patch).every((key) => ['filters', 'reminder_by_event'].includes(key)), 'Invalid event preference.'); Object.assign(data.event_preferences.find((row) => row.owner_user_id === s.owner_id(data)), clone_data(patch)) }) },
    async send_message(conversation_id, body, operation_id = make_id(), media_id = null) {
      const owner = s.owner_id(this.data)
      let media
      try { if (media_id) media = await check_media(this, media_id) } catch (error) { return failure('media_unavailable', error.message) }
      return transact(this, operation(operation_id, 'message', [conversation_id, body, media_id]), (data, now) => {
        s.ensure(s.can_open_conversation(data, data.conversations.find((row) => row.conversation_id === conversation_id)), 'This conversation is unavailable.')
        s.ensure(media || typeof body === 'string' && body.trim(), 'Write a message first.')
        const message_id = make_id('message'); data.messages.push({ message_id, conversation_id, sender_id: owner, kind: media?.kind || 'text', body: String(body || '').trim(), media_id, sent_at: now, read_by: [owner] }); return message_id
      }, { expected_owner: owner })
    },
    mark_read(id) { return transact(this, null, (data) => { s.ensure(s.can_open_conversation(data, data.conversations.find((row) => row.conversation_id === id)), 'Conversation unavailable.'); for (const row of s.messages_for(data, id)) if (!row.read_by.includes(s.owner_id(data))) row.read_by.push(s.owner_id(data)) }) },
    block_user(id) { return transact(this, null, (data, now) => { require_target(data, id); data.blocked_users.push({ block_id: make_id('block'), owner_user_id: s.owner_id(data), user_id: id, created_at: now }) }) },
    unblock_user(id) { return transact(this, null, (data) => { s.ensure(s.blocked(data, id), 'This account is not blocked.'); data.blocked_users = data.blocked_users.filter((row) => row.owner_user_id !== s.owner_id(data) || row.user_id !== id) }) },
    submit_report({ target_type, target_id, reason, description = '', context_id = null, also_block = false }) {
      return transact(this, null, (data, now) => {
        s.ensure(['user', 'event'].includes(target_type) && typeof reason === 'string' && reason.trim(), 'Choose a report reason.')
        if (target_type === 'user') require_target(data, target_id)
        else s.ensure(data.events.some((row) => row.event_id === target_id), 'Event unavailable.')
        const report_id = make_id('report'); data.reports.push({ report_id, owner_user_id: s.owner_id(data), target_type, target_id, reason, description, context_id, status: 'local_saved', created_at: now })
        if (also_block) { s.ensure(target_type === 'user', 'Only a user can be blocked.'); data.blocked_users.push({ block_id: make_id('block'), owner_user_id: s.owner_id(data), user_id: target_id, created_at: now }) }
        return report_id
      })
    },
    report_user(id, reason) { return this.submit_report({ target_type: 'user', target_id: id, reason }) },
    update_settings(group, patch) { return transact(this, null, (data) => { const row = data.settings.find((entry) => entry.owner_user_id === s.owner_id(data)); s.ensure(['notifications', 'privacy'].includes(group) && Object.keys(patch).every((key) => key in row[group] && typeof patch[key] === 'boolean'), 'Invalid setting.'); Object.assign(row[group], patch) }) },
    toggle_setting(key) { const map = { notifications_enabled: ['notifications', 'master'], show_online_status: ['privacy', 'show_online'] }; const path = map[key]; return path ? this.update_settings(path[0], { [path[1]]: !this.current_settings[path[0]][path[1]] }) : unavailable('Location permission settings') },
    begin_purchase(package_id, operation_id) { return transact(this, operation(operation_id, 'purchase', package_id), (data, now) => { s.ensure(data.coin_packages.some((row) => row.package_id === package_id) && !own(data, data.purchase_requests).some((row) => row.status === 'pending'), 'A purchase is already pending or this package is unavailable.'); const request_id = make_id('purchase'); data.purchase_requests.push({ request_id, owner_user_id: s.owner_id(data), package_id, status: 'pending', created_at: now, receipt_id: null }); return request_id }) },
    expire_purchases() { return transact(this, null, (data, now) => { for (const row of own(data, data.purchase_requests)) if (row.status === 'pending' && now - row.created_at >= 8000) row.status = 'timeout' }) },
    async settle_purchase(id, result) {
      const owner = s.owner_id(this.data), before = this.data.purchase_requests.find((row) => row.request_id === id && row.owner_user_id === owner)
      if (!before || before.status !== 'pending') return failure('stale_callback', 'This purchase request is no longer pending.')
      if (result.status === 'success') {
        let valid = false
        try { valid = !!await get_runtime(this).services.verify_purchase?.({ ...result, request_id: id, owner_user_id: owner, package_id: before.package_id }) } catch { /* Untrusted receipt never changes coins. */ }
        if (!valid) result = { status: 'failure' }
      }
      return transact(this, null, (data, now) => {
        const row = require_owned(data, data.purchase_requests, 'request_id', id)
        s.ensure(row.status === 'pending' && ['success', 'failure', 'cancelled', 'timeout'].includes(result.status), 'This purchase callback is no longer valid.')
        if (result.status === 'success' && now - row.created_at >= 8000) { row.status = 'timeout'; return { status: row.status } }
        if (result.status === 'success') {
          const pack = data.coin_packages.find((entry) => entry.package_id === row.package_id)
          s.ensure(pack.product_id && result.product_id === pack.product_id && result.package_id === row.package_id && result.owner_user_id === owner && result.receipt_id && !data.purchase_requests.some((entry) => entry.receipt_id === result.receipt_id), 'Purchase details do not match.')
          add_transaction(data, pack.coins, `purchase:${id}`, 'purchase', id, now); row.receipt_id = result.receipt_id
        }
        row.status = result.status; return { status: row.status }
      }, { expected_owner: owner })
    },
    async apply_refund(id, event) {
      const owner = s.owner_id(this.data)
      let valid = false
      try { valid = !!await get_runtime(this).services.verify_refund?.(event) } catch { /* Fail closed. */ }
      if (!valid) return unavailable('Verified refunds')
      return transact(this, operation(event.event_id, 'refund', id), (data, now) => { const row = require_owned(data, data.coin_transactions, 'transaction_id', id); s.ensure(row.amount < 0 && row.status === 'completed', 'This transaction cannot be refunded.'); add_transaction(data, -row.amount, `refund:${id}`, 'refund', id, now) }, { expected_owner: owner })
    },
    spend_coins() { return failure('unsupported_action', 'Use a valid voice or matching request to spend coins.') },
    complete_purchase() { return failure('unverified_purchase', 'A verified purchase callback is required.') },
    set_match_status() { return unavailable('Verified matching events') },
    toggle_relationship() { return failure('question_required', 'Choose a question and send a real introduction first.') },
    toggle_post_reaction() { return failure('unsupported_action', 'Posts are not part of Cimoa.') },
  },
})
export const use_store_summary = () => { const store = use_app_store(); return { visible_people: computed(() => store.visible_people), conversations: computed(() => store.current_conversations) } }
