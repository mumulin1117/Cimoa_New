import { computed, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from './useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { require_profile_destination_ready } from '@/utils/profileNavigation.js'
export function use_profile_editor(frame, fallback = '/pages/profile/index') {
  const store = use_app_store(), context = computed(() => store.profile_editor), account_id = context.value?.account_id
  const error = ref(''), navigating = ref(false), { is_loading, run_with_loading, cancel_loading } = use_write_loading()
  const access_error = computed(() => store.hydration_status !== 'ready' ? 'Saved data is unavailable. Please return and retry.' : !context.value || context.value.account_id !== account_id ? 'Your account changed or the session expired. Reopen this page after logging in.' : '')
  watch(access_error, value => { if (value) cancel_loading() })
  onHide(cancel_loading)
  const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
  const go = async url => { if (navigating.value || is_loading.value) return; navigating.value = true; error.value = ''; try { await frame.value.navigate_forward(require_profile_destination_ready(url)) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
  const back = async () => { if (navigating.value || is_loading.value) return; navigating.value = true; try { await frame.value.navigate_back(fallback) } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
  const submit = async action => {
    if (is_loading.value || access_error.value) return false
    error.value = ''; const result = await run_with_loading(action)
    if (result.reason === 'cancelled') return false
    if (!result.success) { error.value = result.message; return false }
    await back(); return true
  }
  return { store, context, account_id, error, access_error, is_loading, run_with_loading, cancel_loading, go, back, recover, submit }
}
