import { computed, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from './useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { require_profile_destination_ready } from '@/utils/profileNavigation.js'
import { use_account_scope } from './useAccountScope.js'
import { FEEDBACK, show_toast } from '@/utils/toast.js'
import { auth_message } from '@/utils/authFeedback.js'
export function use_profile_editor(frame, fallback = '/pages/profile/index') {
  const store = use_app_store(), context = computed(() => store.profile_editor), account_id = context.value?.account_id
  const error = ref(''), navigating = ref(false), { is_loading, run_with_loading, cancel_loading } = use_write_loading()
  const { access_error, auth_context } = use_account_scope(store, cancel_loading)
  watch(access_error, value => { if (value) cancel_loading() })
  onHide(cancel_loading)
  const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = auth_message(cause.message, 'This page couldn’t be opened. Please try again.') } }
  const go = async url => { if (navigating.value || is_loading.value || access_error.value) return; navigating.value = true; error.value = ''; try { await frame.value.navigate_forward(require_profile_destination_ready(url)) } catch (cause) { error.value = auth_message(cause.message, 'This page couldn’t be opened. Please try again.') } finally { navigating.value = false } }
  const back = async () => { if (navigating.value || is_loading.value) return false; navigating.value = true; try { return await frame.value.navigate_back(fallback) !== false } catch (cause) { error.value = auth_message(cause.message, 'This page couldn’t be opened. Please try again.'); return false } finally { navigating.value = false } }
  const submit = async (action, message = FEEDBACK.profile_updated) => {
    if (is_loading.value || access_error.value) return false
    error.value = ''; const result = await run_with_loading(scope => action({ ...scope, expected_context: auth_context, is_current: () => scope.is_current() && !access_error.value }))
    if (result.reason === 'cancelled') return false
    if (!result.success) { error.value = result.message; return false }
    if (await back()) show_toast(message, { tone: 'success' })
    return true
  }
  return { store, context, account_id, error, access_error, is_loading, run_with_loading, cancel_loading, go, back, recover, submit }
}
