<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { open_app_settings } from '@/utils/nativePermissions.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import FlowStatePanel from './FlowStatePanel.vue'
import EventActionLoading from './EventActionLoading.vue'

const props = defineProps({ state: { type: String, required: true } })
const store = use_app_store(), frame = ref(null), error = ref(''), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const content = computed(() => ({
  loading: { icon: 'sparkle', title: 'Loading…', copy: 'Cimoa is preparing this content.' },
  offline: { icon: 'globe', title: 'You’re offline', copy: 'Check your connection and try again.' },
  error: { icon: 'blocked', title: 'Something went wrong', copy: 'That didn’t go through. It’s not something you did.' },
  maintenance: { icon: 'settings', title: 'Cimoa is temporarily unavailable', copy: 'We’re making scheduled improvements. Please check back shortly.' },
  empty: { icon: 'sparkle', title: 'Nothing here yet', copy: 'Content will appear here once available.' },
  permission: { icon: 'shield', title: 'This needs access to continue', copy: 'Turn this on in Settings to use this feature.' },
  session: { icon: 'person', title: 'Your session has expired', copy: 'Please log in again. Your account data is unchanged.' },
}[props.state]))
const prefix = computed(() => ({ offline: 'sysOffline', error: 'sysError', permission: 'sysPermDenied', session: 'sysSessionExpired' }[props.state] || 'sysState'))
const go_home = async () => { if (navigating.value || is_loading.value) return; navigating.value = true; try { await frame.value.navigate_replace('/pages/home/index') } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const back = async () => { if (navigating.value || is_loading.value) return; navigating.value = true; try { await frame.value.navigate_back('/pages/home/index') } catch (cause) { error.value = cause.message } finally { navigating.value = false } }
const retry = async () => { error.value = ''; if (props.state === 'offline' && globalThis.navigator?.onLine !== true) { error.value = 'You are still offline. No network operation was attempted.'; return } await back() }
const settings = async () => { try { await open_app_settings() } catch (cause) { error.value = cause.message } }
const login = async () => { const result = await run_with_loading(() => store.logout()); if (result.reason === 'cancelled') return; if (!result.success) { error.value = result.message; return } try { await relaunch_route('/pages/auth/welcome') } catch (cause) { error.value = cause.message } }
onHide(() => { navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template><SecondaryPageFrame ref="frame"><FlowStatePanel :icon="content.icon" :title="content.title" :copy="content.copy" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text><template #footer><view v-if="state !== 'loading' && state !== 'maintenance'" class="flow-footer"><template v-if="state === 'offline'"><view class="flow-primary" role="button" data-interaction="sysOffline.goBack.click.1" @click="retry">Try Again</view><view class="flow-secondary" role="button" data-interaction="sysOffline.goBack.click.2" @click="go_home">View Available Offline Content</view></template><template v-else-if="state === 'error'"><view class="flow-primary" role="button" data-interaction="sysError.goBack.click.1" @click="back">Try Again</view><view class="flow-secondary" role="button" data-interaction="sysError.goBack.click.2" @click="back">Go Back</view></template><template v-else-if="state === 'empty'"><view class="flow-secondary" role="button" @click="back">Go Back</view></template><template v-else-if="state === 'permission'"><view class="flow-primary" role="button" data-interaction="sysPermDenied.goBack.click.1" @click="settings">Open Settings</view><view class="flow-secondary" role="button" data-interaction="sysPermDenied.goBack.click.2" @click="back">Not Now</view></template><template v-else-if="state === 'session'"><view class="flow-primary" role="button" :aria-disabled="is_loading" data-interaction="sysSessionExpired.goLoginFresh.click.1" @click="login">Log In Again</view></template></view></template><template #overlays><EventActionLoading :visible="is_loading" label="Ending the expired session…" /></template></SecondaryPageFrame></template>
