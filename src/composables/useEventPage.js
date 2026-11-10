import { computed, ref, watch } from 'vue'
import { onLoad, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from './useWriteLoading.js'
import { events_destination, require_events_destination_ready } from '@/utils/eventsNavigation.js'
import { auth_message } from '@/utils/authFeedback.js'

export function use_event_page(frame, { needsEvent = true, joinedOnly = false } = {}) {
  const store = use_app_store(), owner = store.session.current_user_id, auth_context = store.auth_context
  const event_id = ref(''), conversation_id = ref(''), error = ref(''), sheet = ref(''), locked = ref(false), navigating = ref(false)
  const { is_loading, run_with_loading: run, cancel_loading: cancel } = use_write_loading()
  onLoad(options => { event_id.value = String(options.event_id || ''); conversation_id.value = String(options.conversation_id || '') })
  const event = computed(() => store.event_detail(event_id.value))
  const access_error = computed(() => store.hydration_status !== 'ready' ? 'Your information is unavailable. Return and try again.' : !store.session.is_authenticated || store.session.current_user_id !== owner || store.auth_context !== auth_context ? 'Your session changed. Reopen this page after signing in.' : needsEvent && !event.value ? 'This event is no longer available.' : joinedOnly && !event.value?.joined ? 'Join this event before opening this page.' : '')
  const close = () => { if (!is_loading.value) { sheet.value = ''; error.value = '' } }
  const reset = () => { cancel(); sheet.value = ''; locked.value = false; error.value = '' }
  onHide(reset); watch(access_error, value => { if (value) reset() })
  const go = async (kind, id = event_id.value, replace = false) => {
    if (navigating.value || is_loading.value || access_error.value) return
    navigating.value = true; error.value = ''; store.tick()
    try { const url = require_events_destination_ready(events_destination(store, kind, id, ['report', 'group-report'].includes(kind) ? conversation_id.value : '')); await frame.value[replace ? 'navigate_replace' : 'navigate_forward'](url) }
    catch (cause) { error.value = auth_message(cause.message, 'This page couldn’t be opened. Please try again.') } finally { navigating.value = false }
  }
  const back = async (fallback = '/pages/events/index') => {
    if (navigating.value || is_loading.value) return
    navigating.value = true
    try { await frame.value.navigate_back(fallback) } catch (cause) { error.value = auth_message(cause.message, 'This page couldn’t be opened. Please try again.') } finally { navigating.value = false }
  }
  const open = kind => {
    if (is_loading.value || locked.value || access_error.value) return
    store.tick(); error.value = ''
    const blocker = kind === 'join' ? store.event_join_blocker(event_id.value) : kind === 'cancel' && !event.value?.joined ? 'You have not joined this event.' : ''
    if (blocker) { error.value = blocker; return }
    locked.value = true; sheet.value = kind
  }
  const write = action => run(context => access_error.value || store.session.current_user_id !== owner ? { success: false, message: access_error.value || 'Your account changed.' } : action(context))
  const attendance = async () => {
    if (is_loading.value || !['join', 'cancel'].includes(sheet.value)) return
    const kind = sheet.value; error.value = ''
    const result = await write(() => kind === 'join' ? store.join_event(event_id.value) : store.leave_event(event_id.value))
    if (result.reason === 'cancelled') return
    if (!result.success) { error.value = result.message; return }
    close()
    if (kind === 'join') await go('join-success')
  }
  return { store, event_id, conversation_id, event, error, sheet, locked, is_loading, access_error, go, back, open, close, write, attendance, cancel }
}
