import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { auth_destination } from '@/utils/authNavigation.js'
import { onboarding_route } from '@/utils/onboardingFlow.js'
import { use_write_loading } from './useWriteLoading.js'
export function use_onboarding(step, frame) {
  const store = use_app_store(), error = ref(''), context = computed(() => store.onboarding), catalog = computed(() => store.onboarding_catalog)
  const allowed = computed(() => context.value && !context.value.completed && catalog.value.steps.indexOf(step) <= catalog.value.steps.indexOf(context.value.step))
  const access_error = computed(() => !context.value ? 'Log in and complete local verification before profile setup.' : context.value.completed ? 'Your profile is already complete.' : !allowed.value ? 'Complete the previous profile steps first.' : '')
  const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
  onHide(cancel_loading)
  const go = async target => { try { await frame.value.navigate_forward(auth_destination(target)) } catch (cause) { error.value = cause.message } }
  const recover = () => go(context.value?.completed ? '/pages/home/index' : context.value ? onboarding_route(context.value.step) : '/pages/auth/login')
  const back = async () => { const index = catalog.value.steps.indexOf(step); try { await frame.value.navigate_back(index > 0 ? onboarding_route(catalog.value.steps[index - 1]) : '/pages/auth/verification/success') } catch (cause) { error.value = cause.message } }
  const save = async patch => {
    if (is_loading.value || !allowed.value) return
    error.value = ''
    const id = context.value.account_id
    const result = await run_with_loading(async scope => {
      if (step === 'basic') { const start = store.begin_onboarding(id); if (!start.success) return start }
      return store.save_onboarding_step(step, patch, id, scope)
    })
    if (result.reason === 'cancelled') return
    if (!result.success) { error.value = result.message; return }
    await go(onboarding_route(result.data))
  }
  return { store, context, catalog, allowed, access_error, error, is_loading, run_with_loading, cancel_loading, back, go, save, recover }
}
