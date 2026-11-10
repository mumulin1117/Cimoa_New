import { computed, ref, watch } from 'vue'

// Account ID alone cannot distinguish logout/relogin to the same account.
export function use_account_scope(store, invalidate = () => {}) {
  const account_id = store.session.account_id
  const captured = ref(store.hydration_status === 'ready' ? store.auth_context : null)
  // A page opened on a corrupt/unreadable snapshot may bind once after Retry.
  // A page that already observed a valid session can never bind again.
  watch(() => [store.hydration_status, store.auth_context], () => {
    if (captured.value === null && store.hydration_status === 'ready') captured.value = store.auth_context
  }, { flush: 'sync' })
  const access_error = computed(() => store.hydration_status !== 'ready'
    ? 'Your information is unavailable. Please return and retry.'
    : !store.session.is_authenticated || store.auth_context !== captured.value
      ? 'Your session has expired or the account changed. Reopen this page after logging in.'
      : '')
  watch(access_error, value => { if (value) invalidate() }, { flush: 'sync' })
  return { account_id, get auth_context() { return captured.value }, access_error, is_current: () => !access_error.value }
}
