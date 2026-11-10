import { clone_data } from './seed.js'
import { auth_context_key } from './accountDefaults.js'
import { authenticated, owner_id, introduction_blocker, ensure } from './selectors.js'
import { transact, failure, make_id, get_runtime } from './transactions.js'
import { auth_message } from '../utils/authFeedback.js'

// UI-only forms live outside data: unrelated transactions cannot autosave them.
// Published introduction drafts remain the only source for spending/media recovery.
const forms_for = state => state.introduction_forms.filter(row => row.auth_context === auth_context_key(state.data) && row.owner_user_id === owner_id(state.data))
export function introduction_form_data(state) {
  const forms = forms_for(state)
  if (!forms.length) return state.data
  const drafts = state.data.drafts.filter(row => !forms.some(form => form.draft_id === row.draft_id))
  for (const form of forms) {
    const saved = state.data.drafts.find(row => row.draft_id === form.draft_id && row.owner_user_id === form.owner_user_id)
    drafts.push(saved?.payload.completed_request_id ? saved : { draft_id: form.draft_id, owner_user_id: form.owner_user_id, kind: 'introduction', target_id: form.target_id, updated_at: form.updated_at, payload: { ...saved?.payload, ...form.payload } })
  }
  return { ...state.data, drafts }
}
function require_form_context(store, target) {
  ensure(store.hydration_status === 'ready', 'Your information is unavailable. Please try again.')
  ensure(authenticated(store.data, get_runtime(store).clock()), 'Your session has expired. Please sign in again.')
  const blocker = introduction_blocker(store.data, target, get_runtime(store).clock()); ensure(!blocker, blocker)
}
function draft_for(store, id) {
  const draft = introduction_form_data(store).drafts.find(row => row.draft_id === id && row.owner_user_id === owner_id(store.data) && row.kind === 'introduction')
  ensure(draft && !draft.payload.completed_request_id, 'This introduction is unavailable.')
  require_form_context(store, draft.target_id)
  return draft
}
function stage(store, draft, patch) {
  ensure(patch && Object.keys(patch).every(key => ['text', 'mode', 'question_id'].includes(key)), 'Unsupported introduction field.')
  const payload = { text: draft.payload.text || '', mode: draft.payload.mode || 'text', question_id: draft.payload.question_id, operation_id: draft.payload.operation_id || make_id('intro'), ...patch }
  ensure(typeof payload.text === 'string' && payload.text.length <= 300 && ['text', 'voice'].includes(payload.mode), 'Write an introduction up to 300 characters or record a voice note.')
  ensure(store.data.users.find(row => row.user_id === draft.target_id)?.icebreaker_ids.includes(payload.question_id), 'Choose one of this person’s current questions.')
  const form = { draft_id: draft.draft_id, owner_user_id: owner_id(store.data), auth_context: auth_context_key(store.data), target_id: draft.target_id, updated_at: get_runtime(store).clock(), payload }
  store.introduction_forms = [...forms_for(store).filter(row => row.target_id !== draft.target_id), form]
  return { success: true, data: form.draft_id }
}
export const introduction_form_actions = {
  stage_introduction_form(user_id, question_id, mode = 'text') {
    try {
      require_form_context(this, user_id)
      const existing = introduction_form_data(this).drafts.find(row => row.kind === 'introduction' && row.owner_user_id === owner_id(this.data) && row.target_id === user_id && !row.payload.completed_request_id)
      return stage(this, existing || { draft_id: make_id('intro_form'), target_id: user_id, payload: {} }, { question_id, mode })
    } catch (cause) { return failure('form_unavailable', auth_message(cause.message, 'Your introduction is unavailable. Please reopen it and try again.')) }
  },
  edit_introduction_form(id, patch) {
    try { return stage(this, draft_for(this, id), patch) }
    catch (cause) { return failure('form_unavailable', auth_message(cause.message, 'Your introduction is unavailable. Please reopen it and try again.')) }
  },
  persist_introduction_form(id) {
    let draft
    try { draft = clone_data(draft_for(this, id)) }
    catch (cause) { return failure('form_unavailable', auth_message(cause.message, 'Your introduction is unavailable. Please reopen it and try again.')) }
    const expected_context = auth_context_key(this.data)
    return transact(this, null, (data, now) => {
      const blocker = introduction_blocker(data, draft.target_id, now); ensure(!blocker, blocker)
      ensure(data.users.find(row => row.user_id === draft.target_id)?.icebreaker_ids.includes(draft.payload.question_id), 'Choose one of this person’s current questions.')
      let saved = data.drafts.find(row => row.draft_id === id && row.owner_user_id === owner_id(data))
      if (!saved) { saved = { draft_id: id, owner_user_id: owner_id(data), kind: 'introduction', target_id: draft.target_id, payload: {} }; data.drafts.push(saved) }
      ensure(saved.kind === 'introduction' && saved.target_id === draft.target_id && !saved.payload.completed_request_id, 'This introduction is unavailable.')
      saved.payload = { ...saved.payload, user_id: draft.target_id, ...draft.payload }; saved.updated_at = now
      return id
    }, { expected_context })
  },
}
